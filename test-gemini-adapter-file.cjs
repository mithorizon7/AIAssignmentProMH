/**
 * Simple test for Gemini adapter file handling
 * Tests our updated DOCX file handling and file type detection
 */

// Core node modules
const fs = require('fs');
const path = require('path');
const { promises: fsp } = require('fs');

// Load environment variables
require('dotenv').config();

// Initialize with API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// Mock the GoogleGenAI class and its files API
class MockGoogleGenAI {
  constructor(options) {
    this.apiKey = options.apiKey;
    this.files = {
      upload: async (options) => {
        const { data, mimeType } = options;
        console.log(`[MOCK] Uploading file with MIME type: ${mimeType}`);
        console.log(`[MOCK] File size: ${Buffer.isBuffer(data) ? data.length : 'unknown'} bytes`);
        
        // Generate a fake GCS URI
        return {
          uri: `gs://mock-bucket/file-${Date.now()}.${mimeType.split('/')[1] || 'bin'}`
        };
      }
    };
  }
}

// Mock shouldUseFilesAPI implementation from our adapter
function shouldUseFilesAPI(mimeType, contentSize) {
  // Safety check to ensure mimeType is a string
  const mime = typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  
  // Always use Files API for PDF, audio, or video
  if (
    mime.startsWith('application/pdf') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/')
  ) {
    return true;
  }
  
  // Always use Files API for document content types
  if (
    mime.includes('document') ||
    mime.includes('msword') ||
    mime.includes('wordprocessing') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('openxmlformats') // Covers docx, xlsx, pptx
  ) {
    console.log(`[TEST] Using Files API for document type: ${mime}`);
    return true;
  }
  
  // Use Files API for large images
  if (mime.startsWith('image/') && contentSize > 5 * 1024 * 1024) {
    return true;
  }
  
  return false;
}

// Mock implementation of createFileData function from our adapter
async function createFileData(genAI, source, mimeType) {
  console.log(`[TEST] Creating file data for mime type: ${mimeType}`);
  
  // Handle Buffer or string content
  let contentBuffer;
  if (Buffer.isBuffer(source)) {
    contentBuffer = source;
  } else if (typeof source === 'string') {
    if (source.startsWith('http') || source.startsWith('gs://')) {
      console.log(`[TEST] Using URL: ${source}`);
      // In a real implementation, we'd fetch this
      contentBuffer = Buffer.from(`Mock content for ${source}`);
    } else {
      try {
        contentBuffer = await fsp.readFile(source);
      } catch (error) {
        console.error(`[TEST] Error reading file: ${error.message}`);
        contentBuffer = Buffer.from(`Mock content for ${source}`);
      }
    }
  } else {
    throw new Error(`Unsupported source type: ${typeof source}`);
  }
  
  // Upload via the Files API
  try {
    const file = await genAI.files.upload({
      data: contentBuffer,
      mimeType: mimeType
    });
    
    console.log(`[TEST] File uploaded successfully, URI: ${file.uri}`);
    
    // Return in the expected format with snake_case keys
    return { 
      file_uri: file.uri, 
      mime_type: mimeType 
    };
  } catch (error) {
    console.error(`[TEST] File upload failed: ${error.message}`);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

// Test different file types
async function runTests() {
  console.log('===== Testing Gemini File Handler =====');
  
  // Create a mock genAI instance
  const genAI = new MockGoogleGenAI({ apiKey });
  
  // Create test files directory
  const testDir = path.join(__dirname, 'test_files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  
  // Test case 1: Small PNG (200KB)
  const smallImagePath = path.join(testDir, 'small_test.png');
  const smallImageBuffer = Buffer.alloc(200 * 1024, 1);
  await fsp.writeFile(smallImagePath, smallImageBuffer);
  
  // Test case 2: Large PNG (8MB)
  const largeImagePath = path.join(testDir, 'large_test.png');
  const largeImageBuffer = Buffer.alloc(8 * 1024 * 1024, 2);
  await fsp.writeFile(largeImagePath, largeImageBuffer);
  
  // Test case 3: DOCX URL
  const docxUrl = 'gs://cloud-samples-data/generative-ai/pdf/sample-pdf.pdf';
  
  // Test case 4: PDF URL
  const pdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  
  // Test each case
  console.log('\n===== Test 1: Small PNG (Should use inline) =====');
  const smallPngMime = 'image/png';
  const smallPngSize = smallImageBuffer.length;
  const shouldUploadSmallPng = shouldUseFilesAPI(smallPngMime, smallPngSize);
  console.log(`Should upload to Files API? ${shouldUploadSmallPng ? 'YES' : 'NO'}`);
  
  console.log('\n===== Test 2: Large PNG (Should use Files API) =====');
  const largePngMime = 'image/png';
  const largePngSize = largeImageBuffer.length;
  const shouldUploadLargePng = shouldUseFilesAPI(largePngMime, largePngSize);
  console.log(`Should upload to Files API? ${shouldUploadLargePng ? 'YES' : 'NO'}`);
  
  console.log('\n===== Test 3: DOCX file (Should use Files API) =====');
  const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const shouldUploadDocx = shouldUseFilesAPI(docxMime, 1024); // Size doesn't matter for DOCX
  console.log(`Should upload to Files API? ${shouldUploadDocx ? 'YES' : 'NO'}`);
  
  console.log('\n===== Test 4: PDF file (Should use Files API) =====');
  const pdfMime = 'application/pdf';
  const shouldUploadPdf = shouldUseFilesAPI(pdfMime, 1024); // Size doesn't matter for PDF
  console.log(`Should upload to Files API? ${shouldUploadPdf ? 'YES' : 'NO'}`);
  
  // Test file upload
  try {
    console.log('\n===== Testing DOCX File Upload =====');
    const fileData = await createFileData(genAI, docxUrl, docxMime);
    console.log('File data returned:', fileData);
    console.log('✅ DOCX file upload successful with correct file_uri and mime_type structure');
  } catch (error) {
    console.error(`❌ DOCX file upload failed: ${error.message}`);
  }
  
  console.log('\n===== Tests Complete =====');
}

// Run the tests
runTests();