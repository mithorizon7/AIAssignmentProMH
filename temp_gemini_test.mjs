/**
 * Test script for the improved Gemini file handler
 * Tests handling of different file types and SDK versions
 */

import pkg from '@google/genai';
const { GoogleGenerativeAI } = pkg;
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Initialize with API key
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Create a simple text file for testing
async function createTextFile() {
  const content = 'This is a test document for Gemini API file handling.';
  const filePath = `/tmp/test-document-${Date.now()}.txt`;
  await fs.writeFile(filePath, content);
  console.log(`Created test file at ${filePath}`);
  return filePath;
}

// Upload file and get file ID
async function uploadFileToGemini(filePath) {
  try {
    console.log(`Uploading file ${filePath} to Gemini Files API...`);
    
    // Try files.upload (newer SDK versions)
    if (genAI.files && typeof genAI.files.upload === 'function') {
      console.log('Using newer SDK version with files.upload method');
      const result = await genAI.files.upload({
        file: filePath,
        config: { mimeType: 'text/plain' }
      });
      
      console.log('Upload result:', result);
      return { fileId: result.fileId || result.uri, method: 'files.upload' };
    } 
    // Try uploadFile directly (some SDK versions)
    else if (typeof genAI.uploadFile === 'function') {
      console.log('Using older SDK version with uploadFile method');
      const result = await genAI.uploadFile(filePath, { mimeType: 'text/plain' });
      
      console.log('Upload result:', result);
      return { fileId: result.uri || result.fileId, method: 'uploadFile' };
    }
    // No supported methods found
    else {
      throw new Error('No compatible file upload method found in Gemini SDK');
    }
  } catch (error) {
    console.error('Failed to upload file:', error.message);
    throw error;
  }
}

// Test the file upload and model usage
async function testFileHandler() {
  let filePath = null;
  
  try {
    // Create a test file
    filePath = await createTextFile();
    
    // Upload the file
    const { fileId, method } = await uploadFileToGemini(filePath);
    
    console.log(`\nSuccessfully uploaded file using '${method}' method`);
    console.log(`File identifier: ${fileId}`);
    
    // Now try to use this file with a model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
    
    // Format the file data for the model
    const filePart = {
      fileData: {
        fileUri: fileId,
        mimeType: 'text/plain'
      }
    };
    
    // Create the prompt
    const prompt = [
      { text: 'Please read this file and summarize its contents in one sentence:' },
      filePart
    ];
    
    console.log('\nSending prompt to Gemini model...');
    
    // Get the response
    const result = await model.generateContent({
      contents: [{ parts: prompt }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    });
    
    const response = await result.response;
    console.log('\nGemini response:');
    console.log(response.text());
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Clean up
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log(`\nCleaned up test file: ${filePath}`);
      } catch (cleanupErr) {
        console.error(`Failed to clean up file: ${cleanupErr.message}`);
      }
    }
  }
}

console.log('Starting Gemini file handler test...');
testFileHandler()
  .then(() => console.log('Test completed'))
  .catch(err => console.error(`Fatal error: ${err.message}`));