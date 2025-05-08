import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { errorHandler, notFoundHandler } from '../../server/lib/error-handler';
import * as schema from '../../shared/schema';

// Mock dependencies
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getCourse: vi.fn(),
    getCourseByCode: vi.fn(),
    createCourse: vi.fn(),
    listCourses: vi.fn(),
    getEnrollment: vi.fn(),
    createEnrollment: vi.fn(),
    listUserEnrollments: vi.fn(),
    listCourseEnrollments: vi.fn(),
    getAssignment: vi.fn(),
    createAssignment: vi.fn(),
    listAssignments: vi.fn(),
    listAssignmentsForUser: vi.fn(),
    updateAssignmentStatus: vi.fn(),
    getSubmission: vi.fn(),
    createSubmission: vi.fn(),
    listSubmissionsForUser: vi.fn(),
    listSubmissionsForAssignment: vi.fn(),
    updateSubmissionStatus: vi.fn(),
    getLatestSubmission: vi.fn(),
    getFeedback: vi.fn(),
    getFeedbackBySubmissionId: vi.fn(),
    createFeedback: vi.fn(),
  }
}));

vi.mock('../../server/services/ai-service', () => ({
  aiService: {
    generateFeedback: vi.fn(),
  }
}));

vi.mock('../../server/queue/worker', () => ({
  submissionQueue: {
    addSubmission: vi.fn(),
    getStats: vi.fn(),
  }
}));

// Setup test app
const app = express();
app.use(express.json());

// Create some test routes for integration testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route successful' });
});

app.get('/api/test/error', (req, res, next) => {
  const error = new Error('Test error');
  next(error);
});

app.post('/api/test/validation', (req, res, next) => {
  try {
    // Simple validation
    if (!req.body.name) {
      throw new Error('Name is required');
    }
    
    if (typeof req.body.age !== 'number') {
      throw new Error('Age must be a number');
    }
    
    res.json({ success: true, data: req.body });
  } catch (error) {
    next(error);
  }
});

// Add 404 handler and error handler
app.use('/api', notFoundHandler);
app.use(errorHandler);

// Create a supertest instance
const request = supertest(app);

describe('API Integration Tests', () => {
  describe('Basic route handling', () => {
    it('should return 200 for existing route', async () => {
      const response = await request.get('/api/test');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Test route successful' });
    });
    
    it('should return 404 for non-existing API route', async () => {
      const response = await request.get('/api/non-existent');
      
      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Route not found');
    });
    
    it('should handle errors correctly', async () => {
      const response = await request.get('/api/test/error');
      
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Internal Server Error');
    });
  });
  
  describe('Validation handling', () => {
    it('should validate request body', async () => {
      const response = await request
        .post('/api/test/validation')
        .send({ name: 'Test User', age: 25 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test User');
    });
    
    it('should return error for invalid request body', async () => {
      const response = await request
        .post('/api/test/validation')
        .send({ age: 'twenty-five' });
      
      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Internal Server Error');
    });
  });
});