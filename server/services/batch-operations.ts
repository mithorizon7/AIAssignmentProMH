import { storage } from '../storage';
import { logger } from '../lib/error-handler';
import { submissions, feedback, users, courses, assignments, enrollments } from '../../shared/schema';
import { db } from '../db';
import { eq, and, lt, desc, sql, count, inArray } from 'drizzle-orm';
import { stringify } from 'csv-stringify';
import type { InferSelectModel } from 'drizzle-orm';

/**
 * Type definitions for batch operations
 */
interface Student {
  id: number;
  userId: number;
  name: string;
  email: string;
}

interface SubmissionRecord {
  userId: number;
  assignmentId: number;
  submissionId: number;
}

/**
 * Service for efficiently handling batch operations on large datasets
 * These operations are optimized for handling classes with thousands of students
 */
export class BatchOperationsService {
  // Maximum number of records to process in a single batch
  private batchSize = 1000;
  
  /**
   * Get comprehensive progress data for all students in a course
   * This implementation is optimized for large classes with thousands of students
   * @param courseId The course ID to get progress for
   */
  async getUserProgressForCourse(courseId: number): Promise<{
    courseId: number;
    courseName: string;
    totalStudents: number;
    totalAssignments: number;
    avgCompletionRate: number;
    avgScore: number;
    assignments: Array<{
      id: number;
      title: string;
      description: string | null;
      courseId: number;
      dueDate: Date;
      status: string;
      shareableCode: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    students: Array<{
      userId: number;
      name: string;
      email: string;
      completionRate: number;
      averageScore: number;
      completedAssignments: number;
      totalAssignments: number;
      submissions: Array<{
        id: number;
        userId: number;
        assignmentId: number;
        status: string;
        createdAt: Date;
        feedback: {
          id: number;
          submissionId: number;
          score: number | null;
          strengths: string[];
          improvements: string[];
          suggestions: string[];
          summary: string | null;
          criteriaScores: Array<{
            criteriaId: string;
            score: number;
            feedback: string;
          }> | null;
          processingTime: number;
          modelName: string | null;
          tokenCount: number | null;
          createdAt: Date;
        } | null;
      }>;
    }>;
  }> {
    // Get course information
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error(`Course ${courseId} not found`);
    }
    
    // Get all assignments for this course
    const courseAssignments = await db
      .select()
      .from(assignments)
      .where(eq(assignments.courseId, courseId))
      .orderBy(assignments.dueDate);
    
    // Get all enrollments for this course with student details
    const enrolledStudents = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .innerJoin(enrollments, eq(users.id, enrollments.userId))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(users.name);
    
    // ✅ PERFORMANCE FIX: Single optimized query eliminates N+1 batch pattern
    console.log(`[PERFORMANCE] Using optimized single-query approach for course ${courseId} progress (eliminating N+1 batch queries)`);
    
    // Get ALL submissions and feedback for this course in a single LEFT JOIN query
    const allSubmissionsWithFeedback = await db
      .select({
        // Submission fields
        submissionId: submissions.id,
        userId: submissions.userId,
        assignmentId: submissions.assignmentId,
        status: submissions.status,
        submissionCreatedAt: submissions.createdAt,
        // Feedback fields (LEFT JOIN allows null feedback)
        feedbackId: feedback.id,
        score: feedback.score,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        suggestions: feedback.suggestions,
        summary: feedback.summary,
        criteriaScores: feedback.criteriaScores,
        processingTime: feedback.processingTime,
        modelName: feedback.modelName,
        tokenCount: feedback.tokenCount,
        feedbackCreatedAt: feedback.createdAt
      })
      .from(submissions)
      .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(and(
        eq(assignments.courseId, courseId),
        inArray(submissions.userId, enrolledStudents.map((s: { userId: number }) => s.userId))
      ))
      .orderBy(submissions.createdAt);
    
    // Group submissions by student using Map for O(1) lookup
    const submissionsByStudent = new Map<number, any[]>();
    
    for (const row of allSubmissionsWithFeedback) {
      if (!submissionsByStudent.has(row.userId)) {
        submissionsByStudent.set(row.userId, []);
      }
      
      // Build submission object with feedback
      const submissionWithFeedback = {
        id: row.submissionId,
        userId: row.userId,
        assignmentId: row.assignmentId,
        status: row.status,
        createdAt: row.submissionCreatedAt,
        feedback: row.feedbackId ? {
          id: row.feedbackId,
          submissionId: row.submissionId,
          score: row.score,
          strengths: row.strengths,
          improvements: row.improvements,
          suggestions: row.suggestions,
          summary: row.summary,
          criteriaScores: row.criteriaScores,
          processingTime: row.processingTime,
          modelName: row.modelName,
          tokenCount: row.tokenCount,
          createdAt: row.feedbackCreatedAt
        } : null
      };
      
      submissionsByStudent.get(row.userId)!.push(submissionWithFeedback);
    }
    
    // Calculate progress for all students in memory (no additional database queries)
    const studentsWithProgress = enrolledStudents.map(student => {
      const studentSubmissions = submissionsByStudent.get(student.userId) || [];
      
      // Calculate completion rate (completed submissions / total assignments)
      const completedCount = studentSubmissions.filter((s: { status: string }) => s.status === 'completed').length;
      const completionRate = courseAssignments.length > 0
        ? completedCount / courseAssignments.length
        : 0;
      
      // Calculate average score across all submissions with feedback
      const submissionsWithScores = studentSubmissions.filter((s: { 
        feedback?: { score?: number } 
      }) => s.feedback && typeof s.feedback.score === 'number');
      
      const totalScore = submissionsWithScores.reduce(
        (sum: number, s: { feedback: { score?: number } }) => sum + (s.feedback.score || 0), 
        0
      );
      
      const averageScore = submissionsWithScores.length > 0
        ? totalScore / submissionsWithScores.length
        : 0;
      
      return {
        userId: student.userId,
        name: student.name,
        email: student.email,
        completionRate,
        averageScore,
        completedAssignments: completedCount,
        totalAssignments: courseAssignments.length,
        submissions: studentSubmissions
      };
    });
    
    // Calculate course-level statistics from processed data
    const avgCompletionRate = studentsWithProgress.length > 0
      ? studentsWithProgress.reduce((sum, s) => sum + s.completionRate, 0) / studentsWithProgress.length
      : 0;
    
    const avgScore = studentsWithProgress.length > 0
      ? studentsWithProgress.reduce((sum, s) => sum + s.averageScore, 0) / studentsWithProgress.length
      : 0;
    
    // Return comprehensive progress data
    return {
      courseId,
      courseName: course.name,
      totalStudents: enrolledStudents.length,
      totalAssignments: courseAssignments.length,
      avgCompletionRate,
      avgScore,
      assignments: courseAssignments,
      students: studentsWithProgress
    };
  }
  
