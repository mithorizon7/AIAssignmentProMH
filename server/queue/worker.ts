import { EventEmitter } from 'events';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage-service';
import { storage } from '../storage';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { db } from '../db';
import { submissions } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Enhanced scaling queue implementation - using database to track jobs
 * This is a more scalable version of the in-memory queue that uses the database for persistence
 * and allows for multiple workers to process jobs simultaneously.
 * 
 * In production, this would be replaced with a proper message queue like BullMQ/Redis
 */
export class ScalableSubmissionQueue extends EventEmitter {
  private processing: boolean = false;
  private workers: number = 0;
  private maxWorkers: number = 5; // Process up to 5 submissions concurrently
  private aiService: AIService;
  private storageService: StorageService;
  private retryDelays: number[] = [5000, 15000, 30000]; // Retry delays in ms (5s, 15s, 30s)

  constructor() {
    super();
    
    // Select the appropriate AI adapter based on available API keys
    let aiAdapter: GeminiAdapter | OpenAIAdapter;
    if (process.env.GEMINI_API_KEY) {
      console.log('Using Gemini AI adapter');
      aiAdapter = new GeminiAdapter();
    } else if (process.env.OPENAI_API_KEY) {
      console.log('Using OpenAI adapter');
      aiAdapter = new OpenAIAdapter();
    } else {
      console.warn('No AI API key found - Gemini will be used by default but may not work properly');
      aiAdapter = new GeminiAdapter();
    }
    
    this.aiService = new AIService(aiAdapter);
    this.storageService = new StorageService();
    
    // Start the queue processing
    setInterval(() => this.processPendingSubmissions(), 5000);
  }

  // Add a submission to the queue
  async addSubmission(submissionId: number): Promise<void> {
    // We're just marking it as pending in the database
    // The actual processing is done by the processPendingSubmissions method
    await storage.updateSubmissionStatus(submissionId, 'pending');
    console.log(`Added submission ${submissionId} to queue`);
    this.emit('added', submissionId);
    
    // Try to start processing right away
    this.processPendingSubmissions();
  }

  // Get pending submissions from the database
  private async getPendingSubmissions(limit: number = 10): Promise<number[]> {
    const pendingSubmissions = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.status, 'pending'))
      .orderBy(desc(submissions.createdAt))
      .limit(limit);
    
    return pendingSubmissions.map(s => s.id);
  }

  // Process any pending submissions in the database
  private async processPendingSubmissions(): Promise<void> {
    // Don't start more workers if we're at capacity
    if (this.workers >= this.maxWorkers) {
      return;
    }
    
    // Get pending submissions
    const pendingIds = await this.getPendingSubmissions(this.maxWorkers - this.workers);
    
    // Start processing each submission in parallel
    for (const submissionId of pendingIds) {
      this.processSubmission(submissionId);
    }
  }

  // Process a single submission
  private async processSubmission(submissionId: number): Promise<void> {
    // Increment worker count
    this.workers++;
    
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
      
      // Update submission status to completed
      await storage.updateSubmissionStatus(submission.id, 'completed');
      
      console.log(`Successfully processed submission ${submissionId}`);
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
    } finally {
      // Decrement worker count
      this.workers--;
      
      // Try to process more submissions if there are any
      if (this.workers < this.maxWorkers) {
        this.processPendingSubmissions();
      }
    }
  }
}

// Singleton instance
export const submissionQueue = new ScalableSubmissionQueue();
