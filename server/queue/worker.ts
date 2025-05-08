import { Queue, Worker, QueueEvents } from 'bullmq';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage-service';
import { storage } from '../storage';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { db } from '../db';
import { submissions, feedback } from '@shared/schema';
import { eq } from 'drizzle-orm';
import redisClient, { connectionOptions } from './redis';

// Job data interface
interface SubmissionJobData {
  submissionId: number;
}

/**
 * BullMQ-based submission queue implementation
 * This provides a robust, Redis-backed queue that can:
 * - Persist across server restarts
 * - Scale horizontally across multiple servers
 * - Handle retries, delays, and priorities
 * - Provide monitoring and analytics
 */
class BullMQSubmissionQueue {
  private queue: Queue<SubmissionJobData>;
  private worker: Worker<SubmissionJobData>;
  private queueEvents: QueueEvents;
  private aiService: AIService;
  private storageService: StorageService;
  
  constructor() {
    // Initialize the queue
    this.queue = new Queue<SubmissionJobData>('submissions', connectionOptions);
    
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
    
    // Set up the worker to process jobs
    this.worker = new Worker<SubmissionJobData>(
      'submissions',
      async job => this.processSubmission(job.data),
      {
        ...connectionOptions,
        concurrency: 5, // Process up to 5 submissions concurrently
        limiter: {
          // Rate limit to avoid overloading the AI service
          max: 20, // Max 20 jobs
          duration: 60000 // Per minute
        }
      }
    );
    
    // Set up queue events (for monitoring)
    this.queueEvents = new QueueEvents('submissions', connectionOptions);
    
    // Set up event handlers
    this.worker.on('completed', job => {
      console.log(`Job ${job.id} completed successfully`);
    });
    
    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error);
    });
    
    this.queueEvents.on('completed', ({ jobId }) => {
      console.log(`Job ${jobId} completed`);
    });
    
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed: ${failedReason}`);
    });
    
    this.queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`Job ${jobId} stalled (may indicate worker crash)`);
    });
    
    console.log('BullMQ submission queue initialized');
  }
  
  /**
   * Add a submission to the queue for processing
   * @param submissionId The ID of the submission to process
   */
  async addSubmission(submissionId: number): Promise<void> {
    try {
      // Mark the submission as pending in the database
      await storage.updateSubmissionStatus(submissionId, 'pending');
      
      // Add the job to the queue
      await this.queue.add(
        `submission-${submissionId}`, 
        { submissionId },
        { 
          // Configure job options
          attempts: 3, // Retry up to 3 times
          backoff: {
            type: 'exponential',
            delay: 5000 // Start with 5s delay, then double
          },
          removeOnComplete: true, // Remove job from queue when complete
          removeOnFail: false // Keep failed jobs for inspection
        }
      );
      
      console.log(`Submission ${submissionId} added to queue`);
    } catch (error) {
      console.error(`Error adding submission ${submissionId} to queue:`, error);
      throw error;
    }
  }
  
  /**
   * Process a submission job
   * @param jobData The job data containing the submission ID
   */
  private async processSubmission({ submissionId }: SubmissionJobData): Promise<void> {
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
    } catch (error) {
      console.error(`Error processing submission ${submissionId}:`, error);
      
      // Mark submission as failed
      try {
        await storage.updateSubmissionStatus(submissionId, 'failed');
      } catch (updateError) {
        console.error(`Failed to update submission status:`, updateError);
      }
      
      // Re-throw the error to let BullMQ handle retries
      throw error;
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
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  }
  
  /**
   * Shutdown the queue and worker (for clean app shutdown)
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
  }
}

// Export singleton instance
export const submissionQueue = new BullMQSubmissionQueue();
