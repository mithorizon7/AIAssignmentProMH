import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel } from '../server/lib/logger';

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
});