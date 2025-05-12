import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { determineContentType, isFileTypeAllowed } from './file-type-settings';

const readFileAsync = promisify(fs.readFile);

/**
 * Process a file to extract its content for use with Gemini's multimodal capabilities
 * 
 * @param filePath Path to the uploaded file
 * @param fileName Original file name
 * @param mimeType MIME type of the file
 * @returns Processed content and metadata
 */
export async function processFileForMultimodal(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<{
  content: string | Buffer;
  contentType: string;
  isProcessable: boolean;
  textContent?: string;
  fileSize?: number;
}> {
  // Extract file extension from filename
  const fileExtension = path.extname(fileName).slice(1).toLowerCase();
  
  // Determine content type based on extension and MIME type
  const contentType = determineContentType(fileExtension, mimeType);
  
  // Check if the file type is allowed based on the content type
  const fileTypeAllowed = await isFileTypeAllowed(contentType, fileExtension, mimeType);
  if (!fileTypeAllowed) {
    throw new Error(`File type ${fileExtension} (${mimeType}) is not allowed for processing`);
  }
  
  // Read the file
  const fileBuffer = await readFileAsync(filePath);
  const fileSize = fileBuffer.length;
  
  // Get file description for logging
  const fileDesc = getFileDescription(fileName, mimeType, fileSize);
  console.log(`Processing file: ${fileDesc}`);
  
  // Process based on content type
  switch (contentType) {
    case 'text':
      try {
        // For text files, use the buffer to get the text content
        const textContent = fileBuffer.toString('utf8');
        console.log(`Extracted ${textContent.length} characters from text file`);
        
        // For basic text files, text IS the content
        return {
          content: textContent,
          contentType,
          isProcessable: true,
          textContent,
          fileSize
        };
      } catch (error) {
        console.error('Error processing text file:', error);
        // Fall back to treating as binary
        return {
          content: fileBuffer,
          contentType,
          isProcessable: false,
          fileSize
        };
      }
    
    case 'image':
      // For images, return the buffer directly - Gemini handles images well
      return {
        content: fileBuffer,
        contentType,
        isProcessable: true,
        fileSize
      };
    
    case 'document':
      // For documents, we need to extract text when possible
      try {
        // Try to extract text from the document
        const extractedText = await extractTextFromFile(filePath, mimeType);
        
        // For PDF, we'll attempt to extract text and also provide the buffer
        if (mimeType === 'application/pdf') {
          return {
            content: fileBuffer,  // The original PDF buffer for multimodal models
            contentType,
            isProcessable: true,  // Modern multimodal models can process PDFs
            textContent: extractedText || `PDF document "${fileName}" (${fileSize} bytes)`,
            fileSize
          };
        } 
        // For Word documents and other office formats
        else if (mimeType.includes('word') || 
                mimeType.includes('officedocument') ||
                mimeType.includes('spreadsheet')) {
          return {
            content: fileBuffer,
            contentType,
            isProcessable: false,  // Most models can't process these directly yet
            textContent: extractedText || `Document "${fileName}" (${fileSize} bytes)`,
            fileSize
          };
        }
        // CSV and other parseable documents
        else if (mimeType === 'text/csv') {
          return {
            content: extractedText || fileBuffer.toString('utf8'),
            contentType,
            isProcessable: true,
            textContent: extractedText,
            fileSize
          };
        }
        // Other document types
        else {
          return {
            content: fileBuffer,
            contentType,
            isProcessable: false,
            textContent: extractedText,
            fileSize
          };
        }
      } catch (error) {
        console.error('Error processing document file:', error);
        return {
          content: fileBuffer,
          contentType,
          isProcessable: false,
          fileSize
        };
      }
    
    case 'audio':
      // For audio, we could use transcription services in production
      // But for now, we'll just provide some metadata
      return {
        content: fileBuffer,
        contentType,
        isProcessable: false,  // Most models can't process audio directly yet
        textContent: `Audio file "${fileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`,
        fileSize
      };
    
    case 'video':
      // For video, similar to audio
      return {
        content: fileBuffer,
        contentType,
        isProcessable: false,  // Most models can't process video directly yet
        textContent: `Video file "${fileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`,
        fileSize
      };
    
    default:
      // For unknown file types, provide as much information as possible
      return {
        content: fileBuffer,
        contentType: 'unknown',
        isProcessable: false,
        textContent: `Unknown file type: ${fileName} (${mimeType})`,
        fileSize
      };
  }
}

/**
 * Convert an image or binary file to a base64 data URI for use with Gemini API
 */
export function fileToDataURI(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Extract text content from various file types
 * This function handles basic text extraction with placeholders for more advanced formats
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string | null> {
  try {
    const fileBuffer = await readFileAsync(filePath);
    
    // Plain text files
    if (mimeType.startsWith('text/')) {
      return fileBuffer.toString('utf8');
    }
    
    // Code files that might not have text MIME type
    if (['application/javascript', 'application/typescript', 'application/json', 'application/xml'].includes(mimeType)) {
      return fileBuffer.toString('utf8');
    }
    
    // Markdown
    if (mimeType === 'text/markdown') {
      return fileBuffer.toString('utf8');
    }
    
    // PDF content - in production, this would use a PDF parsing library
    if (mimeType === 'application/pdf') {
      // Here we would integrate with a PDF parser like pdf-parse
      // For now, this is just a placeholder
      return `[This is a PDF file. In production, the text would be extracted using a PDF parser library.]

Example metadata that would be extracted:
- PDF Title: (extracted from metadata)
- Number of pages: (extracted from PDF)
- Content: (extracted text from all pages)`;
    }
    
    // Word documents
    if (mimeType === 'application/msword' || 
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Here we would integrate with a Word document parser like mammoth.js
      return `[This is a Word document. In production, the text would be extracted using a document parser library.]`;
    }
    
    // CSV/Excel files
    if (mimeType === 'text/csv') {
      // Basic CSV parsing - for more complex CSV, we'd use a proper parser
      return fileBuffer.toString('utf8');
    }
    
    if (mimeType === 'application/vnd.ms-excel' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Here we would integrate with an Excel parser like xlsx
      return `[This is an Excel file. In production, the data would be extracted and formatted as text.]`;
    }
    
    // If we don't recognize the file type or can't extract content
    return null;
  } catch (error) {
    console.error('Error extracting text from file:', error);
    return null;
  }
}

/**
 * Get a human-readable description of a file based on its MIME type and size
 */
export function getFileDescription(fileName: string, mimeType: string, fileSize: number): string {
  const sizeInKB = Math.round(fileSize / 1024);
  const sizeInMB = (fileSize / (1024 * 1024)).toFixed(2);
  
  // Format size string
  const sizeStr = sizeInKB < 1024 ? `${sizeInKB} KB` : `${sizeInMB} MB`;
  
  // Get a friendly file type description
  let fileType = 'Unknown file';
  
  if (mimeType.startsWith('text/')) {
    fileType = 'Text file';
  } else if (mimeType.startsWith('image/')) {
    fileType = 'Image';
  } else if (mimeType.startsWith('audio/')) {
    fileType = 'Audio file';
  } else if (mimeType.startsWith('video/')) {
    fileType = 'Video file';
  } else if (mimeType === 'application/pdf') {
    fileType = 'PDF document';
  } else if (mimeType === 'application/msword' || 
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    fileType = 'Word document';
  } else if (mimeType === 'text/csv' || 
            mimeType === 'application/vnd.ms-excel' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    fileType = 'Spreadsheet';
  }
  
  return `${fileType} "${fileName}" (${sizeStr})`;
}