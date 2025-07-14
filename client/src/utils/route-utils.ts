/**
 * Centralized route utility functions to eliminate duplicate redirect logic
 */

export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: number;
  role: UserRole;
  username: string;
  email?: string;
  name?: string;
}

/**
 * Get the appropriate dashboard path for a user based on their role
 */
export function getDashboardPath(userRole: UserRole): string {
  switch (userRole) {
    case 'admin':
      return '/admin/dashboard';
    case 'instructor':
      return '/instructor/dashboard';
    case 'student':
      return '/dashboard';
    default:
      return '/dashboard'; // Default fallback
  }
}

/**
 * Check if a user has permission to access a route with a specific role requirement
 */
export function hasRolePermission(userRole: UserRole, requiredRole: UserRole): boolean {
  // Admin has access to all routes
  if (userRole === 'admin') {
    return true;
  }
  
  // Strict role-based access: users can only access their own role's routes
  return userRole === requiredRole;
}

/**
 * Get the redirect path for unauthorized access based on user role
 */
export function getUnauthorizedRedirectPath(userRole: UserRole): string {
  return getDashboardPath(userRole);
}

/**
 * Route configuration for role-based routing
 */
export const ROLE_ROUTES = {
  student: [
    '/dashboard',
    '/assignments',
    '/submission/:id',
    '/history'
  ],
  instructor: [
    '/instructor/dashboard',
    '/instructor/assignment/:id',
    '/instructor/create-assignment',
    '/instructor/enhanced-create-assignment',
    '/instructor/courses',
    '/instructor/course/:id',
    '/instructor/course/:id/students',
    '/instructor/students',
    '/instructor/analytics',
    '/instructor/settings',
    '/instructor/profile'
  ],
  admin: [
    '/admin/dashboard',
    '/admin/users',
    '/admin/system-config',
    '/admin/system-status',
    '/admin/logs'
  ]
} as const;

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/submit/:code', // Public submission route via shareable link
  '/ux-examples'
] as const;