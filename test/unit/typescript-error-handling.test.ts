import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, errorHandler } from '../../server/lib/error-handler';
import { Request, Response } from 'express';

// Mock Response object
const mockResponse = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
};

// Mock Request object
const mockRequest = () => {
  const req: Partial<Request> = {
    method: 'GET',
    path: '/test',
    body: {},
  };
  return req as Request;
};

describe('Error Handler TypeScript Type Safety', () => {
  let req: Request;
  let res: Response;
  let next: any;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = vi.fn();
    // Clear mocks
    vi.clearAllMocks();
  });

  it('should handle ApiError correctly', () => {
    const error = new ApiError(400, 'Test error');
    errorHandler(error, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Test error',
        statusCode: 400,
      })
    }));
  });

  it('should handle unknown errors correctly', () => {
    const error = new Error('Unknown error');
    errorHandler(error, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Internal Server Error',
        statusCode: 500,
      })
    }));
  });

  it('should handle non-Error objects correctly', () => {
    const error = { message: 'Custom error object' };
    errorHandler(error as unknown, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Internal Server Error',
        statusCode: 500,
      })
    }));
  });

  it('should handle PostgreSQL unique violation error correctly', () => {
    const pgError = { code: '23505', message: 'Unique violation' };
    errorHandler(pgError, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Resource already exists',
        statusCode: 409,
      })
    }));
  });

  it('should handle PostgreSQL foreign key violation error correctly', () => {
    const pgError = { code: '23503', message: 'Foreign key violation' };
    errorHandler(pgError, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Related resource does not exist',
        statusCode: 400,
      })
    }));
  });

  // Test for null or undefined errors
  it('should handle null errors gracefully', () => {
    errorHandler(null, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Internal Server Error',
        statusCode: 500,
      })
    }));
  });
});