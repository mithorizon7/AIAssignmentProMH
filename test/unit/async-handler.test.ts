import { describe, it, expect, vi, beforeEach } from 'vitest';
import { asyncHandler } from '../../server/lib/error-handler';
import { Request, Response, NextFunction } from 'express';

describe('AsyncHandler Type Safety', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {} as Request;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    mockNext = vi.fn() as NextFunction;
  });

  it('should pass resolved promise value to the next middleware', async () => {
    // Create a handler that returns a resolved promise
    const handler = vi.fn().mockResolvedValue('Success');
    const middleware = asyncHandler(handler);

    // Execute the middleware
    middleware(mockReq, mockRes, mockNext);
    
    // Wait for promise resolution
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled(); // Next shouldn't be called on success
    });
  });

  it('should pass rejection to next function with proper error typing', async () => {
    // Create a typed error
    const typedError = new Error('Test error');
    
    // Create a handler that returns a rejected promise
    const handler = vi.fn().mockRejectedValue(typedError);
    const middleware = asyncHandler(handler);

    // Execute the middleware
    middleware(mockReq, mockRes, mockNext);
    
    // Wait for promise rejection
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(typedError);
    });
  });

  it('should handle unknown rejection types properly', async () => {
    // Create an untyped "unknown" error
    const untypedError = { customProperty: 'This is not an Error instance' };
    
    // Create a handler that returns a rejected promise with an unknown error type
    const handler = vi.fn().mockRejectedValue(untypedError);
    const middleware = asyncHandler(handler);

    // Execute the middleware
    middleware(mockReq, mockRes, mockNext);
    
    // Wait for promise rejection
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(untypedError);
    });
  });

  it('should handle synchronous errors thrown in the handler', async () => {
    // Create a handler that throws synchronously
    const errorMessage = 'Synchronous error';
    const handler = vi.fn().mockImplementation(() => {
      throw new Error(errorMessage);
    });
    
    const middleware = asyncHandler(handler);

    // Execute the middleware
    middleware(mockReq, mockRes, mockNext);
    
    // Check that the error was passed to next
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: errorMessage
      }));
    });
  });
});