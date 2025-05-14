/**
 * Utility for processing different types of content for multimodal AI processing
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { MultimodalPromptPart } from '../adapters/ai-adapter';
import { 
  getContentTypeFromMimeType, 
  getMimeTypeFromExtension,
  isCSVFile,
  getExtensionFromFilename
} from './file-type-settings';

const readFileAsync = promisify(fs.readFile);
const existsAsync = promisify(fs.exists);
const unlinkAsync = promisify(fs.unlink);

/**
 * Interface for file metadata
 */
export interface FileMetadata {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document';
  assignmentId?: number;
  userId?: number;
}

/**
 * Extract text content from various document types
 * Currently handles text files and CSV directly
 * More complex document types would require external libraries
 * @param filePath Path to the file
 * @param mimeType MIME type of the file
 */
export async function extractTextContent(
  filePath: string, 
  mimeType: string,
  extension?: string
): Promise<string | undefined> {
  try {
    // Check if file exists
    const fileExists = await existsAsync(filePath);
    if (!fileExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    // Handle based on content type
    const contentType = getContentTypeFromMimeType(mimeType);
    
    // For text files, just return the content
    if (contentType === 'text') {
      const content = await readFileAsync(filePath, 'utf8');
      return content;
    }
    
    // Special handling for CSV files
    if (isCSVFile(mimeType, extension || '')) {
      const content = await readFileAsync(filePath, 'utf8');
      // Basic CSV description
      const lines = content.split('\n');
      const headers = lines[0]?.split(',').map(h => h.trim()).filter(Boolean) || [];
      
      let csvDescription = `CSV file with ${lines.length - 1} data rows and ${headers.length} columns.\n`;
      csvDescription += `Headers: ${headers.join(', ')}\n`;
      
      // Include a sample of the data (first 5 rows max)
      csvDescription += `Sample data:\n`;
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        csvDescription += `${lines[i]}\n`;
      }
      
      return csvDescription;
    }
    
    // For other document types, return basic metadata
    return `This is a ${contentType} file with MIME type ${mimeType}. Content processing not available for this file type.`;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error extracting text content: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Create multimodal prompt parts from file metadata
 * @param fileMetadata Metadata for the file
 * @param assignmentPrompt Optional assignment-specific prompt
 */
export async function createMultimodalPromptParts(
  fileMetadata: FileMetadata,
  assignmentPrompt?: string
): Promise<MultimodalPromptPart[]> {
  const parts: MultimodalPromptPart[] = [];
  
  try {
    // Load file content
    const fileContent = await readFileAsync(fileMetadata.path);
    
    // Base multimodal part with file content
    const filePart: MultimodalPromptPart = {
      type: fileMetadata.contentType,
      content: fileContent,
      mimeType: fileMetadata.mimeType
    };
    
    // For document and text types, extract text content when possible
    if (fileMetadata.contentType === 'document' || fileMetadata.contentType === 'text') {
      const extractedText = await extractTextContent(
        fileMetadata.path, 
        fileMetadata.mimeType,
        fileMetadata.originalName
      );
      
      if (extractedText) {
        filePart.textContent = extractedText;
      }
    }
    
    // Add the file part first
    parts.push(filePart);
    
    // Add assignment prompt if provided
    if (assignmentPrompt) {
      parts.push({
        type: 'text',
        content: assignmentPrompt
      });
    }
    
    return parts;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error creating multimodal prompt parts: ${errorMessage}`);
    
    // Fallback to text-only if file processing fails
    return [
      {
        type: 'text' as const,
        content: `Failed to process ${fileMetadata.contentType} file: ${fileMetadata.originalName}. ${errorMessage}`
      },
      ...(assignmentPrompt ? [{
        type: 'text' as const,
        content: assignmentPrompt
      }] : [])
    ];
  }
}

/**
 * Create file metadata from uploaded file
 * @param file The uploaded file object from multer
 */
export function createFileMetadata(file: Express.Multer.File): FileMetadata {
  // Determine MIME type (use the detected one or fallback to extension)
  const mimeType = file.mimetype || getMimeTypeFromExtension(getExtensionFromFilename(file.originalname));
  
  // Determine content type category
  const contentType = getContentTypeFromMimeType(mimeType);
  
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimeType,
    contentType
  };
}

/**
 * Clean up file resources
 * @param filePath Path to the file to delete
 */
export async function cleanupFile(filePath: string): Promise<void> {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error cleaning up file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Batch cleanup multiple files
 * @param filePaths Array of file paths to delete
 */
export async function cleanupFiles(filePaths: string[]): Promise<void> {
  const cleanupPromises = filePaths.map(path => cleanupFile(path));
  await Promise.allSettled(cleanupPromises);
}

/**
 * Convert a file buffer to a data URI
 * @param content Buffer containing file data
 * @param mimeType MIME type of the file
 * @returns Base64 encoded data URI string
 */
export function fileToDataURI(content: Buffer, mimeType: string): string {
  const base64 = content.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Interface representing a processed file for multimodal content
 */
export interface ProcessedFile {
  content: Buffer | string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document';
  textContent?: string;
  mimeType: string;
}

/**
 * Process a file for multimodal AI analysis
 * @param filePath Path to the file
 * @param fileName Original name of the file
 * @param mimeType MIME type of the file
 * @returns ProcessedFile object containing the file content and metadata
 */
export async function processFileForMultimodal(
  filePath: string,
  fileName: string, 
  mimeType: string
): Promise<ProcessedFile> {
  try {
    // Read the file
    const fileContent = await fs.promises.readFile(filePath);
    
    // Determine content type from the mime type and filename
    const contentType = getContentTypeFromMimeType(mimeType);
    
    // For text and document types, attempt to extract text content
    let textContent: string | undefined;
    if (contentType === 'text' || contentType === 'document') {
      try {
        // The filename extension might be needed for some document types
        const extension = path.extname(fileName).toLowerCase();
        textContent = await extractTextContent(filePath, mimeType, extension);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to extract text from ${fileName}: ${errorMessage}`);
        // Continue with the process even if text extraction fails
      }
    }
    
    // Return the processed file
    return {
      content: fileContent,
      contentType,
      textContent,
      mimeType
    };
  } catch (error: unknown) {
    console.error(`Error processing file ${fileName} for multimodal analysis:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process file for multimodal analysis: ${errorMessage}`);
  }
}