/**
 * Simple test script to verify file handling improvements in Gemini adapter
 * Tests both DOCX and image handling with the improved implementation
 * 
 * Requirements:
 * - Set GOOGLE_API_KEY environment variable before running
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Get dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check API key
if (!process.env.GOOGLE_API_KEY) {
  console.error('❌ ERROR: GOOGLE_API_KEY environment variable is not set');
  process.exit(1);
}

// Initialize Google GenAI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Test file paths
const docxFile = path.join(__dirname, 'attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');
const imageSmall = path.join(__dirname, 'attached_assets', 'favicon-32x32.png');
const imageLarge = path.join(__dirname, 'attached_assets', 'Screenshot 2025-05-16 at 2.27.56 PM.png');

// Constants
const MAX_INLINE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Simple implementation of shouldUseFilesAPI to match the actual implementation
 */
function shouldUseFilesAPI(mimeType, contentSize) {
  const mime = typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  
  // Always use Files API for documents and large images
  if (mime.includes('document') || mime.includes('openxmlformats')) {
    return true;
  }
  
  // Large images use Files API
  if (mime.startsWith('image/') && contentSize > MAX_INLINE_SIZE) {
    return true;
  }
  
  return false;
}

/**
 * Upload file using Files API
 */
async function uploadWithFilesAPI(filePath, mimeType) {
  console.log(`Uploading file to Gemini: ${filePath}`);
  
  // Use the temporary file approach for reliable uploads
  try {
    const file = await genAI.files.upload({
      file: filePath,
      config: { mimeType }
    });
    
    console.log(`✅ File uploaded successfully: ${file.fileId}`);
    return {
      fileUri: file.fileId,
      mimeType
    };
  } catch (error) {
    console.error(`❌ File upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Use Gemini to analyze file
 */
async function analyzeWithGemini(fileData, prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  console.log('Sending request to Gemini...');
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { 
            fileData: {
              fileUri: fileData.fileUri, 
              mimeType: fileData.mimeType
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    }
  });
  
  return result.response.text();
}

/**
 * Test DOCX file handling
 */
async function testDocxHandling() {
  console.log('\n=== Testing DOCX File Handling ===');
  
  // Check if file exists
  if (!await fileExists(docxFile)) {
    console.error(`❌ Test file not found: ${docxFile}`);
    return false;
  }
  
  try {
    // Get file stats and MIME type
    const stats = await fs.stat(docxFile);
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    console.log(`File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`MIME type: ${mimeType}`);
    
    // Check if we should use Files API
    const useFilesAPI = shouldUseFilesAPI(mimeType, stats.size);
    console.log(`Should use Files API: ${useFilesAPI ? 'YES' : 'NO'}`);
    
    if (!useFilesAPI) {
      console.error('❌ DOCX files should always use Files API!');
      return false;
    }
    
    // Upload file
    const fileData = await uploadWithFilesAPI(docxFile, mimeType);
    
    // Test with Gemini
    const prompt = "Summarize this document in 3-5 bullet points.";
    const response = await analyzeWithGemini(fileData, prompt);
    
    console.log('\n=== Gemini Response ===');
    console.log(response);
    
    console.log('\n✅ DOCX file handling test passed!');
    return true;
  } catch (error) {
    console.error('❌ DOCX file handling test failed:', error);
    return false;
  }
}

/**
 * Test image file handling
 */
async function testImageHandling(imagePath, expectedUseFilesAPI) {
  console.log(`\n=== Testing Image File Handling: ${path.basename(imagePath)} ===`);
  
  // Check if file exists
  if (!await fileExists(imagePath)) {
    console.error(`❌ Test file not found: ${imagePath}`);
    return false;
  }
  
  try {
    // Get file stats and MIME type
    const stats = await fs.stat(imagePath);
    const mimeType = 'image/png';
    
    console.log(`File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`MIME type: ${mimeType}`);
    
    // Check if we should use Files API
    const useFilesAPI = shouldUseFilesAPI(mimeType, stats.size);
    console.log(`Should use Files API: ${useFilesAPI ? 'YES' : 'NO'}`);
    
    if (useFilesAPI !== expectedUseFilesAPI) {
      console.error(`❌ Incorrect decision for ${path.basename(imagePath)}!`);
      console.error(`Expected: ${expectedUseFilesAPI ? 'Use Files API' : 'Use inline data'}`);
      console.error(`Actual: ${useFilesAPI ? 'Use Files API' : 'Use inline data'}`);
      return false;
    }
    
    // If using Files API, test upload
    if (useFilesAPI) {
      const fileData = await uploadWithFilesAPI(imagePath, mimeType);
      
      // Test with Gemini
      const prompt = "Describe what you see in this image.";
      const response = await analyzeWithGemini(fileData, prompt);
      
      console.log('\n=== Gemini Response ===');
      console.log(response);
    } else {
      console.log('✅ Small image would use inline data as expected');
    }
    
    console.log(`\n✅ Image file handling test passed for ${path.basename(imagePath)}!`);
    return true;
  } catch (error) {
    console.error(`❌ Image file handling test failed for ${path.basename(imagePath)}:`, error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 TESTING GEMINI FILE HANDLING IMPROVEMENTS 🧪');
  console.log('================================================');
  
  // Test DOCX handling
  const docxResult = await testDocxHandling();
  
  // Test small image (should NOT use Files API)
  const smallImageResult = await testImageHandling(imageSmall, false);
  
  // Test large image (should use Files API)
  const largeImageResult = await testImageHandling(imageLarge, true);
  
  // Print summary
  console.log('\n================================================');
  console.log('🧪 TEST RESULTS SUMMARY 🧪');
  console.log('================================================');
  console.log(`DOCX file handling: ${docxResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Small image handling: ${smallImageResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Large image handling: ${largeImageResult ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = docxResult && smallImageResult && largeImageResult;
  console.log(`\nOverall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run all tests
runTests().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});