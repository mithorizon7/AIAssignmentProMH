/**
 * Test for multimodal image processing with Gemini
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

// Set up the client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runImageTest() {
  try {
    console.log("Running image multimodal test...");
    
    // Create a simple test image (1x1 pixel transparent PNG)
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // Test with image content
    const imageResult = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [{ 
        role: 'user', 
        parts: [
          { text: "What do you see in this image?" },
          { 
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: "image/png"
            }
          }
        ] 
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "Description of the image content"
            },
            colors: {
              type: "array",
              description: "Colors detected in the image",
              items: { type: "string" }
            }
          },
          required: ["description"]
        }
      }
    });
    
    // Log the image analysis result
    console.log("\n=== Image analysis result ===");
    console.log(imageResult.candidates[0].content.parts[0].text);
    
    // Log token usage if available
    if (imageResult.usageMetadata) {
      console.log("\nToken usage:", 
        imageResult.usageMetadata.promptTokenCount + 
        imageResult.usageMetadata.candidatesTokenCount);
    }
    
    return true;
  } catch (error) {
    console.error("Error in image test:", error);
    return false;
  }
}

// Run the test
runImageTest().then(success => {
  console.log(success ? "\n✅ Test completed successfully" : "\n❌ Test failed");
  process.exit(success ? 0 : 1);
});