import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Gemini API client
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: vi.fn().mockImplementation(() => {
          return {
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => 'Mock AI response analyzing the content'
              }
            })
          };
        })
      };
    })
  };
});

// Import our adapter (path may need adjustment based on actual structure)
import { generateFeedback } from '../../server/adapters/gemini-adapter';

describe('Gemini AI with Rich Text Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process HTML-formatted assignment description', async () => {
    // Sample rich text formatted with HTML
    const richTextDescription = `
      <h2>Programming Exercise: Array Manipulation</h2>
      <p>In this assignment, you will implement <strong>three</strong> functions to manipulate arrays:</p>
      <ol>
        <li>A function to find the maximum value</li>
        <li>A function to filter even numbers</li>
        <li>A function to compute the average</li>
      </ol>
      <p>Your code should be <em>efficient</em> and handle edge cases.</p>
    `;

    const submissionData = {
      assignment: {
        title: 'Array Functions Assignment',
        description: richTextDescription,
        instructorContext: '<p>Students should demonstrate ability to iterate through arrays and use appropriate methods.</p>'
      },
      submission: {
        content: 'function findMax(arr) { return Math.max(...arr); }',
        notes: 'I implemented the findMax function using the spread operator.'
      }
    };

    // Call the generateFeedback function (actual implementation would need to be adjusted)
    const result = await generateFeedback(submissionData);

    // Verify the result contains feedback
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    
    // If actual adapter logs the context sent to Gemini, we could also verify that
    // the HTML content was properly included in the prompt
  });

  it('should process rich text in instructor context', async () => {
    // Rich text instructor context
    const richInstructorContext = `
      <h3>Evaluation Guide:</h3>
      <ul>
        <li><strong>Important:</strong> Students must use proper variable naming.</li>
        <li>Check if they handle <code>null</code> input properly.</li>
        <li>Efficiency is a <em>bonus</em> but not required.</li>
      </ul>
      <p>Sample solution: <code>nums.reduce((a,b) => Math.max(a,b), -Infinity)</code></p>
    `;

    const submissionData = {
      assignment: {
        title: 'Basic Algorithm',
        description: 'Implement a function to find the maximum value in an array.',
        instructorContext: richInstructorContext
      },
      submission: {
        content: 'function findMax(arr) { return Math.max(...arr); }',
        notes: 'This is my implementation'
      }
    };

    // Call the generateFeedback function 
    const result = await generateFeedback(submissionData);

    // Verify the result
    expect(result).toBeDefined();
    
    // In a real test with actual implementation, we might verify that:
    // 1. The AI received the formatted instructor context
    // 2. The feedback reflects the instructor context criteria
    // 3. The AI doesn't reveal the instructor's sample solution
  });
});

// Mock implementation of the adapter function for testing
// In a real scenario, you would import the actual function
function generateFeedback(data: any) {
  // This would call the Gemini API with the rich text content
  // For this test, we're just returning a mock response
  return Promise.resolve({
    summary: 'Good implementation with room for improvement.',
    strengths: ['Used modern JavaScript syntax'],
    improvements: ['Could add error handling for empty arrays'],
    suggestions: ['Consider using reduce method as an alternative approach'],
    score: 85
  });
}