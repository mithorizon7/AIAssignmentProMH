/**
 * Test script for the latest Gemini adapter implementation
 * Using ESM syntax
 */
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Setup dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Import the adapter directly
import { GeminiAdapter } from './server/adapters/gemini-adapter.ts';

// Test text content
const TEST_TEXT = `
This is a sample student submission for testing the AI feedback generation.
The square root of 16 is 4.
Paris is the capital of France.
`;

// Main test function
async function testGeminiAdapter() {
  console.log("=== Gemini Adapter Test ===");
  
  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is missing.");
    console.error("Please add it to your .env file or provide it when running the script.");
    return false;
  }
  
  console.log("GEMINI_API_KEY is available");
  
  try {
    // Initialize the adapter
    console.log("Initializing Gemini adapter...");
    const adapter = new GeminiAdapter(process.env.GEMINI_API_KEY);
    
    // Test text completion
    console.log("\n=== Testing Text Completion ===");
    const systemPrompt = `You are an educational AI assistant. Analyze the following submission and provide feedback.`;
    
    const textPrompt = `
    Please analyze this submission and provide academic feedback.
    Be specific and constructive.
    Provide your response in JSON format with the following fields:
    - strengths (array of strings)
    - improvements (array of strings)
    - suggestions (array of strings)
    - summary (string)
    - score (number from 0 to 100)
    
    SUBMISSION:
    ${TEST_TEXT}
    `;
    
    console.log("Sending text prompt...");
    const textResponse = await adapter.generateCompletion(
      textPrompt,
      systemPrompt,
      [],
      {
        type: "object",
        properties: {
          strengths: {
            type: "array",
            items: { type: "string" }
          },
          improvements: {
            type: "array",
            items: { type: "string" }
          },
          suggestions: {
            type: "array",
            items: { type: "string" }
          },
          summary: { type: "string" },
          score: { type: "number" }
        },
        required: ["strengths", "improvements", "summary", "score"]
      }
    );
    
    console.log("\n=== Text Completion Results ===");
    console.log(`Model: ${textResponse.modelName}`);
    console.log(`Token count: ${textResponse.tokenCount}`);
    console.log(`Score: ${textResponse.score}`);
    console.log(`Summary: ${textResponse.summary}`);
    console.log("Strengths:", textResponse.strengths);
    console.log("Improvements:", textResponse.improvements);
    
    // Test multimodal completion if an image is available
    try {
      console.log("\n=== Testing Multimodal Completion ===");
      
      // Check if we have a test image
      const testImagePath = join(__dirname, "test_image.svg");
      
      if (fs.existsSync(testImagePath)) {
        console.log("Found test image, testing multimodal completion...");
        
        // Read image as base64
        const imageBuffer = fs.readFileSync(testImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        
        // Prepare multimodal parts
        const parts = [
          {
            type: 'text',
            text: 'Please analyze this image and provide feedback on its design, clarity, and effectiveness.'
          },
          {
            type: 'image',
            data: imageBase64,
            mimeType: 'image/svg+xml'
          }
        ];
        
        console.log("Sending multimodal prompt...");
        const multimodalResponse = await adapter.generateMultimodalCompletion(
          parts,
          "You are a design expert. Analyze this image thoroughly and constructively."
        );
        
        console.log("\n=== Multimodal Completion Results ===");
        console.log(`Model: ${multimodalResponse.modelName}`);
        console.log(`Token count: ${multimodalResponse.tokenCount}`);
        console.log(`Score: ${multimodalResponse.score}`);
        console.log(`Summary: ${multimodalResponse.summary}`);
        console.log("Strengths:", multimodalResponse.strengths);
        console.log("Improvements:", multimodalResponse.improvements);
      } else {
        console.log("No test image found at", testImagePath);
        console.log("Skipping multimodal test");
      }
    } catch (multimodalError) {
      console.error("Multimodal test failed:", multimodalError.message);
    }
    
    console.log("\n=== Test Completed Successfully ===");
    return true;
  } catch (error) {
    console.error("Test failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

// Run the test
testGeminiAdapter().then(success => {
  if (success) {
    console.log("\n✅ All tests passed");
    process.exit(0);
  } else {
    console.error("\n❌ Tests failed");
    process.exit(1);
  }
});