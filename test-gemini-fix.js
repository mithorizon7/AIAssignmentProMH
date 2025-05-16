/**
 * Test script for verifying the Gemini adapter file handling fix
 * 
 * This script focuses specifically on the file upload process
 * using the updated createFileData function with proper
 * genAI parameter handling
 */

import pkg from '@google/genai';
const { GoogleGenerativeAI } = pkg;
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Check API key
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is not set');
  process.exit(1);
}

// Initialize Gemini AI client
console.log('Initializing Google Gemini AI with SDK v0.14.0...');
const genAI = new GoogleGenerativeAI(API_KEY);

// Create test file
async function createTestFile(content, extension = '.txt') {
  const tempDir = '/tmp';
  const randomId = crypto.randomBytes(8).toString('hex');
  const filePath = path.join(tempDir, `test-${randomId}${extension}`);
  
  await fs.writeFile(filePath, content);
  console.log(`Created test file: ${filePath}`);
  
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

// Simplified version of our createFileData function
async function createFileData(genAI, content, mimeType) {
  console.log(`[TEST] Creating file data with MIME type: ${mimeType}`);
  
  // Create a temporary file
  const testFile = await createTestFile(content, 
    mimeType.includes('text') ? '.txt' : 
    mimeType.includes('docx') ? '.docx' : '.bin');
  
  try {
    console.log('Uploading file to Gemini Files API...');
    
    // Attempt upload using the files.upload method (SDK v0.14.0+)
    if (genAI.files && typeof genAI.files.upload === 'function') {
      console.log('Using files.upload method (SDK v0.14.0+)');
      const result = await genAI.files.upload({
        file: testFile.path,
        config: { mimeType }
      });
      
      console.log('Upload result:', result);
      
      // Return in the format our adapter expects
      return { 
        fileUri: result.fileId || result.uri || result.name, 
        mimeType 
      };
    }
    
    // Fallback for older SDK versions
    if (typeof genAI.uploadFile === 'function') {
      console.log('Using uploadFile method (older SDK)');
      const result = await genAI.uploadFile(testFile.path, { mimeType });
      
      console.log('Upload result:', result);
      
      // Return in the format our adapter expects
      return { 
        fileUri: result.uri || result.fileId || result.name, 
        mimeType 
      };
    }
    
    throw new Error('No compatible file upload method found in Gemini SDK');
  } catch (error) {
    console.error(`[TEST] Error uploading file: ${error.message}`);
    throw error;
  } finally {
    // Clean up the test file
    await testFile.cleanup();
  }
}

// Test with different file types
async function runTests() {
  console.log('Starting file handling tests with Gemini SDK v0.14.0...');
  
  try {
    // Test 1: Plain text
    console.log('\n\nTEST 1: Plain text file');
    const textContent = 'This is a test document for Gemini file handling.';
    const textFileData = await createFileData(genAI, textContent, 'text/plain');
    console.log(`✅ TEXT SUCCESS: Created file with URI: ${textFileData.fileUri}`);
    
    // Test 2: Using with model
    console.log('\n\nTEST 2: Using text file with model');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
    
    const result = await model.generateContent({
      contents: [{
        parts: [
          { text: 'Please read this file and summarize its contents in one sentence:' },
          { 
            fileData: {
              fileUri: textFileData.fileUri,
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
    console.log('Model response:');
    console.log(response.text());
    console.log('✅ MODEL SUCCESS: Successfully used file with model');
    
    console.log('\n\nAll tests completed successfully.');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the tests
runTests()
  .then(() => console.log('Tests completed'))
  .catch(err => console.error(`Fatal error: ${err.message}`));