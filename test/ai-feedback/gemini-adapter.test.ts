/**
 * Gemini Adapter Unit Tests
 * 
 * Focused tests for the Gemini AI adapter to ensure proper
 * API integration, response handling, and error management.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GeminiAdapter } from '../../server/adapters/gemini-adapter';

describe('Gemini Adapter Tests', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    // Mock environment variable
    process.env.GEMINI_API_KEY = 'test-api-key';
    adapter = new GeminiAdapter();
  });

  describe('Text Generation', () => {
    
    test('should generate completion for text input', async () => {
      const prompt = 'Evaluate this code: function add(a, b) { return a + b; }';
      const systemPrompt = 'You are a code reviewer. Provide structured feedback.';

      const result = await adapter.generateCompletion(prompt, systemPrompt);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('criteriaScores');
      expect(result).toHaveProperty('overallFeedback');
      expect(result).toHaveProperty('modelName');
      expect(result).toHaveProperty('tokenCount');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    test('should handle prompts with special characters', async () => {
      const prompt = 'Evaluate: console.log("Hello, \\"World\\"!");';
      
      const result = await adapter.generateCompletion(prompt);
      
      expect(result.overallFeedback).toBeTruthy();
      expect(typeof result.overallFeedback).toBe('string');
    });

    test('should maintain consistent response format', async () => {
      const prompts = [
        'Review this Python code: print("hello")',
        'Analyze this JavaScript: const x = 42;',
        'Evaluate this HTML: <div>Hello</div>'
      ];

      for (const prompt of prompts) {
        const result = await adapter.generateCompletion(prompt);
        
        // All responses should have the same structure
        expect(result).toHaveProperty('overallScore');
        expect(result).toHaveProperty('criteriaScores');
        expect(result).toHaveProperty('overallFeedback');
        expect(result.criteriaScores).toBeInstanceOf(Array);
      }
    });
  });

  describe('Multimodal Generation', () => {
    
    test('should handle image and text combination', async () => {
      const parts = [
        {
          type: 'text' as const,
          content: 'Analyze this code screenshot for best practices'
        },
        {
          type: 'image' as const,
          content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          mimeType: 'image/png'
        }
      ];

      const result = await adapter.generateMultimodalCompletion(parts);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('criteriaScores');
      expect(result.overallFeedback).toContain('image');
    });

    test('should handle document uploads', async () => {
      const parts = [
        {
          type: 'text' as const,
          content: 'Review this document submission'
        },
        {
          type: 'document' as const,
          content: Buffer.from('This is a test document content'),
          mimeType: 'application/pdf'
        }
      ];

      const result = await adapter.generateMultimodalCompletion(parts);

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('modelName');
      expect(result.modelName).toContain('gemini');
    });

    test('should handle multiple file types in single submission', async () => {
      const parts = [
        {
          type: 'text' as const,
          content: 'Evaluate this multimedia submission'
        },
        {
          type: 'image' as const,
          content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          mimeType: 'image/png'
        },
        {
          type: 'document' as const,
          content: Buffer.from('# README\nThis is a project description'),
          mimeType: 'text/markdown'
        }
      ];

      const result = await adapter.generateMultimodalCompletion(parts);

      expect(result.overallFeedback).toBeTruthy();
      expect(result.criteriaScores.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    
    test('should handle invalid API responses gracefully', async () => {
      // Mock a malformed response
      const originalEnv = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'invalid-key';
      
      const newAdapter = new GeminiAdapter();
      
      await expect(
        newAdapter.generateCompletion('test prompt')
      ).rejects.toThrow();
      
      process.env.GEMINI_API_KEY = originalEnv;
    });

    test('should handle rate limiting', async () => {
      // Simulate rate limiting by making many rapid requests
      const promises = Array.from({ length: 10 }, () =>
        adapter.generateCompletion('Quick test')
      );

      // Some requests might fail due to rate limiting, but should not crash
      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      // At least some should succeed
      expect(successful.length).toBeGreaterThan(0);
      
      // Failed requests should have meaningful error messages
      failed.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toBeTruthy();
        }
      });
    });

    test('should handle timeout scenarios', async () => {
      // Test with very large content to potentially trigger timeout
      const largePrompt = 'Analyze this code: ' + 'console.log("test");'.repeat(1000);
      
      const startTime = Date.now();
      
      try {
        const result = await adapter.generateCompletion(largePrompt);
        const duration = Date.now() - startTime;
        
        // Should either succeed quickly or fail with timeout
        expect(duration).toBeLessThan(60000); // 60 second max
        expect(result).toHaveProperty('overallScore');
      } catch (error) {
        // Timeout errors should be handled gracefully
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Response Validation', () => {
    
    test('should validate JSON schema compliance', async () => {
      const result = await adapter.generateCompletion('Review: function test() {}');
      
      // Validate required fields exist
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('overallFeedback');
      expect(result).toHaveProperty('criteriaScores');
      
      // Validate data types
      expect(typeof result.overallScore).toBe('number');
      expect(typeof result.overallFeedback).toBe('string');
      expect(Array.isArray(result.criteriaScores)).toBe(true);
      
      // Validate score ranges
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      
      // Validate criteria scores structure
      result.criteriaScores.forEach(criteria => {
        expect(criteria).toHaveProperty('name');
        expect(criteria).toHaveProperty('score');
        expect(criteria).toHaveProperty('feedback');
        expect(typeof criteria.name).toBe('string');
        expect(typeof criteria.score).toBe('number');
        expect(typeof criteria.feedback).toBe('string');
      });
    });

    test('should handle truncated responses', async () => {
      // Test with content that might generate very long responses
      const complexPrompt = `
        Analyze this complex codebase in extreme detail:
        
        ${Array.from({ length: 50 }, (_, i) => 
          `function complexFunction${i}() { 
             // Complex logic here
             const data = processData();
             return transformResult(data);
           }`
        ).join('\n')}
      `;
      
      const result = await adapter.generateCompletion(complexPrompt);
      
      // Even with truncation, we should get valid structured output
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('overallFeedback');
      expect(result.overallFeedback.length).toBeGreaterThan(0);
    });

    test('should maintain token count accuracy', async () => {
      const shortPrompt = 'Review: x = 1';
      const longPrompt = 'Review this extensive code: ' + 'function test() { return true; }'.repeat(100);
      
      const shortResult = await adapter.generateCompletion(shortPrompt);
      const longResult = await adapter.generateCompletion(longPrompt);
      
      // Token counts should reflect input size differences
      expect(longResult.tokenCount).toBeGreaterThan(shortResult.tokenCount);
      expect(shortResult.tokenCount).toBeGreaterThan(0);
      expect(longResult.tokenCount).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    
    test('should complete requests within reasonable time', async () => {
      const startTime = Date.now();
      
      await adapter.generateCompletion('Quick test: console.log("hello");');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // 30 seconds max for simple requests
    });

    test('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        adapter.generateCompletion(`Test ${i}: function test${i}() { return ${i}; }`)
      );
      
      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result).toHaveProperty('overallScore');
        expect(result.overallFeedback).toContain(`${index}`);
      });
    });

    test('should maintain memory efficiency', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process multiple requests
      for (let i = 0; i < 5; i++) {
        await adapter.generateCompletion(`Test ${i}: simple code review`);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for 5 requests)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Content Type Handling', () => {
    
    test('should detect and handle different MIME types', async () => {
      const contentTypes = [
        { content: 'console.log("hello");', mimeType: 'text/javascript' },
        { content: 'print("hello")', mimeType: 'text/x-python' },
        { content: '<html><body>Hello</body></html>', mimeType: 'text/html' }
      ];
      
      for (const { content, mimeType } of contentTypes) {
        const parts = [
          { type: 'text' as const, content: 'Review this code:' },
          { type: 'document' as const, content: Buffer.from(content), mimeType }
        ];
        
        const result = await adapter.generateMultimodalCompletion(parts);
        expect(result.overallFeedback).toBeTruthy();
      }
    });

    test('should handle unsupported MIME types gracefully', async () => {
      const parts = [
        { type: 'text' as const, content: 'Review this file:' },
        { 
          type: 'document' as const, 
          content: Buffer.from('binary data'), 
          mimeType: 'application/octet-stream' 
        }
      ];
      
      // Should either process or fail gracefully without crashing
      try {
        const result = await adapter.generateMultimodalCompletion(parts);
        expect(result).toHaveProperty('overallScore');
      } catch (error) {
        expect(error.message).toContain('unsupported');
      }
    });

    test('should validate file size limits', async () => {
      // Test with large file (simulate 10MB file)
      const largeContent = Buffer.alloc(10 * 1024 * 1024, 'a');
      
      const parts = [
        { type: 'text' as const, content: 'Review this large file:' },
        { type: 'document' as const, content: largeContent, mimeType: 'text/plain' }
      ];
      
      // Should handle large files appropriately
      try {
        const result = await adapter.generateMultimodalCompletion(parts);
        expect(result).toHaveProperty('overallScore');
      } catch (error) {
        // If it fails, should be due to size limits, not crashes
        expect(error.message).toMatch(/(size|limit|large)/i);
      }
    });
  });
});