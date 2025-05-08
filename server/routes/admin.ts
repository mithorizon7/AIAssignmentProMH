import { Router, Request, Response } from 'express';
import { submissionQueue } from '../queue/worker';
import { db } from '../db';
import { submissions, users, courses, assignments, feedback } from '@shared/schema';
import { eq, count, avg, gt, lt, between, and, desc } from 'drizzle-orm';

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
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Failed to fetch admin statistics', error: error.message });
  }
});

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

// Get system load over time (hourly buckets for the last 24 hours)
router.get('/load', requireAdmin, async (req: Request, res: Response) => {
  try {
    // In a real implementation, you would use SQL window functions to bucket by hour
    // For now, we'll just return the submissions created in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentSubmissions = await db
      .select({
        id: submissions.id,
        createdAt: submissions.createdAt
      })
      .from(submissions)
      .where(gt(submissions.createdAt, oneDayAgo))
      .orderBy(submissions.createdAt);
    
    res.json(recentSubmissions);
  } catch (error) {
    console.error('Error fetching system load:', error);
    res.status(500).json({ message: 'Failed to fetch system load', error: error.message });
  }
});

// Retry failed submissions
router.post('/retry-failed', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get all failed submissions
    const failedSubmissions = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.status, 'failed'));
      
    // Mark them as pending to be picked up by the queue
    const retryPromises = failedSubmissions.map(submission => 
      submissionQueue.addSubmission(submission.id)
    );
    
    await Promise.all(retryPromises);
    
    res.json({ 
      message: `Requeued ${failedSubmissions.length} failed submissions`,
      count: failedSubmissions.length
    });
  } catch (error) {
    console.error('Error retrying failed submissions:', error);
    res.status(500).json({ message: 'Failed to retry submissions', error: error.message });
  }
});

export default router;