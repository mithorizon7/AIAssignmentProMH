import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import session from 'express-session';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Mock database client
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  execute: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

// Mock entities and data
const testInstructor = {
  id: 1,
  username: 'instructor',
  name: 'Test Instructor',
  email: 'instructor@test.com',
  role: 'instructor'
};

const testStudent = {
  id: 2,
  username: 'student',
  name: 'Test Student',
  email: 'student@test.com',
  role: 'student'
};

const testCourse = {
  id: 101,
  title: 'Test Course',
  description: 'Course for integration testing',
  instructorId: testInstructor.id,
  createdAt: new Date(),
  updatedAt: new Date()
};

const testAssignment = {
  id: 201,
  title: 'Test Assignment',
  description: 'Assignment for integration testing',
  courseId: testCourse.id,
  instructorId: testInstructor.id,
  status: 'active',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  rubric: {
    criteria: [
      { name: 'Content', description: 'Accuracy and completeness', maxScore: 10 },
      { name: 'Structure', description: 'Organization and flow', maxScore: 5 }
    ],
    passingThreshold: 10,
    feedbackPrompt: 'Provide constructive feedback'
  },
  shareableCode: 'TEST123',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('Course and Assignment Flow', () => {
  // Setup express app
  const app = express();
  let request: supertest.SuperTest<supertest.Test>;
  let instructorCookie: string;
  let studentCookie: string;
  
  beforeAll(() => {
    // Configure app with middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Configure session
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));
    
    // Mock authentication middleware
    const setUser = (user: any) => (req: Request, res: Response, next: NextFunction) => {
      (req as any).user = user;
      req.isAuthenticated = () => true;
      next();
    };
    
    // Create API routes
    
    // Auth related routes
    app.post('/api/auth/login', (req: Request, res: Response) => {
      const { username, password } = req.body;
      
      if (username === 'instructor' && password === 'instructor123') {
        (req as any).user = testInstructor;
        res.status(200).json(testInstructor);
      } else if (username === 'student' && password === 'student123') {
        (req as any).user = testStudent;
        res.status(200).json(testStudent);
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    });
    
    app.get('/api/auth/user', (req: Request, res: Response) => {
      if ((req as any).user) {
        res.status(200).json((req as any).user);
      } else {
        res.status(401).json({ message: 'Not authenticated' });
      }
    });
    
    // Course related routes
    app.get('/api/courses', (req: Request, res: Response) => {
      const user = (req as any).user;
      
      if (user.role === 'instructor') {
        // Return courses created by this instructor
        res.status(200).json([testCourse]);
      } else if (user.role === 'student') {
        // Return courses enrolled by this student
        res.status(200).json([testCourse]);
      } else {
        res.status(403).json({ message: 'Forbidden' });
      }
    });
    
    app.post('/api/courses', setUser(testInstructor), (req: Request, res: Response) => {
      const { title, description } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }
      
      const newCourse = {
        id: Math.floor(Math.random() * 1000) + 1000,
        title,
        description: description || '',
        instructorId: testInstructor.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newCourse);
    });
    
    app.get('/api/courses/:id', (req: Request, res: Response) => {
      const courseId = parseInt(req.params.id);
      
      if (courseId === testCourse.id) {
        res.status(200).json(testCourse);
      } else {
        res.status(404).json({ message: 'Course not found' });
      }
    });
    
    // Assignment related routes
    app.get('/api/assignments', (req: Request, res: Response) => {
      const user = (req as any).user;
      
      if (user.role === 'instructor') {
        // Return assignments created by this instructor
        res.status(200).json([testAssignment]);
      } else if (user.role === 'student') {
        // Return assignments for enrolled courses
        res.status(200).json([testAssignment]);
      } else {
        res.status(403).json({ message: 'Forbidden' });
      }
    });
    
    app.post('/api/assignments', setUser(testInstructor), (req: Request, res: Response) => {
      const { title, description, courseId, rubric } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }
      
      if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
        return res.status(400).json({ message: 'Rubric with criteria is required' });
      }
      
      const newAssignment = {
        id: Math.floor(Math.random() * 1000) + 2000,
        title,
        description: description || '',
        courseId: courseId || null, // Allow standalone assignments
        instructorId: testInstructor.id,
        status: 'active',
        rubric,
        shareableCode: randomUUID().substring(0, 8).toUpperCase(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newAssignment);
    });
    
    app.get('/api/assignments/:id', (req: Request, res: Response) => {
      const assignmentId = parseInt(req.params.id);
      
      if (assignmentId === testAssignment.id) {
        res.status(200).json(testAssignment);
      } else {
        res.status(404).json({ message: 'Assignment not found' });
      }
    });
    
    app.patch('/api/assignments/:id/status', setUser(testInstructor), (req: Request, res: Response) => {
      const assignmentId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['upcoming', 'active', 'completed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      if (assignmentId === testAssignment.id) {
        const updatedAssignment = { ...testAssignment, status };
        res.status(200).json(updatedAssignment);
      } else {
        res.status(404).json({ message: 'Assignment not found' });
      }
    });
    
    // Submission related routes
    app.post('/api/submissions', (req: Request, res: Response) => {
      const user = (req as any).user;
      const { assignmentId, content } = req.body;
      
      if (!assignmentId) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }
      
      const newSubmission = {
        id: Math.floor(Math.random() * 1000) + 3000,
        assignmentId,
        userId: user.id,
        content: content || '',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newSubmission);
    });
    
    app.get('/api/submissions', (req: Request, res: Response) => {
      const user = (req as any).user;
      
      // Return user's submissions
      res.status(200).json([
        {
          id: 3001,
          assignmentId: testAssignment.id,
          userId: user.id,
          content: 'Test submission content',
          status: 'graded',
          feedback: {
            strengths: ['Good understanding of concepts'],
            improvements: ['Could use more examples'],
            suggestions: ['Consider expanding on section 2']
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    });
    
    app.get('/api/assignments/:id/submissions', setUser(testInstructor), (req: Request, res: Response) => {
      const assignmentId = parseInt(req.params.id);
      
      if (assignmentId === testAssignment.id) {
        res.status(200).json([
          {
            id: 3001,
            assignmentId: testAssignment.id,
            userId: testStudent.id,
            content: 'Test submission content',
            status: 'graded',
            feedback: {
              strengths: ['Good understanding of concepts'],
              improvements: ['Could use more examples'],
              suggestions: ['Consider expanding on section 2']
            },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]);
      } else {
        res.status(404).json({ message: 'Assignment not found' });
      }
    });
    
    // Initialize supertest
    request = supertest(app);
  });
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });
  
  it('should allow instructor to login and view courses', async () => {
    // Login as instructor
    const loginResponse = await request
      .post('/api/auth/login')
      .send({ username: 'instructor', password: 'instructor123' });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('id', testInstructor.id);
    expect(loginResponse.body).toHaveProperty('role', 'instructor');
    
    // Save cookies for subsequent requests
    instructorCookie = loginResponse.headers['set-cookie'];
    
    // Get authenticated user
    const userResponse = await request
      .get('/api/auth/user')
      .set('Cookie', instructorCookie);
    
    expect(userResponse.status).toBe(200);
    expect(userResponse.body).toHaveProperty('id', testInstructor.id);
    
    // Get courses
    const coursesResponse = await request
      .get('/api/courses')
      .set('Cookie', instructorCookie);
    
    expect(coursesResponse.status).toBe(200);
    expect(coursesResponse.body).toBeInstanceOf(Array);
    expect(coursesResponse.body[0]).toHaveProperty('id', testCourse.id);
  });
  
  it('should allow instructor to create a new course', async () => {
    const courseData = {
      title: 'New Test Course',
      description: 'Created during integration test'
    };
    
    const response = await request
      .post('/api/courses')
      .set('Cookie', instructorCookie)
      .send(courseData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('title', courseData.title);
    expect(response.body).toHaveProperty('instructorId', testInstructor.id);
  });
  
  it('should allow instructor to create a standalone assignment', async () => {
    const assignmentData = {
      title: 'Standalone Assignment',
      description: 'Assignment without a course',
      rubric: {
        criteria: [
          { name: 'Quality', description: 'Overall quality', maxScore: 10 },
          { name: 'Creativity', description: 'Creative approach', maxScore: 5 }
        ],
        passingThreshold: 8,
        feedbackPrompt: 'Please provide detailed feedback'
      }
    };
    
    const response = await request
      .post('/api/assignments')
      .set('Cookie', instructorCookie)
      .send(assignmentData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('title', assignmentData.title);
    expect(response.body).toHaveProperty('courseId', null); // Standalone assignment
    expect(response.body).toHaveProperty('instructorId', testInstructor.id);
    expect(response.body).toHaveProperty('shareableCode');
  });
  
  it('should allow instructor to create a course-associated assignment', async () => {
    const assignmentData = {
      title: 'Course Assignment',
      description: 'Assignment associated with a course',
      courseId: testCourse.id,
      rubric: {
        criteria: [
          { name: 'Research', description: 'Research quality', maxScore: 10 },
          { name: 'Analysis', description: 'Analytical skills', maxScore: 10 }
        ],
        passingThreshold: 12,
        feedbackPrompt: 'Please provide detailed feedback'
      }
    };
    
    const response = await request
      .post('/api/assignments')
      .set('Cookie', instructorCookie)
      .send(assignmentData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('title', assignmentData.title);
    expect(response.body).toHaveProperty('courseId', testCourse.id);
    expect(response.body).toHaveProperty('instructorId', testInstructor.id);
  });
  
  it('should allow instructor to update assignment status', async () => {
    const statusData = { status: 'completed' };
    
    const response = await request
      .patch(`/api/assignments/${testAssignment.id}/status`)
      .set('Cookie', instructorCookie)
      .send(statusData);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', testAssignment.id);
    expect(response.body).toHaveProperty('status', 'completed');
  });
  
  it('should allow student to login and view available assignments', async () => {
    // Login as student
    const loginResponse = await request
      .post('/api/auth/login')
      .send({ username: 'student', password: 'student123' });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('id', testStudent.id);
    expect(loginResponse.body).toHaveProperty('role', 'student');
    
    // Save cookies for subsequent requests
    studentCookie = loginResponse.headers['set-cookie'];
    
    // Get assignments
    const assignmentsResponse = await request
      .get('/api/assignments')
      .set('Cookie', studentCookie);
    
    expect(assignmentsResponse.status).toBe(200);
    expect(assignmentsResponse.body).toBeInstanceOf(Array);
    expect(assignmentsResponse.body[0]).toHaveProperty('id', testAssignment.id);
  });
  
  it('should allow student to submit an assignment', async () => {
    const submissionData = {
      assignmentId: testAssignment.id,
      content: 'This is a test submission'
    };
    
    const response = await request
      .post('/api/submissions')
      .set('Cookie', studentCookie)
      .send(submissionData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('assignmentId', testAssignment.id);
    expect(response.body).toHaveProperty('userId', testStudent.id);
    expect(response.body).toHaveProperty('content', submissionData.content);
  });
  
  it('should allow student to view their submissions', async () => {
    const response = await request
      .get('/api/submissions')
      .set('Cookie', studentCookie);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0]).toHaveProperty('assignmentId', testAssignment.id);
    expect(response.body[0]).toHaveProperty('userId', testStudent.id);
    // Verify feedback is included
    expect(response.body[0]).toHaveProperty('feedback');
    expect(response.body[0].feedback).toHaveProperty('strengths');
    expect(response.body[0].feedback).toHaveProperty('improvements');
  });
  
  it('should allow instructor to view submissions for an assignment', async () => {
    const response = await request
      .get(`/api/assignments/${testAssignment.id}/submissions`)
      .set('Cookie', instructorCookie);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0]).toHaveProperty('assignmentId', testAssignment.id);
    expect(response.body[0]).toHaveProperty('userId', testStudent.id);
  });
});