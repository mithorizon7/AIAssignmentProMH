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

// Create a test SVG for the test
function createTestSvg() {
  const svgContent = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0" />
  <circle cx="100" cy="100" r="80" fill="#3498db" />
  <text x="100" y="115" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Test</text>
</svg>`;

  const filePath = path.join(__dirname, 'test_image.svg');
  fs.writeFileSync(filePath, svgContent);
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
    // Create test file
    const svgPath = createTestSvg();
    console.log(`Created test SVG file at: ${svgPath}`);
    
    // Read the file
    const imageData = fs.readFileSync(svgPath);
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
          mimeType: "image/svg+xml"
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
    
    // Clean up test file
    fs.unlinkSync(svgPath);
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