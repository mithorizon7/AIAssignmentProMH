/**
 * Test script for Google Cloud Storage (GCS) integration
 * 
 * This script tests the full workflow of file upload, URL generation, 
 * and file retrieval using Google Cloud Storage.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import necessary utilities from the project
const { 
  isGcsConfigured, 
  uploadFile, 
  uploadBuffer, 
  generateSignedUrl,
  getPublicUrl
} = require('./server/utils/gcs-client');

const { 
  processFileForMultimodal, 
  isRemoteUrl 
} = require('./server/utils/multimodal-processor');

// Set up test file paths and content
const TEST_TEXT_CONTENT = 'This is a sample test file for GCS integration testing.';
const TEST_FILENAME = 'gcs-test-file.txt';
const LOCAL_TEST_PATH = path.join(__dirname, TEST_FILENAME);

async function createTestFile() {
  // Create a test file with sample content
  await fs.promises.writeFile(LOCAL_TEST_PATH, TEST_TEXT_CONTENT);
  console.log(`Created test file at ${LOCAL_TEST_PATH}`);
}

async function cleanupTestFile() {
  // Remove the local test file
  if (fs.existsSync(LOCAL_TEST_PATH)) {
    await fs.promises.unlink(LOCAL_TEST_PATH);
    console.log(`Cleaned up test file at ${LOCAL_TEST_PATH}`);
  }
}

async function testGcsIntegration() {
  console.log('Starting GCS integration test');
  console.log('=====================================');
  
  try {
    // Check if GCS is configured
    const gcsConfigured = isGcsConfigured();
    console.log(`GCS configured: ${gcsConfigured ? 'Yes' : 'No'}`);
    
    if (!gcsConfigured) {
      console.log('\nSkipping GCS tests - GCS not configured');
      console.log('To enable GCS testing, set the following environment variables:');
      console.log('  - GOOGLE_APPLICATION_CREDENTIALS (path to your service account key JSON file)');
      console.log('  - GCS_BUCKET_NAME (optional, defaults to "aigrader-uploads")');
      return;
    }
    
    // Create test file
    await createTestFile();
    
    // Test 1: Upload a file
    console.log('\nTest 1: Uploading a file to GCS');
    const timestamp = Date.now();
    const gcsPath = `test/gcs-test-${timestamp}.txt`;
    await uploadFile(LOCAL_TEST_PATH, gcsPath, 'text/plain');
    console.log(`Uploaded file to GCS path: ${gcsPath}`);
    
    // Test 2: Generate a signed URL
    console.log('\nTest 2: Generating a signed URL');
    const signedUrl = await generateSignedUrl(gcsPath, 60); // 60 minutes expiration
    console.log(`Generated signed URL: ${signedUrl.substring(0, 80)}...`);
    
    // Test 3: Process the file using multimodal processor with signed URL
    console.log('\nTest 3: Processing file using multimodal processor with signed URL');
    const processedFile = await processFileForMultimodal(
      signedUrl,
      TEST_FILENAME, 
      'text/plain'
    );
    console.log(`File processed successfully`);
    console.log(`Content type: ${processedFile.contentType}`);
    console.log(`Retrieved content matches original: ${processedFile.textContent === TEST_TEXT_CONTENT}`);
    
    // Test 4: Test path detection
    console.log('\nTest 4: Testing path type detection');
    console.log(`Is signed URL detected as remote: ${isRemoteUrl(signedUrl)}`);
    console.log(`Is GCS path detected as remote: ${isRemoteUrl(gcsPath)}`);
    console.log(`Is local path detected as remote: ${isRemoteUrl(LOCAL_TEST_PATH)}`);
    
    // Test 5: Upload a buffer directly
    console.log('\nTest 5: Uploading a buffer directly');
    const buffer = Buffer.from('This is a direct buffer upload test');
    const bufferPath = `test/buffer-test-${timestamp}.txt`;
    await uploadBuffer(buffer, bufferPath, 'text/plain');
    console.log(`Buffer uploaded to path: ${bufferPath}`);
    
    console.log('\nAll GCS integration tests completed successfully! ✅');
    
  } catch (error) {
    console.error('\n❌ GCS integration test failed:', error);
  } finally {
    // Clean up
    await cleanupTestFile();
  }
}

// Run the test
testGcsIntegration()
  .then(() => {
    console.log('\nTest script completed');
  })
  .catch(err => {
    console.error('Test script failed:', err);
    process.exit(1);
  });