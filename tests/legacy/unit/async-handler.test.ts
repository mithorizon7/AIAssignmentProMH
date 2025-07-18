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
    // Create a handler that actually throws synchronously (not just returning a rejected promise)
    const errorMessage = 'Synchronous error';
    const mockError = new Error(errorMessage);
    
    // Use mockImplementationOnce to make the function throw only once
    // This avoids repeated errors during test execution
    const handler = vi.fn().mockImplementationOnce(() => {
      throw mockError;
    });
    
    const middleware = asyncHandler(handler);

    // Execute the middleware
    middleware(mockReq, mockRes, mockNext);
    
    // Check that the error was passed to next
    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(mockError);
  });
  
  it('should handle truthy non-promise returns without passing to next', async () => {
    // Test that non-promise return values are handled correctly
    const handler = vi.fn().mockReturnValue("some string result");
    
    const middleware = asyncHandler(handler);
    middleware(mockReq, mockRes, mockNext);
    
    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });
});