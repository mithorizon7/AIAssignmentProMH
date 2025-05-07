import { EventEmitter } from 'events';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage-service';
import { storage } from '../storage';
import { GeminiAdapter } from '../adapters/gemini-adapter';

// Simple in-memory queue implementation
export class SubmissionQueue extends EventEmitter {
  private queue: any[] = [];
  private processing: boolean = false;
  private aiService: AIService;
  private storageService: StorageService;

  constructor() {
    super();
    const geminiAdapter = new GeminiAdapter();
    this.aiService = new AIService(geminiAdapter);
    this.storageService = new StorageService();
  }

  // Add a submission to the queue
  async addSubmission(submissionId: number): Promise<void> {
    this.queue.push(submissionId);
    this.emit('added', submissionId);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  // Process the queue
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const submissionId = this.queue.shift();

    try {
      // Get submission from database
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        throw new Error(`Submission ${submissionId} not found`);
      }

      // Update submission status to processing
      await storage.updateSubmissionStatus(submission.id, 'processing');

      // Get assignment for context
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        throw new Error(`Assignment ${submission.assignmentId} not found`);
      }

      // Prepare content for analysis
      let content = submission.content || ''; 
      if (submission.fileUrl && !content) {
        // In a real implementation, this would download the file from S3
        content = `File submission: ${submission.fileName}`;
      }

      // Analyze the submission with AI
      const feedbackResult = await this.aiService.analyzeProgrammingAssignment({
        content: content,
        assignmentContext: assignment.description || undefined
      });

      // Prepare feedback for database
      const feedbackData = await this.aiService.prepareFeedbackForStorage(
        submission.id,
        feedbackResult
      );

      // Save feedback to database
      await this.storageService.saveFeedback(feedbackData);

      this.emit('processed', submissionId);
    } catch (error) {
      console.error(`Error processing submission ${submissionId}:`, error);
      
      // Mark submission as failed
      try {
        await storage.updateSubmissionStatus(submissionId, 'failed');
      } catch (updateError) {
        console.error(`Failed to update submission status:`, updateError);
      }
      
      this.emit('error', { submissionId, error });
    }

    // Process next item
    setImmediate(() => this.processQueue());
  }
}

// Singleton instance
export const submissionQueue = new SubmissionQueue();
