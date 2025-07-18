/**
 * Direct test for the Gemini adapter with fixed file handling
 * 
 * This script verifies:
 * 1. SDK connection and initialization
 * 2. File upload capabilities
 * 3. Document processing ability
 */

const { GoogleGenerativeAI } = require('@google/genai');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Check if API key is available
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is not set');
  process.exit(1);
}

// Initialize the SDK
const genAI = new GoogleGenerativeAI(API_KEY);

// Create a temp file for testing
async function createTempFile(content, extension = '.txt') {
  const tempDir = '/tmp';
  const randomId = crypto.randomBytes(8).toString('hex');
  const tempFilePath = path.join(tempDir, `gemini-test-${randomId}${extension}`);
  
  await fs.writeFile(tempFilePath, content);
  console.log(`Created temporary file: ${tempFilePath}`);
  
  return {
    path: tempFilePath,
    cleanup: async () => {
      try {
        await fs.unlink(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (err) {
        console.error(`Failed to clean up file ${tempFilePath}: ${err.message}`);
      }
    }
  };
}

// Detect SDK capabilities
function detectSDKCapabilities() {
  console.log('Detecting Google Gemini SDK capabilities...');
  
  // Check for file upload methods
  const hasFilesUpload = genAI.files && typeof genAI.files.upload === 'function';
  const hasUploadFile = typeof genAI.uploadFile === 'function';
  
  console.log(`- files.upload method available: ${hasFilesUpload}`);
  console.log(`- uploadFile method available: ${hasUploadFile}`);
  
  return {
    hasFilesUpload,
    hasUploadFile,
    hasSomeUploadMethod: hasFilesUpload || hasUploadFile
  };
}

// Upload using files.upload method
async function uploadUsingFilesUpload(filePath, mimeType) {
  console.log(`Uploading file using files.upload method...`);
  
  try {
    const result = await genAI.files.upload({
      file: filePath,
      config: { mimeType }
    });
    
    console.log(`Result:`, result);
    return result.fileId || result.uri || result.name;
  } catch (error) {
    console.error(`Error uploading via files.upload: ${error.message}`);
    throw error;
  }
}

// Upload using uploadFile method
async function uploadUsingUploadFile(filePath, mimeType) {
  console.log(`Uploading file using uploadFile method...`);
  
  try {
    const result = await genAI.uploadFile(filePath, { mimeType });
    
    console.log(`Result:`, result);
    return result.uri || result.fileId || result.name;
  } catch (error) {
    console.error(`Error uploading via uploadFile: ${error.message}`);
    throw error;
  }
}

// Run the test
async function runTest() {
  let tempFile = null;
  
  try {
    // Detect SDK capabilities
    const capabilities = detectSDKCapabilities();
    
    if (!capabilities.hasSomeUploadMethod) {
      console.error('Error: This version of the Google Gemini SDK does not support file uploads');
      return;
    }
    
    // Create a test file
    const content = 'This is a test document for Gemini file handling tests.';
    tempFile = await createTempFile(content, '.txt');
    
    // Upload the file using the first available method
    let fileId = null;
    
    if (capabilities.hasFilesUpload) {
      fileId = await uploadUsingFilesUpload(tempFile.path, 'text/plain');
    } else if (capabilities.hasUploadFile) {
      fileId = await uploadUsingUploadFile(tempFile.path, 'text/plain');
    }
    
    if (!fileId) {
      throw new Error('Failed to get a valid file ID after upload');
    }
    
    console.log(`\nSuccessfully uploaded file. File ID: ${fileId}`);
    
    // Test using the file with the model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
    
    console.log('\nSending prompt to Gemini model...');
    
    const result = await model.generateContent({
      contents: [{
        parts: [
          { text: 'Please read this file and summarize its contents in one sentence:' },
          { 
            fileData: {
              fileUri: fileId,
              mimeType: 'text/plain'
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800
      }
    });
    
    const response = await result.response;
    console.log('\nGemini response:');
    console.log(response.text());
    
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
console.log('Starting test of Gemini file handling...');
runTest()
  .then(() => console.log('\nTest completed'))
  .catch(err => console.error(`Fatal error: ${err.message}`));