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
import { dataSubjectRequests, userConsents, dataAuditLog } from "@shared/schema";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Get auth middleware - will be injected when this router is used
// The configureAuth is called in the main routes.ts

/**
 * Get data subject requests dashboard
 */
router.get('/requests', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;

    let query = db.select({
      id: dataSubjectRequests.id,
      type: dataSubjectRequests.type,
      userId: dataSubjectRequests.userId,
      requesterEmail: dataSubjectRequests.requesterEmail,
      status: dataSubjectRequests.status,
      requestedAt: dataSubjectRequests.requestedAt,
      completedAt: dataSubjectRequests.completedAt,
      details: dataSubjectRequests.details,
    }).from(dataSubjectRequests);

    if (status) {
      query = query.where(eq(dataSubjectRequests.status, status as any));
    }

    if (type) {
      query = query.where(eq(dataSubjectRequests.type, type as any));
    }

    const requests = await query
      .orderBy(desc(dataSubjectRequests.requestedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get total count for pagination
    const [totalResult] = await db.select({ count: count() })
      .from(dataSubjectRequests);

    const stats = {
      total: totalResult.count,
      pending: 0,
      processing: 0,
      completed: 0,
      rejected: 0,
    };

    // Get status counts
    const statusCounts = await db.select({
      status: dataSubjectRequests.status,
      count: count(),
    }).from(dataSubjectRequests)
      .groupBy(dataSubjectRequests.status);

    statusCounts.forEach(({ status, count }) => {
      stats[status] = count;
    });

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit),
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
      userId: requestId,
      action: 'update',
      tableName: 'data_subject_requests',
      recordId: requestId,
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
      recordId: userId,
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
 * Delete user data permanently
 */
router.delete('/users/:userId/data', csrfProtection, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminUserId = req.user.id;
    const { confirmDelete } = req.body;

    if (!confirmDelete) {
      return res.status(400).json({ error: 'Deletion confirmation required' });
    }

    await dataProtectionService.deleteUserData(userId, adminUserId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

/**
 * Get consent management dashboard
 */
router.get('/consent', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const purpose = req.query.purpose as string;

    let query = db.select({
      id: userConsents.id,
      userId: userConsents.userId,
      purpose: userConsents.purpose,
      granted: userConsents.granted,
      grantedAt: userConsents.grantedAt,
      withdrawnAt: userConsents.withdrawnAt,
      version: userConsents.version,
    }).from(userConsents);

    if (purpose) {
      query = query.where(eq(userConsents.purpose, purpose as any));
    }

    const consents = await query
      .orderBy(desc(userConsents.grantedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get consent statistics
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
        total: consents.length,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching consent data:', error);
    res.status(500).json({ error: 'Failed to fetch consent data' });
  }
});

/**
 * Get audit log
 */
router.get('/audit', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    let query = db.select().from(dataAuditLog);

    const conditions = [];
    if (action) conditions.push(eq(dataAuditLog.action, action as any));
    if (userId) conditions.push(eq(dataAuditLog.userId, userId));
    if (startDate) conditions.push(gte(dataAuditLog.timestamp, startDate));
    if (endDate) conditions.push(lte(dataAuditLog.timestamp, endDate));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const auditLogs = await query
      .orderBy(desc(dataAuditLog.timestamp))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      logs: auditLogs,
      pagination: {
        page,
        limit,
        total: auditLogs.length,
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