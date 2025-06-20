import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import express from 'express';
// Removed ioredis import - using only Upstash Redis via REST API

// This module provides a dashboard for monitoring the submission queue

// Set up a dashboard for the queues
export function setupQueueDashboard(app: express.Express, submissionQueue: Queue) {
  // Set up the UI dashboard
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(submissionQueue)],
    serverAdapter,
  });

  // Only allow admin users to access the dashboard
  const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In a production environment, you should add proper authentication here
    // This is a simplified version that checks for admin role
    const user = (req as any).user;
    
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).send('Unauthorized: Admin access required');
    }
  };

  // Mount the dashboard UI
  app.use('/admin/queues', adminAuth, serverAdapter.getRouter());
  
  console.log('Queue dashboard set up at /admin/queues');
  
  return serverAdapter;
}

// Function to get queue stats
export async function getQueueStats(redisClient: any) {
  try {
    // Get the number of jobs in each state for the submissions queue
    const pending = await redisClient.zcard('bull:submissions:wait');
    const active = await redisClient.zcard('bull:submissions:active');
    const completed = await redisClient.zcard('bull:submissions:completed');
    const failed = await redisClient.zcard('bull:submissions:failed');
    const delayed = await redisClient.zcard('bull:submissions:delayed');
    
    return {
      pending,
      active,
      completed,
      failed,
      delayed,
      total: pending + active + completed + failed + delayed
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
      error: 'Failed to retrieve queue stats'
    };
  }
}