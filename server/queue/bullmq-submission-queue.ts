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

// Get the Redis configuration for BullMQ
// We don't directly use the connectionOptions to avoid TypeScript errors
// (ConnectionOptions in BullMQ doesn't fully match IoRedis options)
const queueConnection = {
  // For mock Redis in development, we pass a simple connection
  connection: queueActive 
    ? { 
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        username: process.env.REDIS_USERNAME,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: null
      }
    : {} // Empty object for development mode (will use mock)
};

// Create queue configuration
const queueConfig = {
  connection: queueConnection,
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
                // Create a notification for the instructor in development mode
                console.info(`[DEVELOPMENT] Instructor notification would be created for rubric parsing error on assignment ${assignment.id}`);
                
                // Continue without rubric but with warning
                console.warn(`[DEVELOPMENT] Proceeding with submission processing without rubric for assignment ${assignment.id}`);
                
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
              
            // Determine if this is a multimodal submission
            const isMultimodal = submission.mimeType && 
                                 submission.mimeType !== 'text/plain' && 
                                 submission.fileUrl;
            
            console.log(`[DEVELOPMENT] Submission analysis - isMultimodal: ${isMultimodal}, mimeType: ${submission.mimeType}, fileUrl exists: ${!!submission.fileUrl}`);
            
            // Analyze the submission with AI based on file type
            let feedbackResult;
            if (isMultimodal) {
              // The fileUrl is now a path in GCS storage
              // The multimodal processor will handle retrieving from GCS as needed
              let filePath = submission.fileUrl || '';
              
              console.log(`[DEVELOPMENT] Processing multimodal submission ${submissionId} with original filePath: ${filePath}`);
              
              // Check if this is a GCS path without a signed URL
              // If so, we need to generate a signed URL for access
              if (filePath && !filePath.startsWith('http')) {
                try {
                  // Import only when needed to avoid circular dependencies
                  const { generateSignedUrl, isGcsConfigured } = require('../utils/gcs-client');
                  
                  // Check if GCS is configured
                  const gcsConfigStatus = isGcsConfigured();
                  console.log(`[DEVELOPMENT] GCS configured status: ${gcsConfigStatus}`);
                  
                  // Generate a signed URL for temporary access if GCS is configured
                  if (gcsConfigStatus) {
                    console.log(`[DEVELOPMENT] Generating signed URL for path: ${filePath}`);
                    const signedUrl = await generateSignedUrl(filePath, 60); // 60 minute expiration
                    logger.info(`Generated signed URL for GCS file access`, {
                      submissionId,
                      objectPath: filePath,
                      signedUrlLength: signedUrl.length
                    });
                    
                    // Use the signed URL for file processing
                    filePath = signedUrl;
                    console.log(`[DEVELOPMENT] Successfully generated signed URL with length: ${signedUrl.length}`);
                  } else {
                    console.warn(`[DEVELOPMENT] GCS not configured, cannot generate signed URL`);
                  }
                } catch (urlError) {
                  console.error(`[DEVELOPMENT] Error generating signed URL:`, urlError);
                  logger.warn(`Failed to generate signed URL for GCS file, using path directly`, {
                    submissionId,
                    error: (urlError instanceof Error) ? urlError.message : String(urlError)
                  });
                  // Continue with the original path - the processor will handle it
                }
              }
              
              console.log(`[DEVELOPMENT] Processing multimodal submission ${submissionId} of type ${submission.mimeType} with final filePath: ${filePath.substring(0, 100)}...`);
              
              try {
                console.log(`[MULTIMODAL] Attempting to analyze submission ${submissionId} with these parameters:`, {
                  fileName: submission.fileName || 'unknown',
                  fileType: submission.mimeType || 'application/octet-stream',
                  filePathLength: filePath.length,
                  filePathStart: filePath.substring(0, 30) + '...',
                  hasTextContent: !!submission.content
                });
                
                // Examine file path to ensure it's valid
                if (!filePath || filePath.trim() === '') {
                  throw new Error('File path is empty - cannot process image submission without a valid file URL');
                }
                
                // Check mime type to ensure it's supported for Gemini
                if (submission.mimeType && submission.mimeType.startsWith('image/')) {
                  console.log(`[MULTIMODAL] Processing image submission with MIME type: ${submission.mimeType}`);
                  
                  // Additional validation for image submissions
                  if (filePath.indexOf('storage.googleapis.com') > -1 || 
                      filePath.indexOf('googleusercontent.com') > -1) {
                    console.log(`[MULTIMODAL] File appears to be a valid GCS URL`);
                  } else if (!filePath.startsWith('http')) {
                    console.log(`[MULTIMODAL] File path is not an HTTP URL, assuming GCS object path: ${filePath}`);
                  }
                }
                
                // Attempt to process the file with AI
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
                
                console.log(`[MULTIMODAL] Successfully received AI feedback for ${submissionId}`);
                console.log(`[MULTIMODAL] Feedback processing time: ${feedbackResult.processingTime}ms`);
                
                // Check if we have actual feedback content
                if (feedbackResult.strengths && feedbackResult.strengths.length > 0) {
                  console.log(`[MULTIMODAL] Feedback contains ${feedbackResult.strengths.length} strengths points`);
                }
                
                if (feedbackResult.improvements && feedbackResult.improvements.length > 0) {
                  console.log(`[MULTIMODAL] Feedback contains ${feedbackResult.improvements.length} improvement points`);
                }
              } catch (multimodalError) {
                console.error(`[MULTIMODAL] Error during analysis of submission ${submissionId}:`, multimodalError);
                
                // First, attempt to get detailed error information
                const errorMessage = multimodalError instanceof Error 
                  ? multimodalError.message 
                  : String(multimodalError);
                
                // Log additional context for debugging
                console.error(`[MULTIMODAL] Error context:`, {
                  submissionId,
                  fileName: submission.fileName,
                  mimeType: submission.mimeType,
                  errorMessage
                });
                
                // For image-specific errors, add more context
                if (submission.mimeType?.startsWith('image/')) {
                  console.error(`[MULTIMODAL] Image processing error details:`, {
                    imageType: submission.mimeType,
                    filePathStart: filePath.substring(0, 30) + '...',
                    isGcsPath: !filePath.startsWith('http') && !filePath.startsWith('/'),
                    isSignedUrl: filePath.includes('storage.googleapis.com') && filePath.includes('Signature=')
                  });
                }
                
                throw new Error(`Failed to analyze multimodal submission: ${errorMessage}`);
              }
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