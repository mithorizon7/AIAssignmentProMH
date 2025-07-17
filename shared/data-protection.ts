/**
 * Data Protection and Privacy Compliance Module
 * 
 * This module handles GDPR, FERPA, and other data protection requirements
 * for the educational platform handling student data.
 */

import { z } from "zod";

// Data retention policies
export const DATA_RETENTION_POLICIES = {
  // Student submissions and feedback
  STUDENT_SUBMISSIONS: {
    retention_period_days: 2555, // 7 years (FERPA requirement)
    auto_archive_after_days: 1095, // 3 years
    anonymize_after_days: 1825, // 5 years
  },
  
  // User account data
  USER_ACCOUNTS: {
    retention_period_days: 2555, // 7 years
    inactive_deletion_days: 1095, // 3 years of inactivity
    anonymize_after_deletion: true,
  },
  
  // Course data
  COURSE_DATA: {
    retention_period_days: 2555, // 7 years
    archive_after_completion_days: 365, // 1 year after course completion
  },
  
  // Analytics and logs
  ANALYTICS_LOGS: {
    retention_period_days: 730, // 2 years
    anonymize_after_days: 365, // 1 year
  },
  
  // Session and authentication logs
  SESSION_LOGS: {
    retention_period_days: 90, // 3 months
    purge_frequency_hours: 24,
  }
} as const;

// Anonymization rules
export const ANONYMIZATION_RULES = {
  // Keep educational value while removing personal identifiers
  PRESERVE_ACADEMIC_CONTENT: true,
  
  // Fields to anonymize
  ANONYMIZE_FIELDS: {
    name: () => `Anonymous User ${Math.random().toString(36).substring(2, 8)}`,
    email: () => `anonymized_${Math.random().toString(36).substring(2, 8)}@anonymized.edu`,
    username: () => `anon_${Math.random().toString(36).substring(2, 8)}`,
  },
  
  // Fields to preserve for educational purposes
  PRESERVE_FIELDS: [
    'submissions',
    'assignments', 
    'feedback',
    'grades',
    'course_progress'
  ]
};

// GDPR consent types
export const CONSENT_TYPES = {
  ANALYTICS: 'analytics',
  MARKETING: 'marketing', 
  RESEARCH: 'research',
  IMPROVEMENT: 'improvement'
} as const;

// Data subject request types (GDPR Articles 15-22)
export const DATA_SUBJECT_REQUEST_TYPES = {
  ACCESS: 'access',           // Article 15 - Right of access
  RECTIFICATION: 'rectification', // Article 16 - Right to rectification
  ERASURE: 'erasure',         // Article 17 - Right to erasure ("right to be forgotten")
  PORTABILITY: 'portability', // Article 20 - Right to data portability
  RESTRICTION: 'restriction', // Article 18 - Right to restriction of processing
  OBJECTION: 'objection'      // Article 21 - Right to object
} as const;

// Data processing lawful bases under GDPR
export const PROCESSING_LAWFUL_BASES = {
  CONSENT: 'consent',                    // Article 6(1)(a)
  CONTRACT: 'contract',                  // Article 6(1)(b)
  LEGAL_OBLIGATION: 'legal_obligation',  // Article 6(1)(c)
  VITAL_INTERESTS: 'vital_interests',    // Article 6(1)(d)
  PUBLIC_TASK: 'public_task',           // Article 6(1)(e)
  LEGITIMATE_INTERESTS: 'legitimate_interests' // Article 6(1)(f)
} as const;

// User data export structure for GDPR compliance
export interface UserDataExport {
  user_info: {
    id: number;
    name: string;
    email: string;
    username: string;
    created_at: Date | null;
    role: string;
  };
  submissions: Array<{
    id: number;
    assignment_title: string;
    content: string;
    submitted_at: Date | null;
    grade?: number;
    feedback?: string;
  }>;
  courses: Array<{
    id: number;
    title: string;
    description: string;
    enrolled_at: Date | null;
    role: 'student' | 'instructor' | 'admin';
  }>;
  feedback_received: Array<{
    submission_id: number;
    feedback: string;
    score: number | null;
    created_at: Date | null;
  }>;
  feedback_given?: Array<{
    submission_id: number;
    feedback: string;
    created_at: Date | null;
  }>;
  activity_logs: Array<{
    action: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }>;
}

// Data protection validation schemas
export const dataSubjectRequestSchema = z.object({
  type: z.enum(['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection']),
  userId: z.number().positive(),
  requesterEmail: z.string().email(),
  details: z.string().optional(),
});

export const userConsentSchema = z.object({
  userId: z.number().positive(),
  purpose: z.enum(['analytics', 'marketing', 'research', 'improvement']),
  granted: z.boolean(),
  version: z.string().default('1.0'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Privacy policy configuration
export const PRIVACY_POLICY_CONFIG = {
  CURRENT_VERSION: '2.0',
  EFFECTIVE_DATE: '2025-01-01',
  RETENTION_PERIOD_YEARS: 7, // FERPA requirement
  GDPR_REPRESENTATIVE: {
    name: 'Data Protection Officer',
    email: 'dpo@aigrader.com',
    address: 'To be filled by organization'
  },
  SUPERVISORY_AUTHORITY: {
    name: 'Local Data Protection Authority',
    website: 'https://your-local-dpa.gov',
    email: 'info@your-local-dpa.gov'
  }
};

// FERPA compliance requirements
export const FERPA_REQUIREMENTS = {
  // Educational records retention
  RECORD_RETENTION_YEARS: 7,
  
  // Required notifications
  REQUIRED_NOTIFICATIONS: [
    'annual_notification',
    'directory_information_notice',
    'parent_rights_notice'
  ],
  
  // Student rights under FERPA
  STUDENT_RIGHTS: [
    'inspect_records',
    'request_amendment',
    'consent_disclosure',
    'file_complaint'
  ],
  
  // Legitimate educational interests
  LEGITIMATE_INTERESTS: [
    'academic_instruction',
    'academic_support',
    'administrative_services',
    'safety_security'
  ]
};

// Audit trail requirements
export const AUDIT_REQUIREMENTS = {
  // Events that must be logged
  REQUIRED_EVENTS: [
    'data_access',
    'data_modification', 
    'data_deletion',
    'data_export',
    'consent_granted',
    'consent_withdrawn',
    'privacy_policy_acceptance'
  ],
  
  // Audit log retention
  LOG_RETENTION_DAYS: 2555, // 7 years
  
  // Required audit fields
  REQUIRED_FIELDS: [
    'timestamp',
    'user_id',
    'action',
    'table_name',
    'record_id',
    'ip_address',
    'user_agent',
    'performed_by'
  ]
};

export type ConsentType = typeof CONSENT_TYPES[keyof typeof CONSENT_TYPES];
export type DataSubjectRequestType = typeof DATA_SUBJECT_REQUEST_TYPES[keyof typeof DATA_SUBJECT_REQUEST_TYPES];
export type ProcessingLawfulBasis = typeof PROCESSING_LAWFUL_BASES[keyof typeof PROCESSING_LAWFUL_BASES];