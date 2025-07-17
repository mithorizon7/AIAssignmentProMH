import express from 'express';
import { db } from '../db';
import { submissions, feedback, users } from '../../shared/schema';
import { sql, desc, eq, and, gte, like, or } from 'drizzle-orm';
import { asyncHandler } from '../lib/error-handler';
import { requireAuth } from '../auth';
import { requireRole } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Protect all admin logs routes
router.use(requireAuth);
router.use(requireRole(['admin']));

// Get system logs
router.get('/system-logs', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    level = 'all',
    search = '',
    startDate,
    endDate
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  // In production, this would query actual log files or logging service
  // For now, generate logs from database activity
  let query = db.select({
    id: submissions.id,
    timestamp: submissions.createdAt,
    level: sql<string>`'info'`,
    message: sql<string>`CONCAT('Submission processed: ', ${submissions.fileName})`,
    source: sql<string>`'submission-service'`,
    details: sql<string>`JSON_OBJECT('userId', ${submissions.userId}, 'assignmentId', ${submissions.assignmentId}, 'status', ${submissions.status})`
  })
  .from(submissions)
  .orderBy(desc(submissions.createdAt))
  .limit(Number(limit))
  .offset(offset);
  
  // Add search filter
  if (search) {
    query = query.where(
      or(
        like(submissions.fileName, `%${search}%`),
        like(submissions.content, `%${search}%`)
      )
    );
  }
  
  // Add date filters
  if (startDate) {
    query = query.where(gte(submissions.createdAt, new Date(startDate as string)));
  }
  if (endDate) {
    query = query.where(gte(submissions.createdAt, new Date(endDate as string)));
  }
  
  const logs = await query;
  
  // Get total count for pagination
  const [totalCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(submissions);
  
  res.json({
    logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount.count,
      pages: Math.ceil(totalCount.count / Number(limit))
    }
  });
}));

// Get audit logs
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    action = 'all',
    search = '',
    startDate,
    endDate
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  // Generate audit logs from user activities
  let query = db.select({
    id: users.id,
    timestamp: users.createdAt,
    action: sql<string>`'user_created'`,
    user: users.email,
    details: sql<string>`JSON_OBJECT('role', ${users.role}, 'email', ${users.email})`,
    ip: sql<string>`'127.0.0.1'`, // Would be actual IP in production
    userAgent: sql<string>`'Unknown'` // Would be actual user agent in production
  })
  .from(users)
  .orderBy(desc(users.createdAt))
  .limit(Number(limit))
  .offset(offset);
  
  // Add search filter
  if (search) {
    query = query.where(
      or(
        like(users.email, `%${search}%`),
        like(users.name, `%${search}%`)
      )
    );
  }
  
  // Add date filters
  if (startDate) {
    query = query.where(gte(users.createdAt, new Date(startDate as string)));
  }
  if (endDate) {
    query = query.where(gte(users.createdAt, new Date(endDate as string)));
  }
  
  const auditLogs = await query;
  
  // Get total count for pagination
  const [totalCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
  
  res.json({
    logs: auditLogs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount.count,
      pages: Math.ceil(totalCount.count / Number(limit))
    }
  });
}));

// Get API metrics
router.get('/api-metrics', asyncHandler(async (req, res) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Calculate metrics from feedback table (represents AI API calls)
  const [submissionMetrics] = await db.select({
    count: sql<number>`COUNT(*)`,
    avgTime: sql<number>`AVG(${feedback.processingTime})`,
    errorRate: sql<number>`(COUNT(CASE WHEN ${feedback.score} = 0 THEN 1 END) * 100.0 / COUNT(*))`
  })
  .from(feedback)
  .where(gte(feedback.createdAt, oneHourAgo));
  
  // Mock other endpoint metrics - in production, this would come from actual API monitoring
  const apiMetrics = [
    {
      endpoint: "/api/submissions",
      method: "POST",
      count: submissionMetrics.count || 0,
      avgTime: Math.round(submissionMetrics.avgTime || 0),
      errorRate: Number(submissionMetrics.errorRate?.toFixed(1)) || 0,
      p95Time: Math.round((submissionMetrics.avgTime || 0) * 2.5)
    },
    {
      endpoint: "/api/ai/analyze",
      method: "POST", 
      count: submissionMetrics.count || 0,
      avgTime: Math.round((submissionMetrics.avgTime || 0) / 1000),
      errorRate: Number(submissionMetrics.errorRate?.toFixed(1)) || 0,
      p95Time: Math.round((submissionMetrics.avgTime || 0) / 1000 * 2.5)
    }
  ];
  
  res.json(apiMetrics);
}));

// Export logs (CSV format)
router.get('/export-logs', asyncHandler(async (req, res) => {
  const { type = 'system', format = 'csv' } = req.query;
  
  let logs;
  if (type === 'system') {
    logs = await db.select({
      timestamp: submissions.createdAt,
      level: sql<string>`'info'`,
      message: sql<string>`CONCAT('Submission processed: ', ${submissions.fileName})`,
      source: sql<string>`'submission-service'`
    })
    .from(submissions)
    .orderBy(desc(submissions.createdAt))
    .limit(1000);
  } else {
    logs = await db.select({
      timestamp: users.createdAt,
      action: sql<string>`'user_created'`,
      user: users.email,
      details: users.role
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(1000);
  }
  
  if (format === 'csv') {
    const csvHeaders = Object.keys(logs[0] || {}).join(',');
    const csvRows = logs.map(log => 
      Object.values(log).map(value => 
        typeof value === 'string' ? `"${value}"` : value
      ).join(',')
    );
    
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } else {
    res.json(logs);
  }
}));

export default router;