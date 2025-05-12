/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { GeminiAdapter } from '../server/adapters/gemini-adapter';
import { MultimodalPromptPart } from '../server/adapters/ai-adapter';
import { mockProcessEnv } from './utils/test-utils';

// Skip tests if no API key
const testWithAPIKey = process.env.GEMINI_API_KEY ? describe : describe.skip;

testWithAPIKey('Gemini Multimodal Integration Tests', () => {
  let adapter: GeminiAdapter;
  
  beforeAll(() => {
    // Ensure environment has API key
    if (!process.env.GEMINI_API_KEY) {
      mockProcessEnv({ GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'test-key' });
    }
  });
  
  beforeEach(() => {
    adapter = new GeminiAdapter();
  });
  
  test('handles text content', async () => {
    // Skip test if no real API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping test: No Gemini API key available');
      return;
    }
    
    const parts: MultimodalPromptPart[] = [
      {
        type: 'text',
        content: 'Review this simple function: function add(a, b) { return a + b; }'
      }
    ];
    
    const response = await adapter.generateMultimodalCompletion(parts);
    
    // Basic verification
    expect(response).toBeDefined();
    expect(Array.isArray(response.strengths)).toBe(true);
    expect(Array.isArray(response.improvements)).toBe(true);
    expect(typeof response.summary).toBe('string');
  }, 30000); // Longer timeout for API call

  test('handles text content with accompanying system prompt', async () => {
    // Skip test if no real API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping test: No Gemini API key available');
      return;
    }
    
    const parts: MultimodalPromptPart[] = [
      {
        type: 'text',
        content: 'for (var i=0; i<10; i++) { console.log(i); }'
      }
    ];
    
    const systemPrompt = 'You are a programming instructor reviewing JavaScript code. Focus on best practices.';
    
    const response = await adapter.generateMultimodalCompletion(parts, systemPrompt);
    
    // Basic verification
    expect(response).toBeDefined();
    expect(Array.isArray(response.strengths)).toBe(true);
    expect(Array.isArray(response.improvements)).toBe(true);
    expect(typeof response.summary).toBe('string');
  }, 30000); // Longer timeout for API call

  // Uncomment to test with a real image file
  /*
  test('handles image content', async () => {
    // Skip test if no real API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping test: No Gemini API key available');
      return;
    }
    
    // Load a test image
    const imagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    
    const parts: MultimodalPromptPart[] = [
      {
        type: 'image',
        content: imageBuffer,
        mimeType: 'image/jpeg'
      },
      {
        type: 'text',
        content: 'Describe this image and provide feedback on its composition.'
      }
    ];
    
    const response = await adapter.generateMultimodalCompletion(parts);
    
    // Basic verification
    expect(response).toBeDefined();
    expect(Array.isArray(response.strengths)).toBe(true);
    expect(Array.isArray(response.improvements)).toBe(true);
    expect(typeof response.summary).toBe('string');
  }, 30000); // Longer timeout for API call
  */

  // Uncomment to test with a real document file
  /*
  test('handles document content', async () => {
    // Skip test if no real API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping test: No Gemini API key available');
      return;
    }
    
    // Load a test document
    const docPath = path.join(__dirname, 'fixtures', 'test-document.csv');
    const docBuffer = fs.readFileSync(docPath);
    
    const parts: MultimodalPromptPart[] = [
      {
        type: 'document',
        content: docBuffer,
        mimeType: 'text/csv',
        textContent: 'This is extracted text from the document: column1,column2\nvalue1,value2' // Simulated extracted content
      },
      {
        type: 'text',
        content: 'Review this CSV file and provide feedback on its structure.'
      }
    ];
    
    const response = await adapter.generateMultimodalCompletion(parts);
    
    // Basic verification
    expect(response).toBeDefined();
    expect(Array.isArray(response.strengths)).toBe(true);
    expect(Array.isArray(response.improvements)).toBe(true);
    expect(typeof response.summary).toBe('string');
  }, 30000); // Longer timeout for API call
  */
});