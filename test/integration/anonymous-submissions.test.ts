import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';

// Mock dependencies
vi.mock('../../server/storage', () => {
  return {
    storage: {
      getAssignment: vi.fn().mockImplementation(async (id) => {
        if (id === 123) {
          return {
            id: 123,
            title: 'Test Assignment',
            shareableCode: 'TEST123'
          };
        }
        return undefined;
      }),
      listAssignments: vi.fn().mockResolvedValue([
        { id: 123, title: 'Test Assignment', shareableCode: 'TEST123' }
      ])
    }
  };
});

vi.mock('../../server/services/storage-service', () => {
  return {
    storageService: {
      isAssignmentActive: vi.fn().mockResolvedValue(true),
      storeAnonymousSubmissionFile: vi.fn().mockResolvedValue('https://example.com/file.txt')
    }
  };
});

vi.mock('../../server/queue/worker', () => {
  return {
    submissionQueue: {
      add: vi.fn().mockResolvedValue({})
    }
  };
});

vi.mock('../../server/middleware/rate-limiter', () => {
  return {
    submissionRateLimiter: (req: any, res: any, next: any) => {
      if (req.headers['x-test-exceed-rate-limit'] === 'true') {
        return res.status(429).json({
          status: 'error',
          message: 'Submission rate limit exceeded. Please try again later.'
        });
      }
      next();
    },
    defaultRateLimiter: (req: any, res: any, next: any) => next(),
    authRateLimiter: (req: any, res: any, next: any) => next(),
    csrfRateLimiter: (req: any, res: any, next: any) => next()
  };
});

vi.mock('multer', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        single: vi.fn().mockImplementation(() => {
          return (req: any, res: any, next: any) => {
            if (req.headers['x-test-with-file'] === 'true') {
              req.file = {
                originalname: 'test.txt',
                buffer: Buffer.from('test content')
              };
            }
            next();
          };
        })
      };
    })
  };
});

// Mock the auth configuration
vi.mock('../../server/auth', () => {
  return {
    configureAuth: vi.fn().mockImplementation(() => ({
      requireAuth: (req: any, res: any, next: any) => next(),
      requireRole: () => (req: any, res: any, next: any) => next()
    }))
  };
});

describe('Anonymous Submissions Endpoint Integration Tests', () => {
  let app: Express;
  
  beforeEach(async () => {
    // Setup environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.CSRF_SECRET = 'b'.repeat(32);
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Register routes
    await registerRoutes(app);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should reject submissions without a shareable code', async () => {
    const response = await request(app)
      .post('/api/anonymous-submissions')
      .send({
        assignmentId: '123',
        submissionType: 'code',
        name: 'Test User',
        email: 'test@example.com',
        code: 'console.log("Hello world");'
        // No shareableCode
      });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Invalid submission data');
  });
  
  it('should reject submissions with an incorrect shareable code', async () => {
    const response = await request(app)
      .post('/api/anonymous-submissions')
      .send({
        assignmentId: '123',
        submissionType: 'code',
        name: 'Test User',
        email: 'test@example.com',
        code: 'console.log("Hello world");',
        shareableCode: 'WRONG123' // Incorrect code
      });
    
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message', 'Invalid shareable code for this assignment');
  });
  
  it('should reject submissions when rate limit is exceeded', async () => {
    const response = await request(app)
      .post('/api/anonymous-submissions')
      .set('X-Test-Exceed-Rate-Limit', 'true')
      .send({
        assignmentId: '123',
        submissionType: 'code',
        name: 'Test User',
        email: 'test@example.com',
        code: 'console.log("Hello world");',
        shareableCode: 'TEST123'
      });
    
    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty('message', 'Submission rate limit exceeded. Please try again later.');
  });
  
  it('should accept submissions with correct shareable code', async () => {
    const response = await request(app)
      .post('/api/anonymous-submissions')
      .send({
        assignmentId: '123',
        submissionType: 'code',
        name: 'Test User',
        email: 'test@example.com',
        code: 'console.log("Hello world");',
        shareableCode: 'TEST123' // Correct code
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Submission received successfully');
  });
  
  it('should handle file uploads with correct shareable code', async () => {
    const response = await request(app)
      .post('/api/anonymous-submissions')
      .set('X-Test-With-File', 'true')
      .send({
        assignmentId: '123',
        submissionType: 'file',
        name: 'Test User',
        email: 'test@example.com',
        shareableCode: 'TEST123' // Correct code
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Submission received successfully');
  });
});