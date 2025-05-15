/**
 * Utility for processing different types of content for multimodal AI processing
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { MultimodalPromptPart } from '../adapters/ai-adapter';
import { 
  getContentTypeFromMimeType, 
  getMimeTypeFromExtension,
  isCSVFile,
  getExtensionFromFilename,
  ContentType
} from './file-type-settings';
import os from 'os';
import crypto from 'crypto';

const readFileAsync = promisify(fs.readFile);
const existsAsync = promisify(fs.exists);
const unlinkAsync = promisify(fs.unlink);
const writeFileAsync = promisify(fs.writeFile);

/**
 * Interface for file metadata
 */
export interface FileMetadata {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  contentType: ContentType;
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
        type: 'text' as ContentType,
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
        type: 'text' as ContentType,
        content: `Failed to process ${fileMetadata.contentType} file: ${fileMetadata.originalName}. ${errorMessage}`
      },
      ...(assignmentPrompt ? [{
        type: 'text' as ContentType,
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
 * Check if a path is a remote URL or a GCS object path
 * @param path Path to check
 * @returns Boolean indicating if the path is a remote URL or GCS path
 */
export function isRemoteUrl(path: string): boolean {
  if (!path) return false;
  
  // Handle various URL formats
  return path.startsWith('http://') || 
         path.startsWith('https://') || 
         path.startsWith('gs://') ||
         path.includes('storage.googleapis.com') ||
         // Detect GCS object paths that we should convert to signed URLs
         (path.startsWith('/') === false && // Not an absolute local path
          path.includes('/') && // Has at least one folder separator
          !path.includes('\\') && // Not a Windows-style path
          !fs.existsSync(path)); // Not an existing local file
}

/**
 * Download a file from a remote URL (GCS, HTTP, HTTPS) 
 * @param url The URL to download from
 * @param mimeType Optional MIME type of the file (useful for GCS URLs that might not provide Content-Type)
 * @returns An object containing the file buffer and temporary local path
 */
export async function downloadFromUrl(url: string, mimeType?: string): Promise<{ 
  buffer: Buffer, 
  localPath: string,
  cleanup: () => Promise<void>
}> {
  try {
    console.log(`[DOWNLOAD] Downloading file from URL: ${url.substring(0, 30)}... (url length: ${url.length})`);
    
    // Generate a temporary file path
    const tempDir = os.tmpdir();
    const randomName = crypto.randomBytes(16).toString('hex');
    const extension = mimeType ? 
      `.${mimeType.split('/')[1]}` : 
      path.extname(url) || '.tmp';
    
    const localPath = path.join(tempDir, `${randomName}${extension}`);
    console.log(`[DOWNLOAD] Using temp file path: ${localPath}`);
    
    // Handle different URL types
    let fileBuffer: Buffer;
    
    if (url.startsWith('gs://')) {
      // For direct GCS URLs, we need to use the Google Cloud Storage SDK
      console.log(`[DOWNLOAD] Detected GCS URL (gs:// protocol), using GCS SDK`);
      try {
        // Import the GCS client only when needed
        const { getBucket, bucketName } = require('./gcs-client');
        
        // Parse the GCS URL (format: gs://bucket-name/path/to/file)
        const gcsPath = url.replace('gs://', '');
        const [bucketFromUrl, ...objectPathParts] = gcsPath.split('/');
        const objectPath = objectPathParts.join('/');
        
        // Determine which bucket to use (from URL or default)
        const targetBucket = bucketFromUrl || bucketName;
        console.log(`[DOWNLOAD] GCS bucket: ${targetBucket}, object path: ${objectPath}`);
        
        // Get the bucket and file objects
        const bucket = getBucket(targetBucket);
        const file = bucket.file(objectPath);
        
        // Download the file to a buffer
        console.log(`[DOWNLOAD] Downloading from GCS bucket: ${targetBucket}, object: ${objectPath}`);
        const [fileData] = await file.download();
        fileBuffer = fileData;
        console.log(`[DOWNLOAD] Successfully downloaded from GCS, file size: ${fileBuffer.length} bytes`);
        
        // Write to temp file for operations that need a file path
        await writeFileAsync(localPath, fileBuffer);
        console.log(`[DOWNLOAD] Wrote GCS file data to temporary path: ${localPath}`);
      } catch (gcsError) {
        console.error('[DOWNLOAD] Error downloading from GCS:', gcsError);
        throw new Error(`Failed to download file from GCS: ${gcsError instanceof Error ? gcsError.message : String(gcsError)}`);
      }
    } else {
      // Standard HTTP/HTTPS URLs (including GCS signed URLs)
      console.log(`[DOWNLOAD] Standard HTTP URL detected, using fetch`);
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`[DOWNLOAD] Fetch request failed with status: ${response.status}`);
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
        
        // Get content type from response if not provided
        const responseContentType = response.headers.get('content-type');
        if (!mimeType && responseContentType) {
          mimeType = responseContentType;
          console.log(`[DOWNLOAD] Got content type from response: ${mimeType}`);
        }
        
        // Get the file buffer
        const arrayBuffer = await response.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        console.log(`[DOWNLOAD] Successfully downloaded via HTTP, file size: ${fileBuffer.length} bytes`);
        
        // Write to temp file for operations that need a file path
        await writeFileAsync(localPath, fileBuffer);
        console.log(`[DOWNLOAD] Wrote HTTP file data to temporary path: ${localPath}`);
      } catch (fetchError) {
        console.error('[DOWNLOAD] Error fetching from URL:', fetchError);
        throw new Error(`Failed to download file: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
    }
    
    // Return file buffer and local path
    return { 
      buffer: fileBuffer, 
      localPath,
      // Function to clean up the temporary file
      cleanup: async () => {
        try {
          if (fs.existsSync(localPath)) {
            await unlinkAsync(localPath);
          }
        } catch (error) {
          console.warn(`Failed to clean up temporary file ${localPath}:`, error);
        }
      }
    };
  } catch (error) {
    console.error('Error downloading file from URL:', error);
    throw error;
  }
}

/**
 * Interface representing a processed file for multimodal content
 */
export interface ProcessedFile {
  content: Buffer | string;
  contentType: ContentType;
  textContent?: string;
  mimeType: string;
}

/**
 * Process a file for multimodal AI analysis
 * @param filePath Path to the file or URL to download from
 * @param fileName Original name of the file
 * @param mimeType MIME type of the file
 * @returns ProcessedFile object containing the file content and metadata
 */
export async function processFileForMultimodal(
  filePath: string,
  fileName: string, 
  mimeType: string
): Promise<ProcessedFile> {
  console.log(`[MULTIMODAL] Processing file for multimodal analysis:`, {
    fileName,
    mimeType,
    filePathLength: filePath.length,
    // For debugging purposes, show part of the path without exposing the full URL
    filePathStart: filePath.substring(0, 30) + '...',
    isRemote: isRemoteUrl(filePath)
  });
  
  let temporaryFilePath: string | null = null;
  let cleanup: (() => Promise<void>) | null = null;

  try {
    // Check if the file path is a remote URL or a local path
    let fileContent: Buffer;
    let actualFilePath = filePath;

    if (isRemoteUrl(filePath)) {
      // Download from remote URL (S3, HTTP/HTTPS, GCS)
      console.log(`[MULTIMODAL] File path is a remote URL, attempting to download`);
      try {
        const result = await downloadFromUrl(filePath, mimeType);
        fileContent = result.buffer;
        actualFilePath = result.localPath;
        temporaryFilePath = result.localPath;
        cleanup = result.cleanup;
        console.log(`[MULTIMODAL] Successfully downloaded file from remote URL, size: ${fileContent.length} bytes`);
      } catch (downloadError) {
        console.error(`[MULTIMODAL] Error downloading from URL:`, downloadError);
        throw new Error(`Failed to download file from URL: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
      }
    } else {
      // Read from local file path
      console.log(`[MULTIMODAL] File path is a local path, reading from filesystem`);
      try {
        // Check if the file exists first
        const exists = await existsAsync(filePath);
        if (!exists) {
          console.error(`[MULTIMODAL] File does not exist at path: ${filePath}`);
          throw new Error(`File does not exist at path: ${filePath}`);
        }
        
        fileContent = await fs.promises.readFile(filePath);
        console.log(`[MULTIMODAL] Successfully read local file, size: ${fileContent.length} bytes`);
      } catch (readError) {
        console.error(`[MULTIMODAL] Error reading local file:`, readError);
        throw new Error(`Failed to read local file: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
    }
    
    // Determine content type from the mime type and filename
    const contentType = getContentTypeFromMimeType(mimeType);
    console.log(`[MULTIMODAL] Determined content type: ${contentType} from MIME type: ${mimeType}`);
    
    // For text and document types, attempt to extract text content
    let textContent: string | undefined;
    if (contentType === 'text' || contentType === 'document') {
      try {
        // The filename extension might be needed for some document types
        const extension = path.extname(fileName).toLowerCase();
        console.log(`[MULTIMODAL] Attempting to extract text content from ${contentType} file with extension: ${extension}`);
        textContent = await extractTextContent(actualFilePath, mimeType, extension);
        console.log(`[MULTIMODAL] Successfully extracted text content, length: ${textContent?.length || 0} characters`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[MULTIMODAL] Failed to extract text from ${fileName}: ${errorMessage}`);
        // Continue with the process even if text extraction fails
      }
    }
    
    console.log(`[MULTIMODAL] Successfully processed file for analysis, returning result`);
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
  } finally {
    // Clean up any temporary files
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.warn('Error cleaning up temporary file:', cleanupError);
      }
    }
  }
}