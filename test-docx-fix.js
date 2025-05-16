/**
 * Test script for verifying the DOCX file handling fix in the Gemini adapter
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import the Gen AI SDK
import { GoogleGenAI } from '@google/genai';

// Setup proper __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for API key
if (!process.env.GEMINI_API_KEY) {
  console.error("Please set the GEMINI_API_KEY environment variable");
  process.exit(1);
}

// Initialize the Gemini client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testDocxHandling() {
  try {
    console.log("Starting DOCX file handling test...");

    // Read the test DOCX file
    const docxPath = path.join(__dirname, 'attached_assets', 'Gemini_File_Upload_Migration_Guide.docx');
    const docxBuffer = fs.readFileSync(docxPath);
    console.log(`Read DOCX file: ${docxPath}, size: ${docxBuffer.length} bytes`);

    // Upload file using new SDK format
    console.log("Uploading DOCX file to Gemini with new SDK format...");
    const file = await genAI.files.upload({
      file: docxBuffer,
      config: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    });

    console.log("DOCX file uploaded successfully!");
    console.log(`File URI: ${file.uri}`);
    
    // Test using the file in a multimodal prompt
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    console.log("Sending multimodal prompt with DOCX file...");
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Summarize this document in 3 bullet points:' },
            { fileData: { fileUri: file.uri, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }
          ]
        }
      ]
    });

    console.log("\nResponse from Gemini:");
    console.log(result.response.text());
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Error in DOCX test:", error);
    process.exit(1);
  }
}

// Run the test
testDocxHandling();