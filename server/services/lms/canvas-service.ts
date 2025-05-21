/**
 * Canvas LMS Service Implementation
 * 
 * This service provides integration with Canvas LMS API for:
 * - Authentication and token validation
 * - Course synchronization
 * - Grade posting
 * - Roster synchronization
 */

import fetch from 'node-fetch';
import { 
  BaseLmsService, 
  ConnectionTestResult, 
  CourseInfo, 
  StudentInfo,
  AssignmentInfo,
  GradeInfo,
  SyncResult
} from './base-lms-service';
import { LmsCredential } from '../../../shared/schema';

export class CanvasService implements BaseLmsService {
  private credential: LmsCredential;
  
  constructor(credential: LmsCredential) {
    this.credential = credential;
  }

  /**
   * Get base API URL with version
   */
  private get apiBaseUrl(): string {
    const baseUrl = this.credential.baseUrl.endsWith('/') 
      ? this.credential.baseUrl.slice(0, -1) 
      : this.credential.baseUrl;
    return `${baseUrl}/api/v1`;
  }

  /**
   * Create authorization headers using OAuth token
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.credential.clientSecret}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Test the connection to Canvas by making a simple API call
   */
  async testConnection(credential: LmsCredential): Promise<ConnectionTestResult> {
    try {
      // Use the provided credential for this test rather than the stored one
      this.credential = credential;
      
      const response = await fetch(`${this.apiBaseUrl}/courses?per_page=1`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Failed to connect to Canvas API: ${response.status} ${response.statusText}`,
          details: { error: errorText, statusCode: response.status }
        };
      }

      return {
        success: true,
        message: 'Successfully connected to Canvas API',
        details: { statusCode: response.status }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error connecting to Canvas API: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Get all courses from Canvas
   */
  async getCourses(): Promise<CourseInfo[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/courses?per_page=100&include[]=term`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];
      
      return data.map(course => ({
        id: course.id.toString(),
        name: course.name,
        code: course.course_code,
        startDate: course.start_at ? new Date(course.start_at) : undefined,
        endDate: course.end_at ? new Date(course.end_at) : undefined
      }));
    } catch (error) {
      console.error('Error fetching Canvas courses:', error);
      throw error;
    }
  }

  /**
   * Get all students enrolled in a specific course
   */
  async getStudentsInCourse(courseId: string): Promise<StudentInfo[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/users?enrollment_type[]=student&per_page=100`, 
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];
      
      return data.map(student => ({
        id: student.id.toString(),
        name: student.name,
        email: student.email || '',
        externalId: student.sis_user_id
      }));
    } catch (error) {
      console.error(`Error fetching Canvas students for course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get all assignments for a specific course
   */
  async getAssignmentsInCourse(courseId: string): Promise<AssignmentInfo[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/assignments?per_page=100`, 
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];
      
      return data.map(assignment => ({
        id: assignment.id.toString(),
        title: assignment.name,
        description: assignment.description,
        dueDate: assignment.due_at ? new Date(assignment.due_at) : undefined,
        points: assignment.points_possible
      }));
    } catch (error) {
      console.error(`Error fetching Canvas assignments for course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get grades for all students for a specific assignment
   */
  async getGradesForAssignment(courseId: string, assignmentId: string): Promise<GradeInfo[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100&include[]=user`, 
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];
      const assignmentResponse = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/assignments/${assignmentId}`, 
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );
      
      if (!assignmentResponse.ok) {
        throw new Error(`Canvas API error: ${assignmentResponse.status} ${assignmentResponse.statusText}`);
      }
      
      const assignmentData = await assignmentResponse.json() as any;
      const maxScore = assignmentData.points_possible || 100;
      
      return data.map(submission => ({
        studentId: submission.user_id.toString(),
        assignmentId: assignmentId,
        score: submission.score || 0,
        maxScore,
        comment: submission.comment || '',
        submittedAt: submission.submitted_at ? new Date(submission.submitted_at) : undefined,
        gradedAt: submission.graded_at ? new Date(submission.graded_at) : undefined
      }));
    } catch (error) {
      console.error(`Error fetching Canvas grades for assignment ${assignmentId}:`, error);
      throw error;
    }
  }

  /**
   * Submit a grade for a student on a specific assignment
   */
  async submitGradeForStudent(
    courseId: string, 
    assignmentId: string, 
    studentId: string, 
    grade: GradeInfo
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, 
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({
            submission: {
              posted_grade: grade.score,
              text_comment: grade.comment
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error(`Error submitting Canvas grade for student ${studentId}:`, error);
      return false;
    }
  }

  /**
   * Synchronize student roster from Canvas to local database
   */
  async syncRoster(courseId: string): Promise<SyncResult> {
    try {
      const students = await this.getStudentsInCourse(courseId);
      
      return {
        success: true,
        syncedCount: students.length,
        errors: [],
        details: { students }
      };
    } catch (error) {
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        details: { error: String(error) }
      };
    }
  }

  /**
   * Synchronize grades from local database to Canvas
   */
  async syncGrades(courseId: string, assignmentId: string): Promise<SyncResult> {
    try {
      // In a real implementation, we would:
      // 1. Get all grades for the assignment from our database
      // 2. Submit each grade to Canvas
      // 3. Track success/failures
      
      // This is a placeholder until we implement the full flow
      return {
        success: true,
        syncedCount: 0, // Will be updated with actual count in implementation
        errors: [],
        details: { message: "Grade sync not fully implemented yet" }
      };
    } catch (error) {
      return {
        success: false,
        syncedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        details: { error: String(error) }
      };
    }
  }
}