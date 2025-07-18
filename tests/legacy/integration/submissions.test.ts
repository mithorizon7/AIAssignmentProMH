import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('Submissions Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
  });

  describe('POST /api/submissions', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .send({
          content: 'Test submission',
          assignmentId: 1
        });

      expect(response.status).toBe(401);
    });

    it('should validate submission data', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle large payloads', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB content
      const response = await request(app)
        .post('/api/submissions')
        .send({
          content: largeContent,
          assignmentId: 1
        });

      // Should reject unauthenticated request, not payload size
      expect(response.status).toBe(401);
    });

    it('should reject payloads over 10MB', async () => {
      const hugeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB content
      const response = await request(app)
        .post('/api/submissions')
        .send({
          content: hugeContent,
          assignmentId: 1
        });

      expect(response.status).toBe(413);
    });
  });

  describe('GET /api/submissions/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/submissions/1');

      expect(response.status).toBe(401);
    });

    it('should validate submission ID', async () => {
      const response = await request(app)
        .get('/api/submissions/invalid');

      expect(response.status).toBe(400);
    });
  });
});