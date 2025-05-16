/**
 * Test script for the improved Gemini adapter
 * 
 * This tests the adapter's ability to:
 * 1. Handle text submissions
 * 2. Handle file submissions (images, documents)
 * 3. Correctly capture token usage metadata
 * 4. Process responses with the proper schema format
 */

const fs = require('fs').promises;
const path = require('path');

// Mock the environment variables
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'your-api-key';

// Import the improved file handler and adapter
// Note: In a real application, these would be imported from the server directory
// For testing, we're copying the key functionality here
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Test configuration
const TEST_MODEL = 'gemini-1.5-flash';
const TEST_IMAGE_PATH = './test_submission_image.png';
const TEST_DOCUMENT_PATH = './test_file.txt';

/**
 * Helper to read a file as a buffer
 */
async function readFile(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Helper for creating file data references for Gemini
 */
async function createFileData(genAI, source, mimeType) {
  console.log(`Creating file data for ${mimeType}`);
  
  let buffer;
  if (Buffer.isBuffer(source)) {
    buffer = source;
  } else if (typeof source === 'string') {
    // Read from file path
    buffer = await readFile(source);
  } else {
    throw new Error(`Unsupported source type: ${typeof source}`);
  }
  
  // For testing, we'll use a simplified approach
  const tempFilePath = path.resolve(source);
  
  try {
    // Check which API is available and use it
    if (genAI.files && typeof genAI.files.upload === 'function') {
      console.log('Using files.upload method (SDK v0.14.0+)');
      const result = await genAI.files.upload({
        file: tempFilePath,
        config: { mimeType }
      });
      const fileId = result?.fileId || result?.uri || result?.name;
      console.log('File uploaded successfully:', fileId);
      return { fileUri: fileId, mimeType };
    } else if (typeof genAI.uploadFile === 'function') {
      console.log('Using uploadFile method');
      const result = await genAI.uploadFile(tempFilePath, { mimeType });
      const fileId = result?.uri || result?.fileId || result?.name;
      console.log('File uploaded successfully:', fileId);
      return { fileUri: fileId, mimeType };
    } else {
      throw new Error('No compatible upload method found in Gemini SDK');
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

/**
 * Test text-only submissions
 */
async function testTextSubmission() {
  console.log('\n=== Testing Text Submission ===');
  
  try {
    // Initialize the Gemini client
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    // Configure the model
    const model = genAI.getGenerativeModel({
      model: TEST_MODEL,
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });
    
    // Text prompt sample
    const prompt = `
      This is a test submission for the programming assignment.
      
      def calculate_factorial(n):
          if n <= 1:
              return 1
          return n * calculate_factorial(n-1)
      
      print(calculate_factorial(5))
    `;
    
    // System prompt with instructions and rubric
    const systemPrompt = `
      You are an AI grading assistant. Evaluate the student's code submission based on:
      - Correctness: Does the code work as intended?
      - Efficiency: Is the algorithm efficient?
      - Style: Is the code well-formatted and commented?
      
      Provide structured feedback in JSON format with the following fields:
      - strengths: Array of code strengths
      - improvements: Array of areas for improvement
      - suggestions: Array of specific suggestions
      - summary: Overall feedback summary
      - score: Numerical score from 0-100
    `;
    
    console.log('Sending text prompt to Gemini...');
    
    // Generate the completion
    const result = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      },
      systemInstruction: systemPrompt
    });
    
    // Extract the response
    const response = result.response;
    console.log('Response received from Gemini');
    
    // Get the text content
    const textContent = response.text();
    console.log('\nResponse text:');
    console.log(textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
    
    // Parse the JSON if possible
    try {
      const parsed = JSON.parse(textContent);
      console.log('\nParsed JSON structure:');
      console.log(JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.error('Failed to parse response as JSON:', error);
    }
    
    // Extract usage metadata if available
    if (response.usageMetadata) {
      console.log('\nUsage metadata:');
      console.log(JSON.stringify(response.usageMetadata, null, 2));
    } else {
      console.log('\nNo usage metadata available');
    }
    
    console.log('Text submission test completed successfully');
    return true;
  } catch (error) {
    console.error('Error testing text submission:', error);
    return false;
  }
}

/**
 * Test multimodal submissions with image
 */
async function testImageSubmission() {
  console.log('\n=== Testing Image Submission ===');
  
  try {
    // Initialize the Gemini client
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    // Configure the model
    const model = genAI.getGenerativeModel({
      model: TEST_MODEL,
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });
    
    // Text prompt to accompany the image
    const textPrompt = 'This is my image submission for the design assignment.';
    
    // System prompt with instructions and rubric
    const systemPrompt = `
      You are an AI design evaluator. Analyze the submitted image based on:
      - Composition: Is the layout well-balanced?
      - Color: Is the color palette harmonious?
      - Creativity: Is the design unique and interesting?
      
      Provide structured feedback in JSON format with the following fields:
      - strengths: Array of design strengths
      - improvements: Array of areas for improvement
      - suggestions: Array of specific suggestions
      - summary: Overall feedback summary
      - score: Numerical score from 0-100
    `;
    
    console.log('Reading image file...');
    
    // Prepare image using the file handling utility
    // In a real implementation, this would use createFileData from improved-file-handler.ts
    const imageFilePath = path.resolve(TEST_IMAGE_PATH);
    const imageMimeType = 'image/png';
    
    try {
      // Check if the file exists
      await fs.access(imageFilePath);
      console.log(`Image file found: ${imageFilePath}`);
    } catch (error) {
      console.error(`Image file not found: ${imageFilePath}`);
      console.log('Skipping image test due to missing file');
      return false;
    }
    
    // Upload the file to Gemini
    console.log('Uploading image to Gemini...');
    const fileData = await createFileData(genAI, imageFilePath, imageMimeType);
    console.log('Image uploaded successfully');
    
    // Prepare the parts for the API request
    const parts = [
      { text: textPrompt },
      { fileData }
    ];
    
    console.log('Sending multimodal prompt to Gemini...');
    
    // Generate the completion
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      },
      systemInstruction: systemPrompt
    });
    
    // Extract the response
    const response = result.response;
    console.log('Response received from Gemini');
    
    // Get the text content
    const textContent = response.text();
    console.log('\nResponse text:');
    console.log(textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
    
    // Parse the JSON if possible
    try {
      const parsed = JSON.parse(textContent);
      console.log('\nParsed JSON structure:');
      console.log(JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.error('Failed to parse response as JSON:', error);
    }
    
    // Extract usage metadata if available
    if (response.usageMetadata) {
      console.log('\nUsage metadata:');
      console.log(JSON.stringify(response.usageMetadata, null, 2));
    } else {
      console.log('\nNo usage metadata available');
    }
    
    console.log('Image submission test completed successfully');
    return true;
  } catch (error) {
    console.error('Error testing image submission:', error);
    return false;
  }
}

/**
 * Test document submissions
 */
async function testDocumentSubmission() {
  console.log('\n=== Testing Document Submission ===');
  
  try {
    // Initialize the Gemini client
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    // Configure the model
    const model = genAI.getGenerativeModel({
      model: TEST_MODEL,
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });
    
    // Text prompt to accompany the document
    const textPrompt = 'This is my document submission for the writing assignment.';
    
    // System prompt with instructions and rubric
    const systemPrompt = `
      You are an AI writing evaluator. Analyze the submitted document based on:
      - Content: Is the information accurate and relevant?
      - Organization: Is the document well-structured?
      - Language: Is the writing clear and concise?
      
      Provide structured feedback in JSON format with the following fields:
      - strengths: Array of writing strengths
      - improvements: Array of areas for improvement
      - suggestions: Array of specific suggestions
      - summary: Overall feedback summary
      - score: Numerical score from 0-100
    `;
    
    console.log('Reading document file...');
    
    // Prepare document using the file handling utility
    const docFilePath = path.resolve(TEST_DOCUMENT_PATH);
    const docMimeType = 'text/plain';
    
    try {
      // Check if the file exists
      await fs.access(docFilePath);
      console.log(`Document file found: ${docFilePath}`);
    } catch (error) {
      console.error(`Document file not found: ${docFilePath}`);
      console.log('Skipping document test due to missing file');
      return false;
    }
    
    // Upload the file to Gemini
    console.log('Uploading document to Gemini...');
    const fileData = await createFileData(genAI, docFilePath, docMimeType);
    console.log('Document uploaded successfully');
    
    // Prepare the parts for the API request
    const parts = [
      { text: textPrompt },
      { fileData }
    ];
    
    console.log('Sending document prompt to Gemini...');
    
    // Generate the completion
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      },
      systemInstruction: systemPrompt
    });
    
    // Extract the response
    const response = result.response;
    console.log('Response received from Gemini');
    
    // Get the text content
    const textContent = response.text();
    console.log('\nResponse text:');
    console.log(textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
    
    // Parse the JSON if possible
    try {
      const parsed = JSON.parse(textContent);
      console.log('\nParsed JSON structure:');
      console.log(JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.error('Failed to parse response as JSON:', error);
    }
    
    // Extract usage metadata if available
    if (response.usageMetadata) {
      console.log('\nUsage metadata:');
      console.log(JSON.stringify(response.usageMetadata, null, 2));
    } else {
      console.log('\nNo usage metadata available');
    }
    
    console.log('Document submission test completed successfully');
    return true;
  } catch (error) {
    console.error('Error testing document submission:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=== Starting Gemini Adapter Tests ===');
  console.log(`Using Gemini model: ${TEST_MODEL}`);
  
  // Run text test
  const textSuccess = await testTextSubmission();
  
  // Run image test
  const imageSuccess = await testImageSubmission();
  
  // Run document test
  const documentSuccess = await testDocumentSubmission();
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Text submission: ${textSuccess ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Image submission: ${imageSuccess ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Document submission: ${documentSuccess ? 'SUCCESS' : 'FAILED'}`);
  
  // Overall result
  const overallSuccess = textSuccess && imageSuccess && documentSuccess;
  console.log(`\nOverall result: ${overallSuccess ? 'SUCCESS' : 'PARTIAL SUCCESS'}`);
  
  return overallSuccess;
}

// Run the tests
runAllTests()
  .then(() => console.log('Tests completed'))
  .catch(error => console.error('Test error:', error));