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
  }
  
  if (!hasBucket) {
    console.warn('GCS_BUCKET_NAME environment variable is not set. Using default bucket: aigrader-uploads');
  }
  
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

    // Upload the file to GCS
    const bucket = getBucket();
    const [file] = await bucket.upload(filePath, {
      destination: destinationPath,
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
    // Validate configuration
    if (!isGcsConfigured()) {
      console.warn('GCS not configured, using mock URL');
      return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
    }
    
    // Generate a signed URL
    const bucket = getBucket();
    const file = bucket.file(objectPath);
    
    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expirationMinutes * 60 * 1000, // Convert minutes to milliseconds
    };
    
    const [url] = await file.getSignedUrl(options);
    return url;
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