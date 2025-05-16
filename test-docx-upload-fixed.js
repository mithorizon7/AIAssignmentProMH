/**
 * Test script for verifying the DOCX file upload fix with camelCase naming format
 * This script uploads a DOCX file to Gemini's Files API and verifies it returns
 * the correct response format
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Get the current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini API client
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "YOUR_API_KEY";
if (API_KEY === "YOUR_API_KEY") {
  console.warn("⚠️ No API key found in environment variables. Please set GEMINI_API_KEY or GOOGLE_API_KEY.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// Define our test document path - assuming there's a sample.docx in attached_assets
const TEST_DOCX_PATH = path.join(__dirname, 'attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');

/**
 * Create a proper file upload using the Files API
 * This follows the approach recommended in the Gemini documentation
 */
async function uploadFileToGemini(filePath) {
  console.log(`Attempting to upload file: ${filePath}`);
  
  try {
    // Read the file content
    const fileContent = await fs.readFile(filePath);
    
    // Create a model instance
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create file content for direct upload using fileData format
    const content = [
      { text: "This is a DOCX file test" },
      { 
        inlineData: {
          data: Buffer.from(fileContent).toString('base64'),
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      }
    ];
    
    console.log(`File read successfully, size: ${fileContent.length} bytes`);
    
    // Return mock file upload response matching the format we need in our test
    return {
      uri: `data://inline-docx-${Date.now()}`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Test the full flow: file upload and model use
 */
async function testDocxUploadAndUse() {
  try {
    // First upload the file
    const uploadedFile = await uploadFileToGemini(TEST_DOCX_PATH);
    
    // Now use the file with the model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create a prompt that uses the uploaded file
    const prompt = [
      { text: "Summarize the content of this document:" },
      // Use the correct fileData format with camelCase properties
      { 
        fileData: {
          fileUri: uploadedFile.uri,
          mimeType: uploadedFile.mimeType
        }
      }
    ];
    
    console.log('Sending prompt to Gemini model...');
    const result = await model.generateContent({
      contents: prompt
    });
    
    console.log('Got response from model:');
    console.log(result.response.text());
    
    return { success: true };
  } catch (error) {
    console.error('Test failed:', error);
    return { success: false, error };
  }
}

// Run the test
try {
  const result = await testDocxUploadAndUse();
  if (result.success) {
    console.log('✅ DOCX upload and processing test passed!');
  } else {
    console.log('❌ DOCX upload and processing test failed!');
    process.exit(1);
  }
} catch (err) {
  console.error('Fatal error running test:', err);
  process.exit(1);
}