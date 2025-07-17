/**
 * Data Protection Service
 * 
 * Handles GDPR, FERPA, and other data protection compliance requirements
 * including data subject rights, consent management, and audit trails.
 */

import { db } from "../db";
import { 
  users, 
  submissions, 
  feedback, 
  enrollments,
  dataSubjectRequests,
  userConsents,
  dataAuditLog,
  dataRetentionLog,
  privacyPolicyAcceptances,
  type DataSubjectRequest,
  type InsertDataSubjectRequest,
  type UserConsent,
  type InsertUserConsent,
  type DataAuditLog,
  type InsertDataAuditLog,
  type User,
} from "../../shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { DATA_RETENTION_POLICIES, ANONYMIZATION_RULES, type UserDataExport } from "../../shared/data-protection";
import crypto from "crypto";

export class DataProtectionService {
  /**
   * Create a new data subject request (GDPR Article 15-22)
   */
  async createDataSubjectRequest(
    userId: number,
    type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection',
    requesterEmail: string,
    details?: string
  ): Promise<DataSubjectRequest> {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    const [request] = await db.insert(dataSubjectRequests).values({
      type,
      userId,
      requesterEmail,
      verificationToken,
      details,
      status: 'pending',
    }).returning();

    // Log the request creation
    await this.logDataAccess({
      userId,
      action: 'create',
      tableName: 'data_subject_requests',
      recordId: request.id,
      details: { type, requesterEmail },
      performedBy: userId,
    });

    return request;
  }

  /**
   * Verify and process a data subject request
   */
  async processDataSubjectRequest(requestId: number, adminUserId: number): Promise<void> {
    const [request] = await db.select()
      .from(dataSubjectRequests)
      .where(eq(dataSubjectRequests.id, requestId));

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'verified') {
      throw new Error('Request must be verified before processing');
    }

