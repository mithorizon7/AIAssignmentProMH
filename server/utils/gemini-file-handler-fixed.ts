/**
 * Utility for handling file uploads to Gemini's Files API
 * 
 * This version handles compatibility with different SDK versions
 * and properly manages document file types
 */

import crypto from 'crypto';
import { promises as fsp } from 'fs';
import { GoogleGenAI } from '@google/genai';
import { Redis } from 'ioredis';
import path from 'path';

// Define the file data interface 
export interface GeminiFileData {
  fileUri: string;  // camelCase format for SDK
  mimeType: string; // camelCase format for SDK
}

// Initialize Redis client for caching (fallback if unavailable)
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
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
 * Convert source data to a buffer
 */
async function fetchToBuffer(src: string | Buffer): Promise<Buffer> {
  // Already a Buffer
  if (Buffer.isBuffer(src)) {
    return src;
  }
  
  // String content
  if (typeof src === 'string') {
    // URL content
    if (src.startsWith('http') || src.startsWith('https') || src.startsWith('gs://')) {
      try {
        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`Failed to fetch from URL: ${src} (status ${res.status})`);
        }
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to download URL content: ${message}`);
      }
    }
    
    // File path
    if (src.includes('/') || src.includes('\\')) {
      try {
        return await fsp.readFile(src);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file: ${message}`);
      }
    }
    
    // Plain text data
    return Buffer.from(src);
  }
  
  throw new Error(`Invalid source type: ${typeof src}`);
}

/**
 * Create a temporary file from a buffer
 * Returns the file path and a cleanup function
 */
async function createTempFile(buffer: Buffer, extension?: string): Promise<{ 
  filePath: string, 
  cleanup: () => Promise<void> 
}> {
  const tempDir = path.join('/tmp');
  const randomId = crypto.randomBytes(8).toString('hex');
  const fileExt = extension || '.bin';
  const filePath = path.join(tempDir, `gemini-${randomId}${fileExt}`);
  
  await fsp.writeFile(filePath, buffer);
  
  return {
    filePath,
    cleanup: async () => {
      try {
        await fsp.unlink(filePath);
      } catch (error) {
        console.warn(`Failed to clean up temp file ${filePath}: ${error}`);
      }
    }
  };
}

/**
 * Create a file reference for Gemini
 * Handles different SDK versions and fallbacks
 */
export async function createFileData(
  genAI: GoogleGenerativeAI,
  source: Buffer | string,
  mimeType: string
): Promise<GeminiFileData> {
  // Get the content as a buffer
  const buffer = await fetchToBuffer(source);
  
  // Calculate hash for caching
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cacheKey = `gemini:file:${hash}:${mimeType}`;
  
  // Try to fetch from cache
  if (redis !== null) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[GEMINI] Using cached file reference for ${mimeType} (${(buffer.length / 1024).toFixed(1)}KB)`);
        return { fileUri: cached, mimeType };
      }
    } catch (err) {
      // Continue without cache if Redis fails
    }
  }
  
  // Create a temporary file
  const extension = mimeType.split('/')[1] ? `.${mimeType.split('/')[1]}` : '.bin';
  const { filePath, cleanup } = await createTempFile(buffer, extension);
  
  console.log(`[GEMINI] Uploading ${(buffer.length / 1024).toFixed(1)}KB file with MIME type ${mimeType}`);
  
  try {
    // Try different methods based on what's available in the SDK
    let fileId: string | null = null;
    
    // Method 1: files.upload (newer SDKs)
    if (typeof (genAI as any).files?.upload === 'function') {
      console.log(`[GEMINI] Using files.upload method (SDK v0.14+)`);
      try {
        const result = await (genAI as any).files.upload({
          file: filePath,
          config: { mimeType }
        });
        fileId = result?.fileId || result?.uri || result?.name;
      } catch (error) {
        console.warn(`[GEMINI] files.upload method failed: ${error}`);
        // Will try other methods
      }
    }
    
    // Method 2: uploadFile (some older SDKs)
    if (!fileId && typeof (genAI as any).uploadFile === 'function') {
      console.log(`[GEMINI] Using uploadFile method (older SDK)`);
      try {
        const result = await (genAI as any).uploadFile(filePath, { mimeType });
        fileId = result?.uri || result?.fileId || result?.name;
      } catch (error) {
        console.warn(`[GEMINI] uploadFile method failed: ${error}`);
        // Will try other methods
      }
    }
    
    // Method 3: requestFileService (some SDK versions)
    if (!fileId && (genAI as any).requestFileService) {
      console.log(`[GEMINI] Using requestFileService method`);
      try {
        const result = await (genAI as any).requestFileService().uploadFile({
          buffer,
          mimeType
        });
        fileId = result?.fileId || result?.uri || result?.name;
      } catch (error) {
        console.warn(`[GEMINI] requestFileService method failed: ${error}`);
      }
    }
    
    // Clean up the temporary file
    await cleanup();
    
    // If we couldn't upload the file, throw an error
    if (!fileId) {
      throw new Error(`Failed to upload file to Gemini: No compatible upload method found in SDK`);
    }
    
    // Cache the file ID
    if (redis !== null) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, fileId);
      } catch (err) {
        // Continue without caching
      }
    }
    
    console.log(`[GEMINI] Successfully uploaded file: ${fileId}`);
    return { fileUri: fileId, mimeType };
  } catch (error) {
    // Make sure to clean up the temp file
    await cleanup();
    
    // Re-throw the error
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`File upload failed: ${message}`);
  }
}

/**
 * Determine if a file should use Files API or inline data
 */
export function shouldUseFilesAPI(mimeType: string, contentSize: number): boolean {
  // Safety check for mimeType
  const mime = typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
  
  // Document types - always use Files API
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
  
  // Audio and video - always use Files API
  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    return true;
  }
  
  // SVG images - always use Files API
  if (mime === 'image/svg+xml') {
    return true;
  }
  
  // Large images - use Files API for anything over 5MB
  if (mime.startsWith('image/') && contentSize > MAX_INLINE_IMAGE_SIZE) {
    return true;
  }
  
  // Default to inline data for everything else
  return false;
}