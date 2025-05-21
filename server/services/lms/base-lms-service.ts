/**
 * Base LMS Service Interface
 * 
 * This interface defines the common operations that all LMS implementations must support.
 * Each LMS provider (Canvas, Blackboard, Moodle, etc.) will implement this interface.
 */

import { LmsCredential } from '../../../shared/schema';

export interface CourseInfo {
  id: string;
  name: string;
  code?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface StudentInfo {
  id: string;
  name: string;
  email: string;
  externalId?: string;
}

export interface AssignmentInfo {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  points?: number;
}

export interface GradeInfo {
  studentId: string;
  assignmentId: string;
  score: number;
  maxScore: number;
  comment?: string;
  submittedAt?: Date;
  gradedAt?: Date;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  details?: Record<string, unknown>;
}

export interface BaseLmsService {
  // Connection and authentication
  testConnection(credential: LmsCredential): Promise<ConnectionTestResult>;
  
  // Course operations
  getCourses(): Promise<CourseInfo[]>;
  
  // Student roster operations
  getStudentsInCourse(courseId: string): Promise<StudentInfo[]>;
  
  // Assignment operations
  getAssignmentsInCourse(courseId: string): Promise<AssignmentInfo[]>;
  
  // Grade operations
  getGradesForAssignment(courseId: string, assignmentId: string): Promise<GradeInfo[]>;
  submitGradeForStudent(courseId: string, assignmentId: string, studentId: string, grade: GradeInfo): Promise<boolean>;
  
  // Synchronization operations
  syncRoster(courseId: string): Promise<SyncResult>;
  syncGrades(courseId: string, assignmentId: string): Promise<SyncResult>;
}