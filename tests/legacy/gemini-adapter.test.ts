import { expect, test, vi, describe, beforeEach, afterEach } from 'vitest';
import { GeminiAdapter } from '../server/adapters/gemini-adapter';

// Mock the GoogleGenAI module
vi.mock('@google/genai', () => {
  // Create a mock implementation with the structure we need
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: vi.fn().mockImplementation(() => {
          return {
            generateContent: vi.fn().mockImplementation(async () => {
              // Return a mock response structure
              return {
                response: {
                  text: () => JSON.stringify({
                    strengths: ["Strong point 1", "Strong point 2"],
                    improvements: ["Improvement 1", "Improvement 2"],
                    suggestions: ["Suggestion 1", "Suggestion 2"],
                    summary: "This is a test summary",
                    score: 85
                  }),
                  usageMetadata: {
                    totalTokens: 150
                  }
                }
              };
            })
          };
        })
      };
    })
  };
});

// Mock environment variable
vi.stubEnv('GEMINI_API_KEY', 'fake-api-key');

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    // Create a new adapter instance before each test
    adapter = new GeminiAdapter();
  });

  afterEach(() => {
    // Clear all mocks after each test
    vi.clearAllMocks();
  });

  test('should be initialized correctly', () => {
    expect(adapter).toBeDefined();
  });

  test('generateCompletion should parse JSON responses properly', async () => {
    // Act
    const result = await adapter.generateCompletion('Test prompt');

    // Assert
    expect(result).toHaveProperty('strengths');
    expect(result.strengths).toHaveLength(2);
    expect(result.strengths[0]).toBe('Strong point 1');
    
    expect(result).toHaveProperty('improvements');
    expect(result.improvements).toHaveLength(2);
    
    expect(result).toHaveProperty('summary');
    expect(result.summary).toBe('This is a test summary');
    
    expect(result).toHaveProperty('score');
    expect(result.score).toBe(85);
    
    expect(result).toHaveProperty('tokenCount');
    expect(result.tokenCount).toBe(150);
  });

  test('generateMultimodalCompletion should handle image content', async () => {
    // Create a mock image buffer
    const imageBuffer = Buffer.from('fake-image-data');
    
    // Act
    const result = await adapter.generateMultimodalCompletion([
      {
        type: 'image',
        content: imageBuffer,
        mimeType: 'image/jpeg'
      },
      {
        type: 'text',
        content: 'Some text description'
      }
    ]);

    // Assert
    expect(result).toHaveProperty('strengths');
    expect(result.strengths).toHaveLength(2);
    expect(result.strengths[0]).toBe('Strong point 1');
    
    expect(result).toHaveProperty('improvements');
    expect(result.improvements).toHaveLength(2);
    
    expect(result).toHaveProperty('summary');
    expect(result.summary).toBe('This is a test summary');
    
    expect(result).toHaveProperty('score');
    expect(result.score).toBe(85);
    
    expect(result).toHaveProperty('tokenCount');
    expect(result.tokenCount).toBe(150);
  });
});