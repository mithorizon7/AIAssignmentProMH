import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { submissions, users, courses, assignments, feedback, enrollments } from '@shared/schema';
import { eq, count, and, desc, sql, inArray } from 'drizzle-orm';
import { batchOperations } from '../services/batch-operations';
import { metricsService } from '../services/metrics-service';
import { stringify } from 'csv-stringify';
import { asyncHandler } from '../lib/error-handler';

const router = Router();

// Middleware to ensure user is an instructor
const requireInstructor = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (user?.role !== 'instructor' && user?.role !== 'admin') {
    return res.status(403).json({ message: 'Instructor access required' });
  }
  next();
};

// Get student progress for an entire course (optimized for large classes)
router.get('/students/progress/:courseId', requireInstructor, asyncHandler(async (req: Request, res: Response) => {
    const courseId = parseInt(req.params.courseId);

    // Validate course exists and instructor has access
    const course = await storage.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Get course stats using our optimized batch operations
    const stats = await batchOperations.getCourseStats(courseId);
    
    // Get all assignments for this course
    const courseAssignments = await db
      .select()
      .from(assignments)
      .where(eq(assignments.courseId, courseId))
      .orderBy(assignments.dueDate);
      
    // Get all students and their submissions
    const enrolledStudents = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .innerJoin(enrollments, eq(users.id, enrollments.userId))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(users.name);
      
    // Format the data with high-level stats
    const progressData = {
      courseId,
      courseName: course.name,
      stats,
      assignments: courseAssignments,
      studentCount: enrolledStudents.length,
      students: enrolledStudents
    };
    
    res.json(progressData);
}));

// Bulk enroll students in a course
router.post('/course/:courseId/enroll-students', requireInstructor, asyncHandler(async (req: Request, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const { studentIds } = req.body;
    
    if (!Array.isArray(studentIds) || !studentIds.length) {
      return res.status(400).json({ message: 'Student IDs must be provided as an array' });
    }
    
    // Validate course exists and instructor has access
    const course = await storage.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Use our optimized batch enrollment service for large classes
    const result = await batchOperations.batchEnrollStudents(courseId, studentIds);
    
    res.json({ 
      message: `Successfully enrolled ${result.success} students in the course (${result.failed} failed)`,
      courseId,
      success: result.success,
      failed: result.failed,
      total: studentIds.length
    });
}));

// Get all submissions for an assignment with detailed metrics
router.get('/assignments/:id/submissions', requireInstructor, asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);
    
    // Validate assignment exists and instructor has access
    const assignment = await storage.getAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Get all submissions for the assignment with feedback
    const submissionsData = await db
      .select({
        submission: submissions,
        userName: users.name,
        userEmail: users.email
      })
      .from(submissions)
      .innerJoin(users, eq(submissions.userId, users.id))
      .where(eq(submissions.assignmentId, assignmentId))
      .orderBy(desc(submissions.createdAt));
    
    // Get submission IDs for feedback lookup
    const submissionIds = submissionsData.map((s: { submission: { id: number } }) => s.submission.id);
    
    // Get feedback for all submissions
    const feedbackItems = submissionIds.length > 0 
      ? await db
          .select()
          .from(feedback)
          .where(inArray(feedback.submissionId, submissionIds))
      : [];
    
    const feedbackMap = new Map();
    for (const item of feedbackItems) {
      feedbackMap.set(item.submissionId, item);
    }
    
    // Get assignment metrics
    const metrics = await metricsService.getAssignmentMetrics(assignmentId);
    
    // Combine the data
    const result = submissionsData.map((item: { submission: Submission; userName: string; userEmail: string }) => ({
      ...item.submission,
      student: {
        name: item.userName,
        email: item.userEmail
      },
      feedback: feedbackMap.get(item.submission.id) || null
    }));
    
    res.json({
      assignment,
      submissions: result,
      metrics: metrics[0] || null
    });
}));

// Export grades as CSV
router.get('/export/grades/:courseId', requireInstructor, asyncHandler(async (req: Request, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    
    // Validate course exists and instructor has access
    const course = await storage.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Use our optimized batch operations to generate CSV efficiently
    // This implementation can handle tens of thousands of students
    const csvData = await batchOperations.exportCourseGrades(courseId);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="grades-course-${courseId}.csv"`);
    
    res.send(csvData);
}));

export default router;