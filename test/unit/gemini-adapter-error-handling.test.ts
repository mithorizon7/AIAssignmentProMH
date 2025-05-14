import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIAdapter, MultimodalPromptPart } from '../../server/adapters/ai-adapter';

describe('AI Adapter Error Handling with Type Safety', () => {
  // Create a mock implementation of AIAdapter for testing
  class MockAIAdapter implements AIAdapter {
    private mockError: Error | unknown | null = null;
    
    // Set the error that will be thrown in the next call
    setMockError(error: Error | unknown) {
      this.mockError = error;
    }
    
    async generateCompletion(prompt: string) {
      if (this.mockError) {
        const error = this.mockError;
        this.mockError = null; // Reset after throwing
        throw error;
      }
      
      return {
        strengths: [],
        improvements: [],
        suggestions: [],
        summary: '',
        rawResponse: {} as Record<string, unknown>,
        modelName: 'test-model',
        tokenCount: 0
      };
    }
    
    async generateMultimodalCompletion(
      parts: MultimodalPromptPart[],
      systemPrompt?: string
    ) {
      if (this.mockError) {
        const error = this.mockError;
        this.mockError = null; // Reset after throwing
        throw error;
      }
      
      return {
        strengths: [],
        improvements: [],
        suggestions: [],
        summary: '',
        rawResponse: {} as Record<string, unknown>,
        modelName: 'test-model',
        tokenCount: 0
      };
    }
  }
  
  let adapter: MockAIAdapter;
  
  beforeEach(() => {
    adapter = new MockAIAdapter();
  });

  it('should handle API errors with proper typing in generateCompletion', async () => {
    // Setup the mock to throw a typed error
    const mockError = new Error('API Error');
    adapter.setMockError(mockError);
    
    // Test the error handling
    await expect(adapter.generateCompletion('test prompt')).rejects.toThrow('API Error');
  });
  
  it('should handle unknown error types in generateCompletion', async () => {
    // Setup the mock to throw an unknown error type
    const mockUnknownError = { custom: 'This is not an Error instance' };
    adapter.setMockError(mockUnknownError);
    
    // Test the error handling
    await expect(adapter.generateCompletion('test prompt')).rejects.toEqual(mockUnknownError);
  });
  
  it('should handle API errors with proper typing in generateMultimodalCompletion', async () => {
    // Setup the mock to throw a typed error
    const mockError = new Error('API Error');
    adapter.setMockError(mockError);
    
    // Create a test prompt that matches the interface
    const promptParts: MultimodalPromptPart[] = [
      { 
        type: 'text', 
        content: 'Test prompt'
      }
    ];
    
    // Test the error handling
    await expect(adapter.generateMultimodalCompletion(promptParts, 'system prompt')).rejects.toThrow('API Error');
  });
  
  it('should handle unknown error types in generateMultimodalCompletion', async () => {
    // Setup the mock to throw an unknown error type
    const mockUnknownError = { custom: 'This is not an Error instance' };
    adapter.setMockError(mockUnknownError);
    
    // Create a test prompt that matches the interface
    const promptParts: MultimodalPromptPart[] = [
      { 
        type: 'text', 
        content: 'Test prompt'
      }
    ];
    
    // Test the error handling
    await expect(adapter.generateMultimodalCompletion(promptParts, 'system prompt')).rejects.toEqual(mockUnknownError);
  });
});