import { 
  users, 
  courses, 
  assignments, 
  submissions, 
  feedback,
  enrollments,
  systemSettings,
  fileTypeSettings,
  type User, 
  type InsertUser, 
  type Course, 
  type InsertCourse,
  type Assignment,
  type InsertAssignment,
  type Submission,
  type InsertSubmission,
  type Feedback,
  type InsertFeedback,
  type Enrollment,
  type InsertEnrollment,
  type SystemSetting,
  type InsertSystemSetting,
  type FileTypeSetting,
  type InsertFileTypeSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lt, like, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Course operations
  getCourse(id: number): Promise<Course | undefined>;
  getCourseByCode(code: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  listCourses(): Promise<Course[]>;
  
  // Enrollment operations
  getEnrollment(userId: number, courseId: number): Promise<Enrollment | undefined>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  listUserEnrollments(userId: number): Promise<Course[]>;
  listCourseEnrollments(courseId: number): Promise<User[]>;

  // Assignment operations
  getAssignment(id: number): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  listAssignments(courseId?: number): Promise<Assignment[]>;
  listAssignmentsForUser(userId: number): Promise<Assignment[]>;
  updateAssignmentStatus(id: number, status: string): Promise<Assignment>;

  // Submission operations
  getSubmission(id: number): Promise<Submission | undefined>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  listSubmissionsForUser(userId: number, assignmentId?: number): Promise<Submission[]>;
  listSubmissionsForAssignment(assignmentId: number): Promise<Submission[]>;
  updateSubmissionStatus(id: number, status: string): Promise<Submission>;
  getLatestSubmission(userId: number, assignmentId: number): Promise<Submission | undefined>;

  // Feedback operations
  getFeedback(id: number): Promise<Feedback | undefined>;
  getFeedbackBySubmissionId(submissionId: number): Promise<Feedback | undefined>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;

  // System Settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  listSystemSettings(): Promise<SystemSetting[]>;
  
  // File Type Settings operations
  getFileTypeSettings(contentType: string, context?: string, contextId?: number): Promise<FileTypeSetting[]>;
  upsertFileTypeSetting(setting: InsertFileTypeSetting): Promise<FileTypeSetting>;
  checkFileTypeEnabled(contentType: string, extension: string, mimeType: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Course operations
  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async getCourseByCode(code: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.code, code));
    return course;
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const [course] = await db.insert(courses).values(insertCourse).returning();
    return course;
  }

  async listCourses(): Promise<Course[]> {
    return db.select().from(courses);
  }

  // Enrollment operations
  async getEnrollment(userId: number, courseId: number): Promise<Enrollment | undefined> {
    const [enrollment] = await db.select().from(enrollments)
      .where(and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      ));
    return enrollment;
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const [enrollment] = await db.insert(enrollments).values(insertEnrollment).returning();
    return enrollment;
  }

  async listUserEnrollments(userId: number): Promise<Course[]> {
    const result = await db.select({
      course: courses
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId));
    
    return result.map(r => r.course);
  }

  async listCourseEnrollments(courseId: number): Promise<User[]> {
    const result = await db.select({
      user: users
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, courseId));
    
    return result.map(r => r.user);
  }

  // Assignment operations
  async getAssignment(id: number): Promise<Assignment | undefined> {
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
    return assignment;
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const [assignment] = await db.insert(assignments).values(insertAssignment).returning();
    return assignment;
  }

  async listAssignments(courseId?: number): Promise<Assignment[]> {
    if (courseId) {
      return db.select().from(assignments).where(eq(assignments.courseId, courseId));
    }
    return db.select().from(assignments);
  }

  async listAssignmentsForUser(userId: number): Promise<Assignment[]> {
    const result = await db.select({
      assignment: assignments
    })
    .from(enrollments)
    .innerJoin(assignments, eq(enrollments.courseId, assignments.courseId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(assignments.dueDate));
    
    return result.map(r => r.assignment);
  }

  async updateAssignmentStatus(id: number, status: string): Promise<Assignment> {
    const [assignment] = await db.update(assignments)
      .set({ status: status as any })
      .where(eq(assignments.id, id))
      .returning();
    return assignment;
  }

  // Submission operations
  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission;
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db.insert(submissions).values(insertSubmission).returning();
    return submission;
  }

  async listSubmissionsForUser(userId: number, assignmentId?: number): Promise<Submission[]> {
    let query = db.select()
      .from(submissions)
      .where(eq(submissions.userId, userId))
      .orderBy(desc(submissions.createdAt));
    
    if (assignmentId) {
      query = query.where(eq(submissions.assignmentId, assignmentId));
    }
    
    return query;
  }

  async listSubmissionsForAssignment(assignmentId: number): Promise<Submission[]> {
    return db.select()
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId))
      .orderBy(desc(submissions.createdAt));
  }

  async updateSubmissionStatus(id: number, status: string): Promise<Submission> {
    const [submission] = await db.update(submissions)
      .set({ 
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(submissions.id, id))
      .returning();
    return submission;
  }

  async getLatestSubmission(userId: number, assignmentId: number): Promise<Submission | undefined> {
    const [submission] = await db.select()
      .from(submissions)
      .where(and(
        eq(submissions.userId, userId),
        eq(submissions.assignmentId, assignmentId)
      ))
      .orderBy(desc(submissions.createdAt))
      .limit(1);
    
    return submission;
  }

  // Feedback operations
  async getFeedback(id: number): Promise<Feedback | undefined> {
    const result = await db.select().from(feedback).where(eq(feedback.id, id));
    return result[0];
  }

  async getFeedbackBySubmissionId(submissionId: number): Promise<Feedback | undefined> {
    const result = await db.select().from(feedback).where(eq(feedback.submissionId, submissionId));
    return result[0];
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const result = await db.insert(feedback).values(insertFeedback).returning();
    return result[0];
  }

  // System Settings operations
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const result = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return result[0];
  }

  async upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    // Check if setting exists
    const existingSetting = await this.getSystemSetting(setting.key);
    
    if (existingSetting) {
      // Update existing setting
      const result = await db.update(systemSettings)
        .set({
          ...setting,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.key, setting.key))
        .returning();
      return result[0];
    } else {
      // Insert new setting
      const result = await db.insert(systemSettings)
        .values(setting)
        .returning();
      return result[0];
    }
  }

  async listSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }
  
  // File Type Settings operations
  async getFileTypeSettings(
    contentType: string,
    context: string = 'system',
    contextId?: number
  ): Promise<FileTypeSetting[]> {
    // Create base query
    const query = db.select().from(fileTypeSettings);
    
    // Apply filters
    const filters = [];
    filters.push(eq(fileTypeSettings.contentType, contentType));
    filters.push(eq(fileTypeSettings.context, context));
    
    if (contextId !== undefined) {
      filters.push(eq(fileTypeSettings.contextId, contextId));
    } else {
      filters.push(sql`${fileTypeSettings.contextId} IS NULL`);
    }
    
    // Execute query with all filters
    return await query.where(and(...filters));
  }

  async upsertFileTypeSetting(setting: InsertFileTypeSetting): Promise<FileTypeSetting> {
    // Try to find existing setting
    const filters = [];
    filters.push(eq(fileTypeSettings.contentType, setting.contentType));
    filters.push(eq(fileTypeSettings.context, setting.context));
    
    if (setting.contextId) {
      filters.push(eq(fileTypeSettings.contextId, setting.contextId));
    } else {
      filters.push(sql`${fileTypeSettings.contextId} IS NULL`);
    }
    
    const result = await db.select()
      .from(fileTypeSettings)
      .where(and(...filters));
    
    const existingSetting = result[0];
    
    if (existingSetting) {
      // Update existing setting
      const updateResult = await db.update(fileTypeSettings)
        .set({
          enabled: setting.enabled,
          extensions: setting.extensions,
          mimeTypes: setting.mimeTypes,
          maxSize: setting.maxSize,
          updatedAt: new Date(),
          updatedBy: setting.updatedBy
        })
        .where(eq(fileTypeSettings.id, existingSetting.id))
        .returning();
      return updateResult[0];
    } else {
      // Insert new setting
      const insertResult = await db.insert(fileTypeSettings)
        .values(setting)
        .returning();
      return insertResult[0];
    }
  }

  async checkFileTypeEnabled(
    contentType: string,
    extension: string,
    mimeType: string
  ): Promise<boolean> {
    try {
      // Get system settings for this content type
      const query = db.select().from(fileTypeSettings)
        .where(
          and(
            eq(fileTypeSettings.contentType, contentType),
            eq(fileTypeSettings.context, 'system'),
            eq(fileTypeSettings.enabled, true)
          )
        );
      
      const settings = await query;
      
      if (settings.length === 0) {
        return false; // Content type not enabled at system level
      }
      
      const systemSetting = settings[0];
      
      // Check if the extension and MIME type are allowed
      const allowedExtensions = systemSetting.extensions as string[];
      const allowedMimeTypes = systemSetting.mimeTypes as string[];
      
      const extMatch = allowedExtensions.some(ext => 
        ext.toLowerCase() === extension.toLowerCase().replace(/^\./, '')
      );
      
      const mimeMatch = allowedMimeTypes.some(mime => 
        mime.toLowerCase() === mimeType.toLowerCase()
      );
      
      return extMatch && mimeMatch;
    } catch (error) {
      console.error('Error checking file type enablement:', error);
      return false; // Default to disallowed in case of error
    }
  }
}

export const storage = new DatabaseStorage();
