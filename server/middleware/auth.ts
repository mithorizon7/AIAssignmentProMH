/**
 * Authentication Middleware
 * 
 * Provides middleware functions for route protection:
 * - requireAuth: Ensures the user is authenticated
 * - requireAdmin: Ensures the user is authenticated and has admin role
 * - requireInstructor: Ensures the user is authenticated and has instructor role
 */

import { Request, Response, NextFunction } from 'express';
import { userRoleEnum } from '../../shared/schema';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: typeof userRoleEnum.enumValues[number];
    }
    
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to require authentication for a route
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to require admin role for a route
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
}

/**
 * Middleware to require instructor role for a route
 */
export function requireInstructor(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Instructor access required' });
  }
  
  next();
}