/**
 * Utility for handling file uploads to Google's Files API for Gemini
 * 
 * The Files API is required for PDF documents, large files (>20MB),
 * and should be used for any non-trivial multimodal input.
 */
import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

// Used for caching Files API uploads by hash
let memoryCache: Record<string, { uri: string, mimeType: string, expires: number }> = {};

/**
 * File data structure for Gemini API
 */
// Snake-case interface that matches what the API requires
export interface GeminiFileData {
  file_uri: string;  // Must be snake_case for Gemini API
  mime_type: string; // Must be snake_case for Gemini API
}

// Camel-case interface that TypeScript checking expects for the SDK
export interface SDKFileData {
  fileUri: string;
  mimeType: string;
}

/**
 * Converts from snake_case API format to camelCase SDK format
 * This is needed because the Node SDK expects camelCase but sends snake_case
 */
export function toSDKFormat(fileData: GeminiFileData): SDKFileData {
  return {
    fileUri: fileData.file_uri,
    mimeType: fileData.mime_type
  };
}

/**
 * Uploads content to the Files API and returns proper file data
 * 
 * This function handles different sources:
 * - Buffer data (from memory)
 * - Local file paths (read from disk)
 * - URLs (fetched and then uploaded)
 * 
 * @param genAI Initialized GoogleGenAI client
 * @param source File content as Buffer, path, or URL
 * @param mimeType The MIME type of the file
 * @returns Object with file_uri and mime_type in snake_case format for Gemini
 */
export async function createFileData(
  genAI: GoogleGenAI,
  source: Buffer | string,
  mimeType: string
): Promise<GeminiFileData> {
  // 1. Convert source to Buffer if it's not already
  let data: Buffer;
  
  if (Buffer.isBuffer(source)) {
    // Already a buffer
    data = source;
  } else if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('gs://')) {
    // It's a URL or GCS path, fetch the content
    try {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to download file from URL: ${response.statusText}`);
      }
      data = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Assume it's a local file path
    try {
      data = await fs.readFile(source);
    } catch (error) {
      throw new Error(`Failed to read local file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 2. Generate SHA-256 hash for caching
  const hash = createHash('sha256').update(data).digest('hex');
  
  // 3. Check cache first
  const now = Date.now();
  const cached = memoryCache[hash];
  
  if (cached && cached.expires > now) {
    console.log(`[GEMINI] Using cached file URI for ${hash}`);
    return { 
      file_uri: cached.uri, 
      mime_type: cached.mimeType 
    };
  }
  
  // 4. Upload to Files API
  try {
    console.log(`[GEMINI] Uploading ${data.length} bytes to Files API`);
    
    // Create a Blob for the Google SDK
    const blob = new Blob([data], { type: mimeType });
    
    // Upload file to the Files API
    const file = await genAI.files.upload({
      file: blob,
      config: {
        displayName: `file-${hash.substring(0, 8)}`,
      },
    });
    
    // Ensure necessary properties exist
    const fileName = file.name;
    
    if (!fileName) {
      throw new Error('File upload succeeded but no name was returned');
    }
    
    // Wait for file processing to complete (can take time for large files)
    let getFile = await genAI.files.get({ name: fileName });
    let retryCount = 0;
    
    // Type guard for safety - since API types can change
    const isProcessing = (state: any) => state === 'PROCESSING';
    const isFailed = (state: any) => state === 'FAILED';
    const isSuccessful = (state: any) => state === 'SUCCEEDED' || state === 'ACTIVE';
    
    while (isProcessing(getFile.state) && retryCount < 10) {
      console.log(`[GEMINI] File is still processing (attempt ${retryCount + 1}/10), waiting 2 seconds...`);
      
      // Wait 2 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      getFile = await genAI.files.get({ name: fileName });
      retryCount++;
    }
    
    if (isFailed(getFile.state)) {
      throw new Error('File processing failed in Gemini Files API');
    }
    
    // Ensure file is in a usable state
    if (!isSuccessful(getFile.state)) {
      throw new Error(`File processing didn't complete in time, current state: ${getFile.state || 'unknown'}`);
    }
    
    // Ensure file.uri exists
    if (!file.uri) {
      throw new Error('File upload succeeded but no URI was returned from the Files API');
    }
    
    // 5. Cache the result (47 hours - just under the 48h Files API retention)
    const expiryTime = now + (47 * 60 * 60 * 1000);
    memoryCache[hash] = { 
      uri: file.uri, 
      mimeType: mimeType, 
      expires: expiryTime 
    };
    
    console.log(`[GEMINI] Successfully uploaded to Files API: ${file.uri}`);
    
    // 6. Return the file data in snake_case format
    return { 
      file_uri: file.uri, 
      mime_type: mimeType 
    };
  } catch (error) {
    console.error(`[GEMINI] File upload failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to upload file to Gemini API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clean up expired items from the memory cache
 */
export function cleanupFileCache(): void {
  const now = Date.now();
  
  // Delete any expired entries
  Object.keys(memoryCache).forEach(key => {
    if (memoryCache[key].expires < now) {
      delete memoryCache[key];
    }
  });
  
  console.log(`[GEMINI] File cache cleanup complete, ${Object.keys(memoryCache).length} valid entries remain`);
}

/**
 * Start a background cleanup job that runs every hour
 */
export function startFileCacheCleanup(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(cleanupFileCache, intervalMs);
}