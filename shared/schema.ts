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

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'instructor', 'admin']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['active', 'completed', 'upcoming']);
export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'processing', 'completed', 'failed']);
export const contentTypeEnum = pgEnum('content_type', ['text', 'image', 'audio', 'video', 'document']);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password"), // No notNull() - Password is nullable for Auth0 users and MIT Horizon users
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('student'),
  auth0Sub: text("auth0_sub").unique(), // Auth0 subject identifier for our Auth0 tenant - nullable by default
  mitHorizonSub: text("mit_horizon_sub").unique(), // MIT Horizon Auth0 subject identifier - nullable by default
  emailVerified: boolean("email_verified").default(false).notNull(), // Email verification status
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  mfaSecret: text("mfa_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    usernameIdx: index("idx_users_username").on(table.username),
    emailIdx: index("idx_users_email").on(table.email),
    roleIdx: index("idx_users_role").on(table.role),
    auth0SubIdx: index("idx_users_auth0_sub").on(table.auth0Sub), // Index for our Auth0 tenant subject lookups
    mitHorizonSubIdx: index("idx_users_mit_horizon_sub").on(table.mitHorizonSub) // Index for MIT Horizon Auth0 subject lookups
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
    // Composite index for looking up enrollments by both userId and courseId
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
  instructorContext: json("instructor_context").$type<InstructorContext>(), // Hidden information for AI evaluation only
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
  mimeType: text("mime_type"), // Added to store MIME type information
  fileSize: integer("file_size"), // Added to store file size in bytes
  contentType: contentTypeEnum("content_type"), // Added to store the content type category
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
    // Composite index for efficiently finding submissions by user and assignment
    userAssignmentIdx: index("idx_submissions_user_assignment").on(table.userId, table.assignmentId),
    // Composite index for efficiently finding all submissions for an assignment with a specific status
    assignmentStatusIdx: index("idx_submissions_assignment_status").on(table.assignmentId, table.status),
    // Composite index for finding submissions by content type and status
    contentTypeStatusIdx: index("idx_submissions_content_type_status").on(table.contentType, table.status)
  };
});

// Feedback
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").references(() => submissions.id).notNull(),
  strengths: json("strengths").notNull().$type<string[]>(),
  improvements: json("improvements").notNull().$type<string[]>(),
  suggestions: json("suggestions").notNull().$type<string[]>(),
  summary: text("summary"),
  score: smallint("score"),
  criteriaScores: json("criteria_scores").$type<CriteriaScore[]>(),
  processingTime: integer("processing_time").notNull(), // in milliseconds
  /**
   * rawResponse: Stores the complete raw response from the AI model.
   * Structure varies by model and version of model API.
   * For Gemini models, response structure can change between API versions.
   */
  rawResponse: json("raw_response").$type<Record<string, unknown>>(),
  
  /**
   * modelName: The specific AI model used for generating feedback
   */
  modelName: text("model_name"),
  
  /**
   * tokenCount: Number of tokens used in this AI operation.
   * For Gemini models, this may be an estimate derived from:
   * 1. API usage metadata (when available)
   * 2. Response length approximation (when usage metadata is unavailable)
   * Different versions of the Gemini API provide token usage in different formats.
   */
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    submissionIdIdx: index("idx_feedback_submission_id").on(table.submissionId),
    scoreIdx: index("idx_feedback_score").on(table.score),
    processingTimeIdx: index("idx_feedback_processing_time").on(table.processingTime),
    createdAtIdx: index("idx_feedback_created_at").on(table.createdAt)
  };
});

// Schema Relationships - using explicit parameter types to avoid TypeScript errors
export const usersRelations = {
  // @ts-ignore - Correctly typed at runtime by Drizzle
  submissions: (users) => ({
    one: { submissions, fields: [users.id], references: [submissions.userId] },
  }),
  // @ts-ignore - Correctly typed at runtime by Drizzle
  enrollments: (users) => ({
    one: { enrollments, fields: [users.id], references: [enrollments.userId] },
  }),
};

export const coursesRelations = {
  // @ts-ignore - Correctly typed at runtime by Drizzle
  assignments: (courses) => ({
    one: { assignments, fields: [courses.id], references: [assignments.courseId] },
  }),
  // @ts-ignore - Correctly typed at runtime by Drizzle
  enrollments: (courses) => ({
    one: { enrollments, fields: [courses.id], references: [enrollments.courseId] },
  }),
};

export const assignmentsRelations = {
  // @ts-ignore - Correctly typed at runtime by Drizzle
  submissions: (assignments) => ({
    one: { submissions, fields: [assignments.id], references: [submissions.assignmentId] },
  }),
  // @ts-ignore - Correctly typed at runtime by Drizzle
  course: (assignments) => ({
    many: { courses, fields: [assignments.courseId], references: [courses.id] },
  }),
};

export const submissionsRelations = {
  // @ts-ignore - Correctly typed at runtime by Drizzle
  feedback: (submissions) => ({
    one: { feedback, fields: [submissions.id], references: [feedback.submissionId] },
  }),
  // @ts-ignore - Correctly typed at runtime by Drizzle
  assignment: (submissions) => ({
    many: { assignments, fields: [submissions.assignmentId], references: [assignments.id] },
  }),
  // @ts-ignore - Correctly typed at runtime by Drizzle
  user: (submissions) => ({
    many: { users, fields: [submissions.userId], references: [users.id] },
  }),
};

export const feedbackRelations = {
  // @ts-ignore - Correctly typed at runtime by Drizzle
  submission: (feedback) => ({
    many: { submissions, fields: [feedback.submissionId], references: [submissions.id] },
  }),
};

// System Settings
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").$type<Record<string, unknown>>().notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => {
  return {
    keyIdx: index("idx_system_settings_key").on(table.key)
  };
});

// File Type Settings
export const fileTypeSettings = pgTable("file_type_settings", {
  id: serial("id").primaryKey(),
  context: text("context").notNull(), // 'system', 'course', or 'user'
  contextId: integer("context_id"), // ID of the course or user, null for system
  contentType: contentTypeEnum("content_type").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  extensions: json("extensions").$type<string[]>().notNull(),
  mimeTypes: json("mime_types").$type<string[]>().notNull(),
  maxSize: integer("max_size").notNull(), // in bytes
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => {
  return {
    // Composite index for efficient lookup by context and type
    contextTypeIdx: index("idx_file_type_settings_context_type").on(table.context, table.contentType),
    // Composite index for efficient lookup by context ID and type
    contextIdTypeIdx: index("idx_file_type_settings_context_id_type").on(table.contextId, table.contentType)
  };
});

// Newsletter Subscribers
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index("idx_newsletter_email").on(table.email)
  };
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, mfaEnabled: true, mfaSecret: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true, createdAt: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export const insertFileTypeSettingsSchema = createInsertSchema(fileTypeSettings).omit({ id: true, updatedAt: true });
export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true });

// Types
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
export type InsertSystemSetting = z.infer<typeof insertSystemSettingsSchema>;

export type FileTypeSetting = typeof fileTypeSettings.$inferSelect;
export type InsertFileTypeSetting = z.infer<typeof insertFileTypeSettingsSchema>;

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
