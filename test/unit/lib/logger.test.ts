import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel } from '../../../server/lib/logger';

describe('Logger', () => {
  // Setup and teardown
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'trace').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Tests
  it('should initialize with default config', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should log at the specified level', () => {
    const logger = new Logger({ minLevel: LogLevel.INFO, structured: false });
    
    logger.error('Test error message');
    logger.warn('Test warning message');
    logger.info('Test info message');
    logger.debug('Test debug message');
    logger.trace('Test trace message');
    
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled(); // Should be below minLevel
    expect(console.trace).not.toHaveBeenCalled(); // Should be below minLevel
  });

  it('should respect log level hierarchy', () => {
    const logger = new Logger({ minLevel: LogLevel.WARN, structured: false });
    
    logger.error('Test error message');
    logger.warn('Test warning message');
    logger.info('Test info message');
    
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled(); // Should be below minLevel
  });

  it('should mask sensitive data in structured log', () => {
    const logger = new Logger({ structured: true });
    const consoleSpy = vi.spyOn(console, 'info');
    
    logger.info('Test with sensitive data', { 
      password: 'secret123', 
      token: 'abc123', 
      user: { password: 'nested-secret' } 
    });
    
    const logOutput = consoleSpy.mock.calls[0][0];
    
    expect(logOutput).toContain('***');
    expect(logOutput).not.toContain('secret123');
    expect(logOutput).not.toContain('abc123');
    expect(logOutput).not.toContain('nested-secret');
  });

  it('should create child loggers with inherited settings', () => {
    const parentLogger = new Logger({ 
      service: 'parent-service',
      minLevel: LogLevel.WARN
    });
    
    const childLogger = parentLogger.child({ service: 'child-service' });
    
    const warnSpy = vi.spyOn(console, 'warn');
    const infoSpy = vi.spyOn(console, 'info');
    
    childLogger.warn('Warning from child');
    childLogger.info('Info from child');
    
    expect(warnSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled(); // Should inherit parent's minLevel
  });

  it('should handle errors when serializing context', () => {
    const logger = new Logger();
    
    // Create a circular reference which can't be serialized
    const circular: any = {};
    circular.self = circular;
    
    // This shouldn't throw an error
    expect(() => {
      logger.info('Message with circular reference', circular);
    }).not.toThrow();
  });
});