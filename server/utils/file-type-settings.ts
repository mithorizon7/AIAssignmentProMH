/**
 * Utility functions for file type handling and MIME type detection
 */
import path from 'path';

// Define the content type enum values that match our schema
export type ContentType = 'text' | 'image' | 'audio' | 'video' | 'document';

// MIME type mapping for common file extensions
const MIME_TYPES: Record<string, string> = {
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  
  // Documents
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'csv': 'text/csv',
  
  // Text
  'txt': 'text/plain',
  'html': 'text/html',
  'htm': 'text/html',
  'css': 'text/css',
  'js': 'text/javascript',
  'ts': 'text/typescript',
  'md': 'text/markdown',
  'json': 'application/json',
  'xml': 'text/xml',
  
  // Audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  
  // Video
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogv': 'video/ogg',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'm4v': 'video/mp4'
};

/**
 * Get the MIME type based on file extension
 * @param extension File extension with or without leading dot
 * @returns MIME type or default octet-stream
 */
export function getMimeTypeFromExtension(extension: string | undefined): string {
  if (!extension) {
    return 'application/octet-stream';
  }
  
  // Remove leading dot if present
  const ext = extension.startsWith('.') ? extension.substring(1) : extension;
  
  // Case insensitive lookup
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Extract file extension from a filename
 * @param filename File name or path
 * @returns Extension without the leading dot
 */
export function getExtensionFromFilename(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  return path.extname(filename).slice(1).toLowerCase();
}

/**
 * Determine content type category from MIME type
 * @param mimeType MIME type string
 * @returns ContentType category
 */
export function getContentTypeFromMimeType(mimeType: string | undefined): ContentType {
  if (!mimeType) {
    return 'text'; // Default to text
  }
  
  const mime = mimeType.toLowerCase();
  
  if (mime.startsWith('image/')) {
    return 'image';
  }
  
  if (mime.startsWith('audio/')) {
    return 'audio';
  }
  
  if (mime.startsWith('video/')) {
    return 'video';
  }
  
  // Special cases for documents
  if (
    mime.startsWith('application/pdf') ||
    mime.startsWith('application/msword') ||
    mime.startsWith('application/vnd.openxmlformats-officedocument') ||
    mime.startsWith('application/vnd.ms-') ||
    mime === 'text/csv' ||
    mime === 'application/csv'
  ) {
    return 'document';
  }
  
  // Default to text for all other types
  return 'text';
}

/**
 * Check if a file is a CSV based on mime type or extension
 * @param mimeType MIME type of the file
 * @param filename Filename with extension
 * @returns Boolean indicating if it's a CSV file
 */
export function isCSVFile(mimeType: string | undefined, filename: string | undefined): boolean {
  if (!mimeType && !filename) {
    return false;
  }
  
  // Check mime type
  if (mimeType && (mimeType === 'text/csv' || mimeType === 'application/csv')) {
    return true;
  }
  
  // Check extension
  if (filename) {
    const extension = getExtensionFromFilename(filename);
    return extension === 'csv';
  }
  
  return false;
}

/**
 * Get the maximum allowed file size for a given content type in bytes
 * @param contentType Content type category
 * @returns Maximum size in bytes
 */
export function getMaxFileSizeForContentType(contentType: ContentType): number {
  switch (contentType) {
    case 'image':
      return 10 * 1024 * 1024; // 10MB
    case 'audio':
      return 50 * 1024 * 1024; // 50MB
    case 'video':
      return 100 * 1024 * 1024; // 100MB
    case 'document':
      return 20 * 1024 * 1024; // 20MB
    case 'text':
    default:
      return 5 * 1024 * 1024; // 5MB
  }
}

/**
 * Check if file size is within limits for given content type
 * @param size File size in bytes
 * @param contentType Content type category
 * @returns Boolean indicating if size is acceptable
 */
export function isFileSizeAcceptable(size: number, contentType: ContentType): boolean {
  const maxSize = getMaxFileSizeForContentType(contentType);
  return size <= maxSize;
}

/**
 * Determine content type based on mime type and filename
 * @param mimeType MIME type of the file
 * @param filename Filename with extension
 * @returns Content type category
 */
export function determineContentType(mimeType: string | undefined, filename: string | undefined): ContentType {
  // First try by MIME type if available
  if (mimeType) {
    return getContentTypeFromMimeType(mimeType);
  }
  
  // Fallback to extension-based detection
  if (filename) {
    const extension = getExtensionFromFilename(filename);
    if (extension) {
      const detectedMimeType = getMimeTypeFromExtension(extension);
      return getContentTypeFromMimeType(detectedMimeType);
    }
  }
  
  // Default to text if nothing else works
  return 'text';
}

/**
 * Check if a given file type is allowed based on configuration
 * @param mimeType MIME type of the file
 * @param extension File extension
 * @param enabledTypes List of enabled content types
 * @returns Boolean indicating if the file type is allowed
 */
export function isFileTypeAllowed(
  mimeType: string | undefined,
  filename: string | undefined,
  enabledTypes: ContentType[] = ['text', 'image', 'document', 'audio', 'video']
): boolean {
  // If both are missing, we can't determine type
  if (!mimeType && !filename) {
    return false;
  }
  
  // Get content type
  const contentType = determineContentType(mimeType, filename);
  
  // Check if content type is in enabled list
  return enabledTypes.includes(contentType);
}

/**
 * Get human-readable file size string
 * @param bytes Size in bytes
 * @returns Formatted string with appropriate unit
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}