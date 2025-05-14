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
      db.select({ count: count() }).from(users).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(courses).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(assignments).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(submissions).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'pending')).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'processing')).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'completed')).then((r: { count: number }[]) => r[0].count),
      db.select({ count: count() }).from(submissions).where(eq(submissions.status, 'failed')).then((r: { count: number }[]) => r[0].count),
    ]);

    // Get average processing time for completed submissions
    const avgProcessingTime = await db
      .select({ avg: avg(feedback.processingTime) })
      .from(feedback)
      .then((r: { avg: number | null }[]) => r[0].avg || 0);

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
router.get('/failed-submissions', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
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
}));

// Get system load over time using metrics service
router.get('/load', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { unit = 'day', count = 7 } = req.query;
  
  const loadData = await metricsService.getSystemLoad(
    String(unit), 
    Number(count) || 7
  );
  
  res.json(loadData);
}));

// Get detailed processing statistics
router.get('/performance', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const [processingStats, percentiles] = await Promise.all([
    metricsService.getProcessingStats(),
    metricsService.getProcessingTimePercentiles()
  ]);
  
  res.json({
    ...processingStats,
    percentiles
  });
}));

// Get metrics by assignment
router.get('/assignment-metrics/:id?', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const assignmentId = req.params.id ? parseInt(req.params.id) : undefined;
  const metrics = await metricsService.getAssignmentMetrics(assignmentId);
  
  res.json(metrics);
}));

// Retry failed submissions
router.post('/retry-failed', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  // Use the BullMQ queue's built-in method to retry all failed submissions
  const count = await submissionQueue.retryFailedSubmissions();
  
  res.json({ 
    message: `Requeued ${count} failed submissions`,
    count
  });
}));

// Get queue statistics
router.get('/queue-stats', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const stats = await submissionQueue.getStats();
  res.json(stats);
}));

export default router;