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
import { Redis } from 'ioredis';
// Define the file data interface locally to avoid circular dependencies
// Updated to match the format expected by the current SDK version
export interface GeminiFileData {
  fileUri: string;  // camelCase format for SDK
  mimeType: string; // camelCase format for SDK
}

// Initialize Redis client for caching file URIs (with fallback if unavailable)
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  // Handle connection errors gracefully
  redis.on('error', (err) => {
    console.warn(`[REDIS] Connection error (file caching will be disabled): ${err.message}`);
    redis = null;
  });
} catch (err) {
  console.warn(`[REDIS] Failed to initialize Redis: ${err instanceof Error ? err.message : String(err)}`);
}

// Size thresholds
export const MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const CACHE_TTL = 47 * 60 * 60; // 47 hours (just under Gemini's 48-hour limit)

/**
 * Fetch a file from URL or local path and convert to Buffer
 */
async function fetchToBuffer(src: string | Buffer): Promise<Buffer> {
  console.log(`[FETCHBUFFER] Processing source type: ${typeof src}, ${Buffer.isBuffer(src) ? 'is Buffer' : 'not Buffer'}`);
  if (typeof src === 'string') {
    console.log(`[FETCHBUFFER] String source: ${src.substring(0, 50)}...`);
  }
  
  // If already a Buffer, return it directly
  if (Buffer.isBuffer(src)) {
    console.log(`[FETCHBUFFER] Returning existing buffer of size ${src.length} bytes`);
    return src;
  }
  
  // Handle URL or local file path
  if (typeof src === 'string') {
    if (src.startsWith('gs://') || src.startsWith('http')) {
      console.log(`[FETCHBUFFER] Fetching from URL: ${src}`);
      try {
        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`Failed to download file from URL: ${src} (status: ${res.status})`);
        }
        const arrayBuffer = await res.arrayBuffer();
        console.log(`[FETCHBUFFER] Successfully downloaded ${arrayBuffer.byteLength} bytes from URL`);
        return Buffer.from(arrayBuffer);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[FETCHBUFFER] Error fetching URL: ${errorMessage}`);
        throw new Error(`Failed to download file from URL: ${errorMessage}`);
      }
    }
    
    // Only try to read from filesystem if it looks like a file path
    // This prevents trying to read MIME types as file paths
    if (src.includes('/') || src.includes('\\') || !src.includes('/')) {
      try {
        console.log(`[FETCHBUFFER] Reading from file system: ${src}`);
        const fileBuffer = await fsp.readFile(src); // local path
        console.log(`[FETCHBUFFER] Successfully read ${fileBuffer.length} bytes from file`);
        return fileBuffer;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[FETCHBUFFER] File read error: ${errorMessage}`);
        throw new Error(`Failed to read file from path: ${errorMessage}`);
      }
    }
  }
  
  // If we reach here, it's not a valid source
  console.error(`[FETCHBUFFER] Invalid source type or format`);
  throw new Error(`Invalid file source: ${typeof src === 'string' ? src : 'non-string value'}`);
}

/**
 * Convert a Buffer or URL to a Gemini Files API entry
 * 
 * This function:
 * 1. Checks the cache to see if we've already uploaded this file
 * 2. Uploads the file to Gemini Files API if not in cache
 * 3. Returns a proper Files API reference format
 * 
 * @param genAI Initialized Google GenAI client
 * @param source File content as Buffer or URL string
 * @param mimeType MIME type of the file
 * @returns File reference in snake_case format for API
 */
export async function createFileData(
  genAI: GoogleGenAI,
  source: Buffer | string,
  mimeType: string
): Promise<GeminiFileData> {
  // Use fetchToBuffer to handle the different source types
  // This function properly converts string paths/URLs to Buffers
  const buf = await fetchToBuffer(source);
  
  // Generate hash to use as cache key
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const cacheKey = `gemini:file:${hash}:${mimeType}`;
  
  // Check if we've already uploaded this file (if Redis is available)
  let cached = null;
  if (redis !== null) {
    try {
      cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[GEMINI] Using cached file URI for ${mimeType} (${buf.length} bytes)`);
        return { file_uri: cached, mime_type: mimeType };
      }
    } catch (err) {
      console.warn(`[GEMINI] Redis cache lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      // Continue without caching if Redis fails
    }
  } else {
    console.log(`[GEMINI] Redis not available, file caching disabled`);
  }
  
  // Upload file to Gemini Files API
  console.log(`[GEMINI] Uploading ${buf.length} bytes (${mimeType}) to Files API`);
  try {
    // Add more detailed logging to help debug the issue
    console.log(`[GEMINI] Buffer type: ${typeof buf}, isBuffer: ${Buffer.isBuffer(buf)}, length: ${buf.length}`);
    
    // Updated to match the latest SDK format (v0.14.0+)
    // For Node.js, we need to save the buffer to a temporary file and provide the path
    // This is the most reliable approach as recommended in the migration guide
    const tempFilePath = `/tmp/gemini-upload-${crypto.randomBytes(8).toString('hex')}`;
    await fsp.writeFile(tempFilePath, buf);
    
    const file = await genAI.files.upload({
      file: tempFilePath,
      config: { mimeType: mimeType }
    });
    
    // Clean up the temp file after successful upload
    try {
      await fsp.unlink(tempFilePath);
    } catch (error) {
      const cleanupError = error as Error;
      console.warn(`[GEMINI] Could not clean up temp file: ${cleanupError.message}`);
    }
    console.log(`[GEMINI] File uploaded successfully, URI: ${file.uri}`);
    
    // Cache the file URI for future use (if Redis is available)
    if (redis !== null && file && file.uri) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, file.uri);
        console.log(`[GEMINI] Cached file URI for future use (TTL: ${CACHE_TTL}s)`);
      } catch (err) {
        console.warn(`[GEMINI] Failed to cache file URI: ${err instanceof Error ? err.message : String(err)}`);
        // Continue without caching
      }
    }
    
    // Ensure we have a valid URI before returning
    if (!file || !file.uri) {
      throw new Error("File upload failed: No URI returned from Gemini API");
    }
    
    return { file_uri: file.uri, mime_type: mimeType };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GEMINI] File upload failed: ${errorMessage}`);
    throw new Error(`Failed to upload file to Gemini: ${errorMessage}`);
  }
}

/**
 * Convert snake_case file data to raw file_data structure for Gemini API
 * 
 * The Gemini API expects data in a specific format with correct casing
 */
export function toSDKFormat(fileData: { file_uri: string; mime_type: string }) {
  // Create a properly formatted file_data structure for the API
  return {
    file_data: {
      file_uri: fileData.file_uri,
      mime_type: fileData.mime_type
    }
  };
}

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
    console.log(`[GEMINI] Using Files API for document type: ${mime}`);
    return true;
  }
  
  // Use Files API for large images
  if (mime.startsWith('image/') && contentSize > MAX_INLINE_IMAGE_SIZE) {
    return true;
  }
  
  return false;
}
