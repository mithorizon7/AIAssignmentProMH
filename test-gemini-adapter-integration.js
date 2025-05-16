/**
 * Test script to diagnose issues with Gemini adapter integration
 * This helps troubleshoot file handling problems with document uploads 
 */

// Import the required Gemini SDK
import { GoogleGenerativeAI } from '@google/genai';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Initialize Google Generative AI with API key
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function createTempFile(content, fileExtension = '.txt') {
  const tempDir = '/tmp';
  const randomId = crypto.randomBytes(8).toString('hex');
  const tempFilePath = path.join(tempDir, `gemini-test-${randomId}${fileExtension}`);
  
  // Write the content to the file
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

// Test handling different file types
async function testFileUpload() {
  console.log('Testing Gemini file upload capabilities...');
  
  try {
    // Create a simple text document
    const textContent = 'This is a test document for Gemini file handling tests.';
    const { path: tempFilePath, cleanup } = await createTempFile(textContent, '.txt');
    
    // Print SDK information
    console.log(`Using @google/genai SDK`);
    console.log(`SDK Version structure check:`);
    console.log(`- Has 'files' property: ${!!genAI.files}`);
    console.log(`- Has 'files.upload' method: ${!!(genAI.files && genAI.files.upload)}`);
    console.log(`- Has 'uploadFile' method: ${!!genAI.uploadFile}`);
    
    // Try to upload the file using different methods
    let fileId = null;
    let uploadMethod = '';
    
    // Method 1: Try genAI.files.upload (SDK v0.14.0+)
    if (genAI.files && typeof genAI.files.upload === 'function') {
      try {
        console.log('\nAttempting upload with genAI.files.upload...');
        const result = await genAI.files.upload({
          file: tempFilePath,
          config: { mimeType: 'text/plain' }
        });
        
        console.log('Upload result:', JSON.stringify(result, null, 2));
        fileId = result?.fileId || result?.uri || result?.name;
        uploadMethod = 'files.upload';
      } catch (err) {
        console.error(`files.upload method failed: ${err.message}`);
      }
    }
    
    // Method 2: Try genAI.uploadFile (older SDKs)
    if (!fileId && typeof genAI.uploadFile === 'function') {
      try {
        console.log('\nAttempting upload with genAI.uploadFile...');
        const result = await genAI.uploadFile(tempFilePath, { mimeType: 'text/plain' });
        
        console.log('Upload result:', JSON.stringify(result, null, 2));
        fileId = result?.uri || result?.fileId || result?.name;
        uploadMethod = 'uploadFile';
      } catch (err) {
        console.error(`uploadFile method failed: ${err.message}`);
      }
    }
    
    // Report results
    if (fileId) {
      console.log(`\nFile successfully uploaded using '${uploadMethod}' method`);
      console.log(`File ID: ${fileId}`);
      
      // Try using the file with a model
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
        console.log('\nTesting file use with Gemini model...');
        
        // Format file data based on SDK version
        const fileData = {
          fileUri: fileId,
          mimeType: 'text/plain'
        };
        
        const prompt = [
          { text: 'Read this file and summarize its contents in one sentence:' },
          { fileData }
        ];
        
        console.log('Sending prompt with file reference:', JSON.stringify(prompt, null, 2));
        const result = await model.generateContent({ contents: [{ parts: prompt }] });
        const response = await result.response;
        console.log('\nGemini response:');
        console.log(response.text());
      } catch (err) {
        console.error(`Error using file in model: ${err.message}`);
      }
    } else {
      console.error('Failed to upload file using any available method');
    }
    
    // Clean up
    await cleanup();
    
  } catch (err) {
    console.error(`Test failed: ${err.message}`);
  }
}

// Run the test
testFileUpload()
  .then(() => console.log('Test completed'))
  .catch(err => console.error(`Fatal error: ${err.message}`));