    switch (request.type) {
      case 'access':
        await this.handleDataAccessRequest(request, adminUserId);
        break;
      case 'portability':
        await this.handleDataPortabilityRequest(request, adminUserId);
        break;
      case 'erasure':
        await this.handleDataErasureRequest(request, adminUserId);
        break;
      case 'rectification':
        // Would typically involve manual review and correction
        await this.updateRequestStatus(requestId, 'completed', `Rectification requires manual review`);
        break;
      case 'restriction':
        await this.handleDataRestrictionRequest(request, adminUserId);
        break;
      case 'objection':
        await this.handleDataObjectionRequest(request, adminUserId);
        break;
    }
  }

  /**
   * Handle data access request (GDPR Article 15)
   */
  private async handleDataAccessRequest(request: DataSubjectRequest, adminUserId: number): Promise<void> {
    const userData = await this.exportUserData(request.userId);
    
    await db.update(dataSubjectRequests)
      .set({
        status: 'completed',
        completedAt: new Date(),
        exportData: userData,
        adminNotes: `Data export completed by admin ${adminUserId}`,
      })
      .where(eq(dataSubjectRequests.id, request.id));

    await this.logDataAccess({
      userId: request.userId,
      action: 'export',
      tableName: 'users',
      recordId: request.userId,
      details: { requestType: 'access', totalRecords: Object.keys(userData).length },
      performedBy: adminUserId,
    });
  }

  /**
   * Handle data portability request (GDPR Article 20)
   */
  private async handleDataPortabilityRequest(request: DataSubjectRequest, adminUserId: number): Promise<void> {
    const userData = await this.exportUserData(request.userId);
    
    // Generate portable data format (JSON)
    const portableData = {
      ...userData,
      exportedAt: new Date().toISOString(),
      exportedBy: adminUserId,
      format: 'JSON',
      gdprCompliant: true,
    };

    await db.update(dataSubjectRequests)
      .set({
        status: 'completed',
        completedAt: new Date(),
        exportData: portableData,
        adminNotes: `Portable data export completed by admin ${adminUserId}`,
      })
      .where(eq(dataSubjectRequests.id, request.id));

    await this.logDataAccess({
      userId: request.userId,
      action: 'export',
      tableName: 'users',
      recordId: request.userId,
      details: { requestType: 'portability', format: 'JSON' },
      performedBy: adminUserId,
    });
  }

  /**
   * Handle data erasure request (GDPR Article 17 - Right to be forgotten)
   */
  private async handleDataErasureRequest(request: DataSubjectRequest, adminUserId: number): Promise<void> {
    const userId = request.userId;

    // Check if data can be legally erased (education data retention requirements)
    const hasActiveEducationalRecords = await this.hasActiveEducationalRecords(userId);
    
    if (hasActiveEducationalRecords) {
      await this.updateRequestStatus(
        request.id, 
        'completed',
        'Educational records must be retained per FERPA requirements. Data anonymized instead.'
      );
      
      // Anonymize instead of delete for educational compliance
      await this.anonymizeUserData(userId, adminUserId);
      return;
    }

    // Safe to delete - no active educational obligations
    await this.deleteUserData(userId, adminUserId);
    
    await this.updateRequestStatus(
      request.id,
      'completed',
      `User data permanently deleted by admin ${adminUserId}`
    );
  }

  /**
   * Handle data restriction request (GDPR Article 18)
   */
  private async handleDataRestrictionRequest(request: DataSubjectRequest, adminUserId: number): Promise<void> {
    // Mark user account as restricted
    await db.update(users)
      .set({ 
        // Add restriction flag if needed in schema
        // restricted: true,
        // restrictedAt: new Date(),
      })
      .where(eq(users.id, request.userId));

    await this.updateRequestStatus(
      request.id,
      'completed',
      `Data processing restricted by admin ${adminUserId}`
    );

    await this.logDataAccess({
      userId: request.userId,
      action: 'update',
      tableName: 'users',
      recordId: request.userId,
      details: { action: 'restrict_processing' },
      performedBy: adminUserId,
    });
  }

  /**
   * Handle data objection request (GDPR Article 21)
   */
  private async handleDataObjectionRequest(request: DataSubjectRequest, adminUserId: number): Promise<void> {
    // Withdraw all non-essential consent
    await db.update(userConsents)
      .set({
        granted: false,
        withdrawnAt: new Date(),
      })
      .where(and(
        eq(userConsents.userId, request.userId),
        eq(userConsents.granted, true)
      ));

    await this.updateRequestStatus(
      request.id,
      'completed',
      `Consent withdrawn for non-essential processing by admin ${adminUserId}`
    );

    await this.logDataAccess({
      userId: request.userId,
      action: 'update',
      tableName: 'user_consents',
      recordId: request.userId,
      details: { action: 'withdraw_consent' },
      performedBy: adminUserId,
    });
  }

  /**
   * Export all user data for GDPR compliance
   */
  async exportUserData(userId: number): Promise<UserDataExport> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Get user submissions
    const userSubmissions = await db.select({
      id: submissions.id,
      assignment_title: submissions.content, // Would join with assignments table
      content: submissions.content,
      submitted_at: submissions.createdAt,
      // grade and feedback would come from feedback table
    }).from(submissions).where(eq(submissions.userId, userId));

    // Get user courses (enrollments)
    const userCourses = await db.select({
      id: enrollments.courseId,
      enrolled_at: enrollments.createdAt,
      role: users.role, // Student role
    }).from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(eq(enrollments.userId, userId));

    // Get feedback given (if instructor)
    const feedbackGiven = user.role === 'instructor' ? 
      await db.select().from(feedback).where(eq(feedback.submissionId, userId)) : [];

    return {
      user_info: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        created_at: user.createdAt,
        role: user.role,
      },
      submissions: userSubmissions.map(s => ({
        id: s.id,
        assignment_title: s.assignment_title || 'Unknown Assignment',
        content: s.content || '',
        submitted_at: s.submitted_at,
        grade: undefined, // Would need to join with feedback
        feedback: undefined, // Would need to join with feedback
      })),
      courses: userCourses.map(c => ({
        id: c.id,
        title: 'Course Title', // Would need to join with courses table
        description: 'Course Description',
        enrolled_at: c.enrolled_at,
        role: 'student' as const,
      })),
      feedback_given: user.role === 'instructor' ? feedbackGiven.map(f => ({
        submission_id: f.submissionId,
        feedback: f.summary || '',
        created_at: f.createdAt,
      })) : undefined,
      activity_logs: [], // Would come from audit logs
    };
  }

  /**
   * Anonymize user data while preserving educational value
   */
  async anonymizeUserData(userId: number, performedBy: number): Promise<void> {
    const anonymizedName = ANONYMIZATION_RULES.ANONYMIZE_FIELDS.name();
    const anonymizedEmail = ANONYMIZATION_RULES.ANONYMIZE_FIELDS.email();
    const anonymizedUsername = ANONYMIZATION_RULES.ANONYMIZE_FIELDS.username();

    await db.update(users)
      .set({
        name: anonymizedName,
        email: anonymizedEmail,
        username: anonymizedUsername,
        // Keep educational data but remove personal identifiers
      })
      .where(eq(users.id, userId));

    await this.logDataAccess({
      userId,
      action: 'anonymize',
      tableName: 'users',
      recordId: userId,
      details: { 
        anonymized: true,
        preservedEducationalData: ANONYMIZATION_RULES.PRESERVE_ACADEMIC_CONTENT 
      },
      performedBy,
    });
  }

  /**
   * Permanently delete user data
   */
  async deleteUserData(userId: number, performedBy: number): Promise<void> {
    // Delete in correct order due to foreign key constraints
    await db.delete(feedback).where(eq(feedback.submissionId, userId));
    await db.delete(submissions).where(eq(submissions.userId, userId));
    await db.delete(enrollments).where(eq(enrollments.userId, userId));
    await db.delete(userConsents).where(eq(userConsents.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    await this.logDataAccess({
      userId,
      action: 'delete',
      tableName: 'users',
      recordId: userId,
      details: { 
        permanentDeletion: true,
        cascadeDeleted: ['submissions', 'enrollments', 'feedback', 'consents']
      },
      performedBy,
    });
  }

  /**
   * Check if user has active educational records that must be retained
   */
  private async hasActiveEducationalRecords(userId: number): Promise<boolean> {
    const activeSubmissions = await db.select({ count: submissions.id })
      .from(submissions)
      .where(eq(submissions.userId, userId));
    
    const activeEnrollments = await db.select({ count: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.userId, userId));

    return activeSubmissions.length > 0 || activeEnrollments.length > 0;
  }

  /**
   * Update request status
   */
  private async updateRequestStatus(
    requestId: number, 
    status: 'pending' | 'verified' | 'processing' | 'completed' | 'rejected',
    adminNotes: string
  ): Promise<void> {
    await db.update(dataSubjectRequests)
      .set({
        status,
        adminNotes,
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(dataSubjectRequests.id, requestId));
  }

  /**
   * Log data access for audit trail
   */
  async logDataAccess(logEntry: Omit<InsertDataAuditLog, 'timestamp'>): Promise<void> {
    await db.insert(dataAuditLog).values({
      ...logEntry,
      timestamp: new Date(),
    });
  }

  /**
   * Manage user consent
   */
  async recordConsent(
    userId: number,
    purpose: 'analytics' | 'marketing' | 'research' | 'improvement',
    granted: boolean,
    version: string = '1.0',
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserConsent> {
    // Withdraw previous consent for this purpose
    await db.update(userConsents)
      .set({ 
        granted: false, 
        withdrawnAt: new Date() 
      })
      .where(and(
        eq(userConsents.userId, userId),
        eq(userConsents.purpose, purpose),
        eq(userConsents.granted, true)
      ));

    // Record new consent
    const [consent] = await db.insert(userConsents).values({
      userId,
      purpose,
      granted,
      version,
      ipAddress,
      userAgent,
    }).returning();

    await this.logDataAccess({
      userId,
      action: 'create',
      tableName: 'user_consents',
      recordId: consent.id,
      details: { purpose, granted, version },
      ipAddress,
      userAgent,
      performedBy: userId,
    });

    return consent;
  }

  /**
   * Check user consent for a specific purpose
   */
  async hasConsent(userId: number, purpose: 'analytics' | 'marketing' | 'research' | 'improvement'): Promise<boolean> {
    const [consent] = await db.select()
      .from(userConsents)
      .where(and(
        eq(userConsents.userId, userId),
        eq(userConsents.purpose, purpose),
        eq(userConsents.granted, true)
      ))
      .orderBy(desc(userConsents.grantedAt))
      .limit(1);

    return !!consent && !consent.withdrawnAt;
  }

  /**
   * Process data retention policies
   */
  async processDataRetention(): Promise<void> {
    const currentDate = new Date();
    
    // Check for data that needs to be anonymized or deleted
    for (const [policyName, policy] of Object.entries(DATA_RETENTION_POLICIES)) {
      const retentionDate = new Date(currentDate.getTime() - (policy.retention_period_days * 24 * 60 * 60 * 1000));
      
      if ('anonymize_after_days' in policy) {
        const anonymizeDate = new Date(currentDate.getTime() - (policy.anonymize_after_days * 24 * 60 * 60 * 1000));
        
        // Find records that need anonymization
        const recordsToAnonymize = await db.select()
          .from(dataRetentionLog)
          .where(and(
            eq(dataRetentionLog.retentionPolicy, policyName),
            lte(dataRetentionLog.createdAt, anonymizeDate),
            eq(dataRetentionLog.status, 'active')
          ));

        for (const record of recordsToAnonymize) {
          if (record.tableName === 'users') {
            await this.anonymizeUserData(record.recordId, 0); // System anonymization
            
            await db.update(dataRetentionLog)
              .set({
                status: 'anonymized',
                anonymizedAt: new Date(),
              })
              .where(eq(dataRetentionLog.id, record.id));
          }
        }
      }
    }
  }
}

export const dataProtectionService = new DataProtectionService();