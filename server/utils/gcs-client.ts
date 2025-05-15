import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

// Initialize GCS storage client
// It automatically uses credentials from the GOOGLE_APPLICATION_CREDENTIALS env var
const storage = new Storage({
  // projectId is usually inferred from credentials, but can be specified
  projectId: process.env.GCP_PROJECT_ID,
});

// Default bucket name from environment variables
const bucketName = process.env.GCS_BUCKET_NAME || 'aigrader-uploads';

// Check if GCS is properly configured
const isGcsConfigured = (): boolean => {
  // Check for credentials file or explicit credentials in environment
  const hasCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasBucket = !!process.env.GCS_BUCKET_NAME;
  
  if (!hasCredentials) {
    console.warn('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. GCS operations will likely fail.');
    
    // Provide more detailed diagnostic information
    try {
      const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credentialPath) {
        const exists = fs.existsSync(credentialPath);
        console.warn(`Credentials file ${credentialPath} ${exists ? 'exists' : 'does not exist'}.`);
        
        if (exists) {
          // Check if file is readable
          try {
            const stats = fs.statSync(credentialPath);
            console.warn(`Credentials file is ${stats.size} bytes and was modified at ${stats.mtime}.`);
          } catch (statError) {
            console.warn(`Unable to read credentials file stats: ${statError instanceof Error ? statError.message : String(statError)}`);
          }
        }
      } else {
        console.warn('No credentials path specified.');
      }
    } catch (checkError) {
      console.warn(`Error checking credentials file: ${checkError instanceof Error ? checkError.message : String(checkError)}`);
    }
  }
  
  if (!hasBucket) {
    console.warn(`GCS_BUCKET_NAME environment variable is not set. Using default bucket: ${bucketName}`);
  }
  
  // In some cloud environments, explicit credentials might not be needed,
  // as they can be inferred from the runtime environment (e.g., on GCP)
  return hasCredentials;
};

// Get the storage bucket
const getBucket = () => {
  return storage.bucket(bucketName);
};

/**
 * Upload a file to Google Cloud Storage
 * @param filePath Local path to file
 * @param destinationPath Path in GCS bucket where the file will be stored
 * @param mimeType MIME type of the file
 * @returns URL to the uploaded file
 */
const uploadFile = async (
  filePath: string,
  destinationPath: string,
  mimeType: string
): Promise<string> => {
  try {
    // Validate configuration
    if (!isGcsConfigured()) {
      console.warn('GCS not configured, using mock URL');
      return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
    }

    // Normalize destination path (remove leading slash if present)
    const normalizedPath = destinationPath.startsWith('/') ? destinationPath.substring(1) : destinationPath;
    
    // Upload the file to GCS
    const bucket = getBucket();
    const [file] = await bucket.upload(filePath, {
      destination: normalizedPath,
      metadata: {
        contentType: mimeType,
      },
    });
    
    console.log(`[GCS] File uploaded successfully: ${destinationPath}`);
    
    // Return the path to the file in GCS storage
    // We'll use this path to generate signed URLs when needed
    return destinationPath;
  } catch (error) {
    console.error('[GCS] Error uploading file:', error);
    throw new Error(`Failed to upload file to GCS: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Upload a buffer directly to Google Cloud Storage
 * @param buffer File buffer to upload
 * @param destinationPath Path in GCS bucket where the file will be stored
 * @param mimeType MIME type of the file
 * @returns Path to the uploaded file
 */
const uploadBuffer = async (
  buffer: Buffer,
  destinationPath: string,
  mimeType: string
): Promise<string> => {
  try {
    // Validate configuration
    if (!isGcsConfigured()) {
      console.warn('GCS not configured, using mock URL');
      return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
    }
    
    // Upload the buffer to GCS
    const bucket = getBucket();
    const file = bucket.file(destinationPath);
    
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
    });
    
    console.log(`[GCS] Buffer uploaded successfully: ${destinationPath}`);
    
    // Return the path to the file in GCS storage
    return destinationPath;
  } catch (error) {
    console.error('[GCS] Error uploading buffer:', error);
    throw new Error(`Failed to upload buffer to GCS: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Generate a signed URL for a file in Google Cloud Storage
 * @param objectPath Path to the object in GCS bucket
 * @param expirationMinutes How long the URL should be valid, in minutes (default: 60)
 * @returns Signed URL that provides temporary access to the file
 */
const generateSignedUrl = async (
  objectPath: string,
  expirationMinutes = 60
): Promise<string> => {
  try {
    // Validate input
    if (!objectPath || objectPath.trim() === '') {
      throw new Error('Empty object path provided to generateSignedUrl');
    }
    
    console.log(`[GCS] Generating signed URL for object: ${objectPath} with expiration: ${expirationMinutes} minutes`);
    
    // Validate configuration
    if (!isGcsConfigured()) {
      console.warn('[GCS] GCS not properly configured for signed URL generation');
      console.warn('[GCS] GOOGLE_APPLICATION_CREDENTIALS environment variable is not set or file is invalid');
      
      // Check if we're in a production environment
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (isProduction) {
        throw new Error('GCS not configured in production environment. Check GOOGLE_APPLICATION_CREDENTIALS.');
      } else {
        console.warn('[GCS] Using mock URL for development environment');
        // Only in development, return a mock URL
        return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      }
    }
    
    // Normalize object path (remove leading slash if present)
    const normalizedPath = objectPath.startsWith('/') ? objectPath.substring(1) : objectPath;
    console.log(`[GCS] Normalized object path: ${normalizedPath}`);
    
    // Validate that the file exists before attempting to generate a URL
    try {
      const bucket = getBucket();
      const file = bucket.file(normalizedPath);
      
      // Check if the file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.warn(`[GCS] File does not exist in bucket: ${bucketName}, path: ${normalizedPath}`);
        // We'll still try to generate a URL as the file might be created later
      } else {
        console.log(`[GCS] File exists in bucket: ${bucketName}, path: ${normalizedPath}`);
      }
      
      // Generate a signed URL with specified options
      const options: GetSignedUrlConfig = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000, // Convert minutes to milliseconds
      };
      
      console.log(`[GCS] Requesting signed URL with expiration: ${new Date(options.expires).toISOString()}`);
      const [url] = await file.getSignedUrl(options);
      
      if (!url || !url.startsWith('http')) {
        throw new Error(`Invalid signed URL generated: ${url ? url.substring(0, 30) + '...' : 'undefined'}`);
      }
      
      console.log(`[GCS] Successfully generated signed URL for ${normalizedPath} (${url.length} chars)`);
      return url;
    } catch (gcsOperationError) {
      console.error('[GCS] Error in GCS operation:', gcsOperationError);
      throw new Error(`GCS operation failed: ${gcsOperationError instanceof Error ? gcsOperationError.message : String(gcsOperationError)}`);
    }
  } catch (error) {
    console.error('[GCS] Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Get a public URL for a file in Google Cloud Storage
 * Note: This only works if the bucket or file is configured for public access
 * @param objectPath Path to the object in GCS bucket
 * @returns Public URL to the file
 */
const getPublicUrl = (objectPath: string): string => {
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
};

// Export GCS utilities
export {
  isGcsConfigured,
  uploadFile,
  uploadBuffer,
  generateSignedUrl,
  getPublicUrl,
  getBucket,
  storage,
  bucketName
};