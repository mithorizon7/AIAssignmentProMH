/**
 * Authentication Middleware
 * 
 * Provides middleware functions for route protection:
 * - requireAuth: Ensures the user is authenticated
 * - requireRole: Flexible role-checking middleware factory
 * - requireAdmin: Shorthand for admin-only access
 * - requireInstructor: Shorthand for instructor+ access
 */

import { Request, Response, NextFunction } from 'express';
import { userRoleEnum } from '../../shared/schema';

// Type alias for user roles from the schema
type UserRole = typeof userRoleEnum.enumValues[number];

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: UserRole;
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
 * Flexible role-checking middleware factory
 * Creates middleware that checks if the user has one of the allowed roles
 * Admins are always allowed unless explicitly excluded
 * 
 * @param allowedRoles Array of roles that are allowed to access the route
 * @param options Configuration options for role checking
 * @returns Express middleware function
 * 
 * @example
 * // Allow only admins
 * app.get('/admin/panel', requireAuth, requireRole(['admin']));
 * 
 * // Allow instructors and admins
 * app.get('/instructor/course', requireAuth, requireRole(['instructor']));
 * 
 * // Allow students, instructors, and admins
 * app.get('/dashboard', requireAuth, requireRole(['student', 'instructor']));
 * 
 * // Allow only students (exclude admins)
 * app.get('/student-only', requireAuth, requireRole(['student'], { excludeAdmins: true }));
 */
export function requireRole(
  allowedRoles: UserRole[], 
  options: { excludeAdmins?: boolean } = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check authentication first
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    // Admins are always allowed unless explicitly excluded
    if (userRole === 'admin' && !options.excludeAdmins) {
      return next();
    }

    // Check if user's role is in the allowed roles list
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Generate appropriate error message based on allowed roles
    const roleNames = allowedRoles.join(' or ');
    const accessType = allowedRoles.length === 1 ? 
      `${allowedRoles[0]} access` : 
      `${roleNames} access`;

    return res.status(403).json({ 
      message: `Access denied. ${accessType} required.`,
      userRole: userRole,
      requiredRoles: allowedRoles
    });
  };
}

/**
 * Shorthand middleware for admin-only access
 * Equivalent to requireRole(['admin'])
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin'])(req, res, next);
}

/**
 * Shorthand middleware for instructor+ access (instructors and admins)
 * Equivalent to requireRole(['instructor'])
 */
export function requireInstructor(req: Request, res: Response, next: NextFunction) {
  return requireRole(['instructor'])(req, res, next);
}

/**
 * Shorthand middleware for student+ access (students, instructors, and admins)
 * Equivalent to requireRole(['student'])
 */
export function requireStudent(req: Request, res: Response, next: NextFunction) {
  return requireRole(['student'])(req, res, next);
}