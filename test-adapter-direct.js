/**
 * Direct test of the adapter implementation
 */
require('dotenv').config();

// Only run this if we have the API key
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: Missing GEMINI_API_KEY in environment variables");
  process.exit(1);
}

async function main() {
  try {
    console.log("Testing direct adapter implementation...");
    
    // Dynamically load the adapter module
    const path = require('path');
    const fs = require('fs');
    
    // Check if the adapter file exists
    const adapterPath = path.resolve('./server/adapters/gemini-adapter.ts');
    if (!fs.existsSync(adapterPath)) {
      console.error(`ERROR: Adapter file not found at ${adapterPath}`);
      return false;
    }
    
    // Use tsx to import TypeScript directly
    const { exec } = require('child_process');
    
    // Create a temporary wrapper that just imports and instantiates the adapter
    const tempFile = path.resolve('./temp-adapter-wrapper.js');
    const wrapperCode = `
    const { GeminiAdapter } = require('./server/adapters/gemini-adapter.ts');
    
    async function testAdapter() {
      try {
        console.log("Initializing GeminiAdapter...");
        const adapter = new GeminiAdapter();
        
        const prompt = "Provide feedback on this code: function add(a, b) { return a + b; }";
        console.log("Running text completion test...");
        const result = await adapter.generateCompletion(prompt);
        
        console.log("✅ Results:");
        console.log("Model:", result.modelName);
        console.log("Token count:", result.tokenCount);
        console.log("Strengths:", result.strengths);
        console.log("Summary:", result.summary);
        
        return "success";
      } catch (error) {
        console.error("❌ Test failed:", error.message);
        return "error: " + error.message;
      }
    }
    
    testAdapter().then(result => {
      console.log("Test completed with result:", result);
      process.exit(result === "success" ? 0 : 1);
    });
    `;
    
    fs.writeFileSync(tempFile, wrapperCode);
    
    console.log("Running adapter test with tsx...");
    exec(`npx tsx ${tempFile}`, (error, stdout, stderr) => {
      console.log(stdout);
      if (stderr) {
        console.error(stderr);
      }
      
      // Clean up the temp file
      fs.unlinkSync(tempFile);
      
      if (error) {
        console.error("Test failed with exit code:", error.code);
        process.exit(1);
      } else {
        console.log("Test completed successfully");
        process.exit(0);
      }
    });
    
  } catch (error) {
    console.error("Error running test:", error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});