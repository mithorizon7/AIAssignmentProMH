/**
 * Direct test of the GeminiAdapter class implementation
 * Ensures it uses the correct config structure
 */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Mock implementation based on your actual GeminiAdapter
class GeminiAdapter {
  constructor() {
    console.log("Initializing Gemini adapter with config-style parameters");
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }
    
    // Using dynamic import to load the Google GenAI SDK
    this._initializeClient = async () => {
      const { GoogleGenAI } = await import('@google/genai');
      return new GoogleGenAI({ apiKey });
    };
    
    // Make model name configurable via environment variable
    this.modelName = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash-preview-04-17";
    console.log(`Using model: ${this.modelName}`);
  }
  
  // Define response schema structure for reuse
  responseSchema = {
    type: "object",
    properties: {
      analysis: {
        type: "string",
        description: "Analysis of the submission"
      },
      strengths: {
        type: "array",
        items: { type: "string" }
      },
      score: { type: "number" }
    },
    required: ["analysis"]
  };
  
  // Standard text completion method
  async generateCompletion(prompt) {
    try {
      console.log(`Generating completion for prompt (length: ${prompt.length})`);
      
      // Initialize client dynamically
      const genAI = await this._initializeClient();
      
      // Configure parameters
      const temperature = 0.2;
      const topP = 0.8;
      const maxOutputTokens = 512;
      
      // Use config structure instead of generationConfig
      const result = await genAI.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature,
          topP,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema
        }
      });
      
      console.log("Received response");
      
      // Extract text from response
      if (result.candidates && 
          result.candidates.length > 0 && 
          result.candidates[0]?.content?.parts) {
        const text = result.candidates[0].content.parts[0].text;
        console.log(`Response text (${text.length} chars): ${text.substring(0, 50)}...`);
        
        // Parse JSON response
        try {
          const parsed = JSON.parse(text);
          console.log("Successfully parsed JSON response");
          return parsed;
        } catch (e) {
          console.error("Error parsing JSON:", e.message);
          return { error: "Failed to parse JSON response", text };
        }
      } else {
        console.error("Unexpected response structure");
        return { error: "Unexpected response structure" };
      }
    } catch (error) {
      console.error("Error in generateCompletion:", error.message);
      return { error: error.message };
    }
  }
}

// Run the test
async function testGeminiAdapterWithConfig() {
  try {
    console.log("Testing GeminiAdapter with config structure...");
    
    // Create adapter instance
    const adapter = new GeminiAdapter();
    
    // Test with a simple prompt
    const result = await adapter.generateCompletion(
      "Analyze this code snippet: function multiply(a, b) { return a * b; }"
    );
    
    // Verify the response
    console.log("\nFull response:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.analysis) {
      console.log("\n✅ Success: Received valid response with analysis");
      return true;
    } else if (result.error) {
      console.error("❌ Test failed:", result.error);
      return false;
    } else {
      console.error("❌ Test failed: Unexpected response format");
      return false;
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
    return false;
  }
}

// Run the test and exit with appropriate code
testGeminiAdapterWithConfig().then(success => {
  process.exit(success ? 0 : 1);
});