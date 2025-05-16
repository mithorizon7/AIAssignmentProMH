// Create test script to verify DOCX file handling
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

// Load environment variables
dotenv.config();

async function testDocxHandling() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY in .env file');
      process.exit(1);
    }
    
    const genAI = new GoogleGenAI({ apiKey });
    
    // Test with DOCX file
    const docxPath = path.join(__dirname, 'attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');
    const docxBuffer = fs.readFileSync(docxPath);
    
    console.log(`Uploading DOCX file (${docxBuffer.length} bytes)...`);
    
    // Use the updated format from the migration guide
    const file = await genAI.files.upload({
      file: docxPath,
      config: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    });
    
    console.log('File uploaded successfully!');
    console.log(`File URI: ${file.uri}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testDocxHandling();