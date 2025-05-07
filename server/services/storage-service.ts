import { storage } from '../storage';
import { InsertSubmission, InsertFeedback } from '@shared/schema';

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

  // Store file content or URL (this would use S3 in a real implementation)
  async storeSubmissionFile(file: Express.Multer.File, userId: number, assignmentId: number): Promise<string> {
    try {
      // In a real implementation, this would upload to S3 or similar
      // For now, we'll mock a URL
      const timestamp = Date.now();
      return `https://storage.example.com/submissions/${userId}/${assignmentId}/${timestamp}/${file.originalname}`;
    } catch (error) {
      console.error('Error storing file:', error);
      throw new Error('Failed to store submission file');
    }
  }
  
  // Store file for anonymous submissions (this would use S3 in a real implementation)
  async storeAnonymousSubmissionFile(file: Express.Multer.File, assignmentId: number, name: string, email: string): Promise<string> {
    try {
      // In a real implementation, this would upload to S3 or similar
      // For now, we'll mock a URL
      const timestamp = Date.now();
      const safeEmail = email.replace('@', '-at-').replace(/[^\w-]/g, '_');
      return `https://storage.example.com/anonymous-submissions/${assignmentId}/${safeEmail}/${timestamp}/${file.originalname}`;
    } catch (error) {
      console.error('Error storing anonymous file:', error);
      throw new Error('Failed to store submission file');
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
  async getSubmissionWithFeedback(submissionId: number): Promise<any> {
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
  async getAssignmentSubmissions(assignmentId: number): Promise<any[]> {
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
