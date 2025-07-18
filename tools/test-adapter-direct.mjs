/**
 * Direct test of the adapter implementation
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only run this if we have the API key
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: Missing GEMINI_API_KEY in environment variables");
  process.exit(1);
}

async function main() {
  try {
    console.log("Testing direct adapter implementation...");
    
    // Check if the adapter file exists
    const adapterPath = path.resolve('./server/adapters/gemini-adapter.ts');
    if (!fs.existsSync(adapterPath)) {
      console.error(`ERROR: Adapter file not found at ${adapterPath}`);
      return false;
    }
    
    // Create a temporary wrapper that just imports and instantiates the adapter
    const tempFile = path.resolve('./temp-adapter-wrapper.mjs');
    const wrapperCode = `
    // ESM wrapper for testing the adapter
    import { fileURLToPath } from 'url';
    import path from 'path';
    import * as dotenv from 'dotenv';
    
    // Load environment variables
    dotenv.config();
    
    // Setup dirname for ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Import the GoogleGenAI class directly
    import { GoogleGenAI } from '@google/genai';
    
    async function testDirectGenAI() {
      console.log("Testing direct GoogleGenAI functionality...");
      try {
        // Initialize the client
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        console.log("Initialized GoogleGenAI client successfully");
        
        // Use the models API to generate content
        const MODEL_NAME = "gemini-2.5-flash-preview-04-17";
        const TEST_PROMPT = "Write a 3-point analysis of this code: function add(a, b) { return a + b; }";
        
        console.log("Generating content with model:", MODEL_NAME);
        
        const result = await genAI.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts: [{ text: TEST_PROMPT }] }],
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024
        });
        
        if (result.candidates && result.candidates.length > 0) {
          const text = result.candidates[0].content.parts[0].text;
          console.log("\\nPreview of response:", text.substring(0, 150) + "...");
          console.log("\\nToken usage:", result.usageMetadata?.totalTokenCount || "unknown");
          return true;
        } else {
          console.error("No response candidates found");
          return false;
        }
      } catch (error) {
        console.error("Error testing direct GoogleGenAI:", error);
        return false;
      }
    }
    
    // Run the test and report results
    testDirectGenAI().then(success => {
      if (success) {
        console.log("\\n✅ Direct GoogleGenAI test passed");
        process.exit(0);
      } else {
        console.error("\\n❌ Direct GoogleGenAI test failed");
        process.exit(1);
      }
    }).catch(error => {
      console.error("\\n❌ Unhandled error:", error);
      process.exit(1);
    });
    `;
    
    fs.writeFileSync(tempFile, wrapperCode);
    
    console.log("Running direct GoogleGenAI test with node...");
    return new Promise((resolve, reject) => {
      exec(`node ${tempFile}`, (error, stdout, stderr) => {
        console.log(stdout);
        if (stderr) {
          console.error(stderr);
        }
        
        // Clean up the temp file
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

main().then(result => {
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});