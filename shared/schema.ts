import { pgTable, text, serial, integer, timestamp, json, pgEnum, smallint, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('student'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    usernameIdx: index("idx_users_username").on(table.username),
    emailIdx: index("idx_users_email").on(table.email),
    roleIdx: index("idx_users_role").on(table.role)
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
  rubric: json("rubric"),
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
    createdAtIdx: index("idx_submissions_created_at").on(table.createdAt),
    // Composite index for efficiently finding submissions by user and assignment
    userAssignmentIdx: index("idx_submissions_user_assignment").on(table.userId, table.assignmentId),
    // Composite index for efficiently finding all submissions for an assignment with a specific status
    assignmentStatusIdx: index("idx_submissions_assignment_status").on(table.assignmentId, table.status)
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
  rawResponse: json("raw_response").$type<Record<string, any>>(),
  modelName: text("model_name"),
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

// Schema Relationships
export const usersRelations = {
  submissions: (users: any) => ({
    one: { submissions, fields: [users.id], references: [submissions.userId] },
  }),
  enrollments: (users: any) => ({
    one: { enrollments, fields: [users.id], references: [enrollments.userId] },
  }),
};

export const coursesRelations = {
  assignments: (courses: any) => ({
    one: { assignments, fields: [courses.id], references: [assignments.courseId] },
  }),
  enrollments: (courses: any) => ({
    one: { enrollments, fields: [courses.id], references: [enrollments.courseId] },
  }),
};

export const assignmentsRelations = {
  submissions: (assignments: any) => ({
    one: { submissions, fields: [assignments.id], references: [submissions.assignmentId] },
  }),
  course: (assignments: any) => ({
    many: { courses, fields: [assignments.courseId], references: [courses.id] },
  }),
};

export const submissionsRelations = {
  feedback: (submissions: any) => ({
    one: { feedback, fields: [submissions.id], references: [feedback.submissionId] },
  }),
  assignment: (submissions: any) => ({
    many: { assignments, fields: [submissions.assignmentId], references: [assignments.id] },
  }),
  user: (submissions: any) => ({
    many: { users, fields: [submissions.userId], references: [users.id] },
  }),
};

export const feedbackRelations = {
  submission: (feedback: any) => ({
    many: { submissions, fields: [feedback.submissionId], references: [submissions.id] },
  }),
};

// System Settings
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").$type<any>().notNull(),
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

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true, createdAt: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export const insertFileTypeSettingsSchema = createInsertSchema(fileTypeSettings).omit({ id: true, updatedAt: true });

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
