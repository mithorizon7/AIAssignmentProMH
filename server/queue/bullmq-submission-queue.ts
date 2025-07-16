import { Queue, Worker, QueueEvents, Job, ConnectionOptions } from 'bullmq';
import { submissions } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage-service';
import { storage } from '../storage';
import { redisClient } from './redis-client';
import { queueLogger as logger } from '../lib/logger';
import QueuePerformanceMonitor from '../lib/queue-performance-monitor';

// Queue name
const SUBMISSION_QUEUE_NAME = 'submission-processing';

// Disable BullMQ to prevent Redis request limit issues
const queueActive = false;
logger.info(`BullMQ queue disabled - using direct processing fallback`, { 
  active: queueActive, 
  mode: process.env.NODE_ENV || 'development',
  reason: 'Redis request limit exceeded - using direct processing to maintain functionality'
});

// Optimized queue configuration to minimize Redis requests
const queueConfig = {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 2,              // Reduced attempts to minimize Redis usage
    backoff: {
      type: 'exponential',    // Exponential backoff between retries
      delay: 5000             // Longer delay to reduce frequency
    },
    removeOnComplete: 1,      // Keep only 1 completed job
    removeOnFail: 1,          // Keep only 1 failed job
    
    // Optimized settings
    delay: 0,                 // No artificial delay for new jobs
    priority: 0,              // Standard priority
    
    // Extended timeout settings to reduce checking frequency
    jobTimeout: 10 * 60 * 1000,  // 10 minutes timeout for AI processing
    stalledInterval: 5 * 60 * 1000,  // Check for stalled jobs every 5 minutes
    maxStalledCount: 1           // Mark as failed after 1 stall
  },
  
  // Minimal queue settings to reduce Redis operations
  settings: {
    stalledInterval: 5 * 60 * 1000,     // Check for stalled jobs every 5 minutes
    retryProcessDelay: 30000,           // 30 second delay before retrying
    backoffStrategies: {
      exponential: (attemptsMade: number) => Math.min(Math.pow(2, attemptsMade) * 5000, 60000)
    }
  }
};

// Create queue using the centralized Redis client
const submissionQueue: Queue | null = queueActive 
  ? new Queue(SUBMISSION_QUEUE_NAME, queueConfig) 
  : null;

// Type for worker
type SubmissionWorker = Worker | null;

// Create queue events using the centralized Redis client
const queueEvents = queueActive 
  ? new QueueEvents(SUBMISSION_QUEUE_NAME, { connection: redisClient }) 
  : null;

