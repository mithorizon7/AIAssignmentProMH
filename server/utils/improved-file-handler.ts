/**
 * Improved utility for handling file uploads to Gemini's Files API
 * 
 * This version is designed to work with Gemini SDK v0.14.0+
 * and properly handles different file types including documents
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import redisClient from '../queue/redis';

// Define the file data interface in the format expected by the Gemini API
export interface GeminiFileData {
  fileUri: string;  // camelCase format as used by the SDK
  mimeType: string; // camelCase format as used by the SDK
}

// Size threshold constants
export const MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const CACHE_TTL = 47 * 60 * 60; // 47 hours (just under Gemini's 48-hour limit)

// Disable Redis caching for file handlers to eliminate connection attempts
const redis = null;

/**
 * Convert different source formats (URL, file path, Buffer, string) to a Buffer
 */
async function fetchToBuffer(source: string | Buffer): Promise<Buffer> {
  // Already a Buffer
  if (Buffer.isBuffer(source)) {
    return source;
  }
  
  // String content (URL, file path, or raw string)
  if (typeof source === 'string') {
    // URL - fetch content
    if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('gs://')) {
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${source} (status: ${response.status})`);
        }
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to download from URL: ${message}`);
      }
    }
    
    // File path - read file
    if (source.includes('/') || source.includes('\\')) {
      try {
        return await fs.readFile(source);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file: ${message}`);
      }
    }
    
    // Raw string content (convert to Buffer)
    return Buffer.from(source);
  }
  
  throw new Error(`Invalid source type: ${typeof source}`);
}

/**
 * Create a temporary file from content
 * Returns the file path and a cleanup function
 */
async function createTempFile(buffer: Buffer, extension = '.bin'): Promise<{ 
  filePath: string, 
  cleanup: () => Promise<void> 
}> {
  const tempDir = '/tmp';
  const filename = `gemini-${crypto.randomBytes(8).toString('hex')}${extension}`;
  const filePath = path.join(tempDir, filename);
  
  await fs.writeFile(filePath, buffer);
  
  return {
    filePath,
    cleanup: async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`[GEMINI] Failed to clean up temp file ${filePath}: ${error}`);
      }
    }
  };
}

/**
 * Create a file data reference for the Gemini API
 * This function handles uploading files to the Gemini Files API
 * 
 * @param genAI - The initialized Google GenAI client
 * @param source - File content (Buffer, URL, file path, or string)
 * @param mimeType - MIME type of the file
 * @returns GeminiFileData object with fileUri and mimeType
 */
export async function createFileData(
  genAI: any,  // Use 'any' to avoid SDK version compatibility issues
  source: string | Buffer,
  mimeType: string
): Promise<GeminiFileData> {
  // Convert source to Buffer
  const buffer = await fetchToBuffer(source);
  
  // Generate hash for caching
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cacheKey = `gemini:file:${hash}:${mimeType}`;
  
  // Check cache first (if Redis is available)
  if (redis !== null) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[GEMINI] Using cached file reference: ${cached}`);
        return { fileUri: cached, mimeType };
      }
    } catch (error) {
      // Continue without cache if Redis fails
    }
  }
  
  // Create a temporary file for uploading
  const extension = mimeType.split('/')[1] ? `.${mimeType.split('/')[1]}` : '.bin';
  const { filePath, cleanup } = await createTempFile(buffer, extension);
  
  console.log(`[GEMINI] Uploading ${(buffer.length / 1024).toFixed(1)}KB file with MIME type ${mimeType}`);
  
  try {
    // Try different upload methods based on SDK version
    let fileId: string | null = null;
    
    // First try files.upload method (SDK v0.14.0+)
    if (genAI.files && typeof genAI.files.upload === 'function') {
      console.log('[GEMINI] Using files.upload method (SDK v0.14.0+)');
      try {
        const result = await genAI.files.upload({
          file: filePath,
          config: { mimeType }
        });
        fileId = result?.fileId || result?.uri || result?.name;
      } catch (error) {
        console.warn(`[GEMINI] files.upload method failed: ${error}`);
      }
    }
    
    // Try uploadFile method (some SDK versions)
    if (!fileId && typeof genAI.uploadFile === 'function') {
      console.log('[GEMINI] Using uploadFile method');
      try {
        const result = await genAI.uploadFile(filePath, { mimeType });
        fileId = result?.uri || result?.fileId || result?.name;
      } catch (error) {
        console.warn(`[GEMINI] uploadFile method failed: ${error}`);
      }
    }
    
    // Clean up the temporary file
    await cleanup();
    
    // If we couldn't upload the file with any method
    if (!fileId) {
      throw new Error('Failed to upload file: No compatible upload method found in Gemini SDK');
    }
    
    // Cache the file ID (if Redis is available)
    if (redis !== null) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, fileId);
      } catch (error) {
        // Continue without caching
      }
    }
    
    console.log(`[GEMINI] Successfully uploaded file: ${fileId}`);
    return { fileUri: fileId, mimeType };
    
  } catch (error) {
    // Clean up the temporary file on error
    await cleanup();
    
    // Re-throw with a helpful message
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload file to Gemini: ${message}`);
  }
}

/**
 * Determine if a file should use the Files API or inline data
 * 
 * @param mimeType - MIME type of the file
 * @param contentSize - Size of the file content in bytes
 * @returns true if the file should use the Files API, false for inline data
 */
export function shouldUseFilesAPI(mimeType: string, contentSize: number): boolean {
  // Safety check for mimeType
  const mime = typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  
  // Always use Files API for documents
  if (
    mime === 'application/pdf' || 
    mime.includes('document') ||
    mime.includes('msword') ||
    mime.includes('wordprocessing') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('openxmlformats') // Covers docx, xlsx, pptx
  ) {
    return true;
  }
  
  // Always use Files API for audio and video
  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    return true;
  }
  
  // Always use Files API for SVG images (regardless of size)
  if (mime === 'image/svg+xml') {
    return true;
  }
  
  // Use Files API for large images, inline data for small images
  if (mime.startsWith('image/') && contentSize > MAX_INLINE_IMAGE_SIZE) {
    return true;
  }
  
  // Default to inline data for everything else (small images)
  return false;
}