import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { submissions, users, courses, assignments, feedback } from '@shared/schema';
import { eq, count, and, desc, sql, inArray } from 'drizzle-orm';
import { batchOperations } from '../services/batch-operations';
import { metricsService } from '../services/metrics-service';
import { stringify } from 'csv-stringify';

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
router.get('/students/progress/:courseId', requireInstructor, async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId);

    // Validate course exists and instructor has access
    const course = await storage.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Use batch operations to efficiently retrieve all data
    const progressData = await batchOperations.getUserProgressForCourse(courseId);
    
    res.json(progressData);
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ message: 'Failed to fetch student progress', error: (error as Error).message });
  }
});

// Bulk enroll students in a course
router.post('/course/:courseId/enroll-students', requireInstructor, async (req: Request, res: Response) => {
  try {
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
    
    // Bulk enroll students
    await batchOperations.bulkEnrollStudents(courseId, studentIds);
    
    res.json({ 
      message: `Successfully enrolled ${studentIds.length} students in the course`,
      courseId,
      enrolledCount: studentIds.length
    });
  } catch (error) {
    console.error('Error bulk enrolling students:', error);
    res.status(500).json({ message: 'Failed to enroll students', error: (error as Error).message });
  }
});

// Get all submissions for an assignment with detailed metrics
router.get('/assignments/:id/submissions', requireInstructor, async (req: Request, res: Response) => {
  try {
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
    const submissionIds = submissionsData.map(s => s.submission.id);
    
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
    const result = submissionsData.map(item => ({
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
  } catch (error) {
    console.error('Error fetching assignment submissions:', error);
    res.status(500).json({ message: 'Failed to fetch submissions', error: (error as Error).message });
  }
});

// Export grades as CSV
router.get('/export/grades/:courseId', requireInstructor, async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId);
    
    // Validate course exists and instructor has access
    const course = await storage.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Use batch operations to get all grades efficiently
    const progressData = await batchOperations.getUserProgressForCourse(courseId);
    
    // Format data for CSV export
    const csvData = progressData.students.map((student: any) => {
      const studentAssignments = student.submissions.reduce((acc: any, submission: any) => {
        acc[`Assignment ${submission.assignmentId} Score`] = 
          submission.feedback?.score !== undefined ? submission.feedback.score : 'N/A';
        return acc;
      }, {});
      
      return {
        'Student ID': student.userId,
        'Name': student.name,
        'Email': student.email,
        'Completion Rate': `${(student.completionRate * 100).toFixed(1)}%`,
        'Average Score': student.averageScore.toFixed(1),
        ...studentAssignments
      };
    });
    
    // Generate CSV
    const stringifier = stringify(csvData, { header: true });
    let csvOutput = '';
    
    for await (const chunk of stringifier) {
      csvOutput += chunk;
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="grades-course-${courseId}.csv"`);
    
    res.send(csvOutput);
  } catch (error) {
    console.error('Error exporting grades:', error);
    res.status(500).json({ message: 'Failed to export grades', error: (error as Error).message });
  }
});

export default router;