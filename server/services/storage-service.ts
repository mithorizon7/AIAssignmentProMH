import { storage } from '../storage';
import { InsertSubmission, InsertFeedback, Submission, Feedback } from '@shared/schema';
import { isGcsConfigured, uploadFile, uploadBuffer, generateSignedUrl } from '../utils/gcs-client';
import { logger } from '../lib/logger';
import path from 'path';
import crypto from 'crypto';

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
        
        // If using multer's memoryStorage, use file.buffer
        if (file.buffer) {
          return await uploadBuffer(file.buffer, gcsPath, file.mimetype);
        } else {
          // If using multer's diskStorage, use file.path
          return await uploadFile(file.path, gcsPath, file.mimetype);
        }
      } else {
        console.warn('[StorageService] GCS not configured, storing file locally for development');
        // In development mode, store file temporarily on disk for processing
        const tempDir = '/tmp/aigrader-dev-files';
        const fs = require('fs');
        const pathModule = require('path');
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create full path for the temporary file
        const tempFilePath = pathModule.join(tempDir, `${Date.now()}-${safeFileName}`);
        
        // Write the file buffer to temporary location
        fs.writeFileSync(tempFilePath, file.buffer);
        
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
        
        // If using multer's memoryStorage, use file.buffer
        if (file.buffer) {
          return await uploadBuffer(file.buffer, gcsPath, file.mimetype);
        } else {
          // If using multer's diskStorage, use file.path
          return await uploadFile(file.path, gcsPath, file.mimetype);
        }
      } else {
        console.warn('[StorageService] GCS not configured, storing file locally for development');
        // In development mode, store file temporarily on disk for processing
        const tempDir = '/tmp/aigrader-dev-files';
        const fs = require('fs');
        const pathModule = require('path');
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create full path for the temporary file
        const tempFilePath = pathModule.join(tempDir, `${Date.now()}-${safeFileName}`);
        
        // Write the file buffer to temporary location
        fs.writeFileSync(tempFilePath, file.buffer);
        
        console.log(`[StorageService] File stored temporarily at: ${tempFilePath}`);
        
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
      console.error('Error generating file URL:', error);
      throw new Error(`Failed to generate file URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Check if student is enrolled in the course
  async isStudentEnrolled(userId: number, assignmentId: number): Promise<boolean> {
    try {
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) return false;
      
      const enrollment = await storage.getEnrollment(userId, assignment.courseId);
      return !!enrollment;
    } catch (error) {
      console.error('Error checking enrollment:', error);
      throw new Error('Failed to verify enrollment status');
    }
  }

  // Check if assignment is still accepting submissions
  async isAssignmentActive(assignmentId: number): Promise<boolean> {
    try {
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) return false;
      
      return assignment.status === 'active' && new Date(assignment.dueDate) > new Date();
    } catch (error) {
      console.error('Error checking assignment status:', error);
      throw new Error('Failed to verify assignment status');
    }
  }

  // Get submission with feedback
  async getSubmissionWithFeedback(submissionId: number): Promise<(Submission & { feedback: Feedback | null }) | null> {
    try {
      const submission = await storage.getSubmission(submissionId);
      if (!submission) return null;
      
      const feedbackData = await storage.getFeedbackBySubmissionId(submissionId);
      
      return {
        ...submission,
        feedback: feedbackData || null
      };
    } catch (error) {
      console.error('Error getting submission with feedback:', error);
      throw new Error('Failed to retrieve submission data');
    }
  }

  // Get all submissions for an assignment with feedback
  async getAssignmentSubmissions(assignmentId: number): Promise<Array<Submission & { feedback: Feedback | null }>> {
    try {
      const submissions = await storage.listSubmissionsForAssignment(assignmentId);
      
      // Get feedback for each submission
      const submissionsWithFeedback = await Promise.all(
        submissions.map(async (submission) => {
          const feedbackData = await storage.getFeedbackBySubmissionId(submission.id);
          return {
            ...submission,
            feedback: feedbackData || null
          };
        })
      );
      
      return submissionsWithFeedback;
    } catch (error) {
      console.error('Error getting assignment submissions:', error);
      throw new Error('Failed to retrieve assignment submissions');
    }
  }
}
