/**
 * Simple smoke test for Gemini adapter
 * Verifies correct config structure with responseMimeType
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
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

// Get configurable model name from env or use default
const modelName = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash-preview-04-17";
console.log(`Using model: ${modelName}`);

// Response schema for JSON structure
const responseSchema = {
  type: "object",
  properties: {
    summary: { 
      type: "string",
      description: "A brief summary of the analysis"
    },
    points: {
      type: "array",
      items: { type: "string" },
      description: "Key points from the analysis"
    },
    score: { 
      type: "number",
      description: "A score from 0-100"
    }
  },
  required: ["summary", "points"]
};

async function runSmokeTest() {
  try {
    console.log("Running Gemini smoke test with config structure...");
    
    // Log API key status (masked for security)
    if (apiKey) {
      console.log(`API Key present: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    } else {
      console.log("API Key not found");
    }
    
    // Define the request
    const request = {
      model: modelName,
      contents: [{ 
        role: 'user', 
        parts: [{ text: "Analyze this simple function in JavaScript: function add(a, b) { return a + b; }" }] 
      }],
      config: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    };
    
    console.log("Request structure:", JSON.stringify(request, null, 2));
    
    // Prepare request with config structure
    const result = await genAI.models.generateContent(request);
    
    // Log response metadata
    console.log("Response received:");
    console.log("Response ID:", result.responseId);
    
    // Check if we have candidates
    if (!result.candidates || result.candidates.length === 0) {
      console.error("No candidates found in response");
      return false;
    }
    
    // Get the text content
    const text = result.candidates[0].content.parts[0].text;
    console.log("\nRaw response:", text);
    
    // Try to parse JSON
    try {
      const parsedJson = JSON.parse(text);
      console.log("\nSuccessfully parsed JSON:");
      console.log(JSON.stringify(parsedJson, null, 2));
      return true;
    } catch (error) {
      console.error("Error parsing JSON:", error.message);
      console.log("Raw text content:", text);
      return false;
    }
  } catch (error) {
    console.error("Error in smoke test:", error.message);
    return false;
  }
}

// Run the test
runSmokeTest().then(success => {
  console.log(success ? "\n✅ Smoke test passed successfully" : "\n❌ Smoke test failed");
  process.exit(success ? 0 : 1);
});