/**
 * Test script for multimodal content processing
 * This checks the correct handling of different file types 
 * for the Gemini AI adapter
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

// Check for required API key
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: Missing GEMINI_API_KEY in environment variables");
  process.exit(1);
}

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test file paths - use full path
const TEST_IMAGE_FILE = '/home/runner/workspace/attached_assets/Screenshot 2025-05-15 at 2.00.26 PM.png';
const TEST_TEXT_FILE = '/home/runner/workspace/test_submission.txt';

async function main() {
  try {
    console.log("=== Testing Multimodal Content Processing ===");
    
    // Verify test files exist
    if (!fs.existsSync(TEST_IMAGE_FILE)) {
      console.error(`TEST_IMAGE_FILE not found at: ${TEST_IMAGE_FILE}`);
      return false;
    }
    
    if (!fs.existsSync(TEST_TEXT_FILE)) {
      // Create a simple test file if it doesn't exist
      fs.writeFileSync(TEST_TEXT_FILE, "This is a sample text file for testing multimodal processing.\n\nIt contains multiple lines of text to analyze.\n\nfunction testCode() {\n  return 'Hello, world!';\n}");
      console.log(`Created test text file at: ${TEST_TEXT_FILE}`);
    }
    
    // Create a temporary test script
    const tempFile = path.resolve('./temp-multimodal-test.mjs');
    const testCode = `
    import { GoogleGenAI } from '@google/genai';
    import fs from 'fs';
    import path from 'path';
    import { fileURLToPath } from 'url';
    import * as dotenv from 'dotenv';
    
    // Load environment variables
    dotenv.config();
    
    // Setup paths
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Test file paths (same as in the parent script)
    const TEST_IMAGE_FILE = '/home/runner/workspace/attached_assets/Screenshot 2025-05-15 at 2.00.26 PM.png';
    const TEST_TEXT_FILE = '/home/runner/workspace/test_submission.txt';
    
    /**
     * Test multimodal content processing with Gemini
     */
    async function testMultimodalProcessing() {
      try {
        console.log("Initializing GoogleGenAI client...");
        
        // Initialize Gemini client
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // Load test files
        console.log("Loading test files...");
        const imageData = fs.readFileSync(TEST_IMAGE_FILE);
        const textData = fs.readFileSync(TEST_TEXT_FILE, 'utf8');
        
        // File info for logging
        console.log(\`Image file size: \${Math.round(imageData.length / 1024)}KB\`);
        console.log(\`Text file size: \${textData.length} characters\`);
        
        // Prepare multimodal prompt
        console.log("\\nPreparing multimodal prompt...");
        const MODEL_NAME = "gemini-2.5-flash-preview-04-17";
        
        // Content parts for the multimodal request
        const contentParts = [
          { text: "Please analyze both this text and image. For the text, summarize its content. For the image, describe what you see:" },
          {
            inlineData: {
              data: imageData.toString('base64'),
              mimeType: "image/png"
            }
          },
          { text: "Here's the text content:\\n\\n" + textData }
        ];
        
        // Response schema for structured output
        const responseSchema = {
          type: "object",
          properties: {
            textAnalysis: {
              type: "string",
              description: "Summary of the text content"
            },
            imageAnalysis: {
              type: "string",
              description: "Description of the image"
            },
            combinedInsights: {
              type: "array",
              description: "Insights from analyzing both the text and image together",
              items: { type: "string" }
            }
          },
          required: ["textAnalysis", "imageAnalysis", "combinedInsights"]
        };
        
        console.log("Sending multimodal request to Gemini API...");
        const startTime = Date.now();
        const result = await genAI.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts: contentParts }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });
        const endTime = Date.now();
        
        console.log(\`API call completed in \${(endTime - startTime) / 1000} seconds\`);
        
        // Process response
        if (!result.candidates || result.candidates.length === 0) {
          console.error("No response candidates received from API");
          return false;
        }
        
        const responseText = result.candidates[0].content.parts[0].text;
        console.log("\\nResponse text length:", responseText.length);
        console.log("Response preview:", responseText.substring(0, 100) + "...");
        
        // Log token usage
        let tokenCount = "unknown";
        if (result.usageMetadata) {
          tokenCount = result.usageMetadata.totalTokenCount || 
                       (result.usageMetadata.promptTokenCount || 0) + 
                       (result.usageMetadata.candidatesTokenCount || 0);
        }
        console.log("\\nToken usage:", tokenCount);
        
        // Attempt to parse JSON response
        try {
          const jsonResponse = JSON.parse(responseText);
          console.log("\\nSuccessfully parsed JSON response:");
          console.log("- Text analysis:",  jsonResponse.textAnalysis ? "Present" : "Missing");
          console.log("- Image analysis:", jsonResponse.imageAnalysis ? "Present" : "Missing");
          console.log("- Combined insights:", jsonResponse.combinedInsights ? 
                      \`\${jsonResponse.combinedInsights.length} items\` : "Missing");
          
          // Success if we got structured data for both text and image
          return (jsonResponse.textAnalysis && jsonResponse.imageAnalysis);
        } catch (error) {
          console.warn("Failed to parse JSON response:", error.message);
          console.log("Raw response:", responseText.substring(0, 500) + "...");
          return false;
        }
      } catch (error) {
        console.error("Error testing multimodal processing:", error.message);
        if (error.stack) {
          console.error(error.stack);
        }
        return false;
      }
    }
    
    // Run the test
    testMultimodalProcessing().then(success => {
      if (success) {
        console.log("\\n✅ Multimodal processing test passed");
        process.exit(0);
      } else {
        console.error("\\n❌ Multimodal processing test failed");
        process.exit(1);
      }
    }).catch(error => {
      console.error("\\n❌ Unhandled error:", error);
      process.exit(1);
    });
    `;
    
    // Write test file
    fs.writeFileSync(tempFile, testCode);
    
    // Execute the test
    console.log("Running multimodal test...");
    return new Promise((resolve, reject) => {
      exec(`node ${tempFile}`, (error, stdout, stderr) => {
        console.log(stdout);
        if (stderr) {
          console.error(stderr);
        }
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        if (error) {
          console.error("Test failed with exit code:", error.code);
          reject(error);
        } else {
          console.log("Test completed successfully");
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error("Error running test:", error.message);
    return false;
  }
}

// Run the main function
main().then(result => {
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});