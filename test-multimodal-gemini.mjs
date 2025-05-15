/**
 * Test script for multimodal functionality with Gemini
 * This tests the ability to analyze images + text together
 */
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Test constants
const MODEL_NAME = "gemini-2.5-flash-preview-04-17";
const TEST_PROMPT = "Analyze this image and provide feedback on its design.";

// Use an existing PNG image for the test
function getTestImagePath() {
  // Using an existing PNG from the assets
  const filePath = path.join(__dirname, 'attached_assets/android-chrome-192x192.png');
  
  // Verify the file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Test image not found at: ${filePath}`);
    throw new Error('Test image not found');
  }
  
  console.log(`Using test image: ${filePath}`);
  return filePath;
}

// Main test function
async function testMultimodalGemini() {
  console.log("=== Multimodal Gemini API Test ===");
  
  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is missing");
    return false;
  }
  
  console.log(`Using API key: ${process.env.GEMINI_API_KEY.substring(0, 3)}...`);
  
  try {
    // Get test image path
    const imagePath = getTestImagePath();
    
    // Read the file
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    console.log(`Image loaded, size: ${Math.round(base64Image.length / 1024)}KB`);
    
    // Initialize the client
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Initialized GoogleGenAI client");
    
    // Prepare multimodal request
    console.log(`\nGenerating multimodal content with model: ${MODEL_NAME}`);
    
    // Construct parts array with text and image
    const parts = [
      { text: TEST_PROMPT },
      { 
        inlineData: {
          data: base64Image,
          mimeType: "image/png"
        }
      }
    ];
    
    // Make the API request
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024
    });
    
    // Extract and log response
    if (result.candidates && result.candidates.length > 0) {
      console.log(`\nFound ${result.candidates.length} candidates`);
      
      if (result.candidates[0].content && 
          result.candidates[0].content.parts && 
          result.candidates[0].content.parts.length > 0) {
        
        const text = result.candidates[0].content.parts[0].text;
        console.log("\nResponse text preview:");
        console.log(text.substring(0, 300) + "...");
      } else {
        console.log("\nNo text found in response");
      }
    } else {
      console.log("\nNo candidates found in response");
    }
    
    // Log token usage
    if (result.usageMetadata) {
      console.log("\nUsage metadata:");
      console.log(result.usageMetadata);
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
testMultimodalGemini().then(success => {
  if (success) {
    console.log("\n✅ Test passed");
    process.exit(0);
  } else {
    console.error("\n❌ Test failed");
    process.exit(1);
  }
});