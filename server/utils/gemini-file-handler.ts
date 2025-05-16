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
async function fetchToBuffer(src: string): Promise<Buffer> {
  if (src.startsWith('gs://') || src.startsWith('http')) {
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`Failed to download file from URL: ${src} (status: ${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  return fsp.readFile(src); // local path
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
  // Convert to buffer if it's a URL or path
  const buf = Buffer.isBuffer(source) ? source : await fetchToBuffer(source);
  
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
 * Convert snake_case file data to camelCase for SDK use
 */
export function toSDKFormat(fileData: { file_uri: string; mime_type: string }) {
  return {
    fileUri: fileData.file_uri,
    mimeType: fileData.mime_type
  };
}

/**
 * Determine if a file should be sent as inline data or uploaded to Files API
 * 
 * @param mimeType File MIME type
 * @param size File size in bytes
 * @returns true if file should be uploaded to Files API
 */
export function shouldUseFilesAPI(mimeType: string, size: number): boolean {
  // Always use Files API for PDF, audio, or video
  if (
    mimeType.startsWith('application/pdf') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/')
  ) {
    return true;
  }
  
  // Use Files API for large images
  if (mimeType.startsWith('image/') && size > MAX_INLINE_IMAGE_SIZE) {
    return true;
  }
  
  return false;
}