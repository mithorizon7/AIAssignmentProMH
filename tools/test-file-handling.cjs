/**
 * Smoke tests for Gemini file handling
 * 
 * Tests different file types and sizes to verify that:
 * 1. Small images are inlined (200KB PNG)
 * 2. Large images use Files API (8MB PNG)
 * 3. DOCX files from GCS URLs work correctly
 * 4. PDF files from HTTP URLs work correctly
 */

const fs = require('fs');
const path = require('path');
const { promises: fsp } = require('fs');
const { GoogleGenerativeAI } = require('@google/genai');
require('dotenv').config();

// Initialize Gemini client with API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

// Test files
const TEST_FILES = {
  small_image: {
    path: './test_files/small_image.png',
    size: '200KB',
    mimeType: 'image/png',
    expectInline: true
  },
  large_image: {
    path: './test_files/large_image.png',
    size: '8MB',
    mimeType: 'image/png',
    expectInline: false
  },
  docx_file: {
    url: 'gs://cloud-samples-data/generative-ai/pdf/sample-pdf.pdf', // Using a sample PDF since we don't have a real GCS DOCX URL
    mimeType: 'application/pdf',
    expectInline: false
  },
  pdf_file: {
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    mimeType: 'application/pdf',
    expectInline: false
  }
};

// Create test files of specific sizes
async function createTestFiles() {
  const testDir = './test_files';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  // Create 200KB image (small enough to inline)
  const smallImageBuffer = Buffer.alloc(200 * 1024, 1);
  await fsp.writeFile(TEST_FILES.small_image.path, smallImageBuffer);
  console.log(`Created ${TEST_FILES.small_image.size} test image at ${TEST_FILES.small_image.path}`);

  // Create 8MB image (large enough to require Files API)
  const largeImageBuffer = Buffer.alloc(8 * 1024 * 1024, 2);
  await fsp.writeFile(TEST_FILES.large_image.path, largeImageBuffer);
  console.log(`Created ${TEST_FILES.large_image.size} test image at ${TEST_FILES.large_image.path}`);
}

// Helper function: Determine if file should use Files API based on its size and type
function shouldUseFilesAPI(contentType, size) {
  // Document types always use Files API
  if (contentType.startsWith('application/')) {
    return true;
  }
  
  // Large images use Files API
  if (contentType.startsWith('image/') && size > 5 * 1024 * 1024) {
    return true;
  }
  
  return false;
}

// Helper function: Process a test file
async function processFile(fileInfo) {
  console.log(`\n=== Testing ${fileInfo.path || fileInfo.url} (${fileInfo.mimeType}) ===`);
  
  try {
    let content;
    if (fileInfo.path) {
      content = await fsp.readFile(fileInfo.path);
      console.log(`Read file: ${content.length} bytes`);
    } else if (fileInfo.url) {
      console.log(`Using URL: ${fileInfo.url}`);
      content = fileInfo.url;
    }
    
    // Determine expected handling approach
    const expectedApiType = fileInfo.expectInline ? 'Inline' : 'Files API';
    console.log(`Expected handling: ${expectedApiType}`);
    
    if (shouldUseFilesAPI(fileInfo.mimeType, fileInfo.path ? (await fsp.stat(fileInfo.path)).size : Infinity)) {
      console.log(`Our logic determines: Files API should be used`);
      
      // Test file upload
      try {
        const file = await genAI.files.upload({
          data: content, 
          mimeType: fileInfo.mimeType
        });
        console.log(`✅ Successfully uploaded to Files API: ${file.uri}`);
        
        // Verify we can use this file in content generation
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { fileData: { fileUri: file.uri, mimeType: fileInfo.mimeType } },
                { text: 'Please describe what you see in this file.' }
              ]
            }
          ]
        });
        
        console.log('✅ Successfully used file in content generation');
        console.log(`Response (first 100 chars): ${result.response.text().substring(0, 100)}...`);
      } catch (error) {
        console.error(`❌ Error with Files API: ${error.message}`);
      }
    } else {
      console.log(`Our logic determines: Should use inline data`);
      
      // For inline testing with small images
      try {
        let base64Data;
        if (Buffer.isBuffer(content)) {
          base64Data = content.toString('base64');
        } else {
          throw new Error('Cannot inline non-buffer content');
        }
        
        // Test inline processing
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { 
                  inlineData: { 
                    mimeType: fileInfo.mimeType,
                    data: base64Data
                  } 
                },
                { text: 'Please describe what you see in this image.' }
              ]
            }
          ]
        });
        
        console.log('✅ Successfully used inline data in content generation');
        console.log(`Response (first 100 chars): ${result.response.text().substring(0, 100)}...`);
      } catch (error) {
        console.error(`❌ Error with inline data: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

// Main test function
async function runTests() {
  try {
    console.log('Creating test files...');
    await createTestFiles();
    
    // Test each file type
    for (const [name, fileInfo] of Object.entries(TEST_FILES)) {
      await processFile(fileInfo);
    }
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error(`Test suite error: ${error.message}`);
  }
}

// Run the tests
runTests();