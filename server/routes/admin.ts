import { Router, Request, Response } from 'express';
import { submissionQueue } from '../queue/worker';
import { db } from '../db';
import { submissions, users, courses, assignments, feedback } from '@shared/schema';
import { eq, count, avg, gt, lt, between, and, desc } from 'drizzle-orm';
import { metricsService } from '../services/metrics-service';
import { asyncHandler } from '../lib/error-handler';

const router = Router();

// Middleware to ensure user is an admin
const requireAdmin = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get overall system statistics
router.get('/stats', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const [
      userCount,
      courseCount,
      assignmentCount,
      submissionCount,
      pendingCount,
      processingCount,
      completedCount,
      failedCount
    ] = await Promise.all([
      db.select({ count: count() }).from(users).then(r => r[0].count),
      db.select({ count: count() }).from(courses).then(r => r[0].count),
      db.select({ count: count() }).from(assignments).then(r => r[0].count),
      db.select({ count: count() }).from(submissions).then(r => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'pending')).then(r => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'processing')).then(r => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'completed')).then(r => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'failed')).then(r => r[0].count),
    ]);

    // Get average processing time for completed submissions
    const avgProcessingTime = await db
      .select({ avg: avg(feedback.processingTime) })
      .from(feedback)
      .then(r => r[0].avg || 0);

    res.json({
      userCount,
      courseCount,
      assignmentCount,
      submissionStats: {
        total: submissionCount,
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount
      },
      performance: {
        avgProcessingTimeMs: avgProcessingTime,
      }
    });
}));

// Get recent failed submissions for monitoring
router.get('/failed-submissions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const failedSubmissions = await db
      .select({
        id: submissions.id,
        userId: submissions.userId,
        assignmentId: submissions.assignmentId,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt
      })
      .from(submissions)
      .where(eq(submissions.status, 'failed'))
      .orderBy(desc(submissions.updatedAt))
      .limit(50);
    
    res.json(failedSubmissions);
  } catch (error) {
    console.error('Error fetching failed submissions:', error);
    res.status(500).json({ message: 'Failed to fetch failed submissions', error: error.message });
  }
});

// Get system load over time using metrics service
router.get('/load', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { unit = 'day', count = 7 } = req.query;
    
    const loadData = await metricsService.getSystemLoad(
      String(unit), 
      Number(count) || 7
    );
    
    res.json(loadData);
  } catch (error) {
    console.error('Error fetching system load:', error);
    res.status(500).json({ message: 'Failed to fetch system load', error: (error as Error).message });
  }
});

// Get detailed processing statistics
router.get('/performance', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [processingStats, percentiles] = await Promise.all([
      metricsService.getProcessingStats(),
      metricsService.getProcessingTimePercentiles()
    ]);
    
    res.json({
      ...processingStats,
      percentiles
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ message: 'Failed to fetch performance metrics', error: (error as Error).message });
  }
});

// Get metrics by assignment
router.get('/assignment-metrics/:id?', requireAdmin, async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id ? parseInt(req.params.id) : undefined;
    const metrics = await metricsService.getAssignmentMetrics(assignmentId);
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching assignment metrics:', error);
    res.status(500).json({ message: 'Failed to fetch assignment metrics', error: (error as Error).message });
  }
});

// Retry failed submissions
router.post('/retry-failed', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Use the BullMQ queue's built-in method to retry all failed submissions
    const count = await submissionQueue.retryFailedSubmissions();
    
    res.json({ 
      message: `Requeued ${count} failed submissions`,
      count
    });
  } catch (error) {
    console.error('Error retrying failed submissions:', error);
    res.status(500).json({ message: 'Failed to retry submissions', error: (error as Error).message });
  }
});

// Get queue statistics
router.get('/queue-stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await submissionQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({ message: 'Failed to fetch queue statistics', error: (error as Error).message });
  }
});

export default router;