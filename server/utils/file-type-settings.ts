import { insertFileTypeSettingsSchema, FileTypeSetting, contentTypeEnum } from '@shared/schema';
import { storage } from '../storage';
import { z } from 'zod';

// Define ContentType type based on the enum values
export type ContentType = typeof contentTypeEnum.enumValues[number];

// Default enabled file type settings
const DEFAULT_FILE_TYPE_SETTINGS = [
  // Text files
  {
    context: 'system',
    contentType: 'text',
    enabled: true,
    extensions: ['txt', 'md', 'py', 'js', 'ts', 'java', 'c', 'cpp', 'cs', 'html', 'css', 'json', 'xml'],
    mimeTypes: [
      'text/plain', 
      'text/markdown', 
      'text/x-python', 
      'application/javascript', 
      'text/javascript',
      'application/typescript',
      'text/x-java',
      'text/x-c',
      'text/x-c++',
      'text/x-csharp',
      'text/html',
      'text/css',
      'application/json',
      'application/xml',
      'text/xml'
    ],
    maxSize: 1024 * 1024 * 5, // 5MB
  },
  
  // Image files
  {
    context: 'system',
    contentType: 'image',
    enabled: true,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
    maxSize: 1024 * 1024 * 10, // 10MB
  },
  
  // Document files
  {
    context: 'system',
    contentType: 'document',
    enabled: true,
    extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    maxSize: 1024 * 1024 * 20, // 20MB
  },
  
  // Audio files - disabled by default
  {
    context: 'system',
    contentType: 'audio',
    enabled: false,
    extensions: ['mp3', 'wav', 'ogg', 'm4a'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
    maxSize: 1024 * 1024 * 50, // 50MB
  },
  
  // Video files - disabled by default
  {
    context: 'system',
    contentType: 'video',
    enabled: false,
    extensions: ['mp4', 'webm', 'avi', 'mov'],
    mimeTypes: ['video/mp4', 'video/webm', 'video/x-msvideo', 'video/quicktime'],
    maxSize: 1024 * 1024 * 100, // 100MB
  }
];

/**
 * Initialize default file type settings in the database
 * This should be called on server startup to ensure that default settings are in place
 */
export async function initializeDefaultFileTypeSettings(adminUserId: number): Promise<void> {
  try {
    console.log('Initializing default file type settings...');
    
    for (const defaultSetting of DEFAULT_FILE_TYPE_SETTINGS) {
      // Validate with Zod schema
      const validatedSetting = insertFileTypeSettingsSchema.parse({
        ...defaultSetting,
        contextId: null, // null for system-wide settings
        updatedBy: adminUserId
      });
      
      // Upsert (create or update) the setting
      await storage.upsertFileTypeSetting(validatedSetting);
    }
    
    console.log('Default file type settings initialized successfully');
  } catch (error) {
    console.error('Error initializing default file type settings:', error);
    throw error;
  }
}

/**
 * Get allowed file extensions and MIME types for a specific content type
 */
export async function getAllowedFileTypes(contentType: string): Promise<{
  extensions: string[];
  mimeTypes: string[];
  maxSize: number;
} | null> {
  try {
    const settings = await storage.getFileTypeSettings(contentType, 'system');
    
    if (settings.length === 0 || !settings[0].enabled) {
      return null;
    }
    
    const setting = settings[0];
    return {
      extensions: setting.extensions as string[],
      mimeTypes: setting.mimeTypes as string[],
      maxSize: setting.maxSize
    };
  } catch (error) {
    console.error(`Error getting allowed file types for ${contentType}:`, error);
    return null;
  }
}

/**
 * Check if a file is allowed based on its extension and MIME type
 */
export async function isFileTypeAllowed(
  contentType: ContentType | null,
  extension: string,
  mimeType: string
): Promise<boolean> {
  if (!contentType) return false;
  return storage.checkFileTypeEnabled(contentType, extension, mimeType);
}

/**
 * Determine the content type based on file extension and MIME type
 */
export function determineContentType(extension: string, mimeType: string): ContentType {
  extension = extension.toLowerCase().replace(/^\./, '');
  mimeType = mimeType.toLowerCase();
  
  // Special case for CSV files - classify as documents
  if (extension === 'csv' || mimeType === 'text/csv') {
    return 'document';
  }
  
  // Text files
  if (['txt', 'md', 'py', 'js', 'ts', 'java', 'c', 'cpp', 'cs', 'html', 'css', 'json', 'xml'].includes(extension) ||
      (mimeType.startsWith('text/') && mimeType !== 'text/csv') || 
      ['application/javascript', 'application/typescript', 'application/json', 'application/xml'].includes(mimeType)) {
    return 'text';
  }
  
  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension) ||
      mimeType.startsWith('image/')) {
    return 'image';
  }
  
  // Document files
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(extension) ||
      ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'].some(m => mimeType.includes(m))) {
    return 'document';
  }
  
  // Audio files
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension) ||
      mimeType.startsWith('audio/')) {
    return 'audio';
  }
  
  // Video files
  if (['mp4', 'webm', 'avi', 'mov'].includes(extension) ||
      mimeType.startsWith('video/')) {
    return 'video';
  }
  
  // Default to text if we can't determine
  return 'text';
}