/**
 * Test script to verify the Gemini adapter's multimodal capabilities
 * 
 * This tests:
 * 1. Image processing
 * 2. Proper conversion of image data to API formats
 * 3. Proper MIME type handling
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define a simple test schema (subset of the actual grading schema)
const simpleSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A concise summary of the submission"
    },
    strengths: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Key strengths identified in the submission"
    },
    improvements: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Areas that could be improved in the submission"
    },
    score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Overall score from 0-100"
    }
  },
  required: ["summary", "strengths", "improvements", "score"]
};

// Helper function to ensure mime type is a string
function ensureMimeTypeString(mimeType) {
  return typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
}

// Mock helper that simulates our production code's shouldUseFilesAPI function
function shouldUseFilesAPI(mimeType, size) {
  // Ensure mimeType is a string
  mimeType = ensureMimeTypeString(mimeType);
  
  // Always use Files API for PDF, audio, or video
  if (
    mimeType.startsWith('application/pdf') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/')
  ) {
    return true;
  }
  
  // Use Files API for large files (>10MB)
  return size > 10 * 1024 * 1024;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash-preview-04-17";
  console.log(`Using model: ${modelName}`);

  // Test multimodal input with an image
  await testMultimodalInput(genAI, modelName);
}

async function testMultimodalInput(genAI, modelName) {
  console.log("\n🧪 Test: Multimodal input with image");
  
  try {
    // Load a test image (you can change this to any image file you have)
    const imagePath = './test_submission_image.png';
    let imageData;
    
    try {
      imageData = await fs.readFile(imagePath);
      console.log(`Loaded image from ${imagePath}: ${imageData.length} bytes`);
    } catch (err) {
      console.log(`Could not load image from ${imagePath}, creating a simple test image`);
      
      // Create a simple 1x1 pixel PNG as a fallback
      imageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    }
    
    const mimeType = 'image/png';
    
    // Test our mime type handling
    const isSafeMimeType = ensureMimeTypeString(mimeType);
    console.log(`Original MIME type: ${mimeType}`);
    console.log(`Safe MIME type: ${isSafeMimeType}`);
    
    // Test the fixed shouldUseFilesAPI function
    const shouldUseFiles = shouldUseFilesAPI(mimeType, imageData.length);
    console.log(`Should use Files API: ${shouldUseFiles} (size: ${imageData.length} bytes)`);
    
    // Create a prompt with text and image
    const textPrompt = "Analyze this image and provide feedback on its composition, style, and visual elements.";
    
    // Create a multimodal request with both text and image parts
    const requestParams = {
      model: modelName,
      contents: [
        {
          role: 'user', 
          parts: [
            { text: textPrompt },
            { inlineData: { data: imageData.toString('base64'), mimeType } }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        responseSchema: simpleSchema
      }
    };

    console.log("Sending multimodal request to Gemini API with text + image...");
    const response = await genAI.models.generateContent(requestParams);
    
    if (response && response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log(`Response finish reason: ${candidate.finishReason}`);
      
      const content = candidate.content;
      if (content && content.parts && content.parts.length > 0) {
        const text = content.parts[0].text;
        console.log(`Received ${text.length} characters`);
        
        // Verify it's valid JSON
        try {
          const parsed = JSON.parse(text);
          console.log("✅ Successfully parsed response as JSON:");
          console.log(`Summary: ${parsed.summary.substring(0, 100)}...`);
          console.log(`Score: ${parsed.score}`);
          console.log(`Strengths: ${parsed.strengths.length} items`);
          console.log(`Improvements: ${parsed.improvements.length} items`);
        } catch (err) {
          console.error("❌ Failed to parse response as JSON:", err.message);
          console.log("Raw text:", text.substring(0, 200) + "...");
        }
      } else {
        console.error("❌ No content parts in response");
      }
    } else {
      console.error("❌ No valid response candidates");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the tests
main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});