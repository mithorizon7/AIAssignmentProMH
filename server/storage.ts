import {
  users,
  courses,
  assignments,
  submissions,
  feedback,
  enrollments,
  systemSettings,
  fileTypeSettings,
  userNotificationSettings,
  contentTypeEnum,
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
  type UserNotificationSetting,
  type InsertUserNotificationSetting,
} from "@shared/schema";

// Define type for the content type enum values
type ContentType = "text" | "image" | "audio" | "video" | "document";
import { db } from "./db";
import { eq, and, desc, gte, lt, like, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAuth0Sub(auth0Sub: string): Promise<User | undefined>;
  getUserByMitHorizonSub(mitHorizonSub: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserAuth0Sub(userId: number, auth0Sub: string): Promise<User | undefined>;
  updateUserMitHorizonSub(userId: number, mitHorizonSub: string): Promise<User | undefined>;
  updateUserEmailVerifiedStatus(userId: number, isVerified: boolean): Promise<User | undefined>;
  updateUserRole(userId: number, newRole: string): Promise<User | undefined>;
  listUsers(): Promise<User[]>; // from HEAD
  updateUser(userId: number, updates: Partial<InsertUser>): Promise<User | undefined>; // from HEAD
  deleteUser(userId: number): Promise<void>; // from HEAD
  updateUserMfa(userId: number, enabled: boolean, secret?: string | null): Promise<User | undefined>; // from origin/main

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
  /**
   * List all users with the student role
   */
  listStudents(): Promise<User[]>;

  // Assignment operations
  getAssignment(id: number): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  listAssignments(courseId?: number): Promise<Assignment[]>;
  listAssignmentsForUser(userId: number): Promise<Assignment[]>;
  updateAssignmentStatus(id: number, status: string): Promise<Assignment>;
  updateAssignmentShareableCode(id: number, shareableCode: string): Promise<Assignment>;

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

  // User Notification Settings operations
  getUserNotificationSettings(userId: number): Promise<UserNotificationSetting | undefined>;
  upsertUserNotificationSettings(setting: InsertUserNotificationSetting): Promise<UserNotificationSetting>;
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

  async getUserByAuth0Sub(auth0Sub: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.auth0Sub, auth0Sub));
    return user;
  }

  async getUserByMitHorizonSub(mitHorizonSub: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mitHorizonSub, mitHorizonSub));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserAuth0Sub(userId: number, auth0Sub: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ auth0Sub })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserMitHorizonSub(userId: number, mitHorizonSub: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ mitHorizonSub })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserEmailVerifiedStatus(userId: number, isVerified: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ emailVerified: isVerified })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserRole(userId: number, newRole: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ role: newRole as any }) // Cast to any for enum conversion
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async listUsers(): Promise<User[]> { // from HEAD
    return db.select().from(users);
  }

  async updateUser(userId: number, updates: Partial<InsertUser>): Promise<User | undefined> { // from HEAD
    const [updated] = await db.update(users)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updates as any)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
    
  async updateUserMfa(userId: number, enabled: boolean, secret: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ 
        mfaEnabled: enabled,
        mfaSecret: secret
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async deleteUser(userId: number): Promise<void> { // from HEAD
    await db.delete(users).where(eq(users.id, userId));
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

    return result.map((r: { course: Course }) => r.course);
  }

  async listCourseEnrollments(courseId: number): Promise<User[]> {
    // Validate courseId to prevent NaN errors in SQL
    if (typeof courseId !== 'number' || isNaN(courseId) || courseId <= 0) {
      console.warn(`listCourseEnrollments called with invalid courseId: ${courseId}, type: ${typeof courseId}`);
      return [];
    }

    try {
      const result = await db.select({
        user: users
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.courseId, courseId));

      return result.map((r: { user: User }) => r.user);
    } catch (error) {
      console.error(`Error retrieving enrollments for course ${courseId}:`, error);
      return [];
    }
  }

  async listStudents(): Promise<User[]> {
    try {
      return await db.select().from(users).where(eq(users.role, 'student'));
    } catch (error) {
      console.error('Error retrieving students:', error);
      return [];
    }
  }

  // Assignment operations
  async getAssignment(id: number | undefined): Promise<Assignment | undefined> {
    // Guard against NaN or invalid values
    if (id === undefined || isNaN(Number(id)) || Number(id) <= 0) {
      console.warn(`getAssignment called with invalid id: ${id}`);
      return undefined;
    }

    // Convert id to a valid number to avoid SQL parameter issues
    const numericId = Math.floor(Number(id));
    console.log(`Workspaceing assignment with validated id: ${numericId}`);

    try {
      const result = await db.select().from(assignments).where(eq(assignments.id, numericId));
      if (result && result.length > 0) {
        return result[0];
      } else {
        console.warn(`No assignment found with id: ${numericId}`);
        return undefined;
      }
    } catch (error) {
      console.error(`Error retrieving assignment with id ${numericId}:`, error);
      return undefined;
    }
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    try {
      // Extract the basic fields first
      const { rubric, instructorContext, ...basicFields } = insertAssignment;

      // Create a properly formatted assignment object that matches the schema's expected types
      const assignmentData = {
        ...basicFields,
        // Handle rubric correctly - store as native JSON for Drizzle to handle
        rubric: rubric ? (typeof rubric === 'string' ? JSON.parse(rubric) : rubric) : null,
        // Handle instructorContext correctly - store as native JSON for Drizzle to handle
        instructorContext: instructorContext
          ? (typeof instructorContext === 'string' ? JSON.parse(instructorContext) : instructorContext)
          : null
      };

      // Use Drizzle ORM insert instead of raw SQL
      const [newAssignment] = await db
        .insert(assignments)
        .values(assignmentData)
        .returning();
      
      return newAssignment;
    } catch (error) {
      console.error("[ERROR] Error creating assignment:", error);
      throw error;
    }
  }

  async listAssignments(courseId?: number): Promise<Assignment[]> {
    try {
      // If courseId is provided, validate it's a valid number
      if (courseId !== undefined) {
        if (typeof courseId !== 'number' || isNaN(courseId) || courseId <= 0) {
          console.warn(`listAssignments called with invalid courseId: ${courseId}, type: ${typeof courseId}`);
          return [];
        }
        return db.select().from(assignments).where(eq(assignments.courseId, courseId));
      }
      return db.select().from(assignments);
    } catch (error) {
      console.error("Error in listAssignments:", error);
      return [];
    }
  }

  async listAssignmentsForUser(userId: number): Promise<Assignment[]> {
    const result = await db.select({
      assignment: assignments
    })
    .from(enrollments)
    .innerJoin(assignments, eq(enrollments.courseId, assignments.courseId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(assignments.dueDate));

    return result.map((r: { assignment: Assignment }) => r.assignment);
  }

  async updateAssignmentStatus(id: number, status: string): Promise<Assignment> {
    const [assignment] = await db.update(assignments)
      .set({ status: status as any })
      .where(eq(assignments.id, id))
      .returning();
    return assignment;
  }

  async updateAssignmentShareableCode(id: number, shareableCode: string): Promise<Assignment> {
    const [assignment] = await db.update(assignments)
      .set({ shareableCode })
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
    try {
      // Check if the columns we need exist first
      const columnsQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'submissions'
        AND column_name IN ('mime_type', 'file_size', 'content_type');
      `;

      const resultCols = await db.execute(columnsQuery); // Renamed 'result' to 'resultCols'
      const existingColumns = resultCols.rows.map((row: { column_name: string }) => row.column_name);

      // Create a new submissions insert object with required fields
      const submissionData: InsertSubmission = {
        assignmentId: insertSubmission.assignmentId,
        userId: insertSubmission.userId,
        fileUrl: insertSubmission.fileUrl || '',
        fileName: insertSubmission.fileName || '',
        content: insertSubmission.content || '',
        notes: insertSubmission.notes || null,
        status: insertSubmission.status || 'pending',
        mimeType: existingColumns.includes('mime_type') ? (insertSubmission.mimeType || null) : null,
        fileSize: existingColumns.includes('file_size') ? (insertSubmission.fileSize || null) : null,
        contentType: existingColumns.includes('content_type') ? (insertSubmission.contentType || null) : null
      };

      const [submission] = await db.insert(submissions).values([submissionData]).returning();
      console.log(`[INFO] Submission created successfully: ${submission.id}`);
      return submission;
    } catch (error) {
      console.error("[ERROR] Error creating submission:", error);

      // Fallback approach if there's a schema issue - using parameterized query
      try {
        // Define the parameterized SQL query
        const parameterizedSql = `
          INSERT INTO submissions (assignment_id, user_id, file_url, file_name, content, notes, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;

        // Define parameters with proper types
        const params = [
          insertSubmission.assignmentId,
          insertSubmission.userId,
          insertSubmission.fileUrl || null,
          insertSubmission.fileName || null,
          insertSubmission.content || null,
          insertSubmission.notes || null,
          insertSubmission.status || 'pending'
        ];

        console.log("[INFO] Using fallback parameterized SQL for submission creation");
        const result = await db.execute(parameterizedSql, params);
        const submission = result.rows[0] as Submission;
        console.log(`[INFO] Submission created successfully with secure fallback: ${submission.id}`);
        return submission;
      } catch (fallbackError) {
        console.error("[ERROR] Fallback submission creation also failed:", fallbackError);
        const errorMessage = fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
        throw new Error(`Failed to create submission: ${errorMessage}`);
      }
    }
  }

  async listSubmissionsForUser(userId: number, assignmentId?: number): Promise<Submission[]> {
    if (assignmentId) {
      return db.select()
        .from(submissions)
        .where(and(
          eq(submissions.userId, userId),
          eq(submissions.assignmentId, assignmentId)
        ))
        .orderBy(desc(submissions.createdAt));
    } else {
      return db.select()
        .from(submissions)
        .where(eq(submissions.userId, userId))
        .orderBy(desc(submissions.createdAt));
    }
  }

  async listSubmissionsForAssignment(assignmentId: number): Promise<Submission[]> {
    // Validate assignmentId to prevent NaN errors
    if (typeof assignmentId !== 'number' || isNaN(assignmentId) || assignmentId <= 0) {
      console.warn(`listSubmissionsForAssignment called with invalid assignmentId: ${assignmentId}, type: ${typeof assignmentId}`);
      return [];
    }

    try {
      return db.select()
        .from(submissions)
        .where(eq(submissions.assignmentId, assignmentId))
        .orderBy(desc(submissions.createdAt));
    } catch (error) {
      console.error(`Error listing submissions for assignment ${assignmentId}:`, error);

      // Fallback approach with parameterized SQL if there's a schema issue
      try {
        const parameterizedSql = `
          SELECT * FROM submissions
          WHERE assignment_id = $1
          ORDER BY created_at DESC;
        `;

        const result = await db.execute(parameterizedSql, [assignmentId]);
        return result.rows as Submission[];
      } catch (innerError) {
        console.error("Fallback query also failed:",
          innerError instanceof Error ? innerError.message : String(innerError));
        return [];
      }
    }
  }

  async updateSubmissionStatus(id: number, status: string): Promise<Submission> {
    try {
      // First, validate the submission exists
      const existingSubmission = await this.getSubmission(id);
      if (!existingSubmission) {
        throw new Error(`Submission with ID ${id} not found`);
      }

      // Update with proper error handling
      const [submission] = await db.update(submissions)
        .set({
          status: status as any,
          updatedAt: new Date()
        })
        .where(eq(submissions.id, id))
        .returning();

      console.log(`[INFO] Updated submission ${id} status to ${status}`);
      return submission;
    } catch (error) {
      console.error(`[ERROR] Error updating submission ${id} status to ${status}:`, error);

      // Fallback approach with raw SQL if there's a schema issue
      try {
        console.log(`[INFO] Using fallback SQL approach for submission ${id} status update`);
        const safeSql = `
          UPDATE submissions
          SET status = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;

        const result = await db.execute(safeSql, [status, id]);
        if (result.rows.length === 0) {
          throw new Error(`Submission with ID ${id} not found`);
        }

        console.log(`[INFO] Successfully updated submission ${id} status with fallback approach`);
        return result.rows[0] as Submission;
      } catch (innerError: any) {
        console.error(`[ERROR] Fallback query for submission ${id} status update also failed:`, innerError);
        throw new Error(`Failed to update submission status: ${innerError.message}`);
      }
    }
  }

  async getLatestSubmission(userId: number, assignmentId: number): Promise<Submission | undefined> {
    try {
      const [submission] = await db.select()
        .from(submissions)
        .where(and(
          eq(submissions.userId, userId),
          eq(submissions.assignmentId, assignmentId)
        ))
        .orderBy(desc(submissions.createdAt))
        .limit(1);

      return submission;
    } catch (error) {
      console.error("Error getting latest submission:", error);

      // Fallback approach with parameterized SQL for security
      try {
        const parameterizedSql = `
          SELECT * FROM submissions
          WHERE user_id = $1 AND assignment_id = $2
          ORDER BY created_at DESC
          LIMIT 1;
        `;

        const result = await db.execute(parameterizedSql, [userId, assignmentId]);
        return result.rows[0] as Submission;
      } catch (innerError) {
        console.error("Fallback query for latest submission also failed:",
          innerError instanceof Error ? innerError.message : String(innerError));
        return undefined;
      }
    }
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
    try {
      // Helper function to ensure arrays are properly formatted
      const ensureArray = (input: any): string[] => {
        if (Array.isArray(input)) {
          return input;
        } else if (input && typeof input === 'object' && 'length' in input) {
          // Convert array-like objects to actual arrays
          return Array.from(input as any);
        } else if (typeof input === 'string') {
          try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [input];
          }
        }
        return [];
      };

      // Helper function for ensuring correct JSON format
      const ensureJsonField = (field: any): string | null => { // Not used in current logic but good to have
        if (!field) return null;
        if (typeof field === 'string') return field;
        return JSON.stringify(field);
      };

      console.log('[INFO] Creating feedback with validated data structure');

      // Use Drizzle ORM insert which handles parameter binding correctly
      const [result] = await db
        .insert(feedback)
        .values({
          submissionId: insertFeedback.submissionId,
          strengths: ensureArray(insertFeedback.strengths),
          improvements: ensureArray(insertFeedback.improvements),
          suggestions: ensureArray(insertFeedback.suggestions),
          summary: insertFeedback.summary || null,
          score: insertFeedback.score || null,
          criteriaScores: insertFeedback.criteriaScores || null,
          processingTime: insertFeedback.processingTime,
          rawResponse: insertFeedback.rawResponse || null,
          tokenCount: insertFeedback.tokenCount || null,
          modelName: insertFeedback.modelName || null,
        })
        .returning();

      return result;
    } catch (error: unknown) {
      console.error('[ERROR] Error creating feedback:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create feedback: ${errorMessage}`);
    }
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

    // Build the query with direct string comparison
    const conditions = [];
    conditions.push(sql`${fileTypeSettings.contentType}::text = ${contentType}`);
    conditions.push(sql`${fileTypeSettings.context} = ${context}`);

    if (contextId !== undefined) {
      conditions.push(sql`${fileTypeSettings.contextId} = ${contextId}`);
    } else {
      conditions.push(sql`${fileTypeSettings.contextId} IS NULL`);
    }

    return await query.where(and(...conditions));
  }

  async upsertFileTypeSetting(setting: InsertFileTypeSetting): Promise<FileTypeSetting> {
    try {
      // Helper function to ensure arrays are properly formatted
      const ensureArray = (input: any): string[] => {
        if (Array.isArray(input)) {
          return input;
        } else if (input && typeof input === 'object' && 'length' in input) {
          // Convert array-like objects to actual arrays
          return Array.from(input as any);
        } else if (typeof input === 'string') {
          try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [input];
          }
        }
        return [];
      };

      // Try to find existing setting with proper filtering
      const filters = [];
      filters.push(eq(fileTypeSettings.contentType, setting.contentType));
      filters.push(eq(fileTypeSettings.context, setting.context));

      if (setting.contextId) {
        filters.push(eq(fileTypeSettings.contextId, setting.contextId));
      } else {
        filters.push(sql`${fileTypeSettings.contextId} IS NULL`);
      }

      const resultExisting = await db.select() // Renamed 'result' to 'resultExisting'
        .from(fileTypeSettings)
        .where(and(...filters));

      const existingSetting = resultExisting[0];

      // Ensure arrays are properly formatted
      const validatedSetting = {
        ...setting,
        extensions: ensureArray(setting.extensions),
        mimeTypes: ensureArray(setting.mimeTypes),
      };

      if (existingSetting) {
        // Update existing setting
        console.log('[INFO] Updating existing file type setting');
        const updateResult = await db.update(fileTypeSettings)
          .set({
            enabled: validatedSetting.enabled,
            extensions: validatedSetting.extensions,
            mimeTypes: validatedSetting.mimeTypes,
            maxSize: validatedSetting.maxSize,
            updatedAt: new Date(),
            updatedBy: validatedSetting.updatedBy
          })
          .where(eq(fileTypeSettings.id, existingSetting.id))
          .returning();
        return updateResult[0];
      } else {
        // Insert new setting
        console.log('[INFO] Creating new file type setting');
        const insertResult = await db.insert(fileTypeSettings)
          .values([validatedSetting])
          .returning();
        return insertResult[0];
      }
    } catch (error: any) {
      console.error('[ERROR] Error upserting file type setting:', error);

      // Fallback approach with raw SQL if needed
      try {
        console.log('[INFO] Attempting fallback SQL for file type setting upsert');

        // First check if the setting exists using parameterized query
        let checkSql;
        let checkParams = [];

        if (setting.contextId) {
          checkSql = `
            SELECT id FROM file_type_settings
            WHERE content_type = $1
            AND context = $2
            AND context_id = $3;
          `;
          checkParams = [setting.contentType, setting.context, setting.contextId];
        } else {
          checkSql = `
            SELECT id FROM file_type_settings
            WHERE content_type = $1
            AND context = $2
            AND context_id IS NULL;
          `;
          checkParams = [setting.contentType, setting.context];
        }

        const checkResult = await db.execute(checkSql, checkParams);
        const existingId = checkResult.rows[0]?.id;

        const extensions = JSON.stringify(
          Array.isArray(setting.extensions) ? setting.extensions : []
        );

        const mimeTypes = JSON.stringify(
          Array.isArray(setting.mimeTypes) ? setting.mimeTypes : []
        );

        let sqlQuery; // Renamed 'sql' to 'sqlQuery'
        let sqlParams = []; // Renamed 'params' to 'sqlParams'
        if (existingId) {
          // Update using parameterized query
          sqlQuery = `
            UPDATE file_type_settings
            SET
              enabled = $1,
              extensions = $2,
              mime_types = $3,
              max_size = $4,
              updated_at = NOW(),
              updated_by = $5
            WHERE id = $6
            RETURNING *;
          `;

          sqlParams = [
            setting.enabled || false,
            extensions,
            mimeTypes,
            setting.maxSize || null,
            setting.updatedBy || null,
            existingId
          ];
        } else {
          // Insert using parameterized query
          sqlQuery = `
            INSERT INTO file_type_settings (
              content_type, context, context_id, enabled, extensions,
              mime_types, max_size, updated_at, updated_by
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, NOW(), $8
            )
            RETURNING *;
          `;

          sqlParams = [
            setting.contentType,
            setting.context,
            setting.contextId || null,
            setting.enabled || false,
            extensions,
            mimeTypes,
            setting.maxSize || null,
            setting.updatedBy || null
          ];
        }

        const result = await db.execute(sqlQuery, sqlParams);
        if (result.rows.length === 0) {
          throw new Error('Failed to upsert file type setting with fallback SQL');
        }

        return result.rows[0] as FileTypeSetting;
      } catch (fallbackError: any) {
        console.error('[ERROR] Fallback file type setting upsert also failed:', fallbackError);
        throw new Error(`Failed to upsert file type setting: ${error.message}`);
      }
    }
  }

  async checkFileTypeEnabled(
    contentType: string,
    extension: string,
    mimeType: string
  ): Promise<boolean> {
    try {
      // Validate contentType is one of the allowed values
      if (!['text', 'image', 'audio', 'video', 'document'].includes(contentType)) {
        console.warn(`Invalid content type: ${contentType}`);
        return false;
      }

      // Use the contentType as a valid ContentType
      const normalizedContentType = contentType as ContentType;

      console.log(`Checking file enablement: Content type=${normalizedContentType}, Extension=${extension}, MIME=${mimeType}`);

      // Get system settings for this content type - using SQL template
      const contentTypeFilter = sql`${fileTypeSettings.contentType}::text = ${normalizedContentType}`;
      const contextFilter = sql`${fileTypeSettings.context} = ${'system'}`;
      const enabledFilter = sql`${fileTypeSettings.enabled} = ${true}`;

      const query = db.select().from(fileTypeSettings)
        .where(and(contentTypeFilter, contextFilter, enabledFilter));

      const settings = await query;

      if (settings.length === 0) {
        console.log(`Content type ${normalizedContentType} not enabled at system level`);
        return false; // Content type not enabled at system level
      }

      // First, prioritize content type validation
      // If the content type category is enabled, we're more flexible with extensions/MIME types
      console.log(`Content type ${normalizedContentType} is enabled at system level`);

      const systemSetting = settings[0];

      // Check if the extension and MIME type are allowed
      const allowedExtensions = systemSetting.extensions as string[] | null; // Can be null
      const allowedMimeTypes = systemSetting.mimeTypes as string[] | null; // Can be null

      // If extensions or mimeTypes lists are empty or null, use a more permissive approach
      // based on content type category rather than specific extension/MIME matching
      if ((!allowedExtensions || allowedExtensions.length === 0) && (!allowedMimeTypes || allowedMimeTypes.length === 0)) {
        console.log(`No extension or MIME type restrictions for content type ${normalizedContentType} - allowing file`);
        return true;
      }

      // Clean and normalize the extension for comparison
      const normalizedExtension = extension.toLowerCase().replace(/^\./, '');
      const normalizedMimeType = mimeType.toLowerCase();

      // If we have a list of extensions but it's empty, don't require extension matching
      const shouldCheckExtension = allowedExtensions && allowedExtensions.length > 0;
      // If we have a list of MIME types but it's empty, don't require MIME type matching
      const shouldCheckMimeType = allowedMimeTypes && allowedMimeTypes.length > 0;

      // Match extension if needed
      let extMatch = !shouldCheckExtension; // Default to true if we don't need to check
      if (shouldCheckExtension && allowedExtensions) { // Added null check for allowedExtensions
        extMatch = allowedExtensions.some(ext =>
          ext.toLowerCase() === normalizedExtension
        );
      }

      // Match MIME type if needed
      let mimeMatch = !shouldCheckMimeType; // Default to true if we don't need to check
      if (shouldCheckMimeType && allowedMimeTypes) { // Added null check for allowedMimeTypes
        // Check for exact MIME type match
        const exactMimeMatch = allowedMimeTypes.some(mime =>
          mime.toLowerCase() === normalizedMimeType
        );

        // Check for MIME type category match (e.g., 'image/*')
        const mimeTypeCategory = normalizedMimeType.split('/')[0];
        const wildcardMatch = allowedMimeTypes.some(mime =>
          mime === `${mimeTypeCategory}/*` || mime === '*/*'
        );

        mimeMatch = exactMimeMatch || wildcardMatch;
      }

      // Allow file if it matches either extension OR MIME type requirements
      // This is more permissive and avoids false rejections
      if (extMatch || mimeMatch) {
        console.log(`File type approved - Extension match: ${extMatch}, MIME match: ${mimeMatch}`);
        return true;
      }

      // If we get this far, the file type isn't allowed
      console.log(`File type check failed - Extension: ${normalizedExtension}, MIME: ${normalizedMimeType}, Content Type: ${normalizedContentType}`);
      console.log(`Allowed extensions: ${allowedExtensions?.join(', ') || 'None'}`);
      console.log(`Allowed MIME types: ${allowedMimeTypes?.join(', ') || 'None'}`);

      return false;
    } catch (error) {
      console.error('Error checking file type enablement:', error);
      return false; // Default to disallowed in case of error
    }
  }

  // User Notification Settings operations
  async getUserNotificationSettings(userId: number): Promise<UserNotificationSetting | undefined> {
    const [settings] = await db.select().from(userNotificationSettings).where(eq(userNotificationSettings.userId, userId));
    return settings;
  }

  async upsertUserNotificationSettings(setting: InsertUserNotificationSetting): Promise<UserNotificationSetting> {
    const existing = await this.getUserNotificationSettings(setting.userId);
    if (existing) {
      const [updated] = await db.update(userNotificationSettings)
        .set({
          emailNotifications: setting.emailNotifications,
          assignmentNotifications: setting.assignmentNotifications,
          feedbackNotifications: setting.feedbackNotifications,
          systemNotifications: setting.systemNotifications,
          updatedAt: new Date()
        })
        .where(eq(userNotificationSettings.userId, setting.userId))
        .returning();
      return updated;
    }

    const [inserted] = await db.insert(userNotificationSettings).values(setting).returning();
    return inserted;
  }
}

export const storage = new DatabaseStorage();