  /**
   * Batch enroll multiple students in a course
   * @param courseId The course ID to enroll students in
   * @param studentIds Array of student IDs to enroll
   */
  async batchEnrollStudents(courseId: number, studentIds: number[]): Promise<{ success: number; failed: number }> {
    // Validate the course
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error(`Course ${courseId} not found`);
    }
    
    // Process in batches to avoid memory issues with large student lists
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < studentIds.length; i += this.batchSize) {
      const batchIds = studentIds.slice(i, i + this.batchSize);
      
      // Bulk check which students already exist in the course
      const existingEnrollments = await db
        .select({ userId: enrollments.userId })
        .from(enrollments)
        .where(and(
          eq(enrollments.courseId, courseId),
          inArray(enrollments.userId, batchIds)
        ));
      
      // Create a set of already enrolled student IDs for faster lookup
      const existingStudentIds = new Set(existingEnrollments.map((e: { userId: number }) => e.userId));
      
      // Filter out students who are already enrolled
      const studentsToEnroll = batchIds.filter(id => !existingStudentIds.has(id));
      
      // Process enrollments
      try {
        // Create enrollment records in bulk
        const enrollmentData = studentsToEnroll.map(userId => ({
          userId,
          courseId,
        }));
        
        if (enrollmentData.length > 0) {
          // Use bulk insert
          const result = await db
            .insert(enrollments)
            .values(enrollmentData)
            .returning({ id: enrollments.id });
          
          successCount += result.length;
        }
        
        // Count already enrolled as "successful" since they're already enrolled
        successCount += existingStudentIds.size;
      } catch (error) {
        logger.error(`Error in batch enrollment:`, error);
        failedCount += studentsToEnroll.length;
      }
    }
    
    return { success: successCount, failed: failedCount };
  }
  
  /**
   * Generate a CSV for assignment grades across a course
   * Optimized for large classes
   * @param courseId The course ID to export grades for
   */
  async exportCourseGrades(courseId: number): Promise<string> {
    // Get all assignments for this course
    const courseAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title
      })
      .from(assignments)
      .where(eq(assignments.courseId, courseId))
      .orderBy(assignments.dueDate);
    
    // Get all enrolled students
    const enrolledStudents = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email
      })
      .from(users)
      .innerJoin(enrollments, eq(users.id, enrollments.userId))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(users.name);
    
    // For CSV generation
    const csvHeader = [
      'Student ID', 
      'Name', 
      'Email',
      ...courseAssignments.map((a: { title: string }) => a.title)
    ];
    
    // Initialize the data array for CSV
    const csvData: (string | number | null)[][] = [];
    
    // Process in chunks to avoid memory issues with large classes
    // Cast enrolledStudents to Student[] type for proper typing
    const typedStudents = enrolledStudents as Student[];
    const studentChunks = this.chunkArray(typedStudents, this.batchSize);
    
    for (const studentChunk of studentChunks) {
      // Get all student IDs in this chunk with proper typing
      const studentIds = studentChunk.map(s => s.id);
      
      // Get all assignments and their most recent submission scores in bulk
      // This is much more efficient than querying each student+assignment combination
      const submissionScores = await this.getSubmissionScores(studentIds, courseAssignments.map((a: { id: number }) => a.id));
      
      // Generate a row for each student
      for (const student of studentChunk) {
        const studentRow = [
          student.id.toString(),
          student.name,
          student.email
        ];
        
        // Add the scores for each assignment
        for (const assignment of courseAssignments) {
          // Look up the score using a composite key
          const key = `${student.id}-${assignment.id}`;
          const score = submissionScores.get(key);
          // Convert null to string 'N/A' for consistent CSV data typing
          studentRow.push(score !== undefined ? score?.toString() || 'N/A' : 'N/A');
        }
        
        csvData.push(studentRow);
      }
    }
    
    // Generate CSV
    return new Promise((resolve, reject) => {
      stringify(
        [csvHeader, ...csvData], 
        { 
          header: false,
          quoted: true 
        }, 
        (err, output) => {
          if (err) reject(err);
          else resolve(output);
        }
      );
    });
  }
  
  /**
   * Get submission scores for multiple students and assignments at once
   * This is much more efficient than individual queries
   */
  private async getSubmissionScores(
    studentIds: number[],
    assignmentIds: number[]
  ): Promise<Map<string, number | null>> {
    // ✅ LOGIC FIX: Use ROW_NUMBER() window function to get ONLY the latest submission per student-assignment pair
    console.log(`[PERFORMANCE] Using ROW_NUMBER() window function to correctly isolate latest submissions for grade export`);
    
    const latestSubmissionsWithScores = await db.execute(sql`
      WITH latest_submissions AS (
        SELECT 
          s.id as submission_id,
          s.user_id,
          s.assignment_id,
          f.score,
          ROW_NUMBER() OVER (
            PARTITION BY s.user_id, s.assignment_id 
            ORDER BY s.created_at DESC
          ) as rn
        FROM submissions s
        LEFT JOIN feedback f ON s.id = f.submission_id
        WHERE s.user_id = ANY(${studentIds})
          AND s.assignment_id = ANY(${assignmentIds})
          AND s.status = 'completed'
      )
      SELECT 
        submission_id,
        user_id,
        assignment_id,
        score
      FROM latest_submissions
      WHERE rn = 1
    `);
    
    // Create a map of student-assignment to score
    const result = new Map<string, number | null>();
    
    // Process each latest submission
    for (const row of latestSubmissionsWithScores.rows as any[]) {
      const key = `${row.user_id}-${row.assignment_id}`;
      const score = row.score === null ? null : Number(row.score);
      result.set(key, score);
    }
    
    return result;
  }
  
  /**
   * Get aggregated statistics for a course
   * @param courseId The course ID to get statistics for
   */
  async getCourseStats(courseId: number): Promise<{
    enrollmentCount: number,
    assignmentCount: number,
    submissionCount: number,
    avgSubmissionsPerStudent: number,
    avgScores: { assignmentId: number, avgScore: number }[]
  }> {
    // Define count result type
    type CountResult = { count: number | bigint }[];
    
    // Get counts using a single query for efficiency
    const [enrollmentCount, assignmentCount, submissionCount] = await Promise.all([
      // Count enrollments
      db.select({ count: count() })
        .from(enrollments)
        .where(eq(enrollments.courseId, courseId))
        .then((result: CountResult) => Number(result[0]?.count || 0)),
      
      // Count assignments
      db.select({ count: count() })
        .from(assignments)
        .where(eq(assignments.courseId, courseId))
        .then((result: CountResult) => Number(result[0]?.count || 0)),
      
      // Count submissions (this is more complex - we need to join tables)
      db.select({ count: count() })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(eq(assignments.courseId, courseId))
        .then((result: CountResult) => Number(result[0]?.count || 0))
    ]);
    
    // Calculate average submissions per student
    const avgSubmissionsPerStudent = enrollmentCount > 0 
      ? submissionCount / enrollmentCount 
      : 0;
    
    // Get average scores per assignment using SQL aggregation
    const avgScores = await db
      .select({
        assignmentId: assignments.id,
        avgScore: sql<number>`avg(${feedback.score})`
      })
      .from(feedback)
      .innerJoin(submissions, eq(feedback.submissionId, submissions.id))
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.courseId, courseId))
      .groupBy(assignments.id);
    
    return {
      enrollmentCount,
      assignmentCount,
      submissionCount,
      avgSubmissionsPerStudent,
      avgScores
    };
  }
  
  /**
   * Utility method to chunk an array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export const batchOperations = new BatchOperationsService();