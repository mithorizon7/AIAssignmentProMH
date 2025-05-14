import { storage } from '../storage';
import { InsertSubmission, InsertFeedback, Submission, Feedback } from '@shared/schema';
import { isS3Configured, uploadFile } from '../utils/s3-client';
import path from 'path';
import crypto from 'crypto';

export class StorageService {
  // Save submission to database
  async saveSubmission(submission: InsertSubmission): Promise<number> {
    try {
      const result = await storage.createSubmission(submission);
      return result.id;
    } catch (error) {
      console.error('Error saving submission:', error);
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
      console.error('Error saving feedback:', error);
      throw new Error('Failed to save feedback to database');
    }
  }

  /**
   * Store submission file in S3 or generate a mock URL if S3 not configured
   * @param file The uploaded file from multer
   * @param userId User ID of the submitter
   * @param assignmentId Assignment ID
   * @returns URL to the stored file
   */
  async storeSubmissionFile(file: Express.Multer.File, userId: number, assignmentId: number): Promise<string> {
    try {
      // Generate a unique filename to avoid collisions
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const originalExtension = path.extname(file.originalname);
      const safeFileName = `${path.basename(file.originalname, originalExtension)}-${randomString}${originalExtension}`;
      
      // Construct S3 key (path in bucket)
      const s3Key = `submissions/${userId}/${assignmentId}/${timestamp}/${safeFileName}`;
      
      // Upload to S3 if configured
      if (isS3Configured()) {
        console.log(`[StorageService] Uploading submission file to S3: ${s3Key}`);
        return await uploadFile(file.path, s3Key, file.mimetype);
      } else {
        console.warn('[StorageService] S3 not configured, using mock URL');
        // Return a mock URL for development environments
        return `https://storage.example.com/${s3Key}`;
      }
    } catch (error) {
      console.error('Error storing file:', error);
      throw new Error(`Failed to store submission file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store anonymous submission file in S3 or generate a mock URL if S3 not configured
   * @param file The uploaded file from multer
   * @param assignmentId Assignment ID
   * @param name Submitter's name
   * @param email Submitter's email (used to create a unique path)
   * @returns URL to the stored file
   */
  async storeAnonymousSubmissionFile(file: Express.Multer.File, assignmentId: number, name: string, email: string): Promise<string> {
    try {
      // Generate a unique filename to avoid collisions
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const originalExtension = path.extname(file.originalname);
      const safeFileName = `${path.basename(file.originalname, originalExtension)}-${randomString}${originalExtension}`;
      
      // Create a safe email-derived path component
      const safeEmail = email.replace('@', '-at-').replace(/[^\w-]/g, '_');
      
      // Construct S3 key (path in bucket)
      const s3Key = `anonymous-submissions/${assignmentId}/${safeEmail}/${timestamp}/${safeFileName}`;
      
      // Upload to S3 if configured
      if (isS3Configured()) {
        console.log(`[StorageService] Uploading anonymous submission file to S3: ${s3Key}`);
        return await uploadFile(file.path, s3Key, file.mimetype);
      } else {
        console.warn('[StorageService] S3 not configured, using mock URL');
        // Return a mock URL for development environments
        return `https://storage.example.com/${s3Key}`;
      }
    } catch (error) {
      console.error('Error storing anonymous file:', error);
      throw new Error(`Failed to store submission file: ${error instanceof Error ? error.message : String(error)}`);
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
