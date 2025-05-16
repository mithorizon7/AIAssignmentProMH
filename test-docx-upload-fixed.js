/**
 * Test script for verifying the DOCX file upload fix with camelCase naming format
 * This script uploads a DOCX file to Gemini's Files API and verifies it returns
 * the correct response format
 */

const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API client
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// Define our test document path - assuming there's a sample.docx in attached_assets
const TEST_DOCX_PATH = path.join('attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');

/**
 * Create a proper file upload using the Files API
 * This follows the approach recommended in the Gemini documentation
 */
async function uploadFileToGemini(filePath) {
  console.log(`Attempting to upload file: ${filePath}`);
  
  try {
    // Upload the file to Gemini's Files API
    const fileUpload = await genAI.files.upload({
      file: filePath,
      config: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    });
    
    console.log(`File uploaded successfully!`);
    console.log(`File URI: ${fileUpload.uri}`);
    console.log(`Full file data:`, fileUpload);
    
    return fileUpload;
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
testDocxUploadAndUse()
  .then(result => {
    if (result.success) {
      console.log('✅ DOCX upload and processing test passed!');
    } else {
      console.log('❌ DOCX upload and processing test failed!');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error running test:', err);
    process.exit(1);
  });