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
// Import GCS client properly - will be available throughout the module 
import * as gcsClient from './gcs-client';

const readFileAsync = promisify(fs.readFile);
// fs.exists does not follow the Node callback convention, so promisify will
// mis-handle its boolean argument. Use fs.promises.access instead.
const existsAsync = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};
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
 * Interface for GCS file download result
 */
interface GcsDownloadResult {
  buffer: Buffer;
  metadata?: {
    contentType?: string;
    size?: any; // Could be string or number based on GCS SDK behavior
    [key: string]: any;
  };
}

/**
 * Downloads a file from Google Cloud Storage using the gs:// URL format
 * @param url The GCS URL in the format gs://bucket-name/path/to/file
 * @param mimeType Optional MIME type of the file
 * @returns The file buffer and metadata
 */
async function downloadFromGCS(url: string, mimeType?: string): Promise<GcsDownloadResult> {
  console.log(`[GCS] Downloading file from GCS URL: ${url}`);
  
  // Parse the GCS URL (format: gs://bucket-name/path/to/file)
  if (!url.startsWith('gs://')) {
    throw new Error(`Invalid GCS URL format: ${url}. Expected format: gs://bucket-name/path/to/file`);
  }
  
  const gcsPath = url.replace('gs://', '');
  const [bucketFromUrl, ...objectPathParts] = gcsPath.split('/');
  
  // Validate that we have a non-empty object path
  if (!objectPathParts || objectPathParts.length === 0) {
    throw new Error(`Invalid GCS URL format: ${url}. Missing object path.`);
  }
  
  const objectPath = objectPathParts.join('/');
  
  // Determine which bucket to use (from URL or default)
  const targetBucket = bucketFromUrl || gcsClient.bucketName;
  if (!targetBucket) {
    throw new Error('No bucket specified in GCS URL and no default bucket configured');
  }
  
  console.log(`[GCS] Accessing bucket: ${targetBucket}, object path: ${objectPath}`);
  
  // First try to get a signed URL and use HTTP fetch (more reliable for larger files)
  try {
    console.log(`[GCS] Attempting to get signed URL for GCS object`);
    const signedUrl = await gcsClient.generateSignedUrl(objectPath, 60); // 60 minutes expiration
    
    if (!signedUrl || !signedUrl.startsWith('http')) {
      throw new Error('Invalid signed URL generated');
    }
    
    console.log(`[GCS] Successfully got signed URL, downloading via HTTP`);
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download from signed URL: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Get metadata from response headers
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.log(`[GCS] Successfully downloaded from GCS signed URL, file size: ${buffer.length} bytes`);
    return {
      buffer,
      metadata: {
        contentType: contentType || mimeType,
        size: contentLength ? parseInt(contentLength, 10) : buffer.length
      }
    };
  } catch (signedUrlError) {
    // If signed URL fails, try direct download
    const errorMsg = signedUrlError instanceof Error ? signedUrlError.message : String(signedUrlError);
    console.warn(`[GCS] Failed to use signed URL approach: ${errorMsg}, falling back to direct download`);
    
    try {
      // Get the bucket and file objects for direct download
      const bucket = gcsClient.getBucket(); // Uses default bucket
      const file = bucket.file(objectPath);
      
      // Download the file directly
      console.log(`[GCS] Downloading directly from GCS bucket: ${targetBucket}, object: ${objectPath}`);
      const [fileData] = await file.download();
      
      // Get metadata about the file
      const [metadata] = await file.getMetadata();
      
      console.log(`[GCS] Successfully downloaded directly from GCS, file size: ${fileData.length} bytes`);
      return {
        buffer: fileData,
        metadata: {
          contentType: metadata.contentType || mimeType,
          size: fileData.length, // Use the actual buffer length directly
          ...metadata
        }
      };
    } catch (directError) {
      const directErrorMsg = directError instanceof Error ? directError.message : String(directError);
      console.error(`[GCS] Failed direct download from GCS: ${directErrorMsg}`);
      throw new Error(`Failed to download file from GCS: ${directErrorMsg}`);
    }
  }
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
  if (!path) {
    console.log('[MULTIMODAL] Empty path provided to isRemoteUrl');
    return false;
  }
  
  console.log(`[MULTIMODAL] Checking if path is remote URL: ${path.substring(0, 30)}${path.length > 30 ? '...' : ''}`);
  
  try {
    // Check if it's a valid URL first
    try {
      // This will throw if the URL is invalid
      new URL(path);
      console.log('[MULTIMODAL] Path is a valid URL with protocol');
      return true;
    } catch (e) {
      // Not a valid URL with protocol - continue checks
    }
    
    // First, check for standard URL protocols
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('gs://')) {
      console.log('[MULTIMODAL] Path is definitely a remote URL (has protocol)');
      return true;
    }
    
    // Check for GCS storage.googleapis.com URLs
    if (path.includes('storage.googleapis.com') || path.includes('googleusercontent.com')) {
      console.log('[MULTIMODAL] Path is a GCS URL (storage.googleapis.com or googleusercontent.com)');
      return true;
    }
    
    // Check for potential GCS object paths that should be converted to signed URLs
    // Logic fix: proper grouping of conditions with parentheses to avoid incorrect evaluation
    const isPotentialGcsPath = 
      path.startsWith('/') === false && // Not an absolute local path
      path.includes('/') && // Has at least one folder separator
      !path.includes('\\') && // Not a Windows-style path
      (path.startsWith('submissions/') || path.startsWith('anonymous-submissions/')); // Specific GCS path patterns
    
    if (isPotentialGcsPath) {
      console.log('[MULTIMODAL] Path is a GCS object path (matches submission pattern)');
      return true;
    }
    
    // If the file doesn't exist locally but has path separators, it's likely a remote path
    const hasPathSeparators = path.includes('/');
    const fileExistsLocally = fs.existsSync(path);
    
    if (hasPathSeparators && !fileExistsLocally) {
      console.log('[MULTIMODAL] Path contains separators but file not found locally - treating as remote');
      return true;
    }
    
    console.log('[MULTIMODAL] Path appears to be a local file path');
    return false;
  } catch (error) {
    console.error('[MULTIMODAL] Error in isRemoteUrl check:', error);
    // Default to treating it as remote if we can't determine
    return true;
  }
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
    // Prevent logging full GCS URLs (which might contain sensitive signed URL data)
    // But provide enough to debug issues
    const isGcsSignedUrl = url.includes('storage.googleapis.com') && url.includes('Signature=');
    const urlPreview = isGcsSignedUrl
      ? `https://storage.googleapis.com/...[signed-url]...`
      : url.substring(0, Math.min(30, url.length)) + (url.length > 30 ? '...' : '');
      
    console.log(`[DOWNLOAD] Downloading file from URL: ${urlPreview} (type: ${isGcsSignedUrl ? 'GCS signed URL' : url.startsWith('gs://') ? 'GCS URI' : 'HTTP URL'})`);
    
    // Validate URL
    if (!url || url.trim() === '') {
      throw new Error('Empty URL provided to downloadFromUrl');
    }
    
    // Generate a temporary file path
    const tempDir = os.tmpdir();
    const randomName = crypto.randomBytes(16).toString('hex');
    
    // Parse extension from URL or MIME type
    let extension: string;
    if (mimeType) {
      const parts = mimeType.split('/');
      // For application types, use the subtype (e.g., pdf from application/pdf)
      // For other types, use the second part directly
      extension = `.${parts[1]}`;
    } else if (url.includes('.') && !url.startsWith('gs://') && !isGcsSignedUrl) {
      // Extract extension from URL for regular URLs only (not GCS)
      const urlPath = new URL(url).pathname;
      extension = path.extname(urlPath) || '.tmp';
    } else {
      extension = '.tmp';
    }
    
    const localPath = path.join(tempDir, `${randomName}${extension}`);
    console.log(`[DOWNLOAD] Using temp file path: ${localPath}`);
    
    // Handle different URL types
    let fileBuffer: Buffer;
    
    if (url.startsWith('gs://')) {
      // For direct GCS URLs, use our specialized downloadFromGCS function
      console.log(`[DOWNLOAD] Detected GCS URL (gs:// protocol): ${url}`);
      try {
        // Use our dedicated GCS download function
        const { buffer, metadata } = await downloadFromGCS(url, mimeType);
        fileBuffer = buffer;
        
        // If we got metadata with content type, use it when no explicit type was provided
        if (metadata?.contentType && !mimeType) {
          mimeType = metadata.contentType;
          console.log(`[DOWNLOAD] Using content type from GCS metadata: ${mimeType}`);
        }
        
        // Write to temp file for operations that need a file path
        await writeFileAsync(localPath, fileBuffer);
        console.log(`[DOWNLOAD] Wrote GCS file data to temporary path: ${localPath} (${fileBuffer.length} bytes)`);
      } catch (gcsError) {
        console.error('[DOWNLOAD] Error downloading from GCS:', gcsError);
        throw new Error(`Failed to download file from GCS: ${gcsError instanceof Error ? gcsError.message : String(gcsError)}`);
      }
    } else {
      // Standard HTTP/HTTPS URLs (including GCS signed URLs)
      console.log(`[DOWNLOAD] Standard HTTP URL detected, using fetch`);
      try {
        // Check if this is a GCS object path without gs:// prefix
        if ((url.startsWith('submissions/') || url.startsWith('anonymous-submissions/')) && 
            !url.startsWith('http')) {
          // Try to convert to a GCS URL and use downloadFromGCS
          if (gcsClient.isGcsConfigured()) {
            const gcsUrl = `gs://${gcsClient.bucketName}/${url}`;
            console.log(`[DOWNLOAD] Converting relative path to GCS URL: ${gcsUrl}`);
            
            const { buffer, metadata } = await downloadFromGCS(gcsUrl, mimeType);
            fileBuffer = buffer;
            
            if (metadata?.contentType && !mimeType) {
              mimeType = metadata.contentType;
            }
            
            await writeFileAsync(localPath, fileBuffer);
            console.log(`[DOWNLOAD] Wrote GCS file data to temporary path: ${localPath}`);
          } else {
            throw new Error(`Cannot process GCS path ${url} - GCS not configured`);
          }
        } else {
          // Regular HTTP(S) URL or signed GCS URL
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
          
          // If no MIME type was provided, use the Content-Type header
          if (!mimeType && response.headers.get('content-type')) {
            mimeType = response.headers.get('content-type') || undefined;
          }
          
          console.log(`[DOWNLOAD] Successfully downloaded via HTTP, file size: ${fileBuffer.length} bytes`);
          
          // Write to temp file for operations that need a file path
          await writeFileAsync(localPath, fileBuffer);
          console.log(`[DOWNLOAD] Wrote HTTP file data to temporary path: ${localPath}`);
        }
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
  // Safe guard against undefined or null paths
  if (!filePath) {
    console.error(`[MULTIMODAL] Invalid file path: ${filePath}`);
    throw new Error("Invalid file path: File path cannot be empty or undefined");
  }
  
  console.log(`[MULTIMODAL] Processing file for multimodal analysis:`, {
    fileName: fileName || 'unnamed-file',
    mimeType: mimeType || 'application/octet-stream',
    filePathLength: filePath.length,
    // For debugging purposes, show part of the path without exposing the full URL
    filePathStart: filePath.substring(0, Math.min(30, filePath.length)) + (filePath.length > 30 ? '...' : ''),
    isGcsPath: filePath.startsWith('submissions/') || filePath.startsWith('anonymous-submissions/'),
    isSignedUrl: filePath.includes('storage.googleapis.com') && filePath.includes('Signature='),
    imageType: mimeType?.startsWith('image/') ? mimeType : 'not-image'
  });
  
  let temporaryFilePath: string | null = null;
  let cleanup: (() => Promise<void>) | null = null;

  try {
    // Check if the file path is a remote URL, GCS path, or a local path
    let fileContent: Buffer;
    let actualFilePath = filePath;
    
    // Handle GCS path that's not yet converted to a URL
    if ((filePath.startsWith('submissions/') || filePath.startsWith('anonymous-submissions/')) && 
        !filePath.startsWith('http')) {
      
      console.log(`[MULTIMODAL] File path is a GCS object path: ${filePath}`);
      
      // Check if GCS credentials are available
      if (gcsClient.isGcsConfigured()) {
        // Convert to proper gs:// format for our specialized downloadFromGCS function
        filePath = `gs://${gcsClient.bucketName}/${filePath}`;
        console.log(`[MULTIMODAL] Converted to GCS URI format for direct download: ${filePath}`);
      } else {
        console.warn(`[MULTIMODAL] GCS not configured in development mode. Cannot process file from GCS path: ${filePath}`);
        // In development mode without GCS, we cannot process files that were "uploaded" to GCS paths
        // This is expected behavior - we need either proper GCS setup or file content available elsewhere
        throw new Error(`Cannot process GCS path ${filePath} - GCS not configured`);
      }
    }

    if (isRemoteUrl(filePath)) {
      // Download from remote URL (HTTP/HTTPS, GCS)
      console.log(`[MULTIMODAL] File path is a remote URL, attempting to download: ${filePath.substring(0, 30)}...`);
      try {
        const downloadResult = await downloadFromUrl(filePath, mimeType);
        fileContent = downloadResult.buffer;
        temporaryFilePath = downloadResult.localPath;
        cleanup = downloadResult.cleanup;
        
        console.log(`[MULTIMODAL] Successfully downloaded file from URL, size: ${fileContent.length} bytes`);
        
        // Use the temporary file path for further processing
        actualFilePath = temporaryFilePath;
      } catch (downloadError) {
        console.error(`[MULTIMODAL] Error downloading file from URL:`, downloadError);
        throw new Error(`Failed to download file: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
      }
    } else {
      // Local file path
      try {
        console.log(`[MULTIMODAL] File path is a local path, reading directly: ${filePath}`);
        fileContent = await readFileAsync(filePath);
        actualFilePath = filePath;
        console.log(`[MULTIMODAL] Successfully read local file, size: ${fileContent.length} bytes`);
      } catch (readError) {
        console.error(`[MULTIMODAL] Error reading local file:`, readError);
        throw new Error(`Failed to read local file: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
    }
    
    // Determine content type from MIME type
    const contentType = getContentTypeFromMimeType(mimeType);
    console.log(`[MULTIMODAL] Determined content type: ${contentType} for MIME type: ${mimeType}`);
    
    // Extract text content if applicable
    let textContent: string | undefined;
    
    if (contentType === 'text' || contentType === 'document') {
      try {
        textContent = await extractTextContent(actualFilePath, mimeType, fileName);
        console.log(`[MULTIMODAL] Extracted text content (${textContent?.length || 0} chars)`);
      } catch (extractError) {
        console.warn(`[MULTIMODAL] Failed to extract text content:`, extractError);
        // Continue processing without text content
      }
    }
    
    // Return processed file
    return {
      content: fileContent,
      contentType,
      mimeType,
      textContent
    };
  } catch (error) {
    console.error(`[MULTIMODAL] Error processing file for multimodal analysis:`, error);
    throw new Error(`Failed to process file for multimodal analysis: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Clean up temporary files if needed
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.warn(`[MULTIMODAL] Error during cleanup:`, cleanupError);
      }
    }
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