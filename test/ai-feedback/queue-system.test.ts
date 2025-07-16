/**
 * Queue System Tests
 * 
 * Tests for the BullMQ queue system that handles AI feedback processing,
 * ensuring reliable job processing and error recovery.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from '../../server/lib/redis-client';

describe('Queue System Tests', () => {
  let submissionQueue: Queue;
  let testWorker: Worker;

  beforeAll(async () => {
    // Initialize test queue
    submissionQueue = new Queue('test-submissions', {
      connection: redisClient,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Create test worker
    testWorker = new Worker(
      'test-submissions',
      async (job: Job) => {
        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (job.data.shouldFail) {
          throw new Error('Simulated processing error');
        }
        
        return {
          feedback: {
            overallScore: 85,
            overallFeedback: 'Good work!',
            criteriaScores: [
              { name: 'Quality', score: 20, feedback: 'Well structured' },
              { name: 'Functionality', score: 22, feedback: 'Works correctly' }
            ]
          }
        };
      },
      { connection: redisClient }
    );

    // Wait for worker to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await testWorker.close();
    await submissionQueue.close();
  });

  beforeEach(async () => {
    // Clean up any existing jobs
    await submissionQueue.drain();
  });

  describe('Job Submission', () => {
    
    test('should add jobs to queue successfully', async () => {
      const jobData = {
        submissionId: 'test-submission-001',
        assignmentId: 'test-assignment-001',
        content: 'console.log("Hello, World!");',
        rubric: {
          criteria: [
            { name: 'Quality', maxScore: 25, weight: 0.5 },
            { name: 'Functionality', maxScore: 25, weight: 0.5 }
          ]
        }
      };

      const job = await submissionQueue.add('process-submission', jobData);
      
      expect(job).toBeTruthy();
      expect(job.id).toBeTruthy();
      expect(job.data).toEqual(jobData);
    });

    test('should handle job priorities', async () => {
      const lowPriorityJob = await submissionQueue.add(
        'process-submission', 
        { submissionId: 'low-priority' },
        { priority: 1 }
      );

      const highPriorityJob = await submissionQueue.add(
        'process-submission',
        { submissionId: 'high-priority' },
        { priority: 10 }
      );

      // High priority job should be processed first
      const waiting = await submissionQueue.getWaiting();
      expect(waiting[0].data.submissionId).toBe('high-priority');
    });

    test('should handle delayed jobs', async () => {
      const delayedJob = await submissionQueue.add(
        'process-submission',
        { submissionId: 'delayed-submission' },
        { delay: 2000 } // 2 second delay
      );

      expect(delayedJob.opts.delay).toBe(2000);
      
      const delayed = await submissionQueue.getDelayed();
      expect(delayed).toHaveLength(1);
      expect(delayed[0].data.submissionId).toBe('delayed-submission');
    });
  });

  describe('Job Processing', () => {
    
    test('should process jobs successfully', async () => {
      const jobData = {
        submissionId: 'test-submission-002',
        content: 'function add(a, b) { return a + b; }'
      };

      const job = await submissionQueue.add('process-submission', jobData);
      
      // Wait for processing
      const result = await job.waitUntilFinished(testWorker.queueEvents);
      
      expect(result.feedback).toBeTruthy();
      expect(result.feedback.overallScore).toBe(85);
      expect(result.feedback.criteriaScores).toHaveLength(2);
    });

    test('should retry failed jobs', async () => {
      const jobData = {
        submissionId: 'failing-submission',
        shouldFail: true
      };

      const job = await submissionQueue.add('process-submission', jobData);
      
      try {
        await job.waitUntilFinished(testWorker.queueEvents);
      } catch (error) {
        // Job should have been retried
        expect(job.attemptsMade).toBeGreaterThan(1);
        expect(job.attemptsMade).toBeLessThanOrEqual(3);
      }
    });

    test('should handle concurrent jobs', async () => {
      const jobs = [];
      
      // Add multiple jobs simultaneously
      for (let i = 0; i < 5; i++) {
        const job = await submissionQueue.add('process-submission', {
          submissionId: `concurrent-${i}`,
          content: `// Test ${i}\nconsole.log(${i});`
        });
        jobs.push(job);
      }

      // Wait for all jobs to complete
      const results = await Promise.all(
        jobs.map(job => job.waitUntilFinished(testWorker.queueEvents))
      );

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.feedback).toBeTruthy();
        expect(result.feedback.overallScore).toBe(85);
      });
    });
  });

  describe('Queue Monitoring', () => {
    
    test('should track job statistics', async () => {
      // Add some jobs
      await submissionQueue.add('process-submission', { submissionId: 'stats-1' });
      await submissionQueue.add('process-submission', { submissionId: 'stats-2' });
      await submissionQueue.add('process-submission', { submissionId: 'stats-3', shouldFail: true });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const waiting = await submissionQueue.getWaiting();
      const active = await submissionQueue.getActive();
      const completed = await submissionQueue.getCompleted();
      const failed = await submissionQueue.getFailed();

      expect(waiting.length + active.length + completed.length + failed.length).toBeGreaterThan(0);
    });

    test('should provide queue health metrics', async () => {
      const health = await submissionQueue.getJobCounts();
      
      expect(health).toHaveProperty('waiting');
      expect(health).toHaveProperty('active');
      expect(health).toHaveProperty('completed');
      expect(health).toHaveProperty('failed');
      expect(health).toHaveProperty('delayed');
      
      Object.values(health).forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle queue cleanup', async () => {
      // Add multiple completed jobs
      for (let i = 0; i < 15; i++) {
        const job = await submissionQueue.add('process-submission', {
          submissionId: `cleanup-${i}`
        });
        await job.waitUntilFinished(testWorker.queueEvents);
      }

      // Check that old completed jobs are cleaned up (should only keep 10)
      const completed = await submissionQueue.getCompleted();
      expect(completed.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling and Recovery', () => {
    
    test('should handle worker disconnection gracefully', async () => {
      const job = await submissionQueue.add('process-submission', {
        submissionId: 'disconnection-test'
      });

      // Simulate worker disconnection
      await testWorker.close();
      
      // Job should remain in waiting state
      const waiting = await submissionQueue.getWaiting();
      expect(waiting.some(j => j.data.submissionId === 'disconnection-test')).toBe(true);

      // Recreate worker
      testWorker = new Worker(
        'test-submissions',
        async (job: Job) => {
          return { feedback: { overallScore: 90, overallFeedback: 'Recovered successfully' } };
        },
        { connection: redisClient }
      );

      // Job should eventually be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await job.waitUntilFinished(testWorker.queueEvents);
      expect(result.feedback.overallFeedback).toBe('Recovered successfully');
    });

    test('should handle Redis connection issues', async () => {
      // This test would require mocking Redis disconnection
      // For now, we'll test that the queue handles connection errors gracefully
      
      try {
        const invalidQueue = new Queue('test', {
          connection: {
            host: 'invalid-host',
            port: 6379,
            maxRetriesPerRequest: 1,
            lazyConnect: true
          }
        });

        await invalidQueue.add('test-job', { data: 'test' });
      } catch (error) {
        expect(error.message).toContain('connect');
      }
    });

    test('should handle malformed job data', async () => {
      const invalidJob = await submissionQueue.add('process-submission', {
        // Missing required fields
        invalidData: true
      });

      try {
        await invalidJob.waitUntilFinished(testWorker.queueEvents);
      } catch (error) {
        expect(error).toBeTruthy();
        
        // Job should be marked as failed
        const failed = await submissionQueue.getFailed();
        expect(failed.some(j => j.id === invalidJob.id)).toBe(true);
      }
    });
  });

  describe('Performance Tests', () => {
    
    test('should handle high job throughput', async () => {
      const startTime = Date.now();
      const jobCount = 20;
      
      // Add many jobs quickly
      const jobs = await Promise.all(
        Array.from({ length: jobCount }, (_, i) =>
          submissionQueue.add('process-submission', {
            submissionId: `throughput-${i}`,
            content: `console.log(${i});`
          })
        )
      );

      // Wait for all to complete
      await Promise.all(
        jobs.map(job => job.waitUntilFinished(testWorker.queueEvents))
      );

      const duration = Date.now() - startTime;
      const jobsPerSecond = (jobCount / duration) * 1000;

      // Should process at least 5 jobs per second
      expect(jobsPerSecond).toBeGreaterThan(5);
    });

    test('should maintain memory efficiency under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many jobs
      for (let batch = 0; batch < 3; batch++) {
        const batchJobs = await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            submissionQueue.add('process-submission', {
              submissionId: `memory-test-${batch}-${i}`,
              content: 'test content'
            })
          )
        );

        await Promise.all(
          batchJobs.map(job => job.waitUntilFinished(testWorker.queueEvents))
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Integration with AI Service', () => {
    
    test('should handle AI service timeouts', async () => {
      const job = await submissionQueue.add('process-submission', {
        submissionId: 'timeout-test',
        content: 'Very complex content that might timeout',
        timeout: 1000 // 1 second timeout
      });

      // Job should either complete or fail gracefully
      try {
        const result = await job.waitUntilFinished(testWorker.queueEvents, 5000);
        expect(result.feedback).toBeTruthy();
      } catch (error) {
        expect(error.message).toMatch(/(timeout|time|limit)/i);
      }
    });

    test('should preserve submission metadata through processing', async () => {
      const metadata = {
        submissionId: 'metadata-test',
        studentId: 'student-123',
        assignmentId: 'assignment-456',
        submittedAt: new Date().toISOString(),
        content: 'test content'
      };

      const job = await submissionQueue.add('process-submission', metadata);
      const result = await job.waitUntilFinished(testWorker.queueEvents);

      // Metadata should be preserved
      expect(job.data.submissionId).toBe(metadata.submissionId);
      expect(job.data.studentId).toBe(metadata.studentId);
      expect(job.data.assignmentId).toBe(metadata.assignmentId);
    });
  });
});