// Disable performance monitoring to prevent Redis usage
let performanceMonitor: QueuePerformanceMonitor | null = null;
logger.info('Queue performance monitoring disabled', {
  monitoringEnabled: false,
  reason: 'Redis request limit optimization'
});

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
  // Prioritizing Gemini over OpenAI as per requirements
  let aiAdapter;
  
  // Try to use Gemini first (prioritized model)
  if (process.env.GEMINI_API_KEY) {
    logger.info('AI adapter selected', { 
      adapter: 'Gemini',
      model: 'models/gemini-2.5-flash-preview-05-20'
    });
    aiAdapter = new GeminiAdapter();
  } 
  // Fall back to OpenAI only if Gemini API key is not available
  else if (process.env.OPENAI_API_KEY) {
    logger.info('AI adapter selected', { 
      adapter: 'OpenAI', 
      model: 'gpt-4.1-mini-2025-04-14',
      note: 'Using OpenAI as fallback (Gemini API key not found)'
    });
    aiAdapter = new OpenAIAdapter();
  } 
  // Final fallback if no keys are available
  else {
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

// Skip BullMQ worker initialization - use direct processing instead
let submissionWorker: SubmissionWorker = null;
logger.info('BullMQ worker disabled to prevent Redis request limit issues');
if (false) { // Disabled to prevent Redis usage
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

        // Prepare for analysis
        await job.updateProgress(40);
        
        // Initialize AI service on demand
        const aiService = createAIService();
        
        // Determine if this is a multimodal submission
        const isMultimodal = submission.mimeType && 
                             submission.mimeType !== 'text/plain' && 
                             submission.fileUrl;

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
            
            // Create a notification for the instructor about the rubric parsing error
            const instructorNotification = {
              userId: assignment.createdBy, // Instructor who created the assignment
              type: 'rubric_error',
              title: 'Rubric Parsing Error',
              message: `There was an error parsing the rubric for assignment "${assignment.title}" (ID: ${assignment.id}). The submission will be processed without the rubric, which may affect feedback quality.`,
              metadata: {
                assignmentId: assignment.id,
                submissionId: submissionId,
                error: parseError.message,
                timestamp: new Date().toISOString()
              },
              read: false,
              createdAt: new Date()
            };
            
            // Save notification (wrapped in try-catch to prevent it from affecting main flow)
            try {
              // This is a non-blocking operation - no await
              // The actual implementation depends on the notification system
              // For now, just log it as we'll implement the actual notification later
              logger.info(`Created instructor notification for rubric parsing error`, {
                notificationType: 'rubric_error',
                instructorId: assignment.createdBy,
                assignmentId: assignment.id
              });
              
              // When a notification system is implemented:
              // await storage.createNotification(instructorNotification);
            } catch (notifyError) {
              logger.error(`Failed to create instructor notification`, {
                error: notifyError.message
              });
            }
            
            // Continue without rubric but with warning
            logger.warn(`Proceeding with submission processing without rubric`, {
              assignmentId: assignment.id,
              submissionId,
              fallbackMode: true
            });
            
            // Set a minimal placeholder rubric with warning about parsing error
            rubric = {
              criteria: [],
              maxScore: 100,
              _processingNote: "Original rubric could not be parsed. This is a placeholder to indicate that rubric evaluation was intended but could not be performed."
            };
          }
        } else {
          rubric = undefined;
        }
        
        // Analyze the submission with AI based on file type
        let feedbackResult;
        if (isMultimodal) {
          // In production, fileUrl would be a path to cloud storage
          // Here we use a server-local path for simplicity
          const filePath = submission.fileUrl || '';
          
          logger.info(`Processing multimodal submission`, {
            submissionId,
            type: submission.mimeType,
            filename: submission.fileName
          });
          
          feedbackResult = await aiService.analyzeMultimodalSubmission({
            filePath: filePath,
            fileName: submission.fileName || 'unknown',
            mimeType: submission.mimeType || 'application/octet-stream',
            textContent: submission.content || undefined, // Optional extracted text
            assignmentTitle: assignment.title,
            assignmentDescription: assignment.description || undefined,
            instructorContext: assignment.instructorContext || undefined, // Instructor-only guidance
            rubric: rubric
          });
        } else {
          // Process as standard text submission
          const content = submission.content || '';
          feedbackResult = await aiService.analyzeSubmission({
            studentSubmissionContent: content,
            assignmentTitle: assignment.title,
            assignmentDescription: assignment.description || undefined,
            instructorContext: assignment.instructorContext || undefined, // Instructor-only guidance
            rubric: rubric
          });
        }
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
      connection: redisClient,
      
      // Minimal concurrency to reduce Redis load
      concurrency: 1,  // Single worker to minimize Redis requests
      
      // Performance settings
      autorun: true,              // Start processing jobs automatically
      runRetryDelay: 15000,       // Wait 15s before retrying failed connections
      
      // Advanced worker settings optimized for Redis efficiency
      settings: {
        stalledInterval: 5 * 60 * 1000,  // Check for stalled jobs every 5 minutes
        maxStalledCount: 1,              // Mark as failed after 1 stall
      },
      
      // Conservative rate limiting to stay within Redis limits
      limiter: {
        max: 5,                         // Max 5 jobs processed
        duration: 60 * 1000,            // Per minute
        bounceBack: false               // Don't bounce back to queue
      }
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
      // Process submission directly without Redis/BullMQ to avoid request limits
      logger.info('Processing submission directly (Redis queue disabled)', { submissionId });
      
      // Update submission status to processing
      await storage.updateSubmissionStatus(submissionId, 'processing');
      
      // Get submission data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }
      
      // Get assignment data
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        throw new Error(`Assignment not found: ${submission.assignmentId}`);
      }
      
      // Process the submission directly with AI service
      const aiService = createAIService();
      
      // Get submission content for AI analysis
      let content = submission.content || '';
      if (submission.contentType === 'image' || submission.contentType === 'document') {
        content = submission.fileUrl || '';
      }
      
      // Get assignment rubric
      const rubric = assignment.rubric || assignment.description || 'Please provide feedback on this submission.';
      
      // Analyze the submission
      const feedbackResult = await aiService.analyzeSubmission({
        studentSubmissionContent: content,
        assignmentTitle: assignment.title,
        assignmentDescription: assignment.description || undefined,
        instructorContext: assignment.instructorContext || undefined,
        rubric: rubric
      });
      
      // Prepare feedback for storage
      const feedbackData = await aiService.prepareFeedbackForStorage(
        submission.id,
        feedbackResult
      );
      
      // Save feedback to database using the proper storage service
      await storageService.saveFeedback(feedbackData);
      
      logger.info(`Submission processed directly (Redis fallback mode)`, { submissionId });
      return `direct-${submissionId}-${Date.now()}`;
    } catch (error) {
      logger.error(`Error processing submission directly`, { 
        submissionId, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Mark as failed
      try {
        await storage.updateSubmissionStatus(submissionId, 'failed');
      } catch (updateError) {
        logger.error(`Failed to update submission status to failed`, { 
          submissionId, 
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }
      
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
    // Return mock stats since Redis queue is disabled
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      mode: 'direct_processing',
      redis_disabled: true
    };
  },

  async getStatsDetailed(): Promise<any> {
    // Return mock detailed stats since Redis queue is disabled
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      mode: 'direct_processing',
      redis_disabled: true,
      note: 'Queue disabled - using direct processing to avoid Redis request limits'
    };
  },

  /**
   * Get detailed performance report
   */
  async getPerformanceReport() {
    return { 
      error: 'Performance monitoring disabled (Redis queue disabled)',
      mode: 'direct_processing' 
    };
  },

  /**
   * Get recent job timing data
   */
  async getRecentJobTimings(limit: number = 20) {
    if (!performanceMonitor) {
      return { error: 'Performance monitoring not available' };
    }
    
    return performanceMonitor.getRecentJobTimings(limit);
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