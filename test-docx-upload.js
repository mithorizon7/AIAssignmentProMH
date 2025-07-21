/**
 * Test script for verifying the DOCX file upload fix
 * This uses the actual file handling utility we updated
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import our actual file handler
import { createFileData } from './server/utils/gemini-file-handler.js';
import { GoogleGenAI } from '@google/genai';

// Setup proper __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize the Gemini client with API key from environment
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY environment variable');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

async function testDocxUpload() {
  try {
    console.log('Starting DOCX upload test...');
    
    // Read the test DOCX file
    const docxPath = path.join(__dirname, 'attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');
    const docxBuffer = fs.readFileSync(docxPath);
    console.log(`Read DOCX file: ${docxPath}, size: ${docxBuffer.length} bytes`);
    
    // Use our fixed file handler to create the file data
    const fileData = await createFileData(
      genAI,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    
    console.log('DOCX file upload successful!');
    console.log(`File URI: ${fileData.file_uri}`);
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Error in DOCX upload test:', error);
    process.exit(1);
  }
}

// Run the test
testDocxUpload();