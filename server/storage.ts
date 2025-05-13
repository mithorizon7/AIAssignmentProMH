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
  getUserByAuth0Sub(auth0Sub: string): Promise<User | undefined>;
  getUserByMitHorizonSub(mitHorizonSub: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserAuth0Sub(userId: number, auth0Sub: string): Promise<User | undefined>;
  updateUserMitHorizonSub(userId: number, mitHorizonSub: string): Promise<User | undefined>;
  updateUserEmailVerifiedStatus(userId: number, isVerified: boolean): Promise<User | undefined>;
  updateUserRole(userId: number, newRole: string): Promise<User | undefined>;
  
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
      
      const result = await db.execute(columnsQuery);
      const existingColumns = result.rows.map(row => row.column_name);
      
      // Create a new object with only the known fields based on what columns exist
      const safeSubmission: Record<string, any> = {
        assignmentId: insertSubmission.assignmentId,
        userId: insertSubmission.userId,
        fileUrl: insertSubmission.fileUrl,
        fileName: insertSubmission.fileName,
        content: insertSubmission.content,
        notes: insertSubmission.notes,
        status: insertSubmission.status || 'pending',
      };
      
      // Only include the optional columns if they exist in the database
      if (existingColumns.includes('mime_type') && insertSubmission.mimeType) {
        safeSubmission.mimeType = insertSubmission.mimeType;
      }
      
      if (existingColumns.includes('file_size') && insertSubmission.fileSize) {
        safeSubmission.fileSize = insertSubmission.fileSize;
      }
      
      if (existingColumns.includes('content_type') && insertSubmission.contentType) {
        safeSubmission.contentType = insertSubmission.contentType;
      }
      
      const [submission] = await db.insert(submissions).values(safeSubmission).returning();
      console.log(`[INFO] Submission created successfully: ${submission.id}`);
      return submission;
    } catch (error) {
      console.error("[ERROR] Error creating submission:", error);
      
      // Fallback approach if there's a schema issue
      try {
        const sql = `
          INSERT INTO submissions (assignment_id, user_id, file_url, file_name, content, notes, status)
          VALUES (
            ${insertSubmission.assignmentId}, 
            ${insertSubmission.userId}, 
            ${insertSubmission.fileUrl ? `'${insertSubmission.fileUrl.replace(/'/g, "''")}'` : 'NULL'},
            ${insertSubmission.fileName ? `'${insertSubmission.fileName.replace(/'/g, "''")}'` : 'NULL'},
            ${insertSubmission.content ? `'${insertSubmission.content.replace(/'/g, "''")}'` : 'NULL'},
            ${insertSubmission.notes ? `'${insertSubmission.notes.replace(/'/g, "''")}'` : 'NULL'},
            '${insertSubmission.status || 'pending'}'
          )
          RETURNING *;
        `;
        
        console.log("[INFO] Using fallback SQL for submission creation");
        const result = await db.execute(sql);
        const submission = result.rows[0] as Submission;
        console.log(`[INFO] Submission created successfully with fallback: ${submission.id}`);
        return submission;
      } catch (fallbackError) {
        console.error("[ERROR] Fallback submission creation also failed:", fallbackError);
        throw new Error(`Failed to create submission: ${fallbackError.message}`);
      }
    }
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
    try {
      return db.select()
        .from(submissions)
        .where(eq(submissions.assignmentId, assignmentId))
        .orderBy(desc(submissions.createdAt));
    } catch (error) {
      console.error("Error listing submissions for assignment:", error);
      
      // Fallback approach with raw SQL if there's a schema issue
      try {
        const sql = `
          SELECT * FROM submissions 
          WHERE assignment_id = ${assignmentId}
          ORDER BY created_at DESC;
        `;
        
        const result = await db.execute(sql);
        return result.rows as Submission[];
      } catch (innerError) {
        console.error("Fallback query also failed:", innerError);
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
          SET status = '${status.replace(/'/g, "''")}', updated_at = NOW() 
          WHERE id = ${id}
          RETURNING *;
        `;
        
        const result = await db.execute(safeSql);
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
      
      // Fallback approach with raw SQL if there's a schema issue
      try {
        const sql = `
          SELECT * FROM submissions 
          WHERE user_id = ${userId} AND assignment_id = ${assignmentId}
          ORDER BY created_at DESC
          LIMIT 1;
        `;
        
        const result = await db.execute(sql);
        return result.rows[0] as Submission;
      } catch (innerError) {
        console.error("Fallback query for latest submission also failed:", innerError);
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
      
      // Create a properly formatted feedback object with validated arrays
      const validatedFeedback = {
        ...insertFeedback,
        strengths: ensureArray(insertFeedback.strengths),
        improvements: ensureArray(insertFeedback.improvements),
        suggestions: ensureArray(insertFeedback.suggestions),
      };
      
      console.log('[INFO] Creating feedback with validated data structure');
      const result = await db.insert(feedback).values(validatedFeedback).returning();
      return result[0];
    } catch (error: any) {
      console.error('[ERROR] Error creating feedback:', error);
      
      // Try a fallback approach with direct SQL if needed
      try {
        console.log('[INFO] Attempting fallback SQL for feedback creation');
        
        // Convert arrays to JSON strings for SQL insertion
        const strengths = JSON.stringify(
          Array.isArray(insertFeedback.strengths) ? insertFeedback.strengths : []
        );
        const improvements = JSON.stringify(
          Array.isArray(insertFeedback.improvements) ? insertFeedback.improvements : []
        );
        const suggestions = JSON.stringify(
          Array.isArray(insertFeedback.suggestions) ? insertFeedback.suggestions : []
        );
        
        const sql = `
          INSERT INTO feedback (
            submission_id, strengths, improvements, suggestions, 
            overall_feedback, score, criteria_scores, criteria_feedback,
            feedback_type, token_count, model_name, created_at, updated_at
          )
          VALUES (
            ${insertFeedback.submissionId},
            '${strengths.replace(/'/g, "''")}',
            '${improvements.replace(/'/g, "''")}',
            '${suggestions.replace(/'/g, "''")}',
            ${insertFeedback.overallFeedback ? `'${insertFeedback.overallFeedback.replace(/'/g, "''")}'` : 'NULL'},
            ${insertFeedback.score || 'NULL'},
            ${insertFeedback.criteriaScores ? `'${JSON.stringify(insertFeedback.criteriaScores).replace(/'/g, "''")}'` : 'NULL'},
            ${insertFeedback.criteriaFeedback ? `'${JSON.stringify(insertFeedback.criteriaFeedback).replace(/'/g, "''")}'` : 'NULL'},
            ${insertFeedback.feedbackType ? `'${insertFeedback.feedbackType}'` : 'NULL'},
            ${insertFeedback.tokenCount || 'NULL'},
            ${insertFeedback.modelName ? `'${insertFeedback.modelName}'` : 'NULL'},
            NOW(),
            NOW()
          )
          RETURNING *;
        `;
        
        const result = await db.execute(sql);
        if (result.rows.length === 0) {
          throw new Error('Failed to create feedback with fallback SQL');
        }
        
        return result.rows[0] as Feedback;
      } catch (fallbackError: any) {
        console.error('[ERROR] Fallback feedback creation also failed:', fallbackError);
        throw new Error(`Failed to create feedback: ${error.message}`);
      }
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
      
      const result = await db.select()
        .from(fileTypeSettings)
        .where(and(...filters));
      
      const existingSetting = result[0];
      
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
        
        // First check if the setting exists
        const checkSql = `
          SELECT id FROM file_type_settings 
          WHERE content_type = '${setting.contentType}' 
          AND context = '${setting.context}'
          ${setting.contextId ? `AND context_id = ${setting.contextId}` : 'AND context_id IS NULL'};
        `;
        
        const checkResult = await db.execute(checkSql);
        const existingId = checkResult.rows[0]?.id;
        
        const extensions = JSON.stringify(
          Array.isArray(setting.extensions) ? setting.extensions : []
        );
        
        const mimeTypes = JSON.stringify(
          Array.isArray(setting.mimeTypes) ? setting.mimeTypes : []
        );
        
        let sql;
        if (existingId) {
          // Update
          sql = `
            UPDATE file_type_settings
            SET 
              enabled = ${setting.enabled || false},
              extensions = '${extensions.replace(/'/g, "''")}',
              mime_types = '${mimeTypes.replace(/'/g, "''")}',
              max_size = ${setting.maxSize || 'NULL'},
              updated_at = NOW(),
              updated_by = ${setting.updatedBy || 'NULL'}
            WHERE id = ${existingId}
            RETURNING *;
          `;
        } else {
          // Insert
          sql = `
            INSERT INTO file_type_settings (
              content_type, context, context_id, enabled, extensions,
              mime_types, max_size, created_at, updated_at, created_by, updated_by
            )
            VALUES (
              '${setting.contentType}',
              '${setting.context}',
              ${setting.contextId || 'NULL'},
              ${setting.enabled || false},
              '${extensions.replace(/'/g, "''")}',
              '${mimeTypes.replace(/'/g, "''")}',
              ${setting.maxSize || 'NULL'},
              NOW(),
              NOW(),
              ${setting.createdBy || 'NULL'},
              ${setting.updatedBy || 'NULL'}
            )
            RETURNING *;
          `;
        }
        
        const result = await db.execute(sql);
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
