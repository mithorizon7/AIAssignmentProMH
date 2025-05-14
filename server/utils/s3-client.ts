import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// Environment-based S3 configuration
const s3Config = {
  region: process.env.S3_REGION || 'us-east-1',
  credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY 
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      }
    : undefined,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
};

// Create S3 client with config
const s3Client = new S3Client(s3Config);

// Default bucket name
const defaultBucket = process.env.S3_BUCKET || 'aigrader-uploads';

// Check if S3 is properly configured
const isS3Configured = (): boolean => {
  return !!(
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY &&
    process.env.S3_REGION
  );
};

/**
 * Upload a file to S3
 * @param filePath Local path to file
 * @param key S3 object key (path in bucket)
 * @param mimeType MIME type of the file
 * @param bucket Optional bucket name (defaults to env var or 'aigrader-uploads')
 * @returns URL to the uploaded file
 */
const uploadFile = async (
  filePath: string,
  key: string,
  mimeType: string,
  bucket = defaultBucket
): Promise<string> => {
  try {
    // Validate configuration
    if (!isS3Configured()) {
      console.warn('S3 not configured, using mock URL');
      return `https://storage.example.com/${key}`;
    }

    // Read file content
    const fileContent = await fs.promises.readFile(filePath);
    
    // Create upload command
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: mimeType
    });
    
    // Upload to S3
    const result = await s3Client.send(command);
    console.log(`[S3] File uploaded successfully: ${key}`);
    
    // Generate a presigned URL for access (24 hour expiration)
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    // For public buckets, construct direct URL
    if (process.env.S3_PUBLIC_BUCKET === 'true') {
      const endpoint = process.env.S3_ENDPOINT || `https://${bucket}.s3.${s3Config.region}.amazonaws.com`;
      return `${endpoint}/${key}`;
    }
    
    // For private buckets, generate a presigned URL
    return await getSignedUrl(s3Client, getCommand, { expiresIn: 86400 }); // 24 hours
  } catch (error) {
    console.error('[S3] Error uploading file:', error);
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Upload a buffer directly to S3
 * @param buffer File buffer to upload
 * @param key S3 object key (path in bucket)
 * @param mimeType MIME type of the file
 * @param bucket Optional bucket name (defaults to env var or 'aigrader-uploads')
 * @returns URL to the uploaded file
 */
const uploadBuffer = async (
  buffer: Buffer,
  key: string,
  mimeType: string,
  bucket = defaultBucket
): Promise<string> => {
  try {
    // Validate configuration
    if (!isS3Configured()) {
      console.warn('S3 not configured, using mock URL');
      return `https://storage.example.com/${key}`;
    }
    
    // Create upload command
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    });
    
    // Upload to S3
    const result = await s3Client.send(command);
    console.log(`[S3] Buffer uploaded successfully: ${key}`);
    
    // Generate a presigned URL for access (24 hour expiration)
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    // For public buckets, construct direct URL
    if (process.env.S3_PUBLIC_BUCKET === 'true') {
      const endpoint = process.env.S3_ENDPOINT || `https://${bucket}.s3.${s3Config.region}.amazonaws.com`;
      return `${endpoint}/${key}`;
    }
    
    // For private buckets, generate a presigned URL
    return await getSignedUrl(s3Client, getCommand, { expiresIn: 86400 }); // 24 hours
  } catch (error) {
    console.error('[S3] Error uploading buffer:', error);
    throw new Error(`Failed to upload buffer to S3: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Generate a presigned URL for an existing S3 object
 * @param key S3 object key
 * @param bucket Optional bucket name (defaults to env var or 'aigrader-uploads')
 * @param expiresIn Expiration time in seconds (default 24 hours)
 * @returns Presigned URL for the object
 */
const getPresignedUrl = async (
  key: string,
  bucket = defaultBucket,
  expiresIn = 86400
): Promise<string> => {
  try {
    // Validate configuration
    if (!isS3Configured()) {
      console.warn('S3 not configured, using mock URL');
      return `https://storage.example.com/${key}`;
    }
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('[S3] Error generating presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Export S3 utilities
export {
  isS3Configured,
  uploadFile,
  uploadBuffer,
  getPresignedUrl,
  s3Client
};