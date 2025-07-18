// GCS Test Script - Run with: npx tsx test-gcs.js

import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// Read environment variables
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'aigrader-uploads';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;

console.log('Google Cloud Storage Test');
console.log('=======================');
console.log('GCS Config:');
console.log(`- GOOGLE_APPLICATION_CREDENTIALS: ${GOOGLE_APPLICATION_CREDENTIALS || 'Not set'}`);
console.log(`- GCS_BUCKET_NAME: ${GCS_BUCKET_NAME || 'Not set'}`);
console.log(`- GCP_PROJECT_ID: ${GCP_PROJECT_ID || 'Not set (will be inferred from credentials)'}`);

// Create a test file
async function createTestFile() {
  const testContent = 'This is a test file for GCS upload';
  const testFile = path.join(process.cwd(), 'gcs-test-file.txt');
  await fs.promises.writeFile(testFile, testContent);
  console.log(`\nCreated test file at: ${testFile}`);
  return testFile;
}

// Test GCS upload and signed URL generation
async function testGcs() {
  try {
    // Initialize GCS client
    console.log('\nInitializing GCS client...');
    const storage = new Storage({
      projectId: GCP_PROJECT_ID,
    });
    
    // Get bucket directly (don't try to check if it exists first)
    console.log(`Using bucket '${GCS_BUCKET_NAME}'...`);
    
    // Create a test file
    const testFile = await createTestFile();
    
    try {
      // Upload test file to GCS
      console.log('\nUploading test file to GCS...');
      const bucket = storage.bucket(GCS_BUCKET_NAME);
      const destination = `test-uploads/test-file-${Date.now()}.txt`;
      
      const [file] = await bucket.upload(testFile, {
        destination,
        metadata: {
          contentType: 'text/plain',
        },
      });
      
      console.log(`File uploaded successfully to: gs://${GCS_BUCKET_NAME}/${destination} ✅`);
      
      // Generate a signed URL
      console.log('\nGenerating signed URL...');
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      
      console.log(`Signed URL generated: ${signedUrl} ✅`);
      console.log('\nTest successful! GCS integration is working properly.');
    } finally {
      // Clean up test file
      await fs.promises.unlink(testFile);
      console.log(`\nCleanup: Deleted test file '${testFile}'`);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
testGcs();