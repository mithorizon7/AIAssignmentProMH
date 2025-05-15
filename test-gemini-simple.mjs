/**
 * Simple direct test of Gemini adapter functionality
 * Testing text-only and multimodal capabilities
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check for API key
if (!process.env.GEMINI_API_KEY) {
  console.error("Error: Missing GEMINI_API_KEY in environment");
  process.exit(1);
}

// Set up the client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = "gemini-2.5-flash-preview-04-17";

async function testTextGeneration() {
  console.log("\n=== Testing Text Generation ===");
  
  try {
    const result = await genAI.models.generateContent({
      model: modelName,
      contents: [{ 
        role: 'user', 
        parts: [{ text: "Explain what makes a good code review in 2-3 sentences." }] 
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256
      }
    });
    
    console.log("Text generation result:");
    console.log(result.candidates[0].content.parts[0].text);
    return true;
  } catch (error) {
    console.error("Error generating text:", error);
    return false;
  }
}

async function runTests() {
  try {
    console.log("Testing Gemini adapter functionality with generationConfig");
    
    // Text generation test
    const textSuccess = await testTextGeneration();
    
    return textSuccess;
  } catch (error) {
    console.error("Test execution failed:", error);
    return false;
  }
}

// Run the test
runTests().then(success => {
  console.log(success ? "\n✅ Test completed successfully" : "\n❌ Test failed");
  process.exit(success ? 0 : 1);
});