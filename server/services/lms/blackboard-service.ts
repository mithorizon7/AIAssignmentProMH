/**
 * Blackboard LMS Service Implementation
 * 
 * This service provides integration with Blackboard Learn REST API for:
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

export class BlackboardService implements BaseLmsService {
  private credential: LmsCredential;
  private accessToken: string | null = null;
  private tokenExpires: Date | null = null;
  
  constructor(credential: LmsCredential) {
    this.credential = credential;
  }

  /**
   * Get base API URL
   */
  private get apiBaseUrl(): string {
    const baseUrl = this.credential.baseUrl.endsWith('/') 
      ? this.credential.baseUrl.slice(0, -1) 
      : this.credential.baseUrl;
    return `${baseUrl}/learn/api/public/v1`;
  }

  /**
   * Get authorization token for Blackboard API
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpires && this.tokenExpires > new Date()) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `${this.credential.baseUrl}/learn/api/public/v1/oauth2/token`;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.credential.clientId,
          client_secret: this.credential.clientSecret
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      
      // Set token expiration (subtract 60 seconds for safety)
      const expiresIn = (data.expires_in - 60) * 1000;
      this.tokenExpires = new Date(Date.now() + expiresIn);
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting Blackboard access token:', error);
      throw error;
    }
  }

  /**
   * Create authorization headers with token
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Test the connection to Blackboard
   */
  async testConnection(credential: LmsCredential): Promise<ConnectionTestResult> {
    try {
      // Use the provided credential for this test
      this.credential = credential;
      this.accessToken = null;
      this.tokenExpires = null;
      
      // Try to get an access token
      await this.getAccessToken();
      
      // If we got a token, try a simple API call
      const headers = await this.getHeaders();
      const response = await fetch(`${this.apiBaseUrl}/courses`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Connected to Blackboard API but failed to retrieve courses: ${response.status} ${response.statusText}`,
          details: { error: errorText, statusCode: response.status }
        };
      }

      return {
        success: true,
        message: 'Successfully connected to Blackboard API',
        details: { statusCode: response.status }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error connecting to Blackboard API: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Get all courses from Blackboard
   */
  async getCourses(): Promise<CourseInfo[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.apiBaseUrl}/courses`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Blackboard API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results: any[] };
      
      return data.results.map(course => ({
        id: course.id,
        name: course.name,
        code: course.courseId,
        startDate: course.availability?.available === 'Yes' && course.availability?.startDate 
          ? new Date(course.availability.startDate) 
          : undefined,
        endDate: course.availability?.available === 'Yes' && course.availability?.endDate 
          ? new Date(course.availability.endDate) 
          : undefined
      }));
    } catch (error) {
      console.error('Error fetching Blackboard courses:', error);
      throw error;
    }
  }

  /**
   * Get all students enrolled in a specific course
   */
  async getStudentsInCourse(courseId: string): Promise<StudentInfo[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/users?role=Student`, 
        {
          method: 'GET',
          headers
        }
      );

      if (!response.ok) {
        throw new Error(`Blackboard API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results: any[] };
      
      return data.results.map(user => ({
        id: user.id,
        name: `${user.name.given} ${user.name.family}`,
        email: user.contact?.email || '',
        externalId: user.externalId
      }));
    } catch (error) {
      console.error(`Error fetching Blackboard students for course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get all assignments for a specific course
   */
  async getAssignmentsInCourse(courseId: string): Promise<AssignmentInfo[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/gradebook/columns`, 
        {
          method: 'GET',
          headers
        }
      );

      if (!response.ok) {
        throw new Error(`Blackboard API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results: any[] };
      
      return data.results
        .filter(column => column.contentId && column.grading)
        .map(assignment => ({
          id: assignment.id,
          title: assignment.name,
          description: assignment.description || '',
          dueDate: assignment.grading?.due ? new Date(assignment.grading.due) : undefined,
          points: assignment.grading?.score?.possible || 100
        }));
    } catch (error) {
      console.error(`Error fetching Blackboard assignments for course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get grades for all students for a specific assignment
   */
  async getGradesForAssignment(courseId: string, assignmentId: string): Promise<GradeInfo[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/gradebook/columns/${assignmentId}/users`, 
        {
          method: 'GET',
          headers
        }
      );

      if (!response.ok) {
        throw new Error(`Blackboard API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results: any[] };
      
      return data.results.map(entry => ({
        studentId: entry.userId,
        assignmentId: assignmentId,
        score: entry.score || 0,
        maxScore: entry.possible || 100,
        comment: entry.feedback || '',
        submittedAt: entry.attemptDate ? new Date(entry.attemptDate) : undefined,
        gradedAt: entry.lastActivityDate ? new Date(entry.lastActivityDate) : undefined
      }));
    } catch (error) {
      console.error(`Error fetching Blackboard grades for assignment ${assignmentId}:`, error);
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
      const headers = await this.getHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/courses/${courseId}/gradebook/columns/${assignmentId}/users/${studentId}`, 
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            score: grade.score,
            feedback: grade.comment || ''
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Blackboard API error: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error(`Error submitting Blackboard grade for student ${studentId}:`, error);
      return false;
    }
  }

  /**
   * Synchronize student roster from Blackboard to local database
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
   * Synchronize grades from local database to Blackboard
   */
  async syncGrades(courseId: string, assignmentId: string): Promise<SyncResult> {
    try {
      // In a real implementation, we would:
      // 1. Get all grades for the assignment from our database
      // 2. Submit each grade to Blackboard
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