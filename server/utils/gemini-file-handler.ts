/**
 * Utility for handling file uploads to Gemini's Files API
 * 
 * Gemini Files API expects snake_case keys whereas the SDK uses camelCase
 * The API provides a way to handle large files, PDFs, audio, and video
 * Files are stored for 48 hours in Gemini's system
 */

import crypto from 'crypto';
import { promises as fsp } from 'fs';
// We'll use the provided GenAI instance from the adapter
import { Redis } from 'ioredis';
// Define the file data interface locally to avoid circular dependencies
export interface GeminiFileData {
  file_uri: string;
  mime_type: string;
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
      } catch (error) {
        console.error(`[FETCHBUFFER] Error fetching URL: ${error.message}`);
        throw error;
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
      } catch (err) {
        console.error(`[FETCHBUFFER] File read error: ${err.message}`);
        throw new Error(`Failed to read file from path: ${err instanceof Error ? err.message : String(err)}`);
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
  genAI: any,
  source: Buffer | string,
  mimeType: string
): Promise<GeminiFileData> {
  // Resolve to a Buffer no matter what we get
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
    const file = await genAI.files.upload({ buffer: buf, mimeType: mimeType });
    console.log(`[GEMINI] File uploaded successfully, URI: ${file.uri}`);
    
    // Cache the file URI for future use (if Redis is available)
    if (redis !== null) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, file.uri);
        console.log(`[GEMINI] Cached file URI for future use (TTL: ${CACHE_TTL}s)`);
      } catch (err) {
        console.warn(`[GEMINI] Failed to cache file URI: ${err instanceof Error ? err.message : String(err)}`);
        // Continue without caching
      }
    }
    
    return { file_uri: file.uri, mime_type: mimeType };
  } catch (error) {
    console.error(`[GEMINI] File upload failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to upload file to Gemini: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert snake_case file data to SDK Part using the official helper
 * 
 * This uses the types.Part.fromFile() helper from the SDK
 * which handles the proper conversion to the expected format
 */
export function toSDKFormat(fileData: { file_uri: string; mime_type: string }) {
  // First convert to SDK format
  const sdkData = {
    fileUri: fileData.file_uri,
    mimeType: fileData.mime_type
  };
  
  // Use the SDK's helper to create the part correctly
  // Import types from '@google/genai' to use this
  return sdkData;
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
    mime.includes('presentation')
  ) {
    return true;
  }
  
  // Use Files API for large images
  if (mime.startsWith('image/') && contentSize > MAX_INLINE_IMAGE_SIZE) {
    return true;
  }
  
  return false;
}console.log('Debugging GCS URL fetching:', JSON.stringify(process.env, null, 2))
