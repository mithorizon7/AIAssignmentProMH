/**
 * Simple test of multimodal functionality
 * with the @google/genai SDK
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check for API key
if (!process.env.GEMINI_API_KEY) {
  console.error("Error: Missing GEMINI_API_KEY in environment");
  process.exit(1);
}

// Create a new text file
const TEST_FILE = 'test_image.txt';
fs.writeFileSync(TEST_FILE, 'This is a test image placeholder');

// Set up the client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runTest() {
  try {
    console.log("Running simple multimodal test...");
    
    // First, let's test a text-only prompt with generationConfig
    const textResult = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [{ 
        role: 'user', 
        parts: [{ text: "Explain what makes a good software engineer in 3 sentences." }] 
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256
      }
    });
    
    // Log the text result
    console.log("\n=== Text-only result ===");
    console.log(textResult.candidates[0].content.parts[0].text);
    
    // Read the test file as text
    const fileData = fs.readFileSync(TEST_FILE, 'utf8');
    
    // Test a multimodal prompt with generationConfig
    const multimodalResult = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [{ 
        role: 'user', 
        parts: [
          { text: "What do you see in this image? (Note: This is actually just text but we're testing the API structure)" },
          { text: fileData }
        ] 
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            analysis: {
              type: "string",
              description: "Analysis of the content"
            },
            format: {
              type: "string",
              description: "The format of the content"
            }
          }
        }
      }
    });
    
    // Log the multimodal result
    console.log("\n=== Multimodal result ===");
    console.log(multimodalResult.candidates[0].content.parts[0].text);
    
    // Clean up
    fs.unlinkSync(TEST_FILE);
    
    return true;
  } catch (error) {
    console.error("Error in test:", error);
    return false;
  }
}

// Run the test
runTest().then(success => {
  console.log(success ? "\n✅ Test completed successfully" : "\n❌ Test failed");
  process.exit(success ? 0 : 1);
});