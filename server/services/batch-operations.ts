import { db } from '../db';
import { storage } from '../storage';
import { 
  submissions, 
  feedback, 
  users, 
  courses, 
  assignments, 
  enrollments 
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Service for efficient batch operations on the database.
 * This is particularly useful for operations involving large class sizes.
 */
export class BatchOperationsService {
  /**
   * Bulk enroll multiple students in a course
   * @param courseId - The ID of the course
   * @param userIds - Array of user IDs to enroll
   */
  async bulkEnrollStudents(courseId: number, userIds: number[]): Promise<void> {
    if (!userIds.length) return;
    
    // Prepare enrollment objects
    const enrollmentData = userIds.map(userId => ({
      userId,
      courseId
    }));
    
    // Insert them all at once
    await db.insert(enrollments).values(enrollmentData);
  }

  /**
   * Bulk update submission statuses
   * @param submissionIds - Array of submission IDs to update
   * @param status - New status to set for all submissions
   */
  async bulkUpdateSubmissionStatus(submissionIds: number[], status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
    if (!submissionIds.length) return;
    
    await db
      .update(submissions)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(inArray(submissions.id, submissionIds));
  }

  /**
   * Get all submissions for a list of assignments
   * Useful for instructors managing multiple assignments in large classes
   */
  async getSubmissionsForAssignments(assignmentIds: number[]): Promise<any[]> {
    if (!assignmentIds.length) return [];
    
    return db
      .select()
      .from(submissions)
      .where(inArray(submissions.assignmentId, assignmentIds))
      .orderBy(submissions.updatedAt);
  }

  /**
   * Get all user progress across multiple assignments
   * @param courseId - The ID of the course
   * @returns Map of user progress across assignments
   */
  async getUserProgressForCourse(courseId: number): Promise<any> {
    // Get all assignments for the course
    const courseAssignments = await db
      .select()
      .from(assignments)
      .where(eq(assignments.courseId, courseId));
    
    if (!courseAssignments.length) return {};
    
    // Get all students enrolled in the course
    const enrolledStudents = await db
      .select({
        userId: enrollments.userId
      })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));
    
    const userIds = enrolledStudents.map(e => e.userId);
    
    if (!userIds.length) return {};
    
    // Get all submissions from these students for these assignments
    const assignmentIds = courseAssignments.map(a => a.id);
    
    const allSubmissions = await db
      .select()
      .from(submissions)
      .where(
        and(
          inArray(submissions.assignmentId, assignmentIds),
          inArray(submissions.userId, userIds)
        )
      );
    
    // Get all associated feedback
    const submissionIds = allSubmissions.map(s => s.id);
    
    const allFeedback = submissionIds.length > 0 
      ? await db
          .select()
          .from(feedback)
          .where(inArray(feedback.submissionId, submissionIds))
      : [];
    
    // Get all students
    const students = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
    
    // Organize data for easy consumption
    const studentMap = new Map(students.map(s => [s.id, s]));
    const feedbackMap = new Map(allFeedback.map(f => [f.submissionId, f]));
    const submissionsByStudent = new Map();
    
    for (const submission of allSubmissions) {
      if (!submissionsByStudent.has(submission.userId)) {
        submissionsByStudent.set(submission.userId, []);
      }
      submissionsByStudent.get(submission.userId).push({
        ...submission,
        feedback: feedbackMap.get(submission.id) || null
      });
    }
    
    // Build progress report
    const progress = userIds.map(userId => {
      const student = studentMap.get(userId);
      const studentSubmissions = submissionsByStudent.get(userId) || [];
      
      // Calculate assignment completion
      const completedAssignments = new Set(
        studentSubmissions
          .filter(s => s.status === 'completed')
          .map(s => s.assignmentId)
      );
      
      const averageScore = studentSubmissions
        .filter(s => s.feedback && s.feedback.score !== null)
        .reduce((sum, s) => sum + (s.feedback.score || 0), 0) / 
        (studentSubmissions.filter(s => s.feedback && s.feedback.score !== null).length || 1);
      
      return {
        userId,
        name: student?.name,
        email: student?.email,
        completedAssignments: Array.from(completedAssignments),
        totalAssignments: assignmentIds.length,
        completionRate: completedAssignments.size / assignmentIds.length,
        averageScore,
        submissions: studentSubmissions
      };
    });
    
    return {
      courseId,
      assignments: courseAssignments,
      students: progress
    };
  }
}

// Singleton instance
export const batchOperations = new BatchOperationsService();