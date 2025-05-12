import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../server/lib/error-handler';
import {
  logAudit,
  logSuccessfulAuth,
  logFailedAuth,
  logAdminAction,
  logSensitiveDataAccess,
  logPermissionChange,
  logSecurityEvent,
  AuditCategory,
  AuditEventType
} from '../../server/lib/audit-logger';

describe('Audit Logger', () => {
  beforeEach(() => {
    // Mock the logger.info method
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should log audit events with timestamps', () => {
    // Freeze time for consistent testing
    const fakeNow = new Date('2025-01-01T12:00:00Z');
    vi.spyOn(global, 'Date').mockImplementation(() => fakeNow as any);
    
    // Log a basic audit event
    logAudit({
      category: AuditCategory.AUTH,
      event: AuditEventType.LOGIN_SUCCESS,
      userId: 1,
      username: 'testuser',
      status: 'success'
    });
    
    // Check the logger was called with correct parameters
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[AUDIT] [auth] [login_success]'),
      expect.objectContaining({
        category: AuditCategory.AUTH,
        event: AuditEventType.LOGIN_SUCCESS,
        userId: 1,
        username: 'testuser',
        status: 'success',
        timestamp: '2025-01-01T12:00:00.000Z'
      })
    );
    
    // Restore Date
    vi.restoreAllMocks();
  });
  
  it('should sanitize sensitive information in details', () => {
    // Log an audit event with sensitive details
    logAudit({
      category: AuditCategory.ADMIN,
      event: AuditEventType.SYSTEM_CONFIG,
      userId: 1,
      username: 'admin',
      status: 'success',
      details: {
        setting: 'email',
        password: 'secret123',
        csrfToken: 'abc123',
        apiKey: 'key123',
        normalField: 'This should remain visible'
      }
    });
    
    // Check sensitive fields are redacted
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        details: expect.objectContaining({
          setting: 'email',
          password: '[REDACTED]',
          csrfToken: '[REDACTED]',
          apiKey: '[REDACTED]',
          normalField: 'This should remain visible'
        })
      })
    );
  });
  
  it('should log successful authentication', () => {
    logSuccessfulAuth(1, 'testuser', '192.168.1.1', 'Mozilla/5.0');
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('User testuser (ID: 1) successfully authenticated'),
      expect.objectContaining({
        category: AuditCategory.AUTH,
        event: AuditEventType.LOGIN_SUCCESS,
        userId: 1,
        username: 'testuser',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success'
      })
    );
  });
  
  it('should log failed authentication', () => {
    logFailedAuth('baduser', '192.168.1.1', 'Invalid password', 'Mozilla/5.0');
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Failed authentication attempt for user baduser'),
      expect.objectContaining({
        category: AuditCategory.AUTH,
        event: AuditEventType.LOGIN_FAILURE,
        username: 'baduser',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'failure',
        details: { reason: 'Invalid password' }
      })
    );
  });
  
  it('should log sensitive data access', () => {
    logSensitiveDataAccess(1, 'admin', 'user_grades', 123, '192.168.1.1');
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('User admin (ID: 1) accessed sensitive user_grades data (ID: 123)'),
      expect.objectContaining({
        category: AuditCategory.DATA_ACCESS,
        event: AuditEventType.SENSITIVE_ACCESS,
        userId: 1,
        username: 'admin',
        targetType: 'user_grades',
        targetId: 123,
        ipAddress: '192.168.1.1',
        status: 'success'
      })
    );
  });
  
  it('should log admin actions', () => {
    logAdminAction(1, 'admin', 'updated system settings', 'settings', 'email', '192.168.1.1');
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Admin admin (ID: 1) performed action: updated system settings'),
      expect.objectContaining({
        category: AuditCategory.ADMIN,
        event: AuditEventType.SYSTEM_CONFIG,
        userId: 1,
        username: 'admin',
        targetType: 'settings',
        targetId: 'email',
        ipAddress: '192.168.1.1',
        status: 'success'
      })
    );
  });
  
  it('should log permission changes', () => {
    logPermissionChange(1, 'admin', 2, 'user1', 'student', 'instructor', '192.168.1.1');
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('User user1 (ID: 2) role changed from student to instructor by admin'),
      expect.objectContaining({
        category: AuditCategory.PERMISSION,
        event: AuditEventType.ROLE_CHANGE,
        userId: 1,
        username: 'admin',
        targetId: 2,
        targetType: 'user',
        ipAddress: '192.168.1.1',
        status: 'success',
        details: { oldRole: 'student', newRole: 'instructor' }
      })
    );
  });
  
  it('should log security events', () => {
    logSecurityEvent(
      AuditEventType.CSRF_FAILURE,
      '192.168.1.1',
      1,
      'testuser',
      { path: '/api/admin/settings' }
    );
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Security event: csrf_failure detected from 192.168.1.1'),
      expect.objectContaining({
        category: AuditCategory.SECURITY,
        event: AuditEventType.CSRF_FAILURE,
        userId: 1,
        username: 'testuser',
        ipAddress: '192.168.1.1',
        status: 'failure',
        details: { path: '/api/admin/settings' }
      })
    );
  });
  
  it('should log anonymous security events', () => {
    logSecurityEvent(
      AuditEventType.RATE_LIMIT_EXCEEDED,
      '192.168.1.1',
      undefined,
      undefined,
      { endpoint: '/api/auth/login' }
    );
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Anonymous user'),
      expect.objectContaining({
        category: AuditCategory.SECURITY,
        event: AuditEventType.RATE_LIMIT_EXCEEDED,
        ipAddress: '192.168.1.1',
        status: 'failure',
        details: { endpoint: '/api/auth/login' }
      })
    );
  });
});