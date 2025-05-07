import { pgTable, text, serial, integer, timestamp, json, pgEnum, smallint, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'instructor']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['active', 'completed', 'upcoming']);
export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'processing', 'completed', 'failed']);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('student'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Courses
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Enrollments
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Assignments
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: assignmentStatusEnum("status").notNull().default('upcoming'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Submissions
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => assignments.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  content: text("content"),
  notes: text("notes"),
  status: submissionStatusEnum("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  processingTime: integer("processing_time").notNull(), // in milliseconds
  rawResponse: json("raw_response").$type<Record<string, any>>(),
  modelName: text("model_name"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema Relationships
export const usersRelations = {
  submissions: (users) => ({
    one: { submissions, fields: [users.id], references: [submissions.userId] },
  }),
  enrollments: (users) => ({
    one: { enrollments, fields: [users.id], references: [enrollments.userId] },
  }),
};

export const coursesRelations = {
  assignments: (courses) => ({
    one: { assignments, fields: [courses.id], references: [assignments.courseId] },
  }),
  enrollments: (courses) => ({
    one: { enrollments, fields: [courses.id], references: [enrollments.courseId] },
  }),
};

export const assignmentsRelations = {
  submissions: (assignments) => ({
    one: { submissions, fields: [assignments.id], references: [submissions.assignmentId] },
  }),
  course: (assignments) => ({
    many: { courses, fields: [assignments.courseId], references: [courses.id] },
  }),
};

export const submissionsRelations = {
  feedback: (submissions) => ({
    one: { feedback, fields: [submissions.id], references: [feedback.submissionId] },
  }),
  assignment: (submissions) => ({
    many: { assignments, fields: [submissions.assignmentId], references: [assignments.id] },
  }),
  user: (submissions) => ({
    many: { users, fields: [submissions.userId], references: [users.id] },
  }),
};

export const feedbackRelations = {
  submission: (feedback) => ({
    many: { submissions, fields: [feedback.submissionId], references: [submissions.id] },
  }),
};

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true, createdAt: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });

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
