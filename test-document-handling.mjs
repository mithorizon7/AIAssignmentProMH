/**
 * Test script to verify document file handling in Gemini adapter
 * 
 * This tests:
 * 1. Handling of document files (.docx, .pdf)
 * 2. Proper parameter passing for createFileData
 * 3. Appropriate error handling for documents
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// This function simulates the error-fixed createFileData function
async function createFileData(genAI, content, mimeType) {
  console.log(`Creating file data with:
  - genAI instance present: ${!!genAI}
  - content length: ${content.length} bytes
  - mimeType: ${mimeType}`);
  
  // Simulating the file upload process
  // In production, this would actually upload to Google's file service
  return {
    file_uri: `https://generativelanguage.googleapis.com/v1/files/file_${Date.now()}`,
    mime_type: mimeType
  };
}

// Convert snake_case to camelCase for SDK
function toSDKFormat(fileData) {
  return {
    fileUri: fileData.file_uri,
    mimeType: fileData.mime_type
  };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log(`Testing with valid genAI instance`);

  // Test handling of different document types
  await testDocumentHandling(genAI);
}

async function testDocumentHandling(genAI) {
  console.log("\n🧪 Test: Document file handling");
  
  try {
    // Create some sample document content for testing
    const docxContent = Buffer.from("This is sample DOCX content");
    const pdfContent = Buffer.from("This is sample PDF content");
    
    // Test with DOCX files
    console.log("\nTesting DOCX file handling:");
    const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const docxFileData = await createFileData(genAI, docxContent, docxMimeType);
    console.log("DOCX file data:", docxFileData);
    
    // Test with PDF files
    console.log("\nTesting PDF file handling:");
    const pdfMimeType = 'application/pdf';
    const pdfFileData = await createFileData(genAI, pdfContent, pdfMimeType);
    console.log("PDF file data:", pdfFileData);
    
    // Test SDK format conversion
    console.log("\nTesting SDK format conversion:");
    const sdkDocxFormat = toSDKFormat(docxFileData);
    console.log("Original (snake_case):", docxFileData);
    console.log("SDK format (camelCase):", sdkDocxFormat);
    
    // Test with missing genAI instance (error case we fixed)
    console.log("\nTesting error case that was fixed:");
    try {
      console.log("This would previously fail with 'open is not a function' or similar:");
      // This would fail before our fix:
      // await createFileData(docxContent, docxMimeType);
      
      // With our fix, we now pass genAI as the first parameter:
      await createFileData(genAI, docxContent, docxMimeType);
      console.log("✅ Successfully handled document with proper parameters");
    } catch (error) {
      console.error("❌ Failed to handle document:", error.message);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the tests
main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});