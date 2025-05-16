/**
 * Test script to verify document handling improvements in the Gemini adapter
 * Specifically tests DOCX file processing and usageMetadata capture
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });

// Import our helper functions - these are mock implementations
// In a real test, we'd use the actual functions from the adapter
import { createFileData, toSDKFormat } from './server/utils/gemini-file-handler.js';

// Test DOCX file path - we'll use a sample document if available
const TEST_DOCX_PATH = path.join(__dirname, 'attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Helper to read a file as a buffer
 */
async function readFile(filePath) {
  try {
    return fs.promises.readFile(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Test the document file upload and processing
 */
async function testDocumentHandling() {
  console.log('=== DOCUMENT HANDLING TEST ===');
  console.log(`Testing file: ${TEST_DOCX_PATH}`);
  
  try {
    // Check if test file exists
    if (!fs.existsSync(TEST_DOCX_PATH)) {
      console.error(`Test file not found: ${TEST_DOCX_PATH}`);
      return false;
    }
    
    // Read the test file
    const fileBuffer = await readFile(TEST_DOCX_PATH);
    console.log(`Successfully read file (${fileBuffer.length} bytes)`);
    
    // Test file data creation
    console.log('Creating file data with genAI instance as first parameter...');
    const fileData = await createFileData(genAI, fileBuffer, DOCX_MIME_TYPE);
    
    console.log('File data created successfully:', fileData);
    
    // Convert to SDK format
    const apiFileData = toSDKFormat(fileData);
    console.log('Converted to SDK format:', apiFileData);
    
    // Test simple model call with the file
    console.log('Making API call with document...');
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: apiFileData },
            { text: 'Summarize this document in 3 bullet points' }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    });
    
    // Check the response
    const response = await result.response;
    console.log('API call successful!');
    
    // Check for usageMetadata
    if (response.usageMetadata) {
      console.log('✅ Usage metadata captured successfully');
      console.log('Prompt tokens:', response.usageMetadata.promptTokenCount);
      console.log('Candidate tokens:', response.usageMetadata.candidatesTokenCount);
      console.log('Total tokens:', response.usageMetadata.totalTokenCount);
    } else {
      console.warn('⚠️ No usage metadata in response');
    }
    
    // Check response text
    const responseText = response.text();
    console.log('Response:', responseText);
    
    return true;
  } catch (error) {
    console.error('Document handling test failed:', error);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('Starting document handling tests...');
  
  // Verify API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is required for testing');
    return;
  }
  
  // Run document handling test
  const docHandlingResult = await testDocumentHandling();
  
  // Print summary
  console.log('\n=== TEST RESULTS ===');
  console.log(`Document handling: ${docHandlingResult ? '✅ PASS' : '❌ FAIL'}`);
}

// Run the tests
runTests().catch(console.error);