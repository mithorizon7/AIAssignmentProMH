/**
 * Enhanced logger implementation with structured logging support
 * Provides different logging formats based on environment
 */

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// Log message structure
export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  service?: string;
  trace_id?: string;
}

// Basic logger configuration
export interface LoggerConfig {
  service?: string;
  minLevel?: LogLevel;
  structured?: boolean;
  maskFields?: string[];
}

const DEFAULT_CONFIG: LoggerConfig = {
  service: 'ai-feedback-platform',
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  structured: process.env.NODE_ENV === 'production',
  maskFields: ['password', 'token', 'secret', 'authorization', 'credit_card', 'creditCard']
};

/**
 * Logger class with structured logging and sensitive data masking
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Skip logs below minimum level
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const structuredLog: LogMessage = {
      timestamp,
      level,
      message,
      service: this.config.service,
      context: context ? this.maskSensitiveData(context) : undefined
    };

    // Determine output format based on configuration
    if (this.config.structured) {
      // Production: JSON format for log ingestion
      console[this.getConsoleMethod(level)](JSON.stringify(structuredLog));
    } else {
      // Development: Human-readable format
      const contextStr = context ? ` ${this.formatContext(context)}` : '';
      console[this.getConsoleMethod(level)](`[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`);
    }
  }

  /**
   * Mask sensitive fields in logs
   */
  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    const masked = { ...data };
    const maskFields = this.config.maskFields || [];

    const maskValue = (obj: Record<string, any>, path: string[] = []): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        // Check if this field should be masked
        const shouldMask = maskFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        );

        if (shouldMask && typeof value === 'string') {
          // Mask the value
          obj[key] = value.length > 0 ? '***' : '';
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recursively process nested objects
          maskValue(value, currentPath);
        }
      }
    };

    maskValue(masked);
    return masked;
  }

  /**
   * Format context for human-readable logs
   */
  private formatContext(context: Record<string, any>): string {
    try {
      const masked = this.maskSensitiveData(context);
      return JSON.stringify(masked, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    } catch (error) {
      return `[Context serialization error: ${error}]`;
    }
  }

  /**
   * Get the console method to use for the given log level
   */
  private getConsoleMethod(level: LogLevel): 'error' | 'warn' | 'info' | 'debug' | 'trace' {
    switch (level) {
      case LogLevel.ERROR: return 'error';
      case LogLevel.WARN: return 'warn';
      case LogLevel.INFO: return 'info';
      case LogLevel.DEBUG: return 'debug';
      case LogLevel.TRACE: return 'trace';
      default: return 'info';
    }
  }

  /**
   * Check if the given level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const minLevelIndex = levels.indexOf(this.config.minLevel || LogLevel.INFO);
    const levelIndex = levels.indexOf(level);
    return levelIndex <= minLevelIndex;
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a trace message
   */
  trace(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: Record<string, any>): Logger {
    return new Logger({
      ...this.config,
      service: childContext.service || this.config.service
    });
  }
}

// Create default application logger
export const logger = new Logger();

// Create specialized loggers
export const queueLogger = logger.child({ service: 'queue-service' });
export const aiLogger = logger.child({ service: 'ai-service' });
export const storageLogger = logger.child({ service: 'storage-service' });
export const authLogger = logger.child({ service: 'auth-service' });

// Export default logger
export default logger;