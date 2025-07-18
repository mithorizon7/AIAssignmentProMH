/**
 * Testing utilities
 */

/**
 * Create a mock process.env object that merges with the real one
 * Useful for supplying test credentials in CI/CD environments
 */
export function mockProcessEnv(env: Record<string, string>) {
  const originalEnv = process.env;
  
  // Create a backup
  const envBackup = { ...process.env };
  
  // Override process.env with a proxy
  process.env = new Proxy({ ...envBackup, ...env }, {
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
    get(target, prop) {
      return target[prop as string];
    }
  });
  
  // Return function to restore the original
  return () => {
    process.env = originalEnv;
  };
}

/**
 * Creates a mock implementation for file system operations
 * Useful for testing file handling without actual files
 */
export function createMockFs() {
  const files: Record<string, Buffer> = {};
  
  return {
    writeFile: jest.fn((path: string, data: Buffer | string, callback: (err: Error | null) => void) => {
      files[path] = Buffer.isBuffer(data) ? data : Buffer.from(data);
      callback(null);
    }),
    readFile: jest.fn((path: string, callback: (err: Error | null, data?: Buffer) => void) => {
      if (files[path]) {
        callback(null, files[path]);
      } else {
        callback(new Error(`File not found: ${path}`));
      }
    }),
    // Add more fs methods as needed
    _files: files // For test inspection
  };
}

/**
 * Creates test data of various types
 */
export function createTestData() {
  return {
    textContent: 'This is a test string for testing purposes.',
    jsonContent: JSON.stringify({ test: true, name: 'Test Object', values: [1, 2, 3] }),
    imageBuffer: Buffer.from('This is not a real image but simulates one for testing'),
    documentBuffer: Buffer.from('Title,Value\nItem1,100\nItem2,200'), // CSV format
    audioBuffer: Buffer.from('Fake audio data for testing purposes'),
    videoBuffer: Buffer.from('Fake video data for testing purposes')
  };
}

/**
 * Create a basic mock for the Gemini API responses
 */
export function createMockGeminiResponse(options: {
  text?: string;
  tokenCount?: number;
  error?: boolean;
} = {}) {
  if (options.error) {
    throw new Error('Simulated Gemini API error');
  }
  
  const text = options.text || JSON.stringify({
    strengths: ['Test strength 1', 'Test strength 2'],
    improvements: ['Test improvement 1', 'Test improvement 2'],
    suggestions: ['Test suggestion 1', 'Test suggestion 2'],
    summary: 'This is a test summary.',
    score: 85
  });
  
  return {
    response: {
      text: () => text,
      candidates: [{
        usageMetadata: {
          totalTokens: options.tokenCount || 250
        }
      }]
    }
  };
}