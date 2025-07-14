  import { pgTable, text, serial, integer, timestamp, json, pgEnum, smallint, boolean, index } from "drizzle-orm/pg-core";
  import { createInsertSchema } from "drizzle-zod";
  import { z } from "zod";

  // Utility functions for validating IDs
  export function isValidId(id: any): boolean {
    if (id === undefined || id === null) return false;
    const numberId = Number(id);
    return !isNaN(numberId) && numberId > 0 && Number.isInteger(numberId);
  }

  import { RubricCriteriaTypeValue } from './enums';

  // Rubric type definitions
  export interface RubricCriterion {
    id: string;
    type: RubricCriteriaTypeValue;
    name: string;
    description: string;
    maxScore: number;
    weight: number; // percentage weight in the overall assignment grade
  }

  export interface Rubric {
    criteria: RubricCriterion[];
    totalPoints?: number; // May be calculated from criteria or stored directly
    passingThreshold?: number; // minimum percentage to pass
  }

  export interface CriteriaScore {
    criteriaId: string;
    score: number;
    feedback: string;
  }

  /**
   * InstructorContext represents private information provided by instructors
   * that is only shared with the AI for evaluation purposes and never shown to students.
   * It typically contains HTML content created with a rich text editor (QuillJS).
   *
   * Common use cases:
   * - Sample solutions
   * - Evaluation guidelines
   * - Common pitfalls to watch for
   * - Specific feedback patterns to provide
   * - Grading emphasis details
   */
  export interface InstructorContext {
    content: string;        // HTML content from rich text editor
    version?: string;       // Optional version tracking
    lastUpdated?: Date;     // Optional timestamp of last update
  }

  // Additional system configuration types (from HEAD branch)
  export interface LmsSettings {
    enableLms: boolean;
    lmsProvider: string;
    lmsUrl: string;
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    enableGradeSync: boolean;
    enableRoster: boolean;
  }

  export interface StorageSettings {
    storageProvider: string;
    bucketName?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
    retentionPolicy: string;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
  }

  export interface SecuritySettings {
    sessionTimeout: number;
    mfaEnabled: boolean; // Note: users table from main also has mfaEnabled field
    passwordPolicy: string;
    rateLimit: number;
    allowedDomains: string;
    ipRestrictions: string;
  }

  // Enums (ensuring all enums from both branches are present and consistently defined)
  export const userRoleEnum = pgEnum('user_role', ['student', 'instructor', 'admin']);
  export const assignmentStatusEnum = pgEnum('assignment_status', ['active', 'completed', 'upcoming']);
  export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'processing', 'completed', 'failed']);
  export const contentTypeEnum = pgEnum('content_type', ['text', 'image', 'audio', 'video', 'document']);
  export const lmsProviderEnum = pgEnum('lms_provider', ['canvas', 'blackboard', 'moodle', 'd2l']); // From main
  export const syncStatusEnum = pgEnum('sync_status', ['pending', 'in_progress', 'completed', 'failed']); // From main

  // Users (using main's version which includes MFA fields)
  export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    username: text("username").notNull().unique(),
    password: text("password"), 
    email: text("email").notNull().unique(),
    role: userRoleEnum("role").notNull().default('student'),
    auth0Sub: text("auth0_sub").unique(), 
    mitHorizonSub: text("mit_horizon_sub").unique(), 
    emailVerified: boolean("email_verified").default(false).notNull(), 
    mfaEnabled: boolean("mfa_enabled").default(false).notNull(), // From main
    mfaSecret: text("mfa_secret"), // From main
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }, (table) => {
    return {
      usernameIdx: index("idx_users_username").on(table.username),
      emailIdx: index("idx_users_email").on(table.email),
      roleIdx: index("idx_users_role").on(table.role),
      auth0SubIdx: index("idx_users_auth0_sub").on(table.auth0Sub), 
      mitHorizonSubIdx: index("idx_users_mit_horizon_sub").on(table.mitHorizonSub) 
    };
  });

  // Courses
  export const courses = pgTable("courses", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }, (table) => {
    return {
      codeIdx: index("idx_courses_code").on(table.code)
    };
  });

  // Enrollments
  export const enrollments = pgTable("enrollments", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    courseId: integer("course_id").references(() => courses.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }, (table) => {
    return {
      userIdIdx: index("idx_enrollments_user_id").on(table.userId),
      courseIdIdx: index("idx_enrollments_course_id").on(table.courseId),
      userCourseIdx: index("idx_enrollments_user_course").on(table.userId, table.courseId)
    };
  });

  // Assignments
  export const assignments = pgTable("assignments", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    courseId: integer("course_id").references(() => courses.id).notNull(),
    dueDate: timestamp("due_date").notNull(),
    status: assignmentStatusEnum("status").notNull().default('upcoming'),
    shareableCode: text("shareable_code"),
    rubric: json("rubric").$type<Rubric>(),
    instructorContext: json("instructor_context").$type<InstructorContext>(), 
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }, (table) => {
    return {
      courseIdIdx: index("idx_assignments_course_id").on(table.courseId),
      statusIdx: index("idx_assignments_status").on(table.status),
      shareableCodeIdx: index("idx_assignments_shareable_code").on(table.shareableCode),
      dueDateIdx: index("idx_assignments_due_date").on(table.dueDate)
    };
  });

  // Submissions
  export const submissions = pgTable("submissions", {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id").references(() => assignments.id).notNull(),
    userId: integer("user_id").references(() => users.id).notNull(),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    mimeType: text("mime_type"), 
    fileSize: integer("file_size"), 
    contentType: contentTypeEnum("content_type"), 
    content: text("content"),
    notes: text("notes"),
    status: submissionStatusEnum("status").notNull().default('pending'),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }, (table) => {
    return {
      assignmentIdIdx: index("idx_submissions_assignment_id").on(table.assignmentId),
      userIdIdx: index("idx_submissions_user_id").on(table.userId),
      statusIdx: index("idx_submissions_status").on(table.status),
      contentTypeIdx: index("idx_submissions_content_type").on(table.contentType),
      createdAtIdx: index("idx_submissions_created_at").on(table.createdAt),
      userAssignmentIdx: index("idx_submissions_user_assignment").on(table.userId, table.assignmentId),
      assignmentStatusIdx: index("idx_submissions_assignment_status").on(table.assignmentId, table.status),
      contentTypeStatusIdx: index("idx_submissions_content_type_status").on(table.contentType, table.status)
    };
  });

  // Feedback (using main's version which includes rawResponse, modelName, tokenCount)
  export const feedback = pgTable("feedback", {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").references(() => submissions.id).notNull(),
    strengths: json("strengths").notNull().$type<string[]>(),
    improvements: json("improvements").notNull().$type<string[]>(),
    suggestions: json("suggestions").notNull().$type<string[]>(),
    summary: text("summary"),
    score: smallint("score"),
    criteriaScores: json("criteria_scores").$type<CriteriaScore[]>(),
    processingTime: integer("processing_time").notNull(), 
    rawResponse: json("raw_response").$type<Record<string, unknown>>(), // From main
    modelName: text("model_name"), // From main
    tokenCount: integer("token_count"), // From main
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }, (table) => {
    return {
      submissionIdIdx: index("idx_feedback_submission_id").on(table.submissionId),
      scoreIdx: index("idx_feedback_score").on(table.score),
      processingTimeIdx: index("idx_feedback_processing_time").on(table.processingTime),
      createdAtIdx: index("idx_feedback_created_at").on(table.createdAt)
    };
  });

  // System Settings (using HEAD's version with new lms, storage, security columns)
  export const systemSettings = pgTable("system_settings", {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: json("value").$type<Record<string, unknown>>().notNull(),
    lms: json("lms").$type<Record<string, unknown> | null>().default(null),         // New in HEAD
    storage: json("storage").$type<Record<string, unknown> | null>().default(null), // New in HEAD
    security: json("security").$type<Record<string, unknown> | null>().default(null),// New in HEAD
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: integer("updated_by").references(() => users.id),
  }, (table) => {
    return {
      keyIdx: index("idx_system_settings_key").on(table.key)
    };
  });

  // File Type Settings (from HEAD branch)
  export const fileTypeSettings = pgTable("file_type_settings", {
    id: serial("id").primaryKey(),
    context: text("context").notNull(), 
    contextId: integer("context_id"), 
    contentType: contentTypeEnum("content_type").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    extensions: json("extensions").$type<string[]>().notNull(),
    mimeTypes: json("mime_types").$type<string[]>().notNull(),
    maxSize: integer("max_size").notNull(), 
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: integer("updated_by").references(() => users.id),
  }, (table) => {
    return {
      contextTypeIdx: index("idx_file_type_settings_context_type").on(table.context, table.contentType),
      contextIdTypeIdx: index("idx_file_type_settings_context_id_type").on(table.contextId, table.contentType)
    };
  });

  // User Notification Settings (from HEAD branch)
  export const userNotificationSettings = pgTable("user_notification_settings", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull().unique(),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    assignmentNotifications: boolean("assignment_notifications").notNull().default(true),
    feedbackNotifications: boolean("feedback_notifications").notNull().default(true),
    systemNotifications: boolean("system_notifications").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }, (table) => {
    return {
      userIdx: index("idx_user_notification_settings_user").on(table.userId)
    };
  });

  // Newsletter Subscribers (from main branch)
  export const newsletterSubscribers = pgTable("newsletter_subscribers", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }, (table) => {
    return {
      emailIdx: index("idx_newsletter_email").on(table.email)
    };
  });

  // LMS Integration - Credentials (from main branch)
  export const lmsCredentials = pgTable("lms_credentials", {
    id: serial("id").primaryKey(),
    provider: lmsProviderEnum("provider").notNull(),
    name: text("name").notNull(), 
    baseUrl: text("base_url").notNull(), 
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret").notNull(),
    callbackUrl: text("callback_url").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: integer("created_by").references(() => users.id),
  }, (table) => {
    return {
      providerIdx: index("idx_lms_credentials_provider").on(table.provider),
      activeIdx: index("idx_lms_credentials_active").on(table.active),
    };
  });

  // LMS Sync Jobs (from main branch)
  export const lmsSyncJobs = pgTable("lms_sync_jobs", {
    id: serial("id").primaryKey(),
    credentialId: integer("credential_id").references(() => lmsCredentials.id).notNull(),
    syncType: text("sync_type").notNull(), 
    status: syncStatusEnum("status").notNull().default('pending'),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    syncData: json("sync_data").$type<Record<string, unknown>>(), 
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: integer("created_by").references(() => users.id),
  }, (table) => {
    return {
      credentialIdIdx: index("idx_lms_sync_jobs_credential_id").on(table.credentialId),
      statusIdx: index("idx_lms_sync_jobs_status").on(table.status),
      syncTypeIdx: index("idx_lms_sync_jobs_sync_type").on(table.syncType),
      createdAtIdx: index("idx_lms_sync_jobs_created_at").on(table.createdAt),
    };
  });

  // LMS Course Mappings (from main branch)
  export const lmsCourseMappings = pgTable("lms_course_mappings", {
    id: serial("id").primaryKey(),
    courseId: integer("course_id").references(() => courses.id).notNull(),
    credentialId: integer("credential_id").references(() => lmsCredentials.id).notNull(),
    lmsCourseId: text("lms_course_id").notNull(), 
    lmsCourseName: text("lms_course_name"), 
    lastSynced: timestamp("last_synced"),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }, (table) => {
    return {
      courseIdIdx: index("idx_lms_course_mappings_course_id").on(table.courseId),
      credentialIdIdx: index("idx_lms_course_mappings_credential_id").on(table.credentialId),
      courseCredentialIdx: index("idx_lms_course_mappings_course_credential").on(table.courseId, table.credentialId),
      lmsCourseIdIdx: index("idx_lms_course_mappings_lms_course_id").on(table.lmsCourseId),
    };
  });

  // Schema Relationships - (Combined)
  export const usersRelations = {
    // @ts-ignore - Correctly typed at runtime by Drizzle
    submissions: (users: any) => ({ 
      one: { submissions, fields: [users.id], references: [submissions.userId] },
    }),
    // @ts-ignore - Correctly typed at runtime by Drizzle
    enrollments: (users: any) => ({ 
      one: { enrollments, fields: [users.id], references: [enrollments.userId] },
    }),
  };

  export const coursesRelations = {
    // @ts-ignore - Correctly typed at runtime by Drizzle
    assignments: (courses: any) => ({ 
      one: { assignments, fields: [courses.id], references: [assignments.courseId] },
    }),
    // @ts-ignore - Correctly typed at runtime by Drizzle
    enrollments: (courses: any) => ({ 
      one: { enrollments, fields: [courses.id], references: [enrollments.courseId] },
    }),
  };

  export const assignmentsRelations = {
    // @ts-ignore - Correctly typed at runtime by Drizzle
    submissions: (assignments: any) => ({ 
      one: { submissions, fields: [assignments.id], references: [submissions.assignmentId] },
    }),
    // @ts-ignore - Correctly typed at runtime by Drizzle
    course: (assignments: any) => ({ 
      many: { courses, fields: [assignments.courseId], references: [courses.id] },
    }),
  };

  export const submissionsRelations = {
    // @ts-ignore - Correctly typed at runtime by Drizzle
    feedback: (submissions: any) => ({ 
      one: { feedback, fields: [submissions.id], references: [feedback.submissionId] },
    }),
    // @ts-ignore - Correctly typed at runtime by Drizzle
    assignment: (submissions: any) => ({ 
      many: { assignments, fields: [submissions.assignmentId], references: [assignments.id] },
    }),
    // @ts-ignore - Correctly typed at runtime by Drizzle
    user: (submissions: any) => ({ 
      many: { users, fields: [submissions.userId], references: [users.id] },
    }),
  };

  export const feedbackRelations = {
    // @ts-ignore - Correctly typed at runtime by Drizzle
    submission: (feedback: any) => ({ 
      many: { submissions, fields: [feedback.submissionId], references: [submissions.id] },
    }),
  };

  // Insert Schemas (Consolidated)
  export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, mfaEnabled: true, mfaSecret: true }); // From main (includes MFA omissions)
  export const insertCourseSchema = createInsertSchema(courses).omit({ id: true, createdAt: true });
  export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, createdAt: true });
  export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true, createdAt: true, updatedAt: true });
  export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, createdAt: true, updatedAt: true });
  export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });
  export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true }); // For extended systemSettings table
  export const insertFileTypeSettingSchema = createInsertSchema(fileTypeSettings).omit({ id: true, updatedAt: true }); // From HEAD
  export const insertUserNotificationSettingSchema = createInsertSchema(userNotificationSettings).omit({ id: true, updatedAt: true }); // From HEAD
  export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true }); // From main
  export const insertLmsCredentialsSchema = createInsertSchema(lmsCredentials).omit({ id: true, createdAt: true, updatedAt: true }); // From main
  export const insertLmsSyncJobSchema = createInsertSchema(lmsSyncJobs).omit({ id: true, createdAt: true }); // From main
  export const insertLmsCourseMappingSchema = createInsertSchema(lmsCourseMappings).omit({ id: true, createdAt: true, updatedAt: true }); // From main

  // Types (Consolidated)
  export type User = typeof users.$inferSelect;
  export type InsertUser = z.infer<typeof insertUserSchema>;

  export type Course = typeof courses.$inferSelect;
  export type InsertCourse = z.infer<typeof insertCourseSchema>;

  export type Enrollment = typeof enrollments.$inferSelect;
  export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;

  export type Assignment = typeof assignments.$inferSelect;
  export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

  export type Submission = typeof submissions.$inferSelect;
  export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

  export type Feedback = typeof feedback.$inferSelect;
  export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

  export type SystemSetting = typeof systemSettings.$inferSelect;
  export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

  export type FileTypeSetting = typeof fileTypeSettings.$inferSelect; // From HEAD
  export type InsertFileTypeSetting = z.infer<typeof insertFileTypeSettingSchema>; // From HEAD

  export type UserNotificationSetting = typeof userNotificationSettings.$inferSelect; // From HEAD
  export type InsertUserNotificationSetting = z.infer<typeof insertUserNotificationSettingSchema>; // From HEAD

  export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect; // From main
  export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>; // From main

  export type LmsCredential = typeof lmsCredentials.$inferSelect; // From main
  export type InsertLmsCredential = z.infer<typeof insertLmsCredentialsSchema>; // From main

  export type LmsSyncJob = typeof lmsSyncJobs.$inferSelect; // From main
  export type InsertLmsSyncJob = z.infer<typeof insertLmsSyncJobSchema>; // From main

  export type LmsCourseMapping = typeof lmsCourseMappings.$inferSelect; // From main
  export type InsertLmsCourseMapping = z.infer<typeof insertLmsCourseMappingSchema>; // From main