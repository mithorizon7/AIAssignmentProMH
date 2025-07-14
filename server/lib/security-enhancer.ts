/**
 * Enhanced security features for production deployment
 * Provides comprehensive security monitoring and protection
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { isProduction } from './env-config';
import { logSecurityEvent, AuditEventType } from './audit-logger';
import rateLimit from 'express-rate-limit';

export interface SecurityMetrics {
  blockedRequests: number;
  suspiciousActivity: number;
  rateLimit: number;
  csrfFailures: number;
  lastSecurityEvent: Date | null;
  threatsDetected: number;
}

export interface SecurityThreat {
  type: 'sql_injection' | 'xss' | 'path_traversal' | 'suspicious_headers' | 'rate_limit' | 'csrf';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
  blocked: boolean;
}

class SecurityEnhancer {
  private securityEvents: SecurityThreat[] = [];
  private readonly maxEventHistory = 100; // Reduced from 1000 to 100
  private blockedIPs = new Set<string>();
  private suspiciousPatterns = [
    // SQL injection patterns (exclude file extensions and development files)
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)(?![.\w]*\.(ts|tsx|js|jsx|css|html|md|json))/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)(?![.\w]*\.(ts|tsx|js|jsx|css|html|md|json))/i,
    /(';|--;|\/\*|\*\/)(?![.\w]*\.(ts|tsx|js|jsx|css|html|md|json))/,
    
    // XSS patterns (exclude legitimate development files)
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:(?![.\w]*\.(ts|tsx|js|jsx))/i,
    /on\w+\s*=(?![.\w]*\.(ts|tsx|js|jsx))/i,
    
    // Path traversal patterns (exclude legitimate file paths)
    /\.\.[\/\\](?!.*\.(ts|tsx|js|jsx|css|html|json|md))/,
    /\/(etc|proc|sys|boot)\/\w+/i,
    
    // Common attack patterns
    /eval\s*\(/i,
    /base64_decode/i,
    /phpinfo\s*\(/i
  ];

  /**
   * Records a security event
   */
  recordSecurityEvent(threat: SecurityThreat): void {
    this.securityEvents.push(threat);
    
    // Keep history manageable
    if (this.securityEvents.length > this.maxEventHistory) {
      this.securityEvents.shift();
    }
    
    // Log security event
    logger.warn('Security threat detected', {
      type: threat.type,
      severity: threat.severity,
      description: threat.description,
      ip: threat.ip,
      blocked: threat.blocked
    });
    
    // Block IP for critical threats
    if (threat.severity === 'critical') {
      this.blockedIPs.add(threat.ip);
      logger.error('IP blocked due to critical security threat', {
        ip: threat.ip,
        threat_type: threat.type
      });
    }
    
    // Log to audit system
    logSecurityEvent(
      AuditEventType.SUSPICIOUS_ACTIVITY,
      threat.ip,
      undefined,
      undefined,
      {
        threat_type: threat.type,
        severity: threat.severity,
        description: threat.description,
        blocked: threat.blocked
      }
    );
  }

  /**
   * Checks if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * Analyzes request for suspicious patterns
   */
  analyzeRequest(req: Request): SecurityThreat | null {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    
    // Skip security checking for development file requests
    if (req.url.includes('/src/') || req.url.includes('/@') || req.url.includes('.tsx') || req.url.includes('.ts') || req.url.includes('.js') || req.url.includes('.jsx') || req.url.includes('.css') || req.url.includes('.html')) {
      return null;
    }
    
    // Check for suspicious patterns in URL
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(req.url)) {
        return {
          type: this.getPatternType(pattern),
          severity: 'high',
          description: `Suspicious pattern detected in URL: ${req.url}`,
          ip,
          userAgent,
          timestamp: new Date(),
          blocked: false
        };
      }
    }
    
    // Check for suspicious patterns in query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(value)) {
              return {
                type: this.getPatternType(pattern),
                severity: 'high',
                description: `Suspicious pattern detected in query parameter '${key}': ${value}`,
                ip,
                userAgent,
                timestamp: new Date(),
                blocked: false
              };
            }
          }
        }
      }
    }
    
    // Check for suspicious patterns in request body
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(bodyStr)) {
          return {
            type: this.getPatternType(pattern),
            severity: 'high',
            description: `Suspicious pattern detected in request body`,
            ip,
            userAgent,
            timestamp: new Date(),
            blocked: false
          };
        }
      }
    }
    
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-cluster-client-ip'];
    for (const header of suspiciousHeaders) {
      const value = req.headers[header] as string;
      if (value && this.isSuspiciousHeaderValue(value)) {
        return {
          type: 'suspicious_headers',
          severity: 'medium',
          description: `Suspicious header value detected: ${header}`,
          ip,
          userAgent,
          timestamp: new Date(),
          blocked: false
        };
      }
    }
    
    return null;
  }

  /**
   * Gets pattern type based on regex
   */
  private getPatternType(pattern: RegExp): SecurityThreat['type'] {
    const patternStr = pattern.toString();
    
    if (patternStr.includes('SELECT|INSERT|UPDATE|DELETE')) {
      return 'sql_injection';
    }
    if (patternStr.includes('script|javascript')) {
      return 'xss';
    }
    if (patternStr.includes('\\.\\.')) {
      return 'path_traversal';
    }
    
    return 'suspicious_headers';
  }

  /**
   * Checks if header value is suspicious
   */
  private isSuspiciousHeaderValue(value: string): boolean {
    // Check for header injection attempts
    return /[\r\n]/.test(value) || value.includes('..') || value.length > 200;
  }

  /**
   * Gets security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const recentEvents = this.securityEvents.filter(
      event => Date.now() - event.timestamp.getTime() < 60000 // Last minute
    );
    
    const blockedRequests = recentEvents.filter(e => e.blocked).length;
    const suspiciousActivity = recentEvents.length;
    const rateLimit = recentEvents.filter(e => e.type === 'rate_limit').length;
    const csrfFailures = recentEvents.filter(e => e.type === 'csrf').length;
    const lastSecurityEvent = this.securityEvents.length > 0 
      ? this.securityEvents[this.securityEvents.length - 1].timestamp
      : null;
    
    return {
      blockedRequests,
      suspiciousActivity,
      rateLimit,
      csrfFailures,
      lastSecurityEvent,
      threatsDetected: this.securityEvents.length
    };
  }

  /**
   * Gets recent security threats
   */
  getRecentThreats(limit: number = 10): SecurityThreat[] {
    return this.securityEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Unblocks an IP address
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    logger.info('IP unblocked', { ip });
  }

  /**
   * Gets blocked IPs
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }
}

// Global security enhancer instance
export const securityEnhancer = new SecurityEnhancer();

/**
 * Middleware for security monitoring
 */
