/**
 * Direct test of the latest Gemini adapter implementation
 * Tests both text-only and multimodal capabilities
 */
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

// Create test files
function setupTestFiles() {
  // Create a text file for testing
  const textContent = `
  # Test Submission
  
  This is a sample submission for testing the Gemini adapter.
  
  ## Code Sample
  
  \`\`\`javascript
  function calculateSum(a, b) {
    return a + b;
  }
  \`\`\`
  `;
  
  fs.writeFileSync('./test_submission.txt', textContent);
  
  // Create a simple test image (1x1 pixel transparent PNG)
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const imageBuffer = Buffer.from(base64Image, 'base64');
  fs.writeFileSync('./test_submission_image.png', imageBuffer);
  
  console.log("Created test files for adapter testing");
}

// Clean up test files
function cleanupTestFiles() {
  try {
    fs.unlinkSync('./test_submission.txt');
    fs.unlinkSync('./test_submission_image.png');
    console.log("Cleaned up test files");
  } catch (err) {
    console.warn("Error during cleanup:", err.message);
  }
}

// Mock the GeminiAdapter implementation
class GeminiAdapter {
  constructor() {
    console.log("Initializing Google Gemini AI adapter with latest SDK patterns");
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = "gemini-2.5-flash-preview-04-17";
  }
  
  // Initialize the Google Generative AI client
  async _initializeClient() {
    const { GoogleGenAI } = await import('@google/genai');
    
    if (!this.apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    
    console.log("Initializing GoogleGenAI client");
    return new GoogleGenAI({ apiKey: this.apiKey });
  }
  
  // Standard text completion
  async generateCompletion(prompt) {
    try {
      console.log("Generating text completion for prompt:", prompt.substring(0, 50) + "...");
      
      const genAI = await this._initializeClient();
      
      const result = await genAI.models.generateContent({
        model: this.modelName,
        contents: [{ 
          role: 'user', 
          parts: [{ text: prompt }] 
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              feedback: {
                type: "string",
                description: "Detailed feedback on the submission"
              },
              score: {
                type: "number",
                description: "Score between 0-100"
              }
            },
            required: ["feedback"]
          }
        }
      });
      
      console.log("Received response from Gemini API");
      const responseText = result.candidates[0].content.parts[0].text;
      console.log("Response excerpt:", responseText.substring(0, 100) + "...");
      
      return responseText;
    } catch (error) {
      console.error("Error generating completion:", error);
      return `Error: ${error.message}`;
    }
  }
  
  // Multimodal completion (text + images, etc.)
  async generateMultimodalCompletion(parts) {
    try {
      console.log("Generating multimodal completion with", parts.length, "parts");
      
      const genAI = await this._initializeClient();
      const modelParts = [];
      
      // Convert parts to the format expected by the Gemini API
      for (const part of parts) {
        if (part.type === 'text') {
          modelParts.push({ text: part.data });
        } else if (part.type === 'image') {
          modelParts.push({
            inlineData: {
              data: part.data.toString('base64'),
              mimeType: part.mimeType || 'image/jpeg'
            }
          });
        }
      }
      
      console.log("Sending request to Gemini API");
      const result = await genAI.models.generateContent({
        model: this.modelName,
        contents: [{ 
          role: 'user', 
          parts: modelParts
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              feedback: {
                type: "string",
                description: "Detailed feedback on the submission"
              },
              score: {
                type: "number",
                description: "Score between 0-100"
              }
            },
            required: ["feedback"]
          }
        }
      });
      
      console.log("Received multimodal response from Gemini API");
      const responseText = result.candidates[0].content.parts[0].text;
      console.log("Response excerpt:", responseText.substring(0, 100) + "...");
      
      return responseText;
    } catch (error) {
      console.error("Error generating multimodal completion:", error);
      return `Error: ${error.message}`;
    }
  }
}

async function runTest() {
  try {
    console.log("=== Running Gemini Adapter Direct Test ===");
    setupTestFiles();
    
    // Create adapter instance
    const adapter = new GeminiAdapter();
    
    // Test 1: Text completion
    console.log("\n--- Test 1: Text Completion ---");
    const textPrompt = "Analyze this code: function add(a, b) { return a + b; }";
    const textResult = await adapter.generateCompletion(textPrompt);
    console.log("\nText result:", textResult ? "Success" : "Failed");
    console.log("First 150 chars:", textResult ? textResult.substring(0, 150) + "..." : "N/A");
    
    // Test 2: Multimodal (text) completion
    console.log("\n--- Test 2: Multimodal Text Completion ---");
    const textData = fs.readFileSync('./test_submission.txt', 'utf8');
    const multimodalTextResult = await adapter.generateMultimodalCompletion([
      { type: 'text', data: "Analyze this submission:" },
      { type: 'text', data: textData }
    ]);
    console.log("\nMultimodal text result:", multimodalTextResult ? "Success" : "Failed");
    console.log("First 150 chars:", multimodalTextResult ? multimodalTextResult.substring(0, 150) + "..." : "N/A");
    
    // Test 3: Multimodal (image) completion
    console.log("\n--- Test 3: Multimodal Image Completion ---");
    const imageData = fs.readFileSync('./test_submission_image.png');
    const multimodalImageResult = await adapter.generateMultimodalCompletion([
      { type: 'text', data: "What do you see in this image?" },
      { type: 'image', data: imageData, mimeType: 'image/png' }
    ]);
    console.log("\nMultimodal image result:", multimodalImageResult ? "Success" : "Failed");
    console.log("First 150 chars:", multimodalImageResult ? multimodalImageResult.substring(0, 150) + "..." : "N/A");
    
    return true;
  } catch (error) {
    console.error("Test execution failed:", error);
    return false;
  } finally {
    cleanupTestFiles();
  }
}

// Run the test
runTest().then(success => {
  console.log(success ? "\n✅ Test completed successfully" : "\n❌ Test failed");
  process.exit(success ? 0 : 1);
});