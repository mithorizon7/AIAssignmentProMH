import { storage } from '../storage';
import { InsertSubmission, InsertFeedback, Submission, Feedback } from '../../shared/schema';
import { isGcsConfigured, uploadFile, uploadBuffer, generateSignedUrl } from '../utils/gcs-client';
import { logger } from '../lib/logger';
import path from 'path';
import crypto from 'crypto';
import * as fs from 'fs';

export class StorageService {
  // Save submission to database
  async saveSubmission(submission: InsertSubmission): Promise<number> {
    try {
      const result = await storage.createSubmission(submission);
      return result.id;
    } catch (error) {
      logger.error('Error saving submission', { error });
      throw new Error('Failed to save submission to database');
    }
  }

  // Save feedback to database
  async saveFeedback(feedback: InsertFeedback): Promise<void> {
    try {
      await storage.createFeedback(feedback);
      
      // Update submission status to completed
      await storage.updateSubmissionStatus(feedback.submissionId, 'completed');
    } catch (error) {
      logger.error('Error saving feedback', { error });
      throw new Error('Failed to save feedback to database');
    }
  }

  /**
   * Store submission file in Google Cloud Storage or locally for development
   * @param file The uploaded file from multer
   * @param userId User ID of the submitter
   * @param assignmentId Assignment ID
   * @returns File path for processing (GCS path or local path)
   */
  async storeSubmissionFile(file: Express.Multer.File, userId: number, assignmentId: number): Promise<string> {
    try {
      // Generate a unique filename to avoid collisions
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const originalExtension = path.extname(file.originalname);
      const safeFileName = `${path.basename(file.originalname, originalExtension)}-${randomString}${originalExtension}`;
      
      // Upload to GCS if configured
      if (isGcsConfigured()) {
        console.log(`[StorageService] Uploading submission file to GCS`);
        const gcsPath = `submissions/${userId}/${assignmentId}/${timestamp}/${safeFileName}`;
        
        // ✅ MEMORY OPTIMIZATION: Use disk-based processing only
        if (file.path) {
          // Disk storage (optimized implementation for memory efficiency)
          console.log(`[STORAGE] Using disk-based file processing for memory optimization: ${file.path}`);
          return await uploadFile(file.path, gcsPath, file.mimetype);
        } else {
          throw new Error('File path not available - disk storage required for memory optimization');
        }
      } else {
        console.warn('[StorageService] GCS not configured, storing file locally for development');
        // In development mode, store file temporarily on disk for processing
        const tempDir = '/tmp/aigrader-dev-files';
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create full path for the temporary file
        const tempFilePath = path.join(tempDir, `${Date.now()}-${safeFileName}`);
        
        // ✅ MEMORY OPTIMIZATION: Use disk-based processing only
        if (file.path) {
          // Disk storage - copy file to temp location for memory efficiency
          console.log(`[STORAGE] Using disk-based file copying for memory optimization: ${file.path} -> ${tempFilePath}`);
          fs.copyFileSync(file.path, tempFilePath);
        } else {
          throw new Error('File path not available - disk storage required for memory optimization');
        }
        
        console.log(`[StorageService] File stored temporarily at: ${tempFilePath}`);
        
        // Return the local file path for processing
        return tempFilePath;
      }
    } catch (error) {
      console.error('Error storing file:', error);
      throw new Error(`Failed to store submission file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store anonymous submission file in Google Cloud Storage or locally for development
   * @param file The uploaded file from multer
   * @param assignmentId Assignment ID
   * @param name Submitter's name
   * @param email Submitter's email (used to create a unique path)
   * @returns File path for processing (GCS path or local path)
   */
  async storeAnonymousSubmissionFile(file: Express.Multer.File, assignmentId: number, name: string, email: string): Promise<string> {
    try {
      // Generate a unique filename to avoid collisions
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const originalExtension = path.extname(file.originalname);
      const safeFileName = `${path.basename(file.originalname, originalExtension)}-${randomString}${originalExtension}`;
      
      // Upload to GCS if configured
      if (isGcsConfigured()) {
        console.log(`[StorageService] Uploading anonymous submission file to GCS`);
        // Create a safe email-derived path component
        const safeEmail = email.replace('@', '-at-').replace(/[^\w-]/g, '_');
        const gcsPath = `anonymous-submissions/${assignmentId}/${safeEmail}/${timestamp}/${safeFileName}`;
        
        // ✅ MEMORY OPTIMIZATION: Use disk-based processing only
        if (file.path) {
          // Disk storage (optimized implementation for memory efficiency)
          console.log(`[STORAGE] Using disk-based file processing for anonymous submission: ${file.path}`);
          return await uploadFile(file.path, gcsPath, file.mimetype);
        } else {
          throw new Error('File path not available - disk storage required for memory optimization');
        }
      } else {
        console.warn('[StorageService] GCS not configured, storing anonymous file locally for development');
        // In development mode, store file temporarily on disk for processing
        const tempDir = '/tmp/aigrader-dev-files';
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create full path for the temporary file
        const tempFilePath = path.join(tempDir, `${Date.now()}-${safeFileName}`);
        
        // ✅ MEMORY OPTIMIZATION: Use disk-based processing only
        if (file.path) {
          // Disk storage - copy file to temp location for memory efficiency
          console.log(`[STORAGE] Using disk-based file copying for anonymous submission: ${file.path} -> ${tempFilePath}`);
          fs.copyFileSync(file.path, tempFilePath);
        } else {
          throw new Error('File path not available - disk storage required for memory optimization');
        }
        
        console.log(`[StorageService] Anonymous submission file stored temporarily at: ${tempFilePath}`);
        
        // Return the local file path for processing
        return tempFilePath;
      }
    } catch (error) {
      console.error('Error storing anonymous file:', error);
      throw new Error(`Failed to store submission file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate a signed URL for accessing a file stored in Google Cloud Storage
   * @param objectPath The path to the object in GCS (as returned by storeSubmissionFile)
   * @param expirationMinutes How long the URL should be valid for, in minutes (default: 60)
   * @returns A signed URL that provides temporary access to the file
   */
  async getFileUrl(objectPath: string, expirationMinutes = 60): Promise<string> {
    try {
      if (isGcsConfigured()) {
        return await generateSignedUrl(objectPath, expirationMinutes);
      } else {
        // Return a mock URL for development environments
        return `https://storage.googleapis.com/mock-bucket/${objectPath}`;
      }
    } catch (error) {
      logger.error('Error generating file URL', { error, objectPath });
      throw new Error('Failed to generate file URL');
    }
  }

  /**
   * Check if an assignment is active and accepting submissions
   * @param assignmentId Assignment ID to check
   * @returns True if assignment is active, false otherwise
   */
  async isAssignmentActive(assignmentId: number): Promise<boolean> {
    try {
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) return false;
      
      // Check if assignment status is active
      if (assignment.status !== 'active') return false;
      
      // Check if assignment is past due date
      if (assignment.dueDate && new Date() > assignment.dueDate) return false;
      
      return true;
    } catch (error) {
      logger.error('Error checking assignment status', { error, assignmentId });
      return false;
    }
  }

  /**
   * Check if a student is enrolled in the course for a given assignment
   * @param studentId Student user ID
   * @param assignmentId Assignment ID
   * @returns True if student is enrolled, false otherwise
   */
  async isStudentEnrolled(studentId: number, assignmentId: number): Promise<boolean> {
    try {
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || !assignment.courseId) return false;
      
      const enrollment = await storage.getEnrollment(studentId, assignment.courseId);
      return !!enrollment;
    } catch (error) {
      logger.error('Error checking student enrollment', { error, studentId, assignmentId });
      return false;
    }
  }
}