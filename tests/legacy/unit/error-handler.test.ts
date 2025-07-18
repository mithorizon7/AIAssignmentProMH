import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ApiError, 
  BadRequestError, 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
  errorHandler
} from '../../server/lib/error-handler';
import { Request, Response } from 'express';

describe('Error Handler Unit Tests', () => {
  // Mock console methods
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Custom Error Classes', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError(418, 'I\'m a teapot');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(418);
      expect(error.message).toBe('I\'m a teapot');
      expect(error.isOperational).toBe(true);
    });

    it('should create BadRequestError with default message', () => {
      const error = new BadRequestError();
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.isOperational).toBe(true);
    });

    it('should create BadRequestError with custom message', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.isOperational).toBe(true);
    });

    it('should create UnauthorizedError correctly', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('should create ForbiddenError correctly', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });

    it('should create NotFoundError correctly', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
    });

    it('should create ConflictError correctly', () => {
      const error = new ConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
    });

    it('should create InternalServerError correctly', () => {
      const error = new InternalServerError();
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal server error');
      expect(error.isOperational).toBe(false);
    });

    it('should create ServiceUnavailableError correctly', () => {
      const error = new ServiceUnavailableError();
      expect(error.statusCode).toBe(503);
      expect(error.message).toBe('Service unavailable');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('errorHandler middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: any;
    let jsonSpy: any;

    beforeEach(() => {
      mockRequest = {
        method: 'GET',
        path: '/test',
        body: {}
      };
      
      jsonSpy = vi.fn().mockReturnValue({});
      
      mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: jsonSpy
      };
      
      mockNext = vi.fn();
    });

    it('should handle ApiError correctly', () => {
      const error = new NotFoundError('Test not found');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          message: 'Test not found',
          statusCode: 404,
          details: undefined,
          stack: undefined
        }
      });
    });

    it('should handle unknown errors with 500 status', () => {
      const error = new Error('Unknown error');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(jsonSpy.mock.calls[0][0].error.message).toBe('Internal Server Error');
      expect(jsonSpy.mock.calls[0][0].error.statusCode).toBe(500);
    });

    it('should include stack trace in non-production for non-operational errors', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new InternalServerError('System failure');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(jsonSpy.mock.calls[0][0].error.stack).toBeDefined();
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});