/**
 * Simple test script for Gemini API
 */
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();

// Test variables
const MODEL_NAME = "gemini-2.5-flash-preview-04-17";
const TEST_PROMPT = "Write a short analysis of this text: The capital of France is Paris.";

// Main function
async function runTest() {
  console.log("=== Simple Gemini API Test ===");
  
  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is missing");
    return false;
  }
  
  console.log(`Using API key: ${process.env.GEMINI_API_KEY.substring(0, 3)}...`);
  
  try {
    // Initialize the client
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Initialized GoogleGenAI client");
    
    // Log available methods
    console.log("\nAvailable methods on genAI:");
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(genAI)));
    
    // Use the models API to generate content
    console.log(`\nGenerating content with model: ${MODEL_NAME}`);
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: TEST_PROMPT }] }],
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024
    });
    
    // Log response structure
    console.log("\nResponse structure properties:");
    console.log(Object.keys(result));
    
    // Extract text
    if (result.candidates && result.candidates.length > 0) {
      console.log(`\nFound ${result.candidates.length} candidates`);
      
      if (result.candidates[0].content) {
        console.log("\nCandidate content properties:");
        console.log(Object.keys(result.candidates[0].content));
        
        if (result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
          console.log(`\nFound ${result.candidates[0].content.parts.length} parts`);
          
          const firstPart = result.candidates[0].content.parts[0];
          if (firstPart.text) {
            console.log("\nResponse text preview:");
            console.log(firstPart.text.substring(0, 200) + "...");
          } else {
            console.log("\nNo text found in first part");
          }
        } else {
          console.log("\nNo parts found in content");
        }
      } else {
        console.log("\nNo content found in candidate");
      }
    } else {
      console.log("\nNo candidates found in response");
    }
    
    // Check for token usage
    if (result.usageMetadata) {
      console.log("\nUsage metadata:");
      console.log(result.usageMetadata);
    } else {
      console.log("\nNo usage metadata available");
    }
    
    console.log("\nTest completed successfully");
    return true;
  } catch (error) {
    console.error("Error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

// Run the test
runTest().then(success => {
  if (success) {
    console.log("\n✅ Test passed");
    process.exit(0);
  } else {
    console.error("\n❌ Test failed");
    process.exit(1);
  }
});