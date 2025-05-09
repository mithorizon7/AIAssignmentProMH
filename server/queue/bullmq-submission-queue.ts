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
import { queueLogger as logger } from '../lib/logger';

// Queue name
const SUBMISSION_QUEUE_NAME = 'submission-processing';

// Check if Redis is available
const queueActive = process.env.NODE_ENV === 'production' || process.env.ENABLE_REDIS === 'true';
logger.info(`BullMQ queue status`, { 
  active: queueActive, 
  mode: process.env.NODE_ENV || 'development' 
});

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
    logger.info(`Job completed successfully`, { 
      jobId, 
      result: returnvalue 
    });
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Job failed`, { 
      jobId, 
      reason: failedReason 
    });
  });
}

// Initialize AI Service
function createAIService() {
  // Select the appropriate AI adapter based on available API keys
  let aiAdapter;
  if (process.env.GEMINI_API_KEY) {
    logger.info('AI adapter selected', { adapter: 'Gemini' });
    aiAdapter = new GeminiAdapter();
  } else if (process.env.OPENAI_API_KEY) {
    logger.info('AI adapter selected', { adapter: 'OpenAI' });
    aiAdapter = new OpenAIAdapter();
  } else {
    logger.warn('No AI API key found - Gemini will be used by default', {
      adapter: 'Gemini',
      warning: 'Missing API key - functionality may be limited'
    });
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
      logger.info(`Processing submission job`, { 
        jobId: job.id, 
        attempt: job.attemptsMade + 1,
        submissionId: job.data.submissionId
      });
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

        // Parse the rubric if it exists in the assignment
        let rubric;
        if (assignment.rubric) {
          try {
            // Handle string vs object representation
            if (typeof assignment.rubric === 'string') {
              rubric = JSON.parse(assignment.rubric);
            } else {
              rubric = assignment.rubric;
            }
          } catch (parseError: any) {
            // Log detailed information about the parsing error
            logger.error(`Failed to parse rubric for assignment`, {
              assignmentId: assignment.id,
              submissionId,
              error: parseError.message,
              rubricString: typeof assignment.rubric === 'string' 
                ? (assignment.rubric.length > 500 
                   ? assignment.rubric.substring(0, 500) + '...' 
                   : assignment.rubric)
                : 'Not a string',
              errorCode: 'RUBRIC_PARSE_ERROR'
            });
            // Continue without rubric but with warning
            logger.warn(`Proceeding with submission processing without rubric`, {
              assignmentId: assignment.id,
              submissionId,
              fallbackMode: true
            });
            rubric = undefined;
          }
        } else {
          rubric = undefined;
        }
        
        // Analyze the submission with AI using the new method
        const feedbackResult = await aiService.analyzeSubmission({
          studentSubmissionContent: content,
          assignmentTitle: assignment.title,
          assignmentDescription: assignment.description || undefined,
          rubric: rubric
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
        
        const processingTime = Date.now() - job.timestamp;
        logger.info(`Successfully processed submission`, { 
          submissionId,
          processingTime,
          status: 'completed'
        });
        
        return { 
          submissionId, 
          status: 'completed',
          processingTime
        };
      } catch (error: any) {
        logger.error(`Error processing submission`, { 
          submissionId,
          error: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts || 1
        });
        
        // Mark submission as failed if this is the final attempt
        const maxAttempts = job.opts.attempts || 1;
        if (job.attemptsMade >= maxAttempts - 1) {
          try {
            await storage.updateSubmissionStatus(submissionId, 'failed');
            logger.info(`Marked submission as failed (final attempt)`, { submissionId });
          } catch (updateError: any) {
            logger.error(`Failed to update submission status`, { 
              submissionId,
              error: updateError.message 
            });
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
    logger.info(`Worker completed job successfully`, { 
      jobId: job.id,
      name: job.name,
      timestamp: new Date().toISOString()
    });
  });

  submissionWorker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error(`Worker job failed`, { 
      jobId: job?.id || 'unknown',
      name: job?.name,
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  });

  submissionWorker.on('error', (error: Error) => {
    logger.error('Worker error occurred', { 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
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
            
            // Parse the rubric if it exists
            let rubric;
            if (assignment.rubric) {
              try {
                // Handle string vs object representation
                if (typeof assignment.rubric === 'string') {
                  rubric = JSON.parse(assignment.rubric);
                } else {
                  rubric = assignment.rubric;
                }
              } catch (parseError: any) {
                // Log detailed information about the parsing error
                console.error(`[DEVELOPMENT] Failed to parse rubric for assignment ${assignment.id}:`, {
                  assignmentId: assignment.id,
                  submissionId,
                  error: parseError.message,
                  rubricString: typeof assignment.rubric === 'string' 
                    ? (assignment.rubric.length > 500 
                      ? assignment.rubric.substring(0, 500) + '...' 
                      : assignment.rubric)
                    : 'Not a string',
                  errorCode: 'RUBRIC_PARSE_ERROR'
                });
                // Continue without rubric but with warning
                console.warn(`[DEVELOPMENT] Proceeding with submission processing without rubric for assignment ${assignment.id}`);
                rubric = undefined;
              }
            } else {
              rubric = undefined;
            }
              
            // Analyze submission with the new method
            const feedbackResult = await aiService.analyzeSubmission({
              studentSubmissionContent: content,
              assignmentTitle: assignment.title,
              assignmentDescription: assignment.description || undefined,
              rubric: rubric
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
    logger.info('Initiating graceful shutdown of queue and worker');
    
    if (submissionWorker) {
      try {
        await submissionWorker.close();
        logger.info('Worker shutdown successful');
      } catch (error: any) {
        logger.error('Error shutting down worker', { error: error.message });
      }
    }
    
    if (queueActive && 'close' in submissionQueue) {
      try {
        await submissionQueue.close();
        logger.info('Queue shutdown successful');
      } catch (error: any) {
        logger.error('Error shutting down queue', { error: error.message });
      }
    }
    
    logger.info('Queue system shutdown complete');
  }
};

// Make sure workers and queues are cleaned up on process exit
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, initiating graceful shutdown');
  await queueApi.shutdown();
  logger.info('Process exit initiated due to SIGTERM');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, initiating graceful shutdown');
  await queueApi.shutdown();
  logger.info('Process exit initiated due to SIGINT');
  process.exit(0);
});

// Make submissionQueue available for the dashboard
export default submissionQueue;