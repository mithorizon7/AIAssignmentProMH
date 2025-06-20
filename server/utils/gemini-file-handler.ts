/**
 * Utility for handling file uploads to Gemini's Files API
 * 
 * Gemini Files API expects snake_case keys whereas the SDK uses camelCase
 * The API provides a way to handle large files, PDFs, audio, and video
 * Files are stored for 48 hours in Gemini's system
 */

import crypto from 'crypto';
import { promises as fsp } from 'fs';
// Import the GoogleGenAI for file handling
import { GoogleGenAI } from '@google/genai';

// Use a more flexible type for the Google Gemini AI client
// This allows us to support different SDK versions without type errors
type GoogleAIClient = any;
import { Redis } from 'ioredis';
// Define the file data interface locally to avoid circular dependencies
// Updated to match the format expected by the current SDK version
export interface GeminiFileData {
  fileUri: string;  // camelCase format for SDK
  mimeType: string; // camelCase format for SDK
}

// Disable Redis caching to eliminate localhost connection attempts
const redis: Redis | null = null;

// Size thresholds
export const MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const CACHE_TTL = 47 * 60 * 60; // 47 hours (just under Gemini's 48-hour limit)

/**
 * Fetch a file from URL or local path and convert to Buffer
 */
async function fetchToBuffer(src: string | Buffer): Promise<Buffer> {
  // If already a Buffer, return it directly
  if (Buffer.isBuffer(src)) {
    return src;
  }
  
  // Handle URL or local file path
  if (typeof src === 'string') {
    if (src.startsWith('gs://') || src.startsWith('http')) {
      try {
        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`Failed to download file from URL: ${src} (status: ${res.status})`);
        }
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching URL: ${errorMessage}`);
        throw new Error(`Failed to download file from URL: ${errorMessage}`);
      }
    }
    
    // Only try to read from filesystem if it looks like a file path
    // This prevents trying to read MIME types as file paths
    // Fixed logic to avoid always evaluating to true 
    if (src.includes('/') || src.includes('\\')) {
      try {
        const fileBuffer = await fsp.readFile(src); // local path
        return fileBuffer;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`File read error: ${errorMessage}`);
        throw new Error(`Failed to read file from path: ${errorMessage}`);
      }
    }
  }
  
  // If we reach here, it's not a valid source
  throw new Error(`Invalid file source: ${typeof src === 'string' ? src : 'non-string value'}`);
}

/**
 * Convert a Buffer or URL to a Gemini Files API entry
 * 
 * This function:
 * 1. Checks the cache to see if we've already uploaded this file
 * 2. Uploads the file to Gemini Files API if not in cache
 * 3. Returns a properly formatted file reference with camelCase properties
 * 
 * @param genAI Initialized Google GenAI client
 * @param source File content as Buffer or URL string
 * @param mimeType MIME type of the file
 * @returns File reference with camelCase properties
 */
export async function createFileData(
  genAI: GoogleAIClient,
  source: Buffer | string,
  mimeType: string
): Promise<GeminiFileData> {
  // Convert source to Buffer if needed
  const buf = await fetchToBuffer(source);
  
  // Generate hash to use as cache key
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const cacheKey = `gemini:file:${hash}:${mimeType}`;
  
  // Check if we've already uploaded this file (if Redis is available)
  if (redis !== null) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { fileUri: cached, mimeType: mimeType };
      }
    } catch (err) {
      // Continue without caching if Redis fails
    }
  }
  
  try {
    // For Node.js, save the buffer to a temporary file
    // This is the recommended approach for reliable file handling
    const tempFilePath = `/tmp/gemini-upload-${crypto.randomBytes(8).toString('hex')}`;
    await fsp.writeFile(tempFilePath, buf);
    
    // Upload using the current SDK method for file uploads
    // Handle both version formats for backwards compatibility
    let file;
    try {
      // First try the newer SDK format if available
      if (genAI.files && typeof genAI.files.upload === 'function') {
        file = await genAI.files.upload({
          file: tempFilePath,
          config: { mimeType: mimeType }
        });
      } else if (genAI.uploadFile) {
        // Fallback to older SDK format if needed
        file = await genAI.uploadFile(tempFilePath, { mimeType });
      } else {
        throw new Error("No compatible file upload method found in Gemini SDK");
      }
    } catch (uploadError) {
      const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
      console.error(`[GEMINI] File upload error: ${errorMsg}`);
      throw new Error(`Failed to upload file to Gemini: ${errorMsg}`);
    }
    
    // Clean up the temp file after successful upload
    try {
      await fsp.unlink(tempFilePath);
    } catch (error) {
      // Silent cleanup failure - this isn't critical
    }
    
    // Cache the file URI for future use (if Redis is available)
    if (redis !== null && file && file.uri) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, file.uri);
      } catch (err) {
        // Continue without caching
      }
    }
    
    // Ensure we have a valid URI before returning
    // Handle both fileId (newer SDK) and uri (older SDK) formats
    const fileUri = file?.fileId || file?.uri || file?.name || null;
    
    if (!fileUri) {
      throw new Error("File upload failed: No valid file identifier returned from Gemini API");
    }
    
    console.log(`[GEMINI] Successfully uploaded file to Gemini, identifier: ${fileUri}`);
    return { fileUri: fileUri, mimeType: mimeType };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload file to Gemini: ${errorMessage}`);
  }
}

// toSDKFormat function has been removed as it's now obsolete
// We're using proper typing instead of conversion functions

/**
 * Determine if a file should be sent as inline data or uploaded to Files API
 * 
 * @param content The file content as a Buffer
 * @param mimeType File MIME type
 * @returns true if file should be uploaded to Files API
 */
export function shouldUseFilesAPI(mimeType: string, contentSize: number): boolean {
  // Safety check to ensure mimeType is a string
  const mime = typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  
  // Always use Files API for PDF, audio, or video
  if (
    mime.startsWith('application/pdf') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/')
  ) {
    return true;
  }
  
  // Always use Files API for document content types
  if (
    mime.includes('document') ||
    mime.includes('msword') ||
    mime.includes('wordprocessing') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('openxmlformats') // Covers docx, xlsx, pptx
  ) {
    // Document types always use Files API
    return true;
  }
  
  // Use Files API for large images
  if (mime.startsWith('image/') && contentSize > MAX_INLINE_IMAGE_SIZE) {
    return true;
  }
  
  return false;
}
