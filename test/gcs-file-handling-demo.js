import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isRemoteUrl, processFileForMultimodal } from '../server/utils/multimodal-processor.ts';
import { isGcsConfigured, uploadFile, generateSignedUrl } from '../server/utils/gcs-client.ts';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple test file
async function createTestFile(content, filename) {
  const filePath = path.join(__dirname, filename);
  await fs.promises.writeFile(filePath, content);
  return filePath;
}

// Test our file processing capability
async function testFileProcessing() {
  console.log('Google Cloud Storage File Handling Demo');
  console.log('=======================================');
  console.log('GCS Configuration Status:', isGcsConfigured() ? 'Configured ✅' : 'Not Configured ❌');
  
  try {
    // Create a test text file
    const testContent = 'This is a test file for multimodal processing with Google Cloud Storage';
    const textFilePath = await createTestFile(testContent, 'test_file.txt');
    console.log(`\nCreated test file at: ${textFilePath}`);
    
    // Process a local file
    console.log('\n1. Testing processFileForMultimodal with a local file:');
    const result1 = await processFileForMultimodal(
      textFilePath, 
      'test_file.txt', 
      'text/plain'
    );
    console.log('Content type:', result1.contentType);
    console.log('Text content:', result1.textContent);
    console.log('Local file processing successful! ✅');
    
    // Upload to GCS if configured
    let gcsPath = null;
    let fileUrl = null;
    if (isGcsConfigured()) {
      console.log('\n2. Testing GCS upload:');
      gcsPath = await uploadFile(
        textFilePath,
        'test-uploads/demo-file.txt',
        'text/plain'
      );
      console.log('File uploaded to GCS path:', gcsPath);
      console.log('GCS upload successful! ✅');
      
      // Generate a signed URL
      console.log('\n3. Testing Signed URL generation:');
      fileUrl = await generateSignedUrl(gcsPath, 60); // 60 minutes expiration
      console.log('Signed URL generated:', fileUrl);
      console.log('Signed URL generation successful! ✅');
      
      // Process the remote URL
      console.log('\n4. Testing processFileForMultimodal with the GCS signed URL:');
      const result2 = await processFileForMultimodal(
        fileUrl,
        'test_file.txt',
        'text/plain'
      );
      console.log('Content type:', result2.contentType);
      console.log('Text content:', result2.textContent);
      console.log('Remote file processing successful! ✅');
    } else {
      console.log('\nSkipping GCS upload and remote URL tests - GCS not configured');
      console.log('To enable GCS testing, set the following environment variables:');
      console.log('  - GOOGLE_APPLICATION_CREDENTIALS (path to your service account key JSON file)');
      console.log('  - GCS_BUCKET_NAME (optional, defaults to "aigrader-uploads")');
    }
    
    // Clean up
    await fs.promises.unlink(textFilePath);
    console.log('\nCleanup: Test file deleted');
    
    // Summary
    console.log('\nTest Summary:');
    console.log('- Local file processing: ✅ Success');
    console.log(`- GCS integration: ${isGcsConfigured() ? '✅ Success' : '⏭️ Skipped (not configured)'}`);
    console.log(`- Signed URL generation: ${fileUrl ? '✅ Success' : '⏭️ Skipped (GCS not configured)'}`);
    console.log(`- Remote URL processing: ${fileUrl ? '✅ Success' : '⏭️ Skipped (GCS not configured)'}`);
    
  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
}

// Run the test
testFileProcessing().catch(console.error);

// For ES module exports if needed later
export { testFileProcessing };