require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { isRemoteUrl, processFileForMultimodal } = require('../server/utils/multimodal-processor');
const { isS3Configured, uploadFile } = require('../server/utils/s3-client');

// Create a simple test file
async function createTestFile(content, filename) {
  const filePath = path.join(__dirname, filename);
  await fs.promises.writeFile(filePath, content);
  return filePath;
}

// Test our file processing capability
async function testFileProcessing() {
  console.log('S3 File Handling Demo');
  console.log('=====================');
  console.log('S3 Configuration Status:', isS3Configured() ? 'Configured ✅' : 'Not Configured ❌');
  
  try {
    // Create a test text file
    const testContent = 'This is a test file for multimodal processing';
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
    
    // Upload to S3 if configured
    let fileUrl = null;
    if (isS3Configured()) {
      console.log('\n2. Testing S3 upload:');
      fileUrl = await uploadFile(
        textFilePath,
        'test-uploads/demo-file.txt',
        'text/plain'
      );
      console.log('File uploaded to:', fileUrl);
      console.log('S3 upload successful! ✅');
      
      // Process the remote URL
      console.log('\n3. Testing processFileForMultimodal with the S3 URL:');
      const result2 = await processFileForMultimodal(
        fileUrl,
        'test_file.txt',
        'text/plain'
      );
      console.log('Content type:', result2.contentType);
      console.log('Text content:', result2.textContent);
      console.log('Remote file processing successful! ✅');
    } else {
      console.log('\nSkipping S3 upload and remote URL tests - S3 not configured');
      console.log('To enable S3 testing, set the following environment variables:');
      console.log('  - S3_ACCESS_KEY');
      console.log('  - S3_SECRET_KEY');
      console.log('  - S3_REGION');
      console.log('  - S3_BUCKET (optional, defaults to "aigrader-uploads")');
    }
    
    // Clean up
    await fs.promises.unlink(textFilePath);
    console.log('\nCleanup: Test file deleted');
    
    // Summary
    console.log('\nTest Summary:');
    console.log('- Local file processing: ✅ Success');
    console.log(`- S3 integration: ${isS3Configured() ? '✅ Success' : '⏭️ Skipped (not configured)'}`);
    console.log(`- Remote URL processing: ${fileUrl ? '✅ Success' : '⏭️ Skipped (S3 not configured)'}`);
    
  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
}

// Run the test
testFileProcessing().catch(console.error);