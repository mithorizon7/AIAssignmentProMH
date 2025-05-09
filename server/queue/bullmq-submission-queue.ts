import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { connectionOptions } from './redis';
import { storage } from '../storage';
import { AIService } from '../services/ai-service';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { StorageService } from '../services/storage-service';
import { submissions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '../db';

// Queue names
const SUBMISSION_QUEUE_NAME = 'submissions';

// Create a proper BullMQ queue for processing submissions
export const submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
  connection: connectionOptions.connection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,  // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000  // 5 seconds initial delay, then exponential backoff
    },
    removeOnComplete: 500,  // Keep last 500 completed jobs
    removeOnFail: 1000,     // Keep last 1000 failed jobs
  }
});

// Listen for queue events
const queueEvents = new QueueEvents(SUBMISSION_QUEUE_NAME, { 
  connection: connectionOptions.connection as unknown as ConnectionOptions 
});

// Log queue events
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});

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

// Worker to process submissions
const submissionWorker = new Worker(
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
        content = await storageService.getSubmissionContent(submission);
      }
      await job.updateProgress(40);

      // Initialize AI service on demand
      const aiService = createAIService();

      // Analyze the submission with AI
      const feedbackResult = await aiService.analyzeProgrammingAssignment({
        content: content,
        assignmentContext: assignment.description || undefined,
        rubric: assignment.rubric || undefined
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
    } catch (error) {
      console.error(`Error processing submission ${submissionId}:`, error);
      
      // Mark submission as failed if this is the final attempt
      if (job.attemptsMade >= job.opts.attempts - 1) {
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
    connection: connectionOptions.connection,
    concurrency: 5,  // Process up to 5 jobs concurrently
    autorun: true,   // Start processing jobs automatically
  }
);

// Handle worker events
submissionWorker.on('completed', (job) => {
  console.log(`Worker completed job ${job.id} successfully`);
});

submissionWorker.on('failed', (job, error) => {
  console.error(`Worker failed job ${job?.id}:`, error);
});

submissionWorker.on('error', (error) => {
  console.error('Worker error:', error);
});

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
      
      // Add job to the queue
      const job = await submissionQueue.add('processSubmission', { submissionId }, {
        jobId: `submission-${submissionId}`,
        // Job-specific options can override queue defaults here
      });
      
      console.log(`Submission ${submissionId} added to queue with job ID ${job.id}`);
      return job.id;
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
      const failedSubmissions = await storage.getSubmissionsByStatus('failed');
      
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
    try {
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
        total: waiting + active + completed + failed + delayed
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        error: error.message
      };
    }
  },
  
  /**
   * Graceful shutdown of queue and worker
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down queue and worker...');
    await submissionWorker.close();
    await submissionQueue.close();
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