export function securityMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Check if IP is blocked
  if (securityEnhancer.isIPBlocked(ip)) {
    securityEnhancer.recordSecurityEvent({
      type: 'rate_limit',
      severity: 'high',
      description: 'Request from blocked IP',
      ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
      blocked: true
    });
    
    res.status(403).json({
      error: 'Access denied',
      message: 'Your IP has been blocked due to suspicious activity'
    });
    return;
  }
  
  // Analyze request for threats
  const threat = securityEnhancer.analyzeRequest(req);
  if (threat) {
    securityEnhancer.recordSecurityEvent(threat);
    
    // Block critical threats
    if (threat.severity === 'critical') {
      res.status(403).json({
        error: 'Security threat detected',
        message: 'Request blocked due to security concerns'
      });
      return;
    }
  }
  
  next();
}

/**
 * Enhanced rate limiter with security logging
 */
export function createSecureRateLimiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment() && !isProduction(),
    handler: (req: Request, res: Response) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      securityEnhancer.recordSecurityEvent({
        type: 'rate_limit',
        severity: 'medium',
        description: `Rate limit exceeded for ${req.path}`,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        blocked: true
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message
      });
    }
  });
}

/**
 * Input validation middleware
 */
export function inputValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Additional input validation can be added here
  // For now, rely on the security analysis in securityMonitoringMiddleware
  next();
}

/**
 * Initializes security monitoring
 */
export function initializeSecurityMonitoring(): void {
  logger.info('Security monitoring initialized');
  
  // Log security metrics every hour in production
  if (isProduction()) {
    setInterval(() => {
      const metrics = securityEnhancer.getSecurityMetrics();
      logger.info('Security metrics', metrics);
    }, 60 * 60 * 1000); // 1 hour
  }
}

/**
 * Gets security health status
 */
export function getSecurityHealth(): {
  status: 'secure' | 'monitoring' | 'threat_detected';
  metrics: SecurityMetrics;
  recentThreats: SecurityThreat[];
} {
  const metrics = securityEnhancer.getSecurityMetrics();
  const recentThreats = securityEnhancer.getRecentThreats(5);
  
  let status: 'secure' | 'monitoring' | 'threat_detected' = 'secure';
  
  if (metrics.suspiciousActivity > 0) {
    status = 'monitoring';
  }
  
  if (metrics.blockedRequests > 0 || recentThreats.some(t => t.severity === 'critical')) {
    status = 'threat_detected';
  }
  
  return {
    status,
    metrics,
    recentThreats
  };
}