import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DrizzleError } from 'drizzle-orm';

// Custom error types for more specific error handling
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request') {
    super(400, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(409, message);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error') {
    super(500, message, false);
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service unavailable') {
    super(503, message, false);
  }
}

// Logger function that can be expanded in the future
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta ? meta : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error ? error : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta ? meta : '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, meta ? meta : '');
    }
  }
};

// Async handler to avoid try/catch repetition in routes
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorDetails = undefined;
  let isOperational = false;
  
  // Log the error
  logger.error(`Error in ${req.method} ${req.path}`, { error: err, body: req.body });
  
  // Handle specific error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  } else if (err instanceof ZodError) {
    // Validation errors (Zod)
    statusCode = 400;
    message = 'Validation Error';
    errorDetails = err.errors;
    isOperational = true;
  } else if (err instanceof DrizzleError) {
    // Database ORM errors
    statusCode = 500;
    message = 'Database Error';
    isOperational = false;
  } else if (err?.code === '23505') {
    // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
    isOperational = true;
  } else if (err?.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Related resource does not exist';
    isOperational = true;
  }
  
  // Only include stack trace in non-production environments and for non-operational errors
  const stack = process.env.NODE_ENV !== 'production' && !isOperational ? err.stack : undefined;
  
  // Send the response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      details: errorDetails,
      stack,
    }
  });
};

// Middleware to handle 404 errors
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const err = new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`);
  next(err);
};