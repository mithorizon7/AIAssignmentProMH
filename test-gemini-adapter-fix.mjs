/**
 * Test script for the improved Gemini file handler
 * Using ES module syntax for compatibility
 */

import pkg from '@google/genai';
const { GoogleGenerativeAI } = pkg;
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// Try the file upload method
async function testFileUpload() {
  let tempFile = null;
  
  try {
    // Create test file
    const content = 'This is a test document for Gemini file handling.';
    tempFile = await createTempFile(content);
    console.log(`Test file created at: ${tempFile.path}`);
    
    console.log('Testing file upload with Gemini SDK v0.14.0...');
    
    // Check which methods are available
    console.log('Available file methods:', 
      genAI.files ? 'files object exists' : 'no files object',
      genAI.files?.upload ? 'upload method exists' : 'no upload method'
    );
    
    // Try upload
    if (genAI.files && typeof genAI.files.upload === 'function') {
      console.log('Using files.upload method...');
      const result = await genAI.files.upload({
        file: tempFile.path,
        config: { mimeType: 'text/plain' }
      });
      
      console.log('Upload result:', result);
      
      // Test with model
      if (result && (result.fileId || result.uri)) {
        const fileUri = result.fileId || result.uri;
        console.log(`\nTesting file usage with Gemini model (fileUri: ${fileUri})...`);
        
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash-preview-04-17'
        });
        
        const response = await model.generateContent({
          contents: [{
            parts: [
              { text: 'Please read this file and summarize its contents:' },
              { 
                fileData: {
                  fileUri: fileUri,
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
        
        console.log('\nModel response:');
        console.log(response.response.text());
        console.log('\nSuccess! File upload and usage working correctly.');
      }
    } else {
      console.log('files.upload method not available in this SDK version');
    }
    
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    // Clean up
    if (tempFile) {
      await tempFile.cleanup();
    }
  }
}

// Run tests
console.log('Starting Gemini file handling tests...');
testFileUpload()
  .then(() => console.log('Tests completed'))
  .catch(err => console.error(`Fatal error: ${err.message}`));