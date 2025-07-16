import { Queue, Worker } from 'bullmq';
import redisClient from './redis';
import { queueLogger as logger } from '../lib/logger';

const AUDIT_QUEUE_NAME = 'security-audit';

// Enable security audit queue with optimized settings
const auditQueue = new Queue(AUDIT_QUEUE_NAME, { 
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 1,
    removeOnFail: 1,
    attempts: 1,
    delay: 60000 // 1 minute delay between audits
  }
});

// Worker with minimal Redis impact
new Worker(
  AUDIT_QUEUE_NAME,
  async job => {
    logger.info('Running security audit', { jobId: job.id, requestedBy: job.data.userId });
    // TODO: implement actual audit logic and email results
  },
  { 
    connection: redisClient,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 5 * 60 * 1000 // 1 audit per 5 minutes
    }
  }
);

export async function queueSecurityAudit(userId: number): Promise<string> {
  const job = await auditQueue.add('security-audit', { userId });
  logger.info('Security audit job queued', { jobId: job.id, userId });
  return job.id as string;
}
