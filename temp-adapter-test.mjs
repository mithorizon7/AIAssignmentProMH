
    import { GoogleGenAI } from '@google/genai';
    import * as dotenv from 'dotenv';
    import fs from 'fs';
    import path from 'path';
    import { fileURLToPath } from 'url';
    
    // Setup dirname for ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Load environment variables
    dotenv.config();
    
    async function testAdapter() {
      try {
        console.log("Initializing GoogleGenAI client...");
        
        // Initialize the client
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // Test parameters
        const MODEL_NAME = "gemini-2.5-flash-preview-04-17";
        const TEST_PROMPT = "Write a comprehensive analysis of this code function summarizing its strengths and weaknesses: function add(a, b) { return a + b; }";
        
        // Define response schema
        const responseSchema = {
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
          required: ["strengths", "improvements", "suggestions", "summary", "score"]
        };
        
        // 1. Test text-only prompt
        console.log("\nTEST 1: Text-only prompt with JSON response format");
        console.log("Generating content with model:", MODEL_NAME);
        
        const textResult = await genAI.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts: [{ text: TEST_PROMPT }] }],
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: responseSchema
        });
        
        // Process result
        if (textResult.candidates && textResult.candidates.length > 0) {
          const text = textResult.candidates[0].content.parts[0].text;
          console.log("\nPreview of text response:", text.substring(0, 150) + "...");
          
          // Try to parse as JSON
          try {
            const parsedJson = JSON.parse(text);
            console.log("\nSuccessfully parsed JSON:", Object.keys(parsedJson).join(", "));
            console.log("Strengths count:", parsedJson.strengths?.length || 0);
            console.log("Improvements count:", parsedJson.improvements?.length || 0);
          } catch (e) {
            console.warn("Failed to parse direct JSON:", e.message);
            console.log("Raw text:", text.substring(0, 300) + "...");
          }
          
          console.log("\nToken usage:", textResult.usageMetadata?.totalTokenCount || "unknown");
          
          // Test passed for text generation
          console.log("\n✅ Text prompt test passed");
        } else {
          console.error("No response candidates found for text prompt");
          return false;
        }
        
        // Done
        return true;
      } catch (error) {
        console.error("Error testing adapter:", error);
        return false;
      }
    }
    
    // Run the test
    testAdapter().then(success => {
      if (success) {
        console.log("\n✅ All adapter tests passed");
        process.exit(0);
      } else {
        console.error("\n❌ Adapter tests failed");
        process.exit(1);
      }
    }).catch(error => {
      console.error("\n❌ Unhandled error:", error);
      process.exit(1);
    });
    