import { EventEmitter } from 'events';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage-service';
import { storage } from '../storage';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { db } from '../db';
import { submissions } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Enhanced submission queue implementation with Redis-like semantics
 * This provides a robust queue that can:
 * - Handle multiple concurrent workers
 * - Provide retry capability with exponential backoff
 * - Track submission statistics
 */
class EnhancedSubmissionQueue extends EventEmitter {
  private workers: Map<number, boolean> = new Map(); // Track active worker status
  private maxWorkers: number = 5; // Process up to 5 submissions concurrently
  private aiService: AIService;
  private storageService: StorageService;
  
  // Job stats for monitoring
  private stats = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    total: 0
  };
  
  constructor() {
    super();
    
    // Initialize services
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
    
    // Start processing pending submissions in the background
    setInterval(() => this.processPendingSubmissions(), 5000);
    
    console.log('Enhanced submission queue initialized');
  }
  
  /**
   * Add a submission to the queue for processing
   * @param submissionId The ID of the submission to process
   */
  async addSubmission(submissionId: number): Promise<void> {
    try {
      // Mark the submission as pending in the database
      await storage.updateSubmissionStatus(submissionId, 'pending');
      
      this.stats.waiting++;
      this.stats.total++;
      
      console.log(`Submission ${submissionId} added to queue`);
      this.emit('added', submissionId);
      
      // Try to process right away if we have capacity
      this.processPendingSubmissions();
    } catch (error) {
      console.error(`Error adding submission ${submissionId} to queue:`, error);
      throw error;
    }
  }
  
  /**
   * Check for pending submissions and process them if we have capacity
   */
  private async processPendingSubmissions(): Promise<void> {
    // Calculate how many more workers we can start
    const activeWorkers = Array.from(this.workers.values()).filter(active => active).length;
    const availableSlots = this.maxWorkers - activeWorkers;
    
    if (availableSlots <= 0) {
      return; // At capacity, nothing to do
    }
    
    try {
      // Get pending submissions from the database up to our capacity
      const pendingSubmissions = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.status, 'pending'))
        .limit(availableSlots);
      
      // Start processing each submission
      for (const submission of pendingSubmissions) {
        this.processSubmission(submission.id);
      }
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
    }
  }
  
  /**
   * Process a submission
   * @param submissionId The ID of the submission to process
   */
  private async processSubmission(submissionId: number, attempt: number = 1): Promise<void> {
    // Set this worker as active
    this.workers.set(submissionId, true);
    this.stats.waiting--;
    this.stats.active++;
    
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
      
      // Update stats
      this.stats.active--;
      this.stats.completed++;
      
      console.log(`Successfully processed submission ${submissionId}`);
      this.emit('completed', submissionId);
    } catch (error) {
      console.error(`Error processing submission ${submissionId} (attempt ${attempt}):`, error);
      
      const maxRetries = 3;
      if (attempt < maxRetries) {
        // Calculate exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        
        console.log(`Retrying submission ${submissionId} in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        
        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.processSubmission(submissionId, attempt + 1);
        }, delay);
        
        // This worker is no longer active (for now)
        this.workers.set(submissionId, false);
        this.stats.active--;
        this.stats.waiting++; // Back to waiting
        
        return;
      }
      
      // Mark submission as failed after all retries
      try {
        await storage.updateSubmissionStatus(submissionId, 'failed');
      } catch (updateError) {
        console.error(`Failed to update submission status:`, updateError);
      }
      
      // Update stats
      this.stats.active--;
      this.stats.failed++;
      
      this.emit('failed', submissionId, error);
    } finally {
      // If we haven't already handled retries, mark this worker as inactive
      if (this.workers.get(submissionId)) {
        this.workers.delete(submissionId);
        
        // Check for more submissions to process
        this.processPendingSubmissions();
      }
    }
  }
  
  /**
   * Retry all failed submissions
   */
  async retryFailedSubmissions(): Promise<number> {
    try {
      // Get all failed submissions
      const failedSubmissions = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.status, 'failed'));
      
      // Re-queue them all
      const promises = failedSubmissions.map(sub => this.addSubmission(sub.id));
      await Promise.all(promises);
      
      return failedSubmissions.length;
    } catch (error) {
      console.error('Error retrying failed submissions:', error);
      throw error;
    }
  }
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    return { ...this.stats };
  }
}

// Export singleton instance
export const submissionQueue = new EnhancedSubmissionQueue();
