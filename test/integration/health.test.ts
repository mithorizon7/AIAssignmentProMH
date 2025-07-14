import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('Health Check Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should return health check in under 1 second', async () => {
      const start = Date.now();
      const response = await request(app)
        .get('/api/health');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });
  });
});