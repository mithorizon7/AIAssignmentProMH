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
  
  // Optimized assignment operations with JOINs
  getAssignmentWithDetails(id: number): Promise<any>;
  listAssignmentsWithStats(courseId?: number): Promise<any[]>;
  getAssignmentStats(): Promise<any[]>;

  // Submission operations
  getSubmission(id: number): Promise<Submission | undefined>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  listSubmissionsForUser(userId: number, assignmentId?: number): Promise<Submission[]>;
  listSubmissionsForAssignment(assignmentId: number): Promise<Submission[]>;
  updateSubmissionStatus(id: number, status: string): Promise<Submission>;
  updateSubmission(id: number, updates: Partial<InsertSubmission>): Promise<Submission>;
  getLatestSubmission(userId: number, assignmentId: number): Promise<Submission | undefined>;
  getAssignmentByShareableCode(code: string): Promise<Assignment | undefined>;

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
  
  // Optimized data operations
  getStudentProgress(assignmentId?: number): Promise<any[]>;
  listCoursesWithStats(): Promise<any[]>;
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

  async getAssignmentByShareableCode(code: string): Promise<Assignment | undefined> {
    try {
      console.log(`[PERFORMANCE] Using optimized shareable code lookup for: ${code}`);
      const [assignment] = await db.select()
        .from(assignments)
        .where(eq(assignments.shareableCode, code))
        .limit(1);
      return assignment;
    } catch (error) {
      console.error(`[ERROR] Error getting assignment by shareable code ${code}:`, error);
      throw new Error(`Failed to get assignment by shareable code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // OPTIMIZED: Get comprehensive assignment statistics with single query
  async getAssignmentStats(assignmentId: number, courseId?: number): Promise<{
    totalStudents: number;
    submittedCount: number;
    notStartedCount: number;
    submissionRate: number;
    totalSubmissions: number;
    pendingReviews: number;
    averageScore: number;
    feedbackGenerated: number;
    feedbackViewed: number;
    feedbackViewRate: number;
    submissionsIncrease: number;
    scoreDistribution: { high: number; medium: number; low: number };
    submittedPercentage: number;
    notStartedPercentage: number;
    feedbackViewPercentage: number;
  }> {
    console.log(`[PERFORMANCE] Using optimized assignment stats query for assignment ${assignmentId}`);
    
    try {
      // Single comprehensive query with all statistics
      const statsQuery = sql`
        WITH assignment_stats AS (
          SELECT 
            COUNT(DISTINCT s.user_id) as submitted_count,
            COUNT(s.id) as total_submissions,
            COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.user_id END) as pending_reviews,
            AVG(CASE WHEN f.score IS NOT NULL AND f.score >= 0 AND f.score <= 100 THEN f.score END) as average_score,
            COUNT(f.id) as feedback_generated,
            COUNT(CASE WHEN f.viewed = true THEN f.id END) as feedback_viewed,
            COUNT(CASE WHEN f.score >= 80 THEN f.id END) as high_scores,
            COUNT(CASE WHEN f.score >= 50 AND f.score < 80 THEN f.id END) as medium_scores,
            COUNT(CASE WHEN f.score < 50 THEN f.id END) as low_scores,
            COUNT(CASE WHEN s.created_at >= NOW() - INTERVAL '7 days' THEN s.id END) as submissions_last_week,
            COUNT(CASE WHEN s.created_at >= NOW() - INTERVAL '14 days' AND s.created_at < NOW() - INTERVAL '7 days' THEN s.id END) as submissions_previous_week
          FROM submissions s
          LEFT JOIN feedback f ON s.id = f.submission_id
          WHERE s.assignment_id = ${assignmentId}
        ),
        student_count AS (
          SELECT 
            COUNT(DISTINCT u.id) as total_students
          FROM users u
          INNER JOIN enrollments e ON u.id = e.user_id
          INNER JOIN assignments a ON e.course_id = a.course_id
          WHERE a.id = ${assignmentId}
          AND u.role = 'student'
        )
        SELECT 
          sc.total_students,
          COALESCE(ast.submitted_count, 0) as submitted_count,
          COALESCE(ast.total_submissions, 0) as total_submissions,
          COALESCE(ast.pending_reviews, 0) as pending_reviews,
          COALESCE(ROUND(ast.average_score), 0) as average_score,
          COALESCE(ast.feedback_generated, 0) as feedback_generated,
          COALESCE(ast.feedback_viewed, 0) as feedback_viewed,
          COALESCE(ast.high_scores, 0) as high_scores,
          COALESCE(ast.medium_scores, 0) as medium_scores,
          COALESCE(ast.low_scores, 0) as low_scores,
          COALESCE(ast.submissions_last_week, 0) as submissions_last_week,
          COALESCE(ast.submissions_previous_week, 0) as submissions_previous_week
        FROM student_count sc
        LEFT JOIN assignment_stats ast ON true
      `;

      const result = await db.execute(statsQuery);
      const stats = result.rows[0] as any;

      const totalStudents = Number(stats.total_students) || 0;
      const submittedCount = Number(stats.submitted_count) || 0;
      const totalSubmissions = Number(stats.total_submissions) || 0;
      const pendingReviews = Number(stats.pending_reviews) || 0;
      const averageScore = Number(stats.average_score) || 0;
      const feedbackGenerated = Number(stats.feedback_generated) || 0;
      const feedbackViewed = Number(stats.feedback_viewed) || 0;
      const submissionsLastWeek = Number(stats.submissions_last_week) || 0;
      const submissionsPreviousWeek = Number(stats.submissions_previous_week) || 0;

      const notStartedCount = Math.max(0, totalStudents - submittedCount);
      const submissionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
      const feedbackViewRate = feedbackGenerated > 0 ? Math.round((feedbackViewed / feedbackGenerated) * 100) : 0;
      const submissionsIncrease = submissionsPreviousWeek > 0 
        ? Math.round((submissionsLastWeek - submissionsPreviousWeek) / submissionsPreviousWeek * 100)
        : (submissionsLastWeek > 0 ? 100 : 0);

      const scoreDistribution = {
        high: Number(stats.high_scores) || 0,
        medium: Number(stats.medium_scores) || 0,
        low: Number(stats.low_scores) || 0
      };

      return {
        totalStudents,
        submittedCount,
        notStartedCount,
        submissionRate,
        totalSubmissions,
        pendingReviews,
        averageScore,
        feedbackGenerated,
        feedbackViewed,
        feedbackViewRate,
        submissionsIncrease,
        scoreDistribution,
        submittedPercentage: submissionRate,
        notStartedPercentage: totalStudents > 0 ? Math.round((notStartedCount / totalStudents) * 100) : 0,
        feedbackViewPercentage: feedbackViewRate
      };
    } catch (error) {
      console.error('Error in getAssignmentStats:', error);
      // Return safe defaults
      return {
        totalStudents: 0,
        submittedCount: 0,
        notStartedCount: 0,
        submissionRate: 0,
        totalSubmissions: 0,
        pendingReviews: 0,
        averageScore: 0,
        feedbackGenerated: 0,
        feedbackViewed: 0,
        feedbackViewRate: 0,
        submissionsIncrease: 0,
        scoreDistribution: { high: 0, medium: 0, low: 0 },
        submittedPercentage: 0,
        notStartedPercentage: 0,
        feedbackViewPercentage: 0
      };
    }
  }

  // Submission operations
  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission;
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    console.log("[INFO] Creating submission with data:", JSON.stringify(insertSubmission, null, 2));
    
    try {
      // Use standard Drizzle ORM insert
      const [submission] = await db.insert(submissions)
        .values({
          assignmentId: insertSubmission.assignmentId,
          userId: insertSubmission.userId,
          fileUrl: insertSubmission.fileUrl || '',
          fileName: insertSubmission.fileName || '',
          content: insertSubmission.content || '',
          notes: insertSubmission.notes || null,
          status: (insertSubmission.status || 'pending') as 'pending' | 'processing' | 'completed' | 'failed',
          mimeType: insertSubmission.mimeType || null,
          fileSize: insertSubmission.fileSize || null,
          contentType: insertSubmission.contentType || null,
          fileExtension: insertSubmission.fileExtension || null
        })
        .returning();
      
      console.log(`[INFO] Submission created successfully: ${submission.id}`);
      return submission;
    } catch (error) {
      console.error("[ERROR] Error creating submission:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create submission: ${errorMessage}`);
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

  // OPTIMIZED: Get submissions with feedback in single query
  async listSubmissionsWithFeedbackForUser(userId: number, assignmentId?: number): Promise<(Submission & { feedback: Feedback | null })[]> {
    console.log(`[PERFORMANCE] Using optimized submissions with feedback query for user ${userId}`);
    
    let baseQuery = db.select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
      userId: submissions.userId,
      fileUrl: submissions.fileUrl,
      fileName: submissions.fileName,
      content: submissions.content,
      notes: submissions.notes,
      status: submissions.status,
      mimeType: submissions.mimeType,
      fileSize: submissions.fileSize,
      contentType: submissions.contentType,
      fileExtension: submissions.fileExtension,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
      feedback: feedback
    })
    .from(submissions)
    .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
    .orderBy(desc(submissions.createdAt));

    let query;
    if (assignmentId) {
      query = baseQuery.where(and(
        eq(submissions.userId, userId),
        eq(submissions.assignmentId, assignmentId)
      ));
    } else {
      query = baseQuery.where(eq(submissions.userId, userId));
    }

    const result = await query;
    
    return result.map(row => ({
      id: row.id,
      assignmentId: row.assignmentId,
      userId: row.userId,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      content: row.content,
      notes: row.notes,
      status: row.status,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      contentType: row.contentType,
      fileExtension: row.fileExtension,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      feedback: row.feedback
    }));
  }

  // OPTIMIZED: Get submissions with feedback for assignment (instructor view)
  async listSubmissionsWithFeedbackForAssignment(assignmentId: number): Promise<(Submission & { feedback: Feedback | null })[]> {
    console.log(`[PERFORMANCE] Using optimized submissions with feedback query for assignment ${assignmentId}`);
    
    const result = await db.select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
      userId: submissions.userId,
      fileUrl: submissions.fileUrl,
      fileName: submissions.fileName,
      content: submissions.content,
      notes: submissions.notes,
      status: submissions.status,
      mimeType: submissions.mimeType,
      fileSize: submissions.fileSize,
      contentType: submissions.contentType,
      fileExtension: submissions.fileExtension,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
      feedback: feedback
    })
    .from(submissions)
    .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(desc(submissions.createdAt));

    return result.map(row => ({
      id: row.id,
      assignmentId: row.assignmentId,
      userId: row.userId,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      content: row.content,
      notes: row.notes,
      status: row.status,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      contentType: row.contentType,
      fileExtension: row.fileExtension,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      feedback: row.feedback
    }));
  }

  // OPTIMIZED: Get assignments with submissions for student
  async listAssignmentsWithSubmissionsForUser(userId: number): Promise<any[]> {
    console.log(`[PERFORMANCE] Using optimized assignments with submissions query for user ${userId}`);
    
    const result = await db.select({
      assignment: assignments,
      submission: submissions,
      course: courses
    })
    .from(enrollments)
    .innerJoin(assignments, eq(enrollments.courseId, assignments.courseId))
    .innerJoin(courses, eq(assignments.courseId, courses.id))
    .leftJoin(submissions, and(
      eq(submissions.assignmentId, assignments.id),
      eq(submissions.userId, userId)
    ))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(assignments.dueDate));

    // Group by assignment
    const assignmentMap = new Map();
    
    result.forEach(row => {
      const assignmentId = row.assignment.id;
      
      if (!assignmentMap.has(assignmentId)) {
        assignmentMap.set(assignmentId, {
          ...row.assignment,
          course: row.course,
          submissions: []
        });
      }
      
      if (row.submission) {
        assignmentMap.get(assignmentId).submissions.push(row.submission);
      }
    });

    return Array.from(assignmentMap.values());
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

  async updateSubmission(id: number, updates: Partial<InsertSubmission>): Promise<Submission> {
    try {
      const [submission] = await db.update(submissions)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(submissions.id, id))
        .returning();

      if (!submission) {
        throw new Error(`Submission with ID ${id} not found`);
      }

      return submission;
    } catch (error) {
      console.error(`[ERROR] Error updating submission ${id}:`, error);
      throw new Error(`Failed to update submission: ${error instanceof Error ? error.message : String(error)}`);
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

  // Performance-optimized methods with database-level JOINs and aggregations
  
  async getAssignmentWithDetails(id: number): Promise<any> {
    try {
      const result = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          description: assignments.description,
          instructions: assignments.instructions,
          dueDate: assignments.dueDate,
          maxScore: assignments.maxScore,
          courseId: assignments.courseId,
          shareableCode: assignments.shareableCode,
          status: assignments.status,
          courseName: courses.name,
          courseCode: courses.code,
          submissionCount: sql<number>`COUNT(DISTINCT ${submissions.id})`.as('submissionCount'),
          completedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${submissions.status} = 'completed' THEN ${submissions.id} END)`.as('completedCount'),
          averageScore: sql<number>`AVG(CASE WHEN ${feedback.score} IS NOT NULL THEN ${feedback.score} END)`.as('averageScore')
        })
        .from(assignments)
        .leftJoin(courses, eq(assignments.courseId, courses.id))
        .leftJoin(submissions, eq(assignments.id, submissions.assignmentId))
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .where(eq(assignments.id, id))
        .groupBy(assignments.id, courses.id, courses.name, courses.code);

      return result[0] || null;
    } catch (error) {
      console.error(`[ERROR] Error getting assignment with details for ID ${id}:`, error);
      throw new Error(`Failed to get assignment details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listAssignmentsWithStats(courseId?: number): Promise<any[]> {
    try {
      let query = db
        .select({
          id: assignments.id,
          title: assignments.title,
          description: assignments.description,
          dueDate: assignments.dueDate,
          maxScore: assignments.maxScore,
          courseId: assignments.courseId,
          shareableCode: assignments.shareableCode,
          status: assignments.status,
          courseName: courses.name,
          courseCode: courses.code,
          submissionCount: sql<number>`COUNT(DISTINCT ${submissions.id})`.as('submissionCount'),
          completedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${submissions.status} = 'completed' THEN ${submissions.id} END)`.as('completedCount'),
          averageScore: sql<number>`AVG(CASE WHEN ${feedback.score} IS NOT NULL THEN ${feedback.score} END)`.as('averageScore')
        })
        .from(assignments)
        .leftJoin(courses, eq(assignments.courseId, courses.id))
        .leftJoin(submissions, eq(assignments.id, submissions.assignmentId))
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .groupBy(assignments.id, courses.id, courses.name, courses.code)
        .orderBy(desc(assignments.createdAt));

      if (courseId) {
        query = query.where(eq(assignments.courseId, courseId));
      }

      return await query;
    } catch (error) {
      console.error(`[ERROR] Error listing assignments with stats:`, error);
      throw new Error(`Failed to list assignments with stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAssignmentStats(): Promise<any[]> {
    try {
      return await db
        .select({
          id: assignments.id,
          title: assignments.title,
          courseName: courses.name,
          totalSubmissions: sql<number>`COUNT(DISTINCT ${submissions.id})`.as('totalSubmissions'),
          completedSubmissions: sql<number>`COUNT(DISTINCT CASE WHEN ${submissions.status} = 'completed' THEN ${submissions.id} END)`.as('completedSubmissions'),
          pendingSubmissions: sql<number>`COUNT(DISTINCT CASE WHEN ${submissions.status} = 'pending' THEN ${submissions.id} END)`.as('pendingSubmissions'),
          averageScore: sql<number>`AVG(CASE WHEN ${feedback.score} IS NOT NULL THEN ${feedback.score} END)`.as('averageScore'),
          maxScore: assignments.maxScore,
          dueDate: assignments.dueDate,
          status: assignments.status
        })
        .from(assignments)
        .leftJoin(courses, eq(assignments.courseId, courses.id))
        .leftJoin(submissions, eq(assignments.id, submissions.assignmentId))
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .groupBy(assignments.id, courses.id, courses.name, assignments.title, assignments.maxScore, assignments.dueDate, assignments.status)
        .orderBy(desc(assignments.createdAt));
    } catch (error) {
      console.error(`[ERROR] Error getting assignment stats:`, error);
      throw new Error(`Failed to get assignment stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getStudentProgress(assignmentId?: number): Promise<any[]> {
    try {
      let query = db
        .select({
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          assignmentId: assignments.id,
          assignmentTitle: assignments.title,
          courseName: courses.name,
          submissionCount: sql<number>`COUNT(DISTINCT ${submissions.id})`.as('submissionCount'),
          latestSubmissionDate: sql<Date>`MAX(${submissions.createdAt})`.as('latestSubmissionDate'),
          submissionStatus: sql<string>`CASE WHEN COUNT(${submissions.id}) > 0 THEN 'submitted' ELSE 'not_submitted' END`.as('submissionStatus'),
          score: sql<number>`MAX(${feedback.score})`.as('score'),
          averageScore: sql<number>`AVG(${feedback.score})`.as('averageScore'),
          maxScore: assignments.maxScore
        })
        .from(users)
        .leftJoin(enrollments, eq(users.id, enrollments.userId))
        .leftJoin(courses, eq(enrollments.courseId, courses.id))
        .leftJoin(assignments, eq(courses.id, assignments.courseId))
        .leftJoin(submissions, and(eq(assignments.id, submissions.assignmentId), eq(users.id, submissions.userId)))
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .where(eq(users.role, 'student'))
        .groupBy(users.id, users.name, users.email, assignments.id, assignments.title, assignments.maxScore, courses.name)
        .orderBy(users.name, assignments.title);

      if (assignmentId) {
        query = query.where(eq(assignments.id, assignmentId));
      }

      return await query;
    } catch (error) {
      console.error(`[ERROR] Error getting student progress:`, error);
      throw new Error(`Failed to get student progress: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listCoursesWithStats(): Promise<any[]> {
    try {
      return await db
        .select({
          id: courses.id,
          name: courses.name,
          code: courses.code,
          description: courses.description,
          enrollmentCount: sql<number>`COUNT(DISTINCT ${enrollments.userId})`.as('enrollmentCount'),
          assignmentCount: sql<number>`COUNT(DISTINCT ${assignments.id})`.as('assignmentCount'),
          submissionCount: sql<number>`COUNT(DISTINCT ${submissions.id})`.as('submissionCount'),
          avgCompletionRate: sql<number>`AVG(CASE WHEN ${submissions.status} = 'completed' THEN 1.0 ELSE 0.0 END) * 100`.as('avgCompletionRate')
        })
        .from(courses)
        .leftJoin(enrollments, eq(courses.id, enrollments.courseId))
        .leftJoin(assignments, eq(courses.id, assignments.courseId))
        .leftJoin(submissions, eq(assignments.id, submissions.assignmentId))
        .groupBy(courses.id, courses.name, courses.code, courses.description)
        .orderBy(courses.name);
    } catch (error) {
      console.error(`[ERROR] Error listing courses with stats:`, error);
      throw new Error(`Failed to list courses with stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const storage = new DatabaseStorage();