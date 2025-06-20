import { Queue, Worker } from 'bullmq';
import redisClient from './redis';
import { queueLogger as logger } from '../lib/logger';

const AUDIT_QUEUE_NAME = 'security-audit';

const auditQueue = new Queue(AUDIT_QUEUE_NAME, { connection: redisClient });

new Worker(
  AUDIT_QUEUE_NAME,
  async job => {
    logger.info('Running security audit', { jobId: job.id, requestedBy: job.data.userId });
    // TODO: implement actual audit logic and email results
  },
  { connection: redisClient }
);

export async function queueSecurityAudit(userId: number): Promise<string> {
  const job = await auditQueue.add('security-audit', { userId });
  logger.info('Security audit job queued', { jobId: job.id, userId });
  return job.id as string;
}
