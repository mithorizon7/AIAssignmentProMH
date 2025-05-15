/**
 * Integration test for Gemini adapter
 * This tests the full adapter implementation with different input types
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

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

// Create test files
function setupTestFiles() {
  // Create a text file
  const textContent = `
  # Test Submission
  
  This is a sample submission for testing the Gemini adapter.
  
  ## Code Sample
  
  \`\`\`javascript
  function calculateSum(a, b) {
    return a + b;
  }
  \`\`\`
  
  ## Analysis
  
  The function above performs a simple addition operation.
  `;
  
  fs.writeFileSync('./test_submission_text.txt', textContent);
  
  // Create a simple 1x1 PNG
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const imageBuffer = Buffer.from(base64Image, 'base64');
  fs.writeFileSync('./test_submission_image.png', imageBuffer);
  
  console.log("Created test files for adapter testing");
}

// Clean up test files
function cleanupTestFiles() {
  try {
    fs.unlinkSync('./test_submission_text.txt');
    fs.unlinkSync('./test_submission_image.png');
    console.log("Cleaned up test files");
  } catch (err) {
    console.warn("Error during cleanup:", err.message);
  }
}

// Import the adapter dynamically
async function importAdapter() {
  try {
    // Using dynamic import for ESM compatibility
    const module = await import('./server/adapters/gemini-adapter-new.ts');
    console.log("Successfully imported Gemini adapter module");
    return module.GeminiAdapter;
  } catch (error) {
    console.error("Failed to import Gemini adapter:", error);
    return null;
  }
}

async function runAdapterTests() {
  try {
    console.log("=== Running Gemini Adapter Integration Tests ===");
    setupTestFiles();
    
    // Get the adapter class
    const GeminiAdapter = await importAdapter();
    if (!GeminiAdapter) {
      throw new Error("Failed to import GeminiAdapter class");
    }
    
    // Create an instance
    const adapter = new GeminiAdapter();
    console.log("Created GeminiAdapter instance");
    
    // Test 1: Text completion
    console.log("\n--- Test 1: Text Completion ---");
    const prompt = "Analyze this code: function add(a, b) { return a + b; }";
    const textResult = await adapter.generateCompletion(prompt);
    console.log("Text completion result:", 
      textResult ? "Success" : "Failed");
    console.log("Result preview:", 
      textResult ? textResult.substring(0, 100) + "..." : "N/A");
    
    // Test 2: Multimodal completion with text
    console.log("\n--- Test 2: Multimodal Completion (Text) ---");
    const textFileData = fs.readFileSync('./test_submission_text.txt', 'utf8');
    const multimodalTextResult = await adapter.generateMultimodalCompletion([
      { type: 'text', data: "Please analyze this submission:" },
      { type: 'text', data: textFileData }
    ]);
    console.log("Multimodal text result:", 
      multimodalTextResult ? "Success" : "Failed");
    console.log("Result preview:", 
      multimodalTextResult ? multimodalTextResult.substring(0, 100) + "..." : "N/A");
    
    // Test 3: Multimodal completion with image
    console.log("\n--- Test 3: Multimodal Completion (Image) ---");
    const imageFileData = fs.readFileSync('./test_submission_image.png');
    const multimodalImageResult = await adapter.generateMultimodalCompletion([
      { type: 'text', data: "What do you see in this image?" },
      { type: 'image', data: imageFileData, mimeType: 'image/png' }
    ]);
    console.log("Multimodal image result:", 
      multimodalImageResult ? "Success" : "Failed");
    console.log("Result preview:", 
      multimodalImageResult ? multimodalImageResult.substring(0, 100) + "..." : "N/A");
    
    // Tests completed
    console.log("\n=== All Tests Completed ===");
    return true;
  } catch (error) {
    console.error("Test failed with error:", error);
    return false;
  } finally {
    cleanupTestFiles();
  }
}

// Run the tests
runAdapterTests().then(success => {
  console.log(success ? "\n✅ Integration tests completed successfully" : "\n❌ Integration tests failed");
  process.exit(success ? 0 : 1);
});