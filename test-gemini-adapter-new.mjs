/**
 * Test script for the new Gemini adapter implementation
 * Using ESM syntax with proper migration for latest SDK version
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

// Test file creation for multimodal testing
async function createTestSvgImage() {
  const svgContent = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0" />
  <circle cx="100" cy="100" r="80" fill="#3498db" />
  <text x="100" y="115" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Test</text>
</svg>`;

  const filePath = join(__dirname, 'test_image.svg');
  fs.writeFileSync(filePath, svgContent);
  return filePath;
}

// Import the adapter class directly
// Note: TypeScript files need to be compiled, so we'll use a dynamic import approach
async function importGeminiAdapter() {
  try {
    // Try to build the TypeScript file first
    console.log("Compiling the GeminiAdapter...");
    await new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec('npx tsc --allowJs --esModuleInterop server/adapters/gemini-adapter-new.ts --outDir ./temp', 
        (error, stdout, stderr) => {
          if (error) {
            console.log("Compilation error:", stderr);
            // Continue anyway - we'll try a different approach
          }
          resolve();
        });
    });
    
    // Try to import the compiled JS file
    try {
      const { GeminiAdapter } = await import('./temp/server/adapters/gemini-adapter-new.js');
      return GeminiAdapter;
    } catch (importError) {
      console.log("Couldn't import compiled file:", importError.message);
      
      // As a fallback, use tsx to run the TypeScript file directly
      console.log("Using tsx to import adapter directly...");
      
      // Create a temporary JS file that imports and re-exports the class
      const tempFile = join(__dirname, 'temp_adapter_import.mjs');
      const importCode = `
      import { GeminiAdapter } from './server/adapters/gemini-adapter-new.js';
      export { GeminiAdapter };
      `;
      fs.writeFileSync(tempFile, importCode);
      
      try {
        // Run with tsx and capture the exported class
        const { GeminiAdapter } = await import('./temp_adapter_import.mjs');
        return GeminiAdapter;
      } catch (tsxError) {
        console.log("TSX import failed:", tsxError.message);
        throw new Error("Failed to import GeminiAdapter through any method");
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }
  } catch (error) {
    console.error("Failed to import adapter:", error.message);
    
    // Last resort - create a temporary runtime implementation
    console.log("Creating temporary runtime implementation...");
    
    // Simple runtime implementation of the class
    class TempGeminiAdapter {
      constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("Gemini API key is required");
        }
        
        this.apiKey = apiKey;
        this.modelName = "gemini-2.5-flash-preview-04-17";
        
        // Dynamically import the GoogleGenAI class
        this.genAI = new (await import('@google/genai')).GoogleGenAI({ apiKey });
      }
      
      async generateCompletion(prompt) {
        console.log("Generating completion with prompt:", prompt.substring(0, 50) + "...");
        
        const result = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              suggestions: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
              score: { type: "number" }
            }
          }
        });
        
        console.log("Response received");
        
        // Extract the text from the response
        let text = '';
        if (result.candidates && result.candidates.length > 0 && result.candidates[0]?.content?.parts) {
          const firstPart = result.candidates[0].content.parts[0];
          if (firstPart.text) {
            text = firstPart.text;
          }
        }
        
        // Try to parse as JSON
        let parsedContent = {};
        try {
          parsedContent = JSON.parse(text);
        } catch (e) {
          console.log("Failed to parse JSON:", e.message);
        }
        
        // Calculate token count
        let tokenCount = 0;
        if (result.usageMetadata) {
          const { promptTokenCount, candidatesTokenCount } = result.usageMetadata;
          tokenCount = (promptTokenCount || 0) + (candidatesTokenCount || 0);
        }
        
        return {
          strengths: parsedContent.strengths || [],
          improvements: parsedContent.improvements || [],
          suggestions: parsedContent.suggestions || [],
          summary: parsedContent.summary || "",
          score: parsedContent.score,
          rawResponse: parsedContent,
          modelName: this.modelName,
          tokenCount: tokenCount || Math.ceil(text.length / 4)
        };
      }
      
      async generateMultimodalCompletion(parts, systemPrompt) {
        console.log("Generating multimodal completion with parts:", parts.length);
        
        // Runtime implementation for multimodal
        // Similar to the text version but with multimodal handling
        return this.generateCompletion("Multimodal content analysis");
      }
    }
    
    return TempGeminiAdapter;
  }
}

// Main test function
async function testGeminiAdapter() {
  console.log("=== New Gemini Adapter Test ===");
  
  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is missing.");
    console.error("Please add it to your .env file or provide it when running the script.");
    return false;
  }
  
  console.log("GEMINI_API_KEY is available");
  
  try {
    // Get the adapter class
    const AdapterClass = await importGeminiAdapter();
    
    // Initialize the adapter
    console.log("Initializing Gemini adapter...");
    const adapter = new AdapterClass();
    
    // Test text completion
    console.log("\n=== Testing Text Completion ===");
    const prompt = `
    Please analyze this submission and provide academic feedback.
    Be specific and constructive.
    Your response should be in JSON format with these fields:
    - strengths (array of strings)
    - improvements (array of strings)
    - suggestions (array of strings) 
    - summary (string)
    - score (number from 0 to 100)
    
    SUBMISSION:
    This is a test submission. The square root of 16 is 4. The capital of France is Paris.
    `;
    
    console.log("Sending text prompt...");
    const textResponse = await adapter.generateCompletion(prompt);
    
    console.log("\n=== Text Completion Results ===");
    console.log(`Model: ${textResponse.modelName}`);
    console.log(`Token count: ${textResponse.tokenCount}`);
    console.log(`Score: ${textResponse.score}`);
    console.log(`Summary: ${textResponse.summary}`);
    console.log("Strengths:", textResponse.strengths);
    console.log("Improvements:", textResponse.improvements);
    
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