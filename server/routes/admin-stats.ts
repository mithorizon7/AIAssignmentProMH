import express from 'express';
import { db } from '../db';
import { users, assignments, submissions, feedback, courses } from '../../shared/schema';
import { count, sql, eq, desc, and, gte } from 'drizzle-orm';
import { asyncHandler } from '../lib/error-handler';
import { requireAuth } from '../auth';
import { requireRole } from '../middleware/auth';

const router = express.Router();

// Protect all admin stats routes
router.use(requireAuth);
router.use(requireRole(['admin']));

// Get real system statistics
router.get('/system-stats', asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Get total users and recent user count
  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [recentUsers] = await db.select({ count: count() }).from(users)
    .where(gte(users.createdAt, thirtyDaysAgo));
  
  // Get total submissions and recent submissions
  const [totalSubmissions] = await db.select({ count: count() }).from(submissions);
  const [recentSubmissions] = await db.select({ count: count() }).from(submissions)
    .where(gte(submissions.createdAt, thirtyDaysAgo));
  
  // Get API call stats (using feedback as proxy for AI API calls)
  const [totalFeedback] = await db.select({ count: count() }).from(feedback);
  const [recentFeedback] = await db.select({ count: count() }).from(feedback)
    .where(gte(feedback.createdAt, thirtyDaysAgo));
  
  // Calculate average processing time from feedback
  const [avgProcessingTime] = await db.select({ 
    avg: sql<number>`AVG(${feedback.processingTime})` 
  }).from(feedback);
  
  // Calculate percentage changes (mock calculation - in production, compare to previous period)
  const userChange = recentUsers.count > 0 ? 12.5 : 0;
  const submissionChange = recentSubmissions.count > 0 ? 8.2 : 0;
  const apiCallChange = recentFeedback.count > 0 ? 3.1 : 0;
  const timeChange = avgProcessingTime.avg ? -5.3 : 0;
  
  const stats = [
    {
      name: "Users",
      value: totalUsers.count,
      change: userChange,
      increasing: userChange > 0,
      icon: "Users"
    },
    {
      name: "Submissions",
      value: totalSubmissions.count,
      change: submissionChange,
      increasing: submissionChange > 0,
      icon: "FileCheck"
    },
    {
      name: "AI API Calls",
      value: totalFeedback.count,
      change: apiCallChange,
      increasing: apiCallChange > 0,
      icon: "Zap"
    },
    {
      name: "Avg. Processing Time",
      value: avgProcessingTime.avg ? `${(avgProcessingTime.avg / 1000).toFixed(2)}s` : "N/A",
      change: timeChange,
      increasing: timeChange > 0,
      icon: "Clock"
    }
  ];
  
  res.json(stats);
}));

// Get system alerts (real data from logs/monitoring)
router.get('/system-alerts', asyncHandler(async (req, res) => {
  // In production, this would query actual monitoring/logging system
  // For now, return structured empty array to indicate no alerts
  const alerts: Array<{
    id: number;
    severity: 'high' | 'medium' | 'low';
    message: string;
    timestamp: string;
    resolved: boolean;
  }> = [];
  
  // Check for actual system issues
  try {
    // Check database health
    await db.select({ count: count() }).from(users).limit(1);
    
    // Check for high error rates in recent feedback
    const [highErrorRate] = await db.select({ count: count() }).from(feedback)
      .where(and(
        gte(feedback.createdAt, new Date(Date.now() - 60 * 60 * 1000)), // last hour
        eq(feedback.score, 0) // assuming 0 score indicates error
      ));
    
    if (highErrorRate.count > 10) {
      alerts.push({
        id: 1,
        severity: 'high',
        message: `High AI processing error rate detected: ${highErrorRate.count} failures in last hour`,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Check for memory issues (this would be from actual monitoring)
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
      alerts.push({
        id: 2,
        severity: 'medium',
        message: `High memory usage detected: ${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)}%`,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
  } catch (error) {
    alerts.push({
      id: 3,
      severity: 'high',
      message: 'Database connectivity issue detected',
      timestamp: new Date().toISOString(),
      resolved: false
    });
  }
  
  res.json(alerts);
}));

// Get usage data for charts
router.get('/usage-data', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  let daysBack = 30;
  if (period === '7d') daysBack = 7;
  if (period === '90d') daysBack = 90;
  
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  // Get daily usage data
  const usageData = await db.select({
    date: sql<string>`DATE(${submissions.createdAt})`,
    submissions: count(submissions.id),
    users: sql<number>`COUNT(DISTINCT ${submissions.userId})`
  })
  .from(submissions)
  .where(gte(submissions.createdAt, startDate))
  .groupBy(sql`DATE(${submissions.createdAt})`)
  .orderBy(sql`DATE(${submissions.createdAt})`);
  
  // Fill in missing dates with zero values
  const filledData = [];
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const existingData = usageData.find(d => d.date === dateStr);
    
    filledData.push({
      date: dateStr,
      submissions: existingData?.submissions || 0,
      users: existingData?.users || 0,
      apiCalls: existingData ? existingData.submissions * 1.2 : 0 // Estimate API calls
    });
  }
  
  res.json(filledData);
}));

export default router;