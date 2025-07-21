/**
 * Test script for the fixed Gemini file handling implementation
 * This uses CommonJS format to avoid ES module compatibility issues
 */

// Import dependencies
const { GoogleGenerativeAI } = require('@google/genai');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Check for API key
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable not set');
  process.exit(1);
}

// Initialize the Google AI client
console.log('Initializing Google AI with SDK v0.14.0...');
const genAI = new GoogleGenerativeAI(API_KEY);

// Create a temporary file for testing
async function createTempFile(content, extension = '.txt') {
  const tempDir = '/tmp';
  const randomId = crypto.randomBytes(8).toString('hex');
  const filePath = path.join(tempDir, `test-${randomId}${extension}`);
  
  await fs.writeFile(filePath, content);
  console.log(`Created test file at ${filePath}`);
  
  return {
    path: filePath,
    cleanup: async () => {
      try {
        await fs.unlink(filePath);
        console.log(`Cleaned up test file: ${filePath}`);
      } catch (err) {
        console.error(`Failed to clean up file: ${err.message}`);
      }
    }
  };
}

// Function to upload file to Gemini Files API
async function uploadFileToGemini(genAI, filePath, mimeType) {
  console.log(`Uploading ${filePath} with MIME type ${mimeType}`);
  
  try {
    if (genAI.files && typeof genAI.files.upload === 'function') {
      console.log('Using files.upload method (SDK v0.14.0)');
      const result = await genAI.files.upload({
        file: filePath,
        config: { mimeType }
      });
      
      console.log('Upload result:', result);
      return {
        fileUri: result.fileId,
        mimeType
      };
    } else {
      throw new Error('SDK version does not support files.upload');
    }
  } catch (error) {
    console.error(`Upload error: ${error.message}`);
    throw error;
  }
}

// Use the file with Gemini model
async function useFileWithModel(fileData) {
  console.log('Using file with Gemini model...');
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-04-17',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  });
  
  // Create the prompt with file reference
  const result = await model.generateContent({
    contents: [{
      parts: [
        { text: 'Read this file and summarize its contents in one sentence:' },
        { 
          fileData: {
            fileUri: fileData.fileUri,
            mimeType: fileData.mimeType
          }
        }
      ]
    }]
  });
  
  const response = await result.response;
  console.log('\nModel response:');
  console.log(response.text());
}

// Main test function
async function runTest() {
  let tempFile = null;
  
  try {
    // Create test file
    const content = 'This is a test document for Gemini file handling.';
    tempFile = await createTempFile(content);
    
    // Upload to Gemini Files API
    const fileData = await uploadFileToGemini(genAI, tempFile.path, 'text/plain');
    console.log(`Successfully uploaded file: ${fileData.fileUri}`);
    
    // Use with model
    await useFileWithModel(fileData);
    
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
  } finally {
    // Clean up
    if (tempFile) {
      await tempFile.cleanup();
    }
  }
}

// Run the test
console.log('Starting Gemini file handling test...');
runTest()
  .then(() => console.log('Test completed'))
  .catch(err => console.error(`Fatal error: ${err.message}`));