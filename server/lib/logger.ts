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
  structured: process.env.STRUCTURED_LOGGING === 'true',
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
   * With comprehensive error handling to ensure logging never throws exceptions
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    try {
      // Skip logs below minimum level
      if (!this.shouldLog(level)) {
        return;
      }

      const timestamp = new Date().toISOString();
      let safeContext: any = undefined;
      
      // Safely process context if provided
      if (context) {
        try {
          safeContext = this.maskSensitiveData(context);
        } catch (err) {
          // If context processing fails, add an error entry instead
          safeContext = { 
            logging_error: "Failed to process context object",
            error_message: err instanceof Error ? err.message : String(err)
          };
        }
      }
      
      const structuredLog: LogMessage = {
        timestamp,
        level,
        message,
        service: this.config.service,
        context: safeContext
      };

      // Determine output format based on configuration
      if (this.config.structured) {
        // Production: JSON format for log ingestion
        try {
          console[this.getConsoleMethod(level)](this.safeStringify(structuredLog));
        } catch (err) {
          // Fallback in case structured logging fails
          console.error(`[Logger Error] Failed to output structured log: ${err}`);
          console[this.getConsoleMethod(level)](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        }
      } else {
        // Development: Human-readable format
        try {
          const contextStr = context ? ` ${this.formatContext(context)}` : '';
          console[this.getConsoleMethod(level)](`[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`);
        } catch (err) {
          // Fallback if formatting fails 
          console[this.getConsoleMethod(level)](`[${timestamp}] [${level.toUpperCase()}] ${message} [Context Error: ${err}]`);
        }
      }
    } catch (err) {
      // Ultimate fallback - ensure logging never throws
      try {
        console.error(`[CRITICAL LOGGER ERROR] ${err}`);
        console.error(`Original message: ${message}`);
      } catch {
        // Nothing more we can do if even this fails
      }
    }
  }

  /**
   * Mask sensitive fields in logs
   * Safely handles circular references
   */
  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    try {
      // Create a shallow copy to avoid modifying the original
      const masked = { ...data };
      const maskFields = this.config.maskFields || [];
      // Use a Set to track objects we've already seen to avoid circular references
      const seen = new WeakSet();

      const maskValue = (obj: Record<string, any>, path: string[] = []): void => {
        // Skip if null, undefined, or not an object
        if (!obj || typeof obj !== 'object') return;
        
        // Detect circular references
        if (seen.has(obj)) return;
        
        // Add to seen objects
        seen.add(obj);
        
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = [...path, key];
          
          // Check if this field should be masked
          const shouldMask = maskFields.some(field => 
            key.toLowerCase().includes(field.toLowerCase())
          );

          if (shouldMask && typeof value === 'string') {
            // Mask the value
            obj[key] = value.length > 0 ? '***' : '';
          } else if (value && typeof value === 'object') {
            // Recursively process nested objects and arrays
            maskValue(value, currentPath);
          }
        }
      };

      maskValue(masked);
      return masked;
    } catch (error) {
      // If anything goes wrong, return a safe object
      return { masked_error: "Error masking sensitive data" };
    }
  }

  /**
   * Format context for human-readable logs
   * Handles circular references safely
   */
  private formatContext(context: Record<string, any>): string {
    try {
      // First mask sensitive data
      const masked = this.maskSensitiveData(context);
      
      // Use a safe stringify implementation that handles circular references
      return this.safeStringify(masked, process.env.NODE_ENV === 'production' ? 0 : 2);
    } catch (error) {
      return `[Context serialization error: ${error}]`;
    }
  }
  
  /**
   * Safe JSON stringify that handles circular references
   */
  private safeStringify(obj: any, indent: number = 0): string {
    const cache = new Set();
    
    return JSON.stringify(obj, (key, value) => {
      // Handle null and undefined
      if (value === null || value === undefined) {
        return value;
      }
      
      // Handle non-objects
      if (typeof value !== 'object') {
        return value;
      }
      
      // Handle Date objects
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      // Handle circular references
      if (cache.has(value)) {
        return '[Circular Reference]';
      }
      
      // Add object to cache if it's an object type
      if (typeof value === 'object') {
        cache.add(value);
      }
      
      return value;
    }, indent);
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