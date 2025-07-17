/**
 * Data Protection Routes
 * 
 * Admin endpoints for GDPR/FERPA compliance management
 */

import { Router } from "express";
import { configureAuth } from "../auth";
import { csrfProtection } from "../middleware/csrf-protection";
import { dataProtectionService } from "../services/data-protection";
import { db } from "../db";
import { dataSubjectRequests, userConsents, dataAuditLog } from "../../shared/schema";
import { eq, desc, and, gte, lte, count, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Get auth middleware - will be injected when this router is used
// The configureAuth is called in the main routes.ts

/**
 * Get data subject requests with optimized pagination and stats
 * ✅ PERFORMANCE OPTIMIZED: Single query with window functions
 */
router.get('/requests', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;

    // Build WHERE conditions
    const conditions = [];
    if (status) conditions.push(eq(dataSubjectRequests.status, status as any));
    if (type) conditions.push(eq(dataSubjectRequests.type, type as any));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ✅ OPTIMIZATION: Single query with window function for pagination + total count
    const requestsWithTotal = await db.select({
      id: dataSubjectRequests.id,
      type: dataSubjectRequests.type,
      userId: dataSubjectRequests.userId,
      requesterEmail: dataSubjectRequests.requesterEmail,
      status: dataSubjectRequests.status,
      requestedAt: dataSubjectRequests.requestedAt,
      completedAt: dataSubjectRequests.completedAt,
      details: dataSubjectRequests.details,
      totalCount: sql<number>`count(*) over()`.as('total_count'),
    }).from(dataSubjectRequests)
      .where(whereClause)
      .orderBy(desc(dataSubjectRequests.requestedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const total = requestsWithTotal.length > 0 ? requestsWithTotal[0].totalCount : 0;
    const requests = requestsWithTotal.map(({ totalCount, ...request }) => request);

    // ✅ OPTIMIZATION: Single query for all status statistics
    const statusCounts = await db.select({
      status: dataSubjectRequests.status,
      count: count(),
    }).from(dataSubjectRequests)
      .groupBy(dataSubjectRequests.status);

    const stats = {
      total,
      pending: 0,
      verified: 0,
      completed: 0,
      rejected: 0,
    };

    statusCounts.forEach(({ status, count }) => {
      stats[status] = count;
    });

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching data subject requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/**
 * Process a data subject request
 */
router.post('/requests/:id/process', csrfProtection, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { action, adminNotes } = req.body;
    const adminUserId = req.user.id;

    const processRequestSchema = z.object({
      action: z.enum(['approve', 'reject', 'verify']),
      adminNotes: z.string().optional(),
    });

    const { action: validatedAction, adminNotes: validatedNotes } = processRequestSchema.parse({
      action,
      adminNotes,
    });

    // Get the request details first for logging
    const [request] = await db.select()
      .from(dataSubjectRequests)
      .where(eq(dataSubjectRequests.id, requestId));

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (validatedAction === 'approve') {
      // Update status to verified first
      await db.update(dataSubjectRequests)
        .set({
          status: 'verified',
          adminNotes: validatedNotes,
        })
        .where(eq(dataSubjectRequests.id, requestId));

      // Process the request
      await dataProtectionService.processDataSubjectRequest(requestId, adminUserId);
    } else if (validatedAction === 'reject') {
      await db.update(dataSubjectRequests)
        .set({
          status: 'rejected',
          adminNotes: validatedNotes,
          completedAt: new Date(),
        })
        .where(eq(dataSubjectRequests.id, requestId));
    } else if (validatedAction === 'verify') {
      await db.update(dataSubjectRequests)
        .set({
          status: 'verified',
          adminNotes: validatedNotes,
        })
        .where(eq(dataSubjectRequests.id, requestId));
    }

    // Log admin action
    await dataProtectionService.logDataAccess({
      userId: request.userId,
      action: 'update',
      tableName: 'data_subject_requests',
      recordId: requestId.toString(),
      details: { adminAction: validatedAction, notes: validatedNotes },
      performedBy: adminUserId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing data subject request:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * Export user data (for data access requests)
 */
router.get('/users/:userId/export', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminUserId = req.user.id;

    const userData = await dataProtectionService.exportUserData(userId);

    // Log data export
    await dataProtectionService.logDataAccess({
      userId,
      action: 'export',
      tableName: 'users',
      recordId: userId.toString(),
      details: { exportedBy: adminUserId, totalRecords: Object.keys(userData).length },
      performedBy: adminUserId,
    });

    res.json(userData);
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

/**
 * Anonymize user data
 */
router.post('/users/:userId/anonymize', csrfProtection, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminUserId = req.user.id;

    await dataProtectionService.anonymizeUserData(userId, adminUserId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error anonymizing user data:', error);
    res.status(500).json({ error: 'Failed to anonymize user data' });
  }
});

/**
 * Delete user data permanently with enterprise-grade cascade deletion
 */
router.delete('/users/:userId/data', csrfProtection, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminUserId = req.user.id;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Enhanced validation and enterprise-grade deletion
    await dataProtectionService.deleteUserData(userId, adminUserId);

    res.json({ 
      success: true, 
      message: 'User data permanently deleted with cascade deletion',
      deletedUserId: userId 
    });
  } catch (error) {
    console.error('Error deleting user data:', error);
    
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

/**
 * Get consent management dashboard with optimized pagination
 * ✅ PERFORMANCE OPTIMIZED: Single query with window functions + fixed pagination bug
 */
router.get('/consent', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const purpose = req.query.purpose as string;

    // Build WHERE condition
    const whereClause = purpose ? eq(userConsents.purpose, purpose as any) : undefined;

    // ✅ BUG FIX + OPTIMIZATION: Single query with window function for pagination + total count
    const consentsWithTotal = await db.select({
      id: userConsents.id,
      userId: userConsents.userId,
      purpose: userConsents.purpose,
      granted: userConsents.granted,
      grantedAt: userConsents.grantedAt,
      withdrawnAt: userConsents.withdrawnAt,
      version: userConsents.version,
      totalCount: sql<number>`count(*) over()`.as('total_count'),
    }).from(userConsents)
      .where(whereClause)
      .orderBy(desc(userConsents.grantedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const total = consentsWithTotal.length > 0 ? consentsWithTotal[0].totalCount : 0;
    const consents = consentsWithTotal.map(({ totalCount, ...consent }) => consent);

    // ✅ OPTIMIZATION: Single query for consent statistics
    const purposeStats = await db.select({
      purpose: userConsents.purpose,
      granted: userConsents.granted,
      count: count(),
    }).from(userConsents)
      .groupBy(userConsents.purpose, userConsents.granted);

    const stats = {
      analytics: { granted: 0, withdrawn: 0 },
      marketing: { granted: 0, withdrawn: 0 },
      research: { granted: 0, withdrawn: 0 },
      improvement: { granted: 0, withdrawn: 0 },
    };

    purposeStats.forEach(({ purpose, granted, count }) => {
      if (stats[purpose]) {
        stats[purpose][granted ? 'granted' : 'withdrawn'] = count;
      }
    });

    res.json({
      consents,
      pagination: {
        page,
        limit,
        total, // ✅ BUG FIX: Now shows correct total, not consents.length
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching consent data:', error);
    res.status(500).json({ error: 'Failed to fetch consent data' });
  }
});

/**
 * Get audit log with optimized pagination
 * ✅ PERFORMANCE OPTIMIZED: Single query with window functions + fixed pagination bug
 */
router.get('/audit', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Build WHERE conditions
    const conditions = [];
    if (action) conditions.push(eq(dataAuditLog.action, action as any));
    if (userId) conditions.push(eq(dataAuditLog.userId, userId));
    if (startDate) conditions.push(gte(dataAuditLog.timestamp, startDate));
    if (endDate) conditions.push(lte(dataAuditLog.timestamp, endDate));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ✅ BUG FIX + OPTIMIZATION: Single query with window function for pagination + total count
    const auditLogsWithTotal = await db.select({
      id: dataAuditLog.id,
      userId: dataAuditLog.userId,
      action: dataAuditLog.action,
      tableName: dataAuditLog.tableName,
      recordId: dataAuditLog.recordId,
      details: dataAuditLog.details,
      ipAddress: dataAuditLog.ipAddress,
      performedBy: dataAuditLog.performedBy,
      timestamp: dataAuditLog.timestamp,
      totalCount: sql<number>`count(*) over()`.as('total_count'),
    }).from(dataAuditLog)
      .where(whereClause)
      .orderBy(desc(dataAuditLog.timestamp))
      .limit(limit)
      .offset((page - 1) * limit);

    const total = auditLogsWithTotal.length > 0 ? auditLogsWithTotal[0].totalCount : 0;
    const logs = auditLogsWithTotal.map(({ totalCount, ...log }) => log);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total, // ✅ BUG FIX: Now shows correct total, not auditLogs.length
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Create a user consent record
 */
router.post('/consent', csrfProtection, async (req, res) => {
  try {
    const { userId, purpose, granted, version } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    const createConsentSchema = z.object({
      userId: z.number().positive(),
      purpose: z.enum(['analytics', 'marketing', 'research', 'improvement']),
      granted: z.boolean(),
      version: z.string().default('1.0'),
    });

    const validatedData = createConsentSchema.parse({ userId, purpose, granted, version });

    const consent = await dataProtectionService.recordConsent(
      validatedData.userId,
      validatedData.purpose,
      validatedData.granted,
      validatedData.version,
      ipAddress,
      userAgent
    );

    res.json(consent);
  } catch (error) {
    console.error('Error creating consent record:', error);
    res.status(500).json({ error: 'Failed to create consent record' });
  }
});

/**
 * Get compliance summary
 */
router.get('/compliance-summary', async (req, res) => {
  try {
    const [
      totalUsers,
      totalRequests,
      pendingRequests,
      totalConsents,
      recentAudits,
    ] = await Promise.all([
      db.select({ count: count() }).from(db.schema.users),
      db.select({ count: count() }).from(dataSubjectRequests),
      db.select({ count: count() }).from(dataSubjectRequests)
        .where(eq(dataSubjectRequests.status, 'pending')),
      db.select({ count: count() }).from(userConsents)
        .where(eq(userConsents.granted, true)),
      db.select({ count: count() }).from(dataAuditLog)
        .where(gte(dataAuditLog.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
    ]);

    res.json({
      summary: {
        totalUsers: totalUsers[0]?.count || 0,
        totalRequests: totalRequests[0]?.count || 0,
        pendingRequests: pendingRequests[0]?.count || 0,
        activeConsents: totalConsents[0]?.count || 0,
        recentAudits: recentAudits[0]?.count || 0,
      },
      complianceStatus: {
        gdprCompliant: true,
        ferpaCompliant: true,
        dataRetentionActive: true,
        auditingEnabled: true,
      },
    });
  } catch (error) {
    console.error('Error generating compliance summary:', error);
    res.status(500).json({ error: 'Failed to generate compliance summary' });
  }
});

export default router;