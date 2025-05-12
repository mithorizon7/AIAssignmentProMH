import { logger } from './error-handler';

/**
 * Audit event categories for security and administrative actions
 */
export enum AuditCategory {
  AUTH = 'auth',
  USER_MGMT = 'user_management',
  DATA_ACCESS = 'data_access',
  ADMIN = 'admin',
  PERMISSION = 'permission',
  SYSTEM = 'system',
  SECURITY = 'security'
}

/**
 * Event types within categories
 */
export enum AuditEventType {
  // Auth events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  REGISTER = 'register',
  
  // User management events
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  ROLE_CHANGE = 'role_change',
  
  // Data access events
  DATA_READ = 'data_read',
  DATA_CREATE = 'data_create',
  DATA_UPDATE = 'data_update',
  DATA_DELETE = 'data_delete',
  SENSITIVE_ACCESS = 'sensitive_access',
  
  // Admin actions
  SYSTEM_CONFIG = 'system_config',
  BULK_OPERATION = 'bulk_operation',
  
  // Permission events
  PERMISSION_DENIED = 'permission_denied',
  PERMISSION_GRANTED = 'permission_granted',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_FAILURE = 'csrf_failure',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_DETECTED = 'brute_force_detected'
}

/**
 * Structure of an audit log entry
 */
export interface AuditLogEntry {
  timestamp: string;
  category: AuditCategory;
  event: AuditEventType;
  userId?: number | string; // User who performed the action or was affected
  username?: string; // Username for readability in logs
  targetId?: number | string; // ID of the entity being acted upon
  targetType?: string; // Type of entity (e.g., "user", "assignment", "course")
  ipAddress?: string; // IP address of the client
  userAgent?: string; // User agent of the client
  description?: string; // Additional details about the event
  status: 'success' | 'failure'; // Outcome of the action
  details?: Record<string, any>; // Any additional structured data
}

/**
 * Creates and logs an audit entry
 */
export function logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const logEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };
  
  // Sanitize any sensitive data from the details before logging
  if (logEntry.details) {
    // Remove passwords, tokens, etc.
    const sanitizedDetails = { ...logEntry.details };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'csrf'];
    
    for (const field of sensitiveFields) {
      for (const key of Object.keys(sanitizedDetails)) {
        if (key.toLowerCase().includes(field)) {
          sanitizedDetails[key] = '[REDACTED]';
        }
      }
    }
    
    logEntry.details = sanitizedDetails;
  }
  
  // Format log message for consistency
  const logMessage = `[AUDIT] [${logEntry.category}] [${logEntry.event}] ${logEntry.description || ''}`;
  
  // Use structured logging
  logger.info(logMessage, logEntry);
  
  // In production, you would likely also:
  // 1. Store in database for query and analysis
  // 2. Send to external SIEM or log aggregation service
  // 3. Trigger alerts for certain security events
}

/**
 * Logs a successful authentication
 */
export function logSuccessfulAuth(userId: number, username: string, ipAddress: string, userAgent?: string): void {
  logAudit({
    category: AuditCategory.AUTH,
    event: AuditEventType.LOGIN_SUCCESS,
    userId,
    username,
    ipAddress,
    userAgent,
    description: `User ${username} (ID: ${userId}) successfully authenticated`,
    status: 'success'
  });
}

/**
 * Logs a failed authentication attempt
 */
export function logFailedAuth(username: string, ipAddress: string, reason: string, userAgent?: string): void {
  logAudit({
    category: AuditCategory.AUTH,
    event: AuditEventType.LOGIN_FAILURE,
    username,
    ipAddress,
    userAgent,
    description: `Failed authentication attempt for user ${username}`,
    status: 'failure',
    details: { reason }
  });
}

/**
 * Logs user logout
 */
export function logLogout(userId: number, username: string, ipAddress: string): void {
  logAudit({
    category: AuditCategory.AUTH,
    event: AuditEventType.LOGOUT,
    userId,
    username,
    ipAddress,
    description: `User ${username} (ID: ${userId}) logged out`,
    status: 'success'
  });
}

/**
 * Logs access to sensitive data
 */
export function logSensitiveDataAccess(
  userId: number,
  username: string, 
  targetType: string, 
  targetId: string | number,
  ipAddress: string,
  details?: Record<string, any>
): void {
  logAudit({
    category: AuditCategory.DATA_ACCESS,
    event: AuditEventType.SENSITIVE_ACCESS,
    userId,
    username,
    targetType,
    targetId,
    ipAddress,
    description: `User ${username} (ID: ${userId}) accessed sensitive ${targetType} data (ID: ${targetId})`,
    status: 'success',
    details
  });
}

/**
 * Logs an administrative action
 */
export function logAdminAction(
  userId: number,
  username: string,
  action: string,
  targetType?: string,
  targetId?: string | number,
  ipAddress?: string,
  details?: Record<string, any>
): void {
  logAudit({
    category: AuditCategory.ADMIN,
    event: AuditEventType.SYSTEM_CONFIG,
    userId,
    username,
    targetType,
    targetId,
    ipAddress,
    description: `Admin ${username} (ID: ${userId}) performed action: ${action}`,
    status: 'success',
    details
  });
}

/**
 * Logs a permission change event (role assignment, etc.)
 */
export function logPermissionChange(
  adminUserId: number,
  adminUsername: string,
  targetUserId: number,
  targetUsername: string,
  oldRole: string,
  newRole: string,
  ipAddress: string
): void {
  logAudit({
    category: AuditCategory.PERMISSION,
    event: AuditEventType.ROLE_CHANGE,
    userId: adminUserId,
    username: adminUsername,
    targetId: targetUserId,
    targetType: 'user',
    ipAddress,
    description: `User ${targetUsername} (ID: ${targetUserId}) role changed from ${oldRole} to ${newRole} by ${adminUsername}`,
    status: 'success',
    details: { oldRole, newRole }
  });
}

/**
 * Logs a security-related event (CSRF failure, rate limit, etc.)
 */
export function logSecurityEvent(
  event: AuditEventType,
  ipAddress: string,
  userId?: number,
  username?: string,
  details?: Record<string, any>
): void {
  const userInfo = userId ? `User ${username} (ID: ${userId})` : 'Anonymous user';
  
  logAudit({
    category: AuditCategory.SECURITY,
    event,
    userId,
    username,
    ipAddress,
    description: `Security event: ${event} detected from ${ipAddress}. ${userInfo}`,
    status: 'failure',
    details
  });
}

/**
 * Logs creation of a new user (registration)
 */
export function logUserCreation(
  createdUserId: number,
  createdUsername: string,
  creatorUserId?: number,
  creatorUsername?: string,
  ipAddress?: string
): void {
  const creatorInfo = creatorUserId 
    ? `by admin ${creatorUsername} (ID: ${creatorUserId})` 
    : 'via self-registration';
  
  logAudit({
    category: AuditCategory.USER_MGMT,
    event: AuditEventType.USER_CREATE,
    userId: creatorUserId,
    username: creatorUsername,
    targetId: createdUserId,
    targetType: 'user',
    ipAddress,
    description: `New user ${createdUsername} (ID: ${createdUserId}) created ${creatorInfo}`,
    status: 'success'
  });
}