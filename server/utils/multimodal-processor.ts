import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { determineContentType, isFileTypeAllowed } from './file-type-settings';

const readFileAsync = promisify(fs.readFile);

/**
 * Process a file to extract its content for use with Gemini's multimodal capabilities
 * 
 * @param filePath Path to the uploaded file
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
}> {
  // Extract file extension from filename
  const fileExtension = path.extname(fileName).slice(1).toLowerCase();
  
  // Determine content type
  const contentType = determineContentType(fileExtension, mimeType);
  
  // Check if the file type is allowed
  const fileTypeAllowed = await isFileTypeAllowed(contentType, fileExtension, mimeType);
  if (!fileTypeAllowed) {
    throw new Error(`File type ${fileExtension} (${mimeType}) is not allowed for processing`);
  }
  
  // Read the file
  const fileBuffer = await readFileAsync(filePath);
  
  // Process based on content type
  switch (contentType) {
    case 'text':
      try {
        const textContent = fileBuffer.toString('utf8');
        return {
          content: textContent,
          contentType,
          isProcessable: true,
          textContent
        };
      } catch (error) {
        console.error('Error processing text file:', error);
        return {
          content: fileBuffer,
          contentType,
          isProcessable: false
        };
      }
    
    case 'image':
      // For images, we'll return the buffer directly for Gemini to process
      return {
        content: fileBuffer,
        contentType,
        isProcessable: true
      };
    
    case 'document':
      // For documents, we'll attempt simple text extraction if it's a PDF
      // For other document types, we'll return the buffer and indicate it's not directly processable
      if (mimeType === 'application/pdf') {
        try {
          // In a real implementation, we would use a PDF parsing library here
          // For now, we'll just indicate it's not directly processable
          return {
            content: fileBuffer,
            contentType,
            isProcessable: false,
            textContent: 'PDF content extraction not implemented'
          };
        } catch (error) {
          console.error('Error processing PDF file:', error);
          return {
            content: fileBuffer,
            contentType,
            isProcessable: false
          };
        }
      } else {
        // Other document types
        return {
          content: fileBuffer,
          contentType,
          isProcessable: false
        };
      }
    
    case 'audio':
      // For audio, return the buffer and indicate it's not directly processable
      // In a real implementation, we might use a transcription service
      return {
        content: fileBuffer,
        contentType,
        isProcessable: false
      };
    
    case 'video':
      // For video, return the buffer and indicate it's not directly processable
      return {
        content: fileBuffer,
        contentType,
        isProcessable: false
      };
    
    default:
      // Default case
      return {
        content: fileBuffer,
        contentType: 'unknown',
        isProcessable: false
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
 * This is a placeholder function that would be expanded with proper parsers for different file types
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string | null> {
  try {
    const fileBuffer = await readFileAsync(filePath);
    
    // For text files, return the content directly
    if (mimeType.startsWith('text/')) {
      return fileBuffer.toString('utf8');
    }
    
    // For other file types, we would use specific parsers
    // This is just a placeholder implementation
    
    // PDF parser would go here
    if (mimeType === 'application/pdf') {
      return 'PDF text extraction not implemented';
    }
    
    // Word document parser
    if (mimeType === 'application/msword' || 
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'Word document text extraction not implemented';
    }
    
    // CSV/Excel parser
    if (mimeType === 'text/csv' || 
        mimeType === 'application/vnd.ms-excel' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return 'Spreadsheet text extraction not implemented';
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting text from file:', error);
    return null;
  }
}