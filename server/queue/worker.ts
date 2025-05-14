import { EventEmitter } from 'events';
import { queueApi } from './bullmq-submission-queue';

/**
 * @deprecated This implementation is being replaced by BullMQ
 * For better reliability, performance, and monitoring, use bullmq-submission-queue.ts instead
 * 
 * This is a compatibility wrapper that delegates to the BullMQ implementation
 * It maintains the same interface as the original EnhancedSubmissionQueue
 * while leveraging the more robust BullMQ implementation
 */
class EnhancedSubmissionQueue extends EventEmitter {
  constructor() {
    super();
    console.log('⚠️ Legacy queue adapter initialized - Using BullMQ implementation');
    console.log('For production use, update code to import from bullmq-submission-queue.ts');
  }
  
  /**
   * Add a submission to the queue for processing
   * @param submissionId The ID of the submission to process
   */
  async addSubmission(submissionId: number): Promise<void> {
    try {
      await queueApi.addSubmission(submissionId);
      this.emit('added', submissionId);
    } catch (error) {
      console.error(`Error adding submission ${submissionId} to queue:`, error);
      throw error;
    }
  }
  
  /**
   * Add a job to the queue
   * @param jobName The name of the job
   * @param data The job data
   */
  async add(jobName: string, data: any): Promise<void> {
    try {
      if (jobName === 'process' && data.submissionId) {
        await queueApi.addSubmission(data.submissionId);
        this.emit('added', data.submissionId);
      } else {
        console.warn(`Unrecognized job name: ${jobName}`);
      }
    } catch (error) {
      console.error(`Error adding job ${jobName} to queue:`, error);
      throw error;
    }
  }
  
  /**
   * Retry all failed submissions
   */
  async retryFailedSubmissions(): Promise<number> {
    try {
      const count = await queueApi.retryFailedSubmissions();
      return count;
    } catch (error) {
      console.error('Error retrying failed submissions:', error);
      throw error;
    }
  }
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    return queueApi.getStats();
  }
}

// Export singleton instance
export const submissionQueue = new EnhancedSubmissionQueue();
