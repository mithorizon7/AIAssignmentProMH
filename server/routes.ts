import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { configureAuth } from "./auth";
import { submissionQueue } from "./queue/worker";
import multer from "multer";
import path from "path";
import { StorageService } from "./services/storage-service";
import { AIService } from "./services/ai-service";
import { GeminiAdapter, SUPPORTED_MIME_TYPES } from "./adapters/gemini-adapter";
import { OpenAIAdapter } from "./adapters/openai-adapter";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { submissions, feedback, users, type User } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { defaultRateLimiter, submissionRateLimiter } from "./middleware/rate-limiter";
import adminRoutes from "./routes/admin";
import instructorRoutes from "./routes/instructor";
import { determineContentType, isFileTypeAllowed, ContentType } from "./utils/file-type-settings";
import { processFileForMultimodal } from "./utils/multimodal-processor";
import { asyncHandler } from "./lib/error-handler";

// Helper function to generate a unique shareable code for assignments
function generateShareableCode(length = 8): string {
  // Generate a random UUID
  const uuid = uuidv4();
  
  // Convert to alphanumeric characters by removing dashes and taking first 'length' characters
  const code = uuid.replace(/-/g, '').substring(0, length).toUpperCase();
  
  return code;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { requireAuth, requireRole } = configureAuth(app);
  
  // Initialize services
  const storageService = new StorageService();
  
  // Mount admin routes
  app.use('/api/admin', adminRoutes);
  
  // Mount instructor routes
  app.use('/api/instructor', instructorRoutes);
  
  // Define API routes
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Authentication endpoints handled in auth.ts

  // Assignment endpoints
  app.get('/api/assignments', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    let assignments;
    
    if (user.role === 'student') {
      assignments = await storage.listAssignmentsForUser(user.id);
      
      // For each assignment, get the latest submission
      const assignmentsWithSubmissions = await Promise.all(
        assignments.map(async (assignment) => {
          const submission = await storage.getLatestSubmission(user.id, assignment.id);
          const course = await storage.getCourse(assignment.courseId);
          return {
            ...assignment,
            submissions: submission ? [submission] : [],
            course
          };
        })
      );
      
      res.json(assignmentsWithSubmissions);
    } else {
      // For instructors, return all assignments with submission counts
      assignments = await storage.listAssignments();
      
      const assignmentsWithStats = await Promise.all(
        assignments.map(async (assignment) => {
          const submissions = await storage.listSubmissionsForAssignment(assignment.id);
          const course = await storage.getCourse(assignment.courseId);
          const students = await storage.listCourseEnrollments(assignment.courseId);
          
          const submittedCount = new Set(submissions.map(s => s.userId)).size;
          
          return {
            ...assignment,
            submittedCount,
            totalStudents: students.length,
            submissionPercentage: students.length > 0 ? (submittedCount / students.length) * 100 : 0,
            course
          };
        })
      );
      
      res.json(assignmentsWithStats);
    }
  }));

  // Get specific assignment
  app.get('/api/assignments/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);
    const assignment = await storage.getAssignment(assignmentId);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    const course = await storage.getCourse(assignment.courseId);
    
    res.json({
      ...assignment,
      course
    });
  }));

  // Create assignment (instructor only)
  app.post('/api/assignments', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
    const { title, description, courseId, dueDate, rubric } = req.body;
    
    // Validate request
    const assignmentSchema = z.object({
      title: z.string().min(3),
      description: z.string().min(10),
      courseId: z.union([
        z.number().int().positive(),
        z.string().transform(val => parseInt(val))
      ]).optional(), // Make optional for standalone assignments
      dueDate: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'Invalid date format'
      }),
      rubric: z.object({
        criteria: z.array(z.object({
          id: z.string(),
          type: z.string(),
          name: z.string(),
          description: z.string(),
          maxScore: z.number().int().min(1),
          weight: z.number().int().min(1),
        })).optional(),
        totalPoints: z.number().int().positive().optional(),
        passingThreshold: z.number().int().min(0).max(100).optional(),
      }).optional(),
    });
    
    const result = assignmentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid assignment data', errors: result.error });
    }
    
    // Check if course exists (if courseId is provided)
    if (courseId) {
      const courseIdNum = typeof courseId === 'string' ? parseInt(courseId) : courseId;
      const course = await storage.getCourse(courseIdNum);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
    }
    
    // Generate a unique shareable code
    const shareableCode = generateShareableCode();
    
    // Create assignment
    const courseIdNum = courseId ? (typeof courseId === 'string' ? parseInt(courseId) : courseId) : undefined;
    const assignment = await storage.createAssignment({
      title,
      description,
      courseId: courseIdNum, // Now properly parsed and optional
      dueDate: new Date(dueDate), // The client already sends an ISO string, so we just need a Date object
      status: 'active', // Setting to active by default so students can submit immediately
      shareableCode,
      rubric: rubric ? JSON.stringify(rubric) as any : null,
    });
    
    res.status(201).json(assignment);
  }));

  // Get assignment details for instructor
  app.get('/api/assignments/:id/details', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);
    // Get the basic assignment data
    let assignment;
    try {
      assignment = await storage.getAssignment(assignmentId);
    } catch (err) {
      console.error('Error retrieving assignment:', err);
      // Generate minimal assignment data for UI to work with
      const assignments = await storage.listAssignments();
      assignment = assignments.find(a => a.id === assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
    }
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Get additional data with error handling
    let course = null;
    let submissions: any[] = [];
    let students: any[] = [];
    
    try {
      course = await storage.getCourse(assignment.courseId);
    } catch (err) {
      console.error('Error fetching course:', err);
    }
    
    try {
      submissions = await storage.listSubmissionsForAssignment(assignment.id);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
    
    try {
      students = await storage.listCourseEnrollments(assignment.courseId);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
    
    const submittedCount = submissions.length > 0 ? new Set(submissions.map(s => s.userId)).size : 0;
    
    // Ensure shareableCode is included
    let shareableCode = assignment.shareableCode;
    if (!shareableCode && assignment.id) {
      // Generate a code if one doesn't exist
      shareableCode = generateShareableCode();
      try {
        // Try to update the assignment with the new code, but don't fail if it doesn't work
        await storage.updateAssignmentShareableCode(assignment.id, shareableCode);
      } catch (err) {
        console.error('Error updating assignment with shareable code:', err);
      }
    }
    
    res.json({
      ...assignment,
      course,
      submittedCount,
      totalStudents: students.length,
      submissionPercentage: students.length > 0 ? (submittedCount / students.length) * 100 : 0,
      shareableCode: shareableCode || 'temp-' + assignment.id
    });
  }));
  
  // Update assignment status (instructor only)
  app.patch('/api/assignments/:id/status', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);
    
    if (isNaN(assignmentId)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }
    
    // Validate request
    const statusSchema = z.object({
      status: z.enum(['active', 'upcoming', 'completed'])
    });
    
    const result = statusSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid status value', errors: result.error });
    }
    
    const { status } = result.data;
    
    // Check if assignment exists
    const assignment = await storage.getAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Update assignment status
    const updatedAssignment = await storage.updateAssignmentStatus(assignmentId, status);
    
    res.json(updatedAssignment);
  }));

  // Lookup assignment by shareable code - with rate limiting
  app.get('/api/assignments/code/:code', defaultRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code;
    
    if (!code || code.length < 6) {
      return res.status(400).json({ message: 'Invalid shareable code' });
    }
    
    // Query assignments to find one with matching shareable code
    const assignments = await storage.listAssignments();
    const assignment = assignments.find(a => a.shareableCode === code);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found with this code' });
    }
    
    // Get course information
    const course = await storage.getCourse(assignment.courseId);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found for this assignment' });
    }
    
    // Check if user is authenticated
    const isAuthenticated = req.isAuthenticated();
    
    // If user is not authenticated, they will be redirected to login
    // from the client side, and then back to the submission page
    
    // Ensure assignment has a valid shareable code
    let shareableCode = assignment.shareableCode;
    
    // If no shareable code exists, generate one and try to persist it
    if (!shareableCode && assignment.id) {
      shareableCode = generateShareableCode();
      try {
        // Try to update the assignment with the new code, but don't fail if it doesn't work
        await storage.updateAssignmentShareableCode(assignment.id, shareableCode);
        console.log(`Generated new shareable code ${shareableCode} for assignment ${assignment.id}`);
      } catch (err) {
        console.error('Error updating assignment with new shareable code:', err);
      }
    }

    // Return assignment with authentication status flag set to true (always require auth)
    res.json({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      courseId: assignment.courseId,
      courseCode: course.code,
      courseName: course.name,
      dueDate: assignment.dueDate,
      // Always provide a shareable code, using temp- prefix as fallback if needed
      shareableCode: shareableCode || `TEMP-${assignment.id}`,
      requiresAuth: true, // Always require authentication for submissions
      isAuthenticated: isAuthenticated // Flag indicating if user is already authenticated
    });
  }));

  // Anonymous submission (via shareable link) - with strict rate limiting
  // The /api/anonymous-submissions endpoint is now deprecated - everything should use the authenticated endpoint
  // We're keeping this route but making it require authentication for backward compatibility
  app.post('/api/anonymous-submissions', submissionRateLimiter, requireAuth, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const submissionSchema = z.object({
      assignmentId: z.string().transform(val => parseInt(val)),
      submissionType: z.enum(['file', 'code']),
      name: z.string().min(1),
      email: z.string().email(),
      notes: z.string().optional(),
      code: z.string().optional(),
      shareableCode: z.string().min(1, "Shareable code is required for anonymous submissions"),
    });
    
    const result = submissionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid submission data', errors: result.error });
    }
    
    const { assignmentId, submissionType, name, email, notes, code, shareableCode } = result.data;
    
    // Get the assignment to validate the shareableCode
    const assignment = await storage.getAssignment(assignmentId);
    
    // Check if assignment exists
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Validate shareable code - this is a critical security check
    let storedShareableCode = assignment.shareableCode;
    
    // If assignment has no shareable code but has an ID, generate and persist one
    if (!storedShareableCode && assignment.id) {
      storedShareableCode = generateShareableCode();
      try {
        await storage.updateAssignmentShareableCode(assignment.id, storedShareableCode);
        console.log(`Generated new shareable code ${storedShareableCode} for assignment ${assignment.id}`);
      } catch (err) {
        console.error('Error updating assignment with new shareable code:', err);
      }
    }
    
    // If no valid stored code, use temporary format based on ID for security
    if (!storedShareableCode) {
      storedShareableCode = `TEMP-${assignment.id}`;
    }
    
    // Now compare the provided code with the stored/generated one
    if (shareableCode !== storedShareableCode) {
      return res.status(403).json({ message: 'Invalid shareable code' });
    }
    
    const userId = req.user ? (req.user as any).id : 0;
    
    // Prepare submission data
    let submission: any = {
      assignmentId,
      userId,
      name,
      email,
      status: 'submitted',
      notes,
      contentType: null,
      fileSize: null,
      fileName: null,
      fileExtension: null,
      submissionType
    };
    
    // Handle submission content based on type
    if (submissionType === 'file') {
      // File upload - process file from multer
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Determine content type based on file extension and mime type
      const extension = path.extname(req.file.originalname).toLowerCase().slice(1);
      const mimeType = req.file.mimetype;
      const contentType = determineContentType(mimeType, req.file.originalname);
      
      if (!contentType || !isFileTypeAllowed(extension, contentType)) {
        return res.status(400).json({ 
          message: `File type .${extension} is not allowed`,
          allowedTypes: SUPPORTED_MIME_TYPES
        });
      }
      
      // Add file information to submission
      submission.contentType = contentType;
      submission.fileSize = req.file.size;
      submission.fileName = req.file.originalname;
      submission.fileExtension = extension;
      submission.content = req.file.buffer.toString('base64');
    } else if (submissionType === 'code') {
      // Code snippet submission
      if (!code) {
        return res.status(400).json({ message: 'Code content is required for code submissions' });
      }
      
      submission.contentType = 'text';
      submission.content = code;
      submission.fileExtension = 'txt';
    } else {
      return res.status(400).json({ message: 'Invalid submission type' });
    }
    
    // Create the submission in the database
    const createdSubmission = await storage.createSubmission(submission);
    
    // Add to processing queue
    await submissionQueue.add('process', {
      submissionId: createdSubmission.id,
      assignmentId: assignmentId,
      userId: userId,
      submissionType: submissionType,
      contentType: submission.contentType,
      content: submission.content,
      fileName: submission.fileName,
      fileExtension: submission.fileExtension,
    });
    
    // Return success response
    res.status(201).json({
      id: createdSubmission.id,
      message: 'Submission added successfully and queued for processing'
    });
  }));

  // Submission endpoints
  app.post('/api/submissions', requireAuth, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      
      if (user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can submit assignments' });
      }
      
      // Validate request
      const submissionSchema = z.object({
        assignmentId: z.string().transform(val => parseInt(val)),
        submissionType: z.enum(['file', 'code']),
        notes: z.string().optional()
      });
      
      const result = submissionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid submission data', errors: result.error });
      }
      
      const { assignmentId, submissionType, notes } = result.data;
      
      // Check if assignment exists and is active
      const isActive = await storageService.isAssignmentActive(assignmentId);
      if (!isActive) {
        return res.status(400).json({ message: 'Assignment is not active or has passed its due date' });
      }
      
      // Check if student is enrolled in the course
      const isEnrolled = await storageService.isStudentEnrolled(user.id, assignmentId);
      if (!isEnrolled) {
        return res.status(403).json({ message: 'You are not enrolled in this course' });
      }
      
      // Create submission
      let fileUrl = '';
      let fileName = '';
      let content = '';
      let mimeType = null;
      let fileSize = null;
      let contentType: ContentType | null = null;
      
      if (submissionType === 'file' && req.file) {
        // Get file metadata
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;
        
        // Determine content type based on file extension and MIME type
        const fileExtension = path.extname(fileName).slice(1).toLowerCase();
        contentType = determineContentType(mimeType, fileName);
        
        console.log(`User ${user.id} submission: ${fileName}, MIME: ${mimeType}, Content type: ${contentType}`);
        
        // Verify that the file type is allowed by passing the determined content type
        // This ensures we're checking based on content category rather than exact MIME/extension match
        const isAllowed = await storage.checkFileTypeEnabled(contentType, fileExtension, mimeType);
        if (!isAllowed) {
          return res.status(400).json({ 
            message: `File type ${fileExtension} (${mimeType}) is not allowed`,
            details: 'This file type is currently not supported for AI evaluation'
          });
        }
        
        // Store file and get URL
        fileUrl = await storageService.storeSubmissionFile(req.file, user.id, assignmentId);
        
        // For text files, extract and store content
        if (contentType === 'text' && mimeType.startsWith('text/')) {
          content = req.file.buffer.toString('utf8');
        }
      } else if (submissionType === 'code') {
        // Get code from request body
        content = req.body.code || '';
        
        if (!content.trim()) {
          return res.status(400).json({ message: 'Code content is required for code submissions' });
        }
        
        // Set default metadata for code submissions
        mimeType = 'text/plain';
        contentType = 'text' as ContentType;
        fileSize = Buffer.from(content).length;
      } else {
        return res.status(400).json({ message: 'Invalid submission type or missing file' });
      }
      
      // Create submission in database with additional metadata for multimodal content
      const submission = await storage.createSubmission({
        assignmentId,
        userId: user.id,
        fileUrl,
        fileName,
        content,
        notes: notes || null,
        status: 'pending',
        mimeType: mimeType || null,
        fileSize: fileSize || null,
        contentType: contentType || null
      });
      
      // Queue submission for AI processing
      submissionQueue.addSubmission(submission.id);
      
      res.status(201).json(submission);
  }));

  // Get submissions for the current user
  app.get('/api/submissions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : undefined;
      
      // Get submissions
      const submissions = await storage.listSubmissionsForUser(user.id, assignmentId);
      
      // For each submission, get the feedback
      const submissionsWithFeedback = await Promise.all(
        submissions.map(async (submission) => {
          const feedbackItem = await storage.getFeedbackBySubmissionId(submission.id);
          return {
            ...submission,
            feedback: feedbackItem
          };
        })
      );
      
      res.json(submissionsWithFeedback);
  }));

  // Get recent submissions for the current user
  app.get('/api/submissions/recent', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      
      // Get recent submissions using the storage service instead of direct db access
      const userSubmissions = await storage.listSubmissionsForUser(user.id);
      
      // Sort by created date (descending) and take only 5
      const recentSubmissions = userSubmissions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      // For each submission, get the feedback
      const submissionsWithFeedback = await Promise.all(
        recentSubmissions.map(async (submission) => {
          const feedbackItem = await storage.getFeedbackBySubmissionId(submission.id);
          
          return {
            ...submission,
            feedback: feedbackItem
          };
        })
      );
      
      res.json(submissionsWithFeedback);
  }));

  // Get submissions for a specific assignment (instructor only)
  app.get('/api/assignments/:id/submissions', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const assignmentId = parseInt(req.params.id);
      
      // Check if assignment exists
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      const submissions = await storage.listSubmissionsForAssignment(assignmentId);
      
      // For each submission, get the feedback
      const submissionsWithFeedback = await Promise.all(
        submissions.map(async (submission) => {
          const feedback = await storage.getFeedbackBySubmissionId(submission.id);
          
          return {
            ...submission,
            feedback
          };
        })
      );
      
      res.json(submissionsWithFeedback);
  }));

  // Course endpoints
  app.get('/api/courses', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      let courses;
      
      if (user.role === 'instructor') {
        // Instructors can see all courses
        courses = await storage.listCourses();
      } else {
        // Students can only see courses they're enrolled in
        courses = await storage.listUserEnrollments(user.id);
      }
      
      res.json(courses);
  }));
  
  // Get course by ID with its assignments
  app.get('/api/courses/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const courseId = parseInt(req.params.id);
      
      if (isNaN(courseId)) {
        return res.status(400).json({ message: 'Invalid course ID' });
      }
      
      // Get the course
      const course = await storage.getCourse(courseId);
      
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      
      // Get assignments for this course
      const assignments = await storage.listAssignments(courseId);
      
      // Return course with assignments
      res.json({
        ...course,
        assignments
      });
  }));
  
  // Create course (instructor only)
  app.post('/api/courses', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const { name, code, description } = req.body;
      
      // Validate request
      const courseSchema = z.object({
        name: z.string().min(3),
        code: z.string().min(2),
        description: z.string().optional()
      });
      
      const result = courseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid course data', errors: result.error });
      }
      
      // Check if course code already exists
      const existingCourse = await storage.getCourseByCode(code);
      if (existingCourse) {
        return res.status(400).json({ message: 'Course code already exists' });
      }
      
      // Create course
      const course = await storage.createCourse({
        name,
        code,
        description: description || null
      });
      
      // Automatically enroll the test student in this course
      // This ensures the instructor can test student interactions
      const testStudent = await storage.getUserByEmail('student@test.com');
      if (testStudent) {
        await storage.createEnrollment({
          userId: testStudent.id,
          courseId: course.id
        });
        console.log(`Automatically enrolled test student (ID: ${testStudent.id}) in course ${course.name}`);
      }
      
      res.status(201).json(course);
  }));

  // Student progress data for instructors
  app.get('/api/students/progress/:assignmentId?', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1');
      const pageSize = 10;
      const searchQuery = req.query.search as string || '';
      const statusFilter = req.query.status as string || 'all';
      const assignmentId = req.params.assignmentId ? parseInt(req.params.assignmentId) : undefined;
      
      let students;
      let totalCount;
      
      if (assignmentId) {
        // Get assignment
        const assignment = await storage.getAssignment(assignmentId);
        if (!assignment) {
          return res.status(404).json({ message: 'Assignment not found' });
        }
        
        // Get all students enrolled in the course
        const enrolledStudents = await storage.listCourseEnrollments(assignment.courseId);
        
        // Get submissions for this assignment
        const submissions = await storage.listSubmissionsForAssignment(assignmentId);
        
        // Group submissions by student
        const submissionsByStudent = submissions.reduce((acc, submission) => {
          if (!acc[submission.userId]) {
            acc[submission.userId] = [];
          }
          acc[submission.userId].push(submission);
          return acc;
        }, {} as Record<number, any[]>);
        
        // Map students to progress data
        students = enrolledStudents.map(student => {
          const studentSubmissions = submissionsByStudent[student.id] || [];
          const latestSubmission = studentSubmissions.length > 0 ? 
            studentSubmissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : 
            null;
          
          let status: 'submitted' | 'not_submitted' | 'needs_review' = 'not_submitted';
          
          if (latestSubmission) {
            if (latestSubmission.status === 'completed') {
              status = 'submitted';
            } else if (['pending', 'processing'].includes(latestSubmission.status)) {
              status = 'needs_review';
            }
          }
          
          return {
            id: student.id,
            name: student.name,
            email: student.email,
            status,
            lastSubmission: latestSubmission ? new Date(latestSubmission.createdAt).toLocaleString() : undefined,
            attempts: studentSubmissions.length
          };
        });
        
        totalCount = students.length;
      } else {
        // Get all students for pagination
        const allStudents = await db.select().from(users).where(eq(users.role, 'student'));
        totalCount = allStudents.length;
        
        // Get paginated students
        students = allStudents.slice((page - 1) * pageSize, page * pageSize).map((student: User) => ({
          id: student.id,
          name: student.name,
          email: student.email,
          status: 'not_submitted', // Default status
          attempts: 0
        }));
      }
      
      // Apply search filter
      if (searchQuery) {
        students = students.filter((student: { name: string; email: string }) => 
          student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Apply status filter
      if (statusFilter !== 'all') {
        students = students.filter((student: { status: string }) => student.status === statusFilter);
      }
      
      // Calculate pagination
      const filteredCount = students.length;
      const totalPages = Math.ceil(filteredCount / pageSize);
      
      // Paginate results
      const paginatedStudents = students.slice((page - 1) * pageSize, page * pageSize);
      
      res.json({
        students: paginatedStudents,
        totalCount: filteredCount,
        totalPages,
        currentPage: page
      });
  }));

  // Assignment statistics for instructors
  app.get('/api/assignments/stats', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      // Get all assignments
      const allAssignments = await storage.listAssignments();
      
      // Get all submissions
      const submissionsQuery = await db.select().from(submissions);
      
      // Calculate stats
      const totalSubmissions = submissionsQuery.length;
      
      // Filter submissions to get those that need review
      const pendingReviews = submissionsQuery.filter(
        (s: { status: string }) => s.status === 'completed' 
      ).length;
      
      // Calculate average score (if available in feedback)
      const feedbackItems = await db.select().from(feedback);
      const scores = feedbackItems
        .map((f: { score: number | null | undefined }) => f.score)
        .filter((score: number | null | undefined) => score !== null && score !== undefined) as number[];
      
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      
      // Calculate feedback generation
      const feedbackGenerated = feedbackItems.length;
      
      // Calculate submission increase (over last week)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const submissionsLastWeek = submissionsQuery.filter(
        (s: { createdAt: string | Date }) => new Date(s.createdAt) >= oneWeekAgo
      ).length;
      
      const previousWeekStart = new Date(oneWeekAgo);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      const submissionsPreviousWeek = submissionsQuery.filter(
        (s: { createdAt: string | Date }) => new Date(s.createdAt) >= previousWeekStart && new Date(s.createdAt) < oneWeekAgo
      ).length;
      
      const submissionsIncrease = submissionsPreviousWeek > 0
        ? Math.round((submissionsLastWeek - submissionsPreviousWeek) / submissionsPreviousWeek * 100)
        : 0;
      
      res.json({
        totalSubmissions,
        pendingReviews,
        averageScore,
        feedbackGenerated,
        submissionsIncrease,
      });
  }));

  // Assignment analytics for instructors
  app.get('/api/assignments/:id?/analytics', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const assignmentId = req.params.id ? parseInt(req.params.id) : undefined;
      
      let targetAssignmentId = assignmentId;
      
      // If no specific assignment, get the most recent active assignment
      if (!targetAssignmentId) {
        const activeAssignments = (await storage.listAssignments())
          .filter(a => a.status === 'active')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        if (activeAssignments.length === 0) {
          return res.status(404).json({ message: 'No active assignments found' });
        }
        
        targetAssignmentId = activeAssignments[0].id;
      }
      
      // Get assignment
      const assignment = await storage.getAssignment(targetAssignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      // Get submissions for this assignment
      const submissions = await storage.listSubmissionsForAssignment(targetAssignmentId);
      
      // Get enrolled students
      const students = await storage.listCourseEnrollments(assignment.courseId);
      const totalStudents = students.length;
      
      // Calculate submitted students (unique)
      const submittedStudentIds = new Set(submissions.map(s => s.userId));
      const submittedCount = submittedStudentIds.size;
      
      // Calculate students who started but haven't finished
      // (have at least one submission but latest is not completed)
      const inProgressStudents = new Map();
      
      for (const submission of submissions) {
        if (!inProgressStudents.has(submission.userId) || 
            new Date(submission.createdAt) > new Date(inProgressStudents.get(submission.userId).createdAt)) {
          inProgressStudents.set(submission.userId, submission);
        }
      }
      
      const inProgressCount = Array.from(inProgressStudents.values()).filter(
        s => s.status === 'pending' || s.status === 'processing'
      ).length;
      
      // Calculate students who haven't started
      const notStartedCount = totalStudents - submittedCount;
      
      // Create timeline data (submissions per day for the last week)
      const timeline = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const count = submissions.filter(
          s => new Date(s.createdAt) >= date && new Date(s.createdAt) < nextDate
        ).length;
        
        timeline.push({
          date: date.toISOString().split('T')[0],
          count
        });
      }
      
      // Calculate average feedback metrics
      const feedbackItems = await Promise.all(
        submissions.map(s => storage.getFeedbackBySubmissionId(s.id))
      );
      
      const validFeedback = feedbackItems.filter(f => f !== undefined) as any[];
      
      const avgFeedbackTime = validFeedback.length > 0
        ? Math.round(validFeedback.reduce((sum, f) => sum + f.processingTime, 0) / validFeedback.length / 1000)
        : 0;
      
      // Average revisions per student
      const submissionsByStudent = submissions.reduce((acc, sub) => {
        if (!acc[sub.userId]) acc[sub.userId] = [];
        acc[sub.userId].push(sub);
        return acc;
      }, {} as Record<number, any[]>);
      
      const revisionsPerStudent = Object.values(submissionsByStudent)
        .map(subs => subs.length);
      
      const avgRevisionsPerStudent = revisionsPerStudent.length > 0
        ? revisionsPerStudent.reduce((sum, count) => sum + count, 0) / revisionsPerStudent.length
        : 0;
      
      // Mock improvement percentage for now
      // In a real app, this would compare scores between first and last submissions
      const avgImprovementPercentage = 18;
      
      res.json({
        assignmentStats: {
          submittedCount,
          inProgressCount,
          notStartedCount,
          totalCount: totalStudents,
          submissionPercentage: totalStudents > 0 ? (submittedCount / totalStudents) * 100 : 0
        },
        submissionTimeline: timeline,
        avgFeedbackTime,
        avgRevisionsPerStudent,
        avgImprovementPercentage
      });
  }));

  // Test rubric with AI (instructor only)
  app.post('/api/test-rubric', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const { content, assignmentContext } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }
      
      // Use AI service to analyze the content
      const aiService = new AIService(process.env.OPENAI_API_KEY ? 
        new OpenAIAdapter() : new GeminiAdapter());
      
      const feedback = await aiService.analyzeProgrammingAssignment({
        content,
        assignmentContext
      });
      
      res.json({
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        suggestions: feedback.suggestions,
        summary: feedback.summary,
        score: feedback.score
      });
  }));

  // Export grades as CSV
  app.get('/api/export/grades', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const assignmentId = parseInt(req.query.assignmentId as string);
      
      if (!assignmentId) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }
      
      // Get assignment
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      // Get course
      const course = await storage.getCourse(assignment.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      
      // Get all enrolled students
      const students = await storage.listCourseEnrollments(assignment.courseId);
      
      // Get all submissions for this assignment
      const submissions = await storage.listSubmissionsForAssignment(assignmentId);
      
      // Group submissions by student
      const submissionsByStudent = submissions.reduce((acc, sub) => {
        if (!acc[sub.userId]) acc[sub.userId] = [];
        acc[sub.userId].push(sub);
        return acc;
      }, {} as Record<number, any[]>);
      
      // Get all feedback
      const feedbackPromises = submissions.map(s => storage.getFeedbackBySubmissionId(s.id));
      const allFeedback = await Promise.all(feedbackPromises);
      
      // Create a map of submission ID to feedback
      const feedbackBySubmission = new Map();
      allFeedback.filter(Boolean).forEach(f => {
        if (f) {
          feedbackBySubmission.set(f.submissionId, f);
        }
      });
      
      // Generate CSV data
      let csv = 'Student ID,Student Name,Student Email,Submission Status,Submission Date,Last Score,Attempts,Feedback Summary\n';
      
      for (const student of students) {
        const studentSubmissions = submissionsByStudent[student.id] || [];
        
        // Sort submissions by date (newest first)
        studentSubmissions.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        const latestSubmission = studentSubmissions[0];
        
        let status = 'Not Submitted';
        let submissionDate = '';
        let score = '';
        let attempts = studentSubmissions.length.toString();
        let feedbackSummary = '';
        
        if (latestSubmission) {
          status = latestSubmission.status === 'completed' ? 'Completed' : 
                   latestSubmission.status === 'processing' ? 'Processing' : 
                   latestSubmission.status === 'pending' ? 'Pending' : 'Failed';
          
          submissionDate = new Date(latestSubmission.createdAt).toLocaleString();
          
          const feedbackForLatest = feedbackBySubmission.get(latestSubmission.id);
          if (feedbackForLatest) {
            score = feedbackForLatest.score !== null ? feedbackForLatest.score.toString() : '';
            feedbackSummary = feedbackForLatest.summary.replace(/"/g, '""'); // Escape quotes for CSV
          }
        }
        
        csv += `${student.id},"${student.name}","${student.email}","${status}","${submissionDate}","${score}","${attempts}","${feedbackSummary}"\n`;
      }
      
      // Set content type and headers for download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${course.code}_${assignment.title.replace(/\s+/g, '_')}_grades.csv"`);
      
      res.send(csv);
  }));
  
  const httpServer = createServer(app);

  return httpServer;
}
