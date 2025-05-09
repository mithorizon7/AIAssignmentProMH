import { Queue, Worker, QueueEvents, Job, ConnectionOptions } from 'bullmq';
import { submissions } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage-service';
import { storage } from '../storage';
import { connectionOptions } from './redis';

// Queue name
const SUBMISSION_QUEUE_NAME = 'submission-processing';

// Check if Redis is available
const queueActive = process.env.NODE_ENV === 'production' || process.env.ENABLE_REDIS === 'true';
console.log(`BullMQ queue ${queueActive ? 'active' : 'inactive'} (${process.env.NODE_ENV} mode)`);

// Configure queue connection options
// Using the imported connectionOptions directly

// Create queue configuration
const queueConfig = {
  connection: connectionOptions.connection,
  // Additional queue settings for production
  ...(queueActive ? {
    defaultJobOptions: {
      attempts: 3,              // Retry failed jobs up to 3 times
      backoff: {
        type: 'exponential',    // Exponential backoff between retries
        delay: 5000             // Starting delay of 5 seconds
      },
      removeOnComplete: 100,    // Keep the last 100 completed jobs
      removeOnFail: 100         // Keep the last 100 failed jobs
    }
  } : {})
};

// Create queue
const submissionQueue: Queue = queueActive 
  ? new Queue(SUBMISSION_QUEUE_NAME, queueConfig) 
  : {} as Queue;

// Type for worker
type SubmissionWorker = Worker | null;

// Create queue events if active
const queueEvents = queueActive 
  ? new QueueEvents(SUBMISSION_QUEUE_NAME, { 
      connection: connectionOptions.connection as unknown as ConnectionOptions 
    })
  : null;

// Log queue events if active
if (queueEvents) {
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`Job ${jobId} completed successfully`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`Job ${jobId} failed: ${failedReason}`);
  });
}

// Initialize AI Service
function createAIService() {
  // Select the appropriate AI adapter based on available API keys
  let aiAdapter;
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
    
  return new AIService(aiAdapter);
}

// Create storage service
const storageService = new StorageService();

// Create worker if queue is active
let submissionWorker: SubmissionWorker = null;
if (queueActive) {
  submissionWorker = new Worker(
    SUBMISSION_QUEUE_NAME,
    async (job: Job) => {
      // Log job progress
      console.log(`Processing submission job ${job.id}, attempt ${job.attemptsMade + 1}`);
      await job.updateProgress(10);

      // Get submission data
      const submissionId = job.data.submissionId;
      
      try {
        // Get submission from database
        const submission = await storage.getSubmission(submissionId);
        if (!submission) {
          throw new Error(`Submission ${submissionId} not found`);
        }

        // Update submission status to processing
        await storage.updateSubmissionStatus(submission.id, 'processing');
        await job.updateProgress(20);

        // Get assignment for context
        const assignment = await storage.getAssignment(submission.assignmentId);
        if (!assignment) {
          throw new Error(`Assignment ${submission.assignmentId} not found`);
        }
        await job.updateProgress(30);

        // Prepare content for analysis
        let content = submission.content || ''; 
        if (submission.fileUrl && !content) {
          // In a production environment, this would download from cloud storage
          content = `File submission: ${submission.fileName || 'Unnamed file'}`;
        }
        await job.updateProgress(40);

        // Initialize AI service on demand
        const aiService = createAIService();

        // Analyze the submission with AI
        const feedbackResult = await aiService.analyzeProgrammingAssignment({
          content: content,
          assignmentContext: assignment.description || undefined
          // Note: rubric parameter would be added here when AIService interface supports it
        });
        await job.updateProgress(70);

        // Prepare feedback for database
        const feedbackData = await aiService.prepareFeedbackForStorage(
          submission.id,
          feedbackResult
        );
        await job.updateProgress(80);

        // Save feedback to database
        await storageService.saveFeedback(feedbackData);
        await job.updateProgress(90);
        
        // Update submission status to completed
        await storage.updateSubmissionStatus(submission.id, 'completed');
        await job.updateProgress(100);
        
        console.log(`Successfully processed submission ${submissionId}`);
        
        return { 
          submissionId, 
          status: 'completed',
          processingTime: Date.now() - job.timestamp
        };
      } catch (error: any) {
        console.error(`Error processing submission ${submissionId}:`, error);
        
        // Mark submission as failed if this is the final attempt
        const maxAttempts = job.opts.attempts || 1;
        if (job.attemptsMade >= maxAttempts - 1) {
          try {
            await storage.updateSubmissionStatus(submissionId, 'failed');
          } catch (updateError) {
            console.error(`Failed to update submission status:`, updateError);
          }
        }
        
        // Re-throw the error so BullMQ can handle retries
        throw error;
      }
    },
    { 
      connection: connectionOptions.connection as unknown as ConnectionOptions,
      concurrency: 5,  // Process up to 5 jobs concurrently
      autorun: true,   // Start processing jobs automatically
    }
  );

  // Handle worker events
  submissionWorker.on('completed', (job: Job) => {
    console.log(`Worker completed job ${job.id} successfully`);
  });

  submissionWorker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`Worker failed job ${job?.id}:`, error);
  });

  submissionWorker.on('error', (error: Error) => {
    console.error('Worker error:', error);
  });
}

// Helper functions to interact with the queue
export const queueApi = {
  /**
   * Add a submission to the processing queue
   * @param submissionId The ID of the submission to process
   */
  async addSubmission(submissionId: number): Promise<string> {
    try {
      // First update the status in database
      await storage.updateSubmissionStatus(submissionId, 'pending');
      
      // Handle mock mode (no real Redis connection)
      if (!queueActive) {
        const mockJobId = `mock-submission-${submissionId}-${Date.now()}`;
        console.log(`[DEVELOPMENT] Mock processing submission ${submissionId} with ID ${mockJobId}`);
        
        // In development without Redis, immediately process the submission 
        // using the same process as the worker would
        setTimeout(async () => {
          try {
            console.log(`[DEVELOPMENT] Processing submission ${submissionId} directly`);
            
            // Get submission from database
            const submission = await storage.getSubmission(submissionId);
            if (!submission) {
              throw new Error(`Submission ${submissionId} not found`);
            }
            
            // Update status to processing
            await storage.updateSubmissionStatus(submission.id, 'processing');
            
            // Get assignment for context
            const assignment = await storage.getAssignment(submission.assignmentId);
            if (!assignment) {
              throw new Error(`Assignment ${submission.assignmentId} not found`);
            }
            
            // Prepare content for analysis
            let content = submission.content || '';
            if (submission.fileUrl && !content) {
              content = `File submission: ${submission.fileName || 'Unnamed file'}`;
            }
            
            // Initialize AI service and process
            const aiService = createAIService();
            
            // Analyze submission
            const feedbackResult = await aiService.analyzeProgrammingAssignment({
              content,
              assignmentContext: assignment.description || undefined
            });
            
            // Prepare and save feedback
            const feedbackData = await aiService.prepareFeedbackForStorage(
              submission.id,
              feedbackResult
            );
            
            await storageService.saveFeedback(feedbackData);
            
            // Mark as completed
            await storage.updateSubmissionStatus(submission.id, 'completed');
            
            console.log(`[DEVELOPMENT] Successfully processed submission ${submissionId}`);
          } catch (error) {
            console.error(`[DEVELOPMENT] Error processing submission ${submissionId}:`, error);
            await storage.updateSubmissionStatus(submissionId, 'failed');
          }
        }, 100); // Small delay to let the response return first
        
        return mockJobId;
      }
      
      // Production mode with Redis
      if ('add' in submissionQueue) {
        // Add job to the queue
        const job = await submissionQueue.add('processSubmission', { submissionId }, {
          jobId: `submission-${submissionId}`,
          // Job-specific options can override queue defaults here
        });
        
        // BullMQ job.id can be undefined in some edge cases, provide fallback 
        const jobId = job.id || `submission-${submissionId}-${Date.now()}`;
        console.log(`Submission ${submissionId} added to queue with job ID ${jobId}`);
        return jobId;
      } else {
        throw new Error('Queue not properly initialized');
      }
    } catch (error) {
      console.error(`Error adding submission ${submissionId} to queue:`, error);
      throw error;
    }
  },
  
  /**
   * Retry all failed submissions
   */
  async retryFailedSubmissions(): Promise<number> {
    try {
      // Get all failed submissions from the database
      // Since getSubmissionsByStatus doesn't exist yet, use direct database query
      const failedSubmissions = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.status, 'failed'));
      
      // Add each back to the queue
      const promises = failedSubmissions.map(sub => this.addSubmission(sub.id));
      await Promise.all(promises);
      
      return failedSubmissions.length;
    } catch (error) {
      console.error('Error retrying failed submissions:', error);
      throw error;
    }
  },
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    // In development mode without Redis, return mock stats
    if (!queueActive) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        mode: 'development'
      };
    }
    
    try {
      // In production mode with active queue
      if ('getWaitingCount' in submissionQueue) {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          submissionQueue.getWaitingCount(),
          submissionQueue.getActiveCount(),
          submissionQueue.getCompletedCount(),
          submissionQueue.getFailedCount(),
          submissionQueue.getDelayedCount()
        ]);
        
        return {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed,
          mode: 'production'
        };
      } else {
        throw new Error('Queue methods not available');
      }
    } catch (error: any) {
      console.error('Error getting queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        error: error?.message || 'Unknown error',
        mode: 'error'
      };
    }
  },
  
  /**
   * Graceful shutdown of queue and worker
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down queue and worker...');
    if (submissionWorker) {
      await submissionWorker.close();
    }
    if (queueActive && 'close' in submissionQueue) {
      await submissionQueue.close();
    }
    console.log('Queue and worker shut down successfully');
  }
};

// Make sure workers and queues are cleaned up on process exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await queueApi.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await queueApi.shutdown();
  process.exit(0);
});

// Make submissionQueue available for the dashboard
export default submissionQueue;