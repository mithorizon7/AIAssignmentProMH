import { 
  GoogleGenerativeAI, 
  GenerativeModel, 
  Content, 
  Part, 
  FileData,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig
} from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { CriteriaScore } from '@shared/schema';
import { fileToDataURI } from '../utils/multimodal-processor';
import { ContentType } from '../utils/file-type-settings';

const readFileAsync = promisify(fs.readFile);

/**
 * Interface for parsed AI responses
 */
interface ParsedContent {
  strengths?: string[];
  improvements?: string[];
  suggestions?: string[];
  summary?: string;
  score?: number;
  criteriaScores?: CriteriaScore[];
  [key: string]: unknown;
}

/**
 * Extended FileData interface that includes cleanup methods
 * for the Gemini API which might have different versions
 */
interface GeminiFileData extends FileData {
  delete?: () => Promise<void>;
}

/**
 * Extended GoogleGenerativeAI interface that includes file handling methods
 * which might differ between API versions
 */
interface ExtendedGenerativeAI extends GoogleGenerativeAI {
  createFile?: (options: { data: Buffer, mimeType: string }) => Promise<FileData>;
  createBlob?: (options: { data: Buffer, mimeType: string }) => Promise<FileData>;
}

/**
 * Using the GenerationConfig type from the Google Generative AI SDK
 * No need to define our own interface as it's already provided by the SDK
 * 
 * @see https://ai.google.dev/api/rest/v1/GenerationConfig
 */

/**
 * Response metadata interface for token usage information
 * Different API versions might have different structures
 */
interface ResponseMetadata {
  candidates?: Array<{
    usageMetadata?: {
      totalTokens?: number;
    };
  }>;
  usageMetadata?: {
    totalTokens?: number;
  };
  usage?: {
    totalTokens?: number;
  };
  [key: string]: unknown;
}

// Extracted from Google AI Gemini API documentation
// https://ai.google.dev/gemini-api/docs/image-understanding
// https://ai.google.dev/gemini-api/docs/video-understanding
// https://ai.google.dev/gemini-api/docs/audio
// https://ai.google.dev/gemini-api/docs/document-processing
export const SUPPORTED_MIME_TYPES = {
  // Images (inlineData for small, fileData for large)
  // Based on https://ai.google.dev/gemini-api/docs/image-understanding
  image: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'image/gif', 'image/bmp', 'image/svg+xml', 'image/tiff'
  ],
  
  // Videos (always use fileData)
  // Based on https://ai.google.dev/gemini-api/docs/video-understanding
  video: [
    'video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'video/x-matroska', 'video/3gpp', 'video/x-flv', 'video/x-ms-wmv'
  ],
  
  // Audio (always use fileData)
  // Based on https://ai.google.dev/gemini-api/docs/audio
  audio: [
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm',
    'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/mp3'
  ],
  
  // Documents (use fileData)
  // Based on https://ai.google.dev/gemini-api/docs/document-processing
  document: [
    // Standard document formats
    'application/pdf', 
    // Text formats
    'text/csv', 'text/plain', 'application/json', 'text/markdown', 'text/html',
    // Office formats
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-powerpoint', // .ppt
    // Open document formats
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'application/vnd.oasis.opendocument.presentation', // .odp
    // Rich text format
    'application/rtf'
  ]
};

export class GeminiAdapter implements AIAdapter {
  private generativeAI: ExtendedGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor() {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    
    this.generativeAI = new GoogleGenerativeAI(apiKey);
    
    // Using a supported model from Google's documentation
    // Using the correct model name as provided
    this.modelName = "gemini-2.5-flash-preview-04-17";
    
    console.log(`[GEMINI] Initializing with model: ${this.modelName}`);
    
    // Configuration optimized for educational assessment and feedback
    // Based on best practices from https://ai.google.dev/gemini-api/docs/models/gemini
    this.model = this.generativeAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        // Temperature balances creativity with precision
        // Lower for more focused, consistent assessment feedback
        temperature: 0.4,
        
        // Allow longer outputs for detailed feedback
        maxOutputTokens: 8192,
        
        // These settings help with structured assessment output format
        topP: 0.95,
        topK: 64
        
        // Note: responseFormat removed as it's not supported in the current Gemini API version
      }
      // Safety settings removed temporarily to debug API issues
    });
  }
  
  /**
   * Check if a MIME type is supported by Gemini for a given content type
   * @param mimeType The MIME type to check
   * @param contentType The content category (image, video, audio, document)
   * @returns True if the MIME type is supported
   */
  private isMimeTypeSupported(mimeType: string, contentType: ContentType): boolean {
    const supportedTypes = SUPPORTED_MIME_TYPES[contentType as keyof typeof SUPPORTED_MIME_TYPES];
    if (!supportedTypes) return false;
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get the default MIME type for a given content type
   * @param contentType The content category
   * @returns A default MIME type for the given category
   */
  private getDefaultMimeType(contentType: ContentType): string {
    const defaults: Record<ContentType, string> = {
      'text': 'text/plain',
      'image': 'image/jpeg',
      'audio': 'audio/mpeg',
      'video': 'video/mp4',
      'document': 'application/pdf'
    };
    
    return defaults[contentType] || 'application/octet-stream';
  }
  
  /**
   * Creates a file with the Gemini File API
   * @param content Buffer containing file data
   * @param mimeType MIME type of the file
   * @returns A FileData object that can be used in a content part
   */
  /**
   * Get the file URI from a FileData object, handling different API versions
   * @param fileData The FileData object from the Gemini API
   * @returns The file URI string
   */
  private getFileUri(fileData: FileData): string {
    // The FileData object might have different property names in different API versions
    // Handle all possible variants based on Gemini API documentation changes
    const fileDataObj = fileData as unknown as Record<string, unknown>;
    return (
      typeof fileDataObj.uri === 'string' ? fileDataObj.uri :
      typeof fileDataObj.fileUri === 'string' ? fileDataObj.fileUri :
      typeof fileDataObj.url === 'string' ? fileDataObj.url :
      typeof fileDataObj.fileUrl === 'string' ? fileDataObj.fileUrl :
      ''
    );
  }
  
  /**
   * Upload and prepare files for the Gemini API
   * This method handles uploading files directly to the Gemini File API
   * and returns the proper FileData format for use in generateContent
   * 
   * @param content The file content as a Buffer
   * @param mimeType The MIME type of the file
   * @returns A Promise resolving to a GeminiFileData object with fileUri
   */
  private async createFileData(content: Buffer, mimeType: string): Promise<GeminiFileData> {
    try {
      console.log(`[GEMINI] Creating file data for file of size ${content.length} bytes with MIME type: ${mimeType}`);
      
      // Validate content
      if (!content || content.length === 0) {
        throw new Error('Empty file content provided to createFileData');
      }
      
      // Validate MIME type
      if (!mimeType || typeof mimeType !== 'string') {
        console.warn('[GEMINI] Missing or invalid MIME type, defaulting to application/octet-stream');
        mimeType = 'application/octet-stream';
      }
      
      // Following Gemini best practices for file handling based on size and type
      // https://ai.google.dev/gemini-api/docs/files
      
      // For images specifically, we can use size-appropriate handling
      if (mimeType.startsWith('image/')) {
        // For small images (<4MB), we could use inline data if createFile fails
        // But for consistency and best results, we'll try the File API first
        console.log(`[GEMINI] Processing image (${content.length} bytes) using File API for best quality analysis`);
      } 
      // For large files (PDFs, videos, audio), always use File API
      else if (content.length > 10 * 1024 * 1024) {
        console.log(`[GEMINI] Large file detected (${content.length} bytes), using File API is required`);
      }
      
      // For the latest Gemini API version (2.5 models), the File API method is exposed directly on the model
      // See: https://ai.google.dev/gemini-api/docs/files
      if (this.model && typeof (this.model as any).createFile === 'function') {
        console.log(`[GEMINI] Using model.createFile method (recommended for gemini-2.5-*)`);
        try {
          const fileData = await (this.model as any).createFile({
            data: content,
            mimeType
          }) as GeminiFileData;
          
          console.log(`[GEMINI] Successfully created file using model.createFile, URI: ${this.getFileUri(fileData)}`);
          return fileData;
        } catch (modelCreateFileError) {
          console.error(`[GEMINI] model.createFile method failed:`, modelCreateFileError);
          // Fall through to try other methods
        }
      }
      
      // For older Gemini API versions, the createFile might be directly on the generativeAI instance
      if (this.generativeAI.createFile && typeof this.generativeAI.createFile === 'function') {
        console.log(`[GEMINI] Using generativeAI.createFile method`);
        try {
          const fileData = await this.generativeAI.createFile({
            data: content,
            mimeType
          }) as GeminiFileData;
          
          const fileUri = this.getFileUri(fileData);
          console.log(`[GEMINI] Successfully uploaded file to Gemini File API, fileUri: ${fileUri}`);
          return fileData;
        } catch (createFileError) {
          console.error(`[GEMINI] generativeAI.createFile method failed:`, createFileError);
          // Try next method
        }
      }
      
      // Try alternative method: createBlob for older API versions
      if (this.generativeAI.createBlob && typeof this.generativeAI.createBlob === 'function') {
        console.log(`[GEMINI] Using createBlob method to upload to Gemini File API`);
        try {
          const fileData = await this.generativeAI.createBlob({
            data: content,
            mimeType
          }) as GeminiFileData;
          
          console.log(`[GEMINI] Successfully uploaded file using createBlob, fileUri: ${this.getFileUri(fileData)}`);
          return fileData;
        } catch (createBlobError) {
          console.error(`[GEMINI] createBlob method failed:`, createBlobError);
        }
      }
      
      // Final attempt: check if the model itself has a file method (some newer API versions)
      const modelMethods = Object.keys(this.model).filter(
        key => typeof (this.model as any)[key] === 'function'
      );
      console.log(`[GEMINI] Available methods on model instance: ${modelMethods.join(', ')}`);
      
      // If File API methods are not available, log detailed debugging information
      console.error('[GEMINI] All Gemini File API methods failed. File Handling Debug Info:', {
        modelName: this.modelName,
        contentSize: content.length,
        mimeType,
        modelMethods,
        generativeAIMethods: Object.keys(this.generativeAI).filter(
          key => typeof (this.generativeAI as any)[key] === 'function'
        )
      });
      
      // For small images (< 4MB), we can fallback to inlineData
      if (content.length < 4 * 1024 * 1024 && mimeType.startsWith('image/')) {
        console.log(`[GEMINI] Image is small enough (${content.length} bytes) to fall back to inlineData`);
        
        // Return a mock FileData object indicating we should use inline data instead
        return {
          mimeType,
          // This special flag tells our code to use inline data instead
          useInlineData: true,
          // Include the original data so it can be used directly
          data: content
        } as unknown as GeminiFileData;
      }
      
      throw new Error(`Gemini File API methods unavailable for model ${this.modelName}. Content size: ${content.length} bytes, MIME type: ${mimeType}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[GEMINI] Error creating file with Gemini File API:', errorMessage);
      
      // Rethrow with more context
      throw new Error(`Failed to create file with Gemini API: ${errorMessage}`);
    }
  }
  
  /**
   * Helper method to handle file upload failures based on file type
   * Different content types have different fallback strategies
   * 
   * @param content The file content as a Buffer
   * @param mimeType The MIME type of the file
   * @param textContent Optional extracted text from the file
   * @returns A Part object that can be added to the content parts array
   */
  private handleFileUploadFailure(content: Buffer, mimeType: string, textContent?: string): Part {
    // Detect content category from MIME type
    const contentCategory = this.getContentCategoryFromMimeType(mimeType);
    
    // Log detailed context about the failure for diagnostics
    console.warn('[GEMINI] File upload failure handling - details:', {
      contentCategory,
      mimeType,
      contentSize: content.length,
      hasTextContent: !!textContent,
      textContentLength: textContent?.length || 0,
      model: this.modelName
    });
    
    // Following Gemini API best practices for handling file processing failures
    // https://ai.google.dev/gemini-api/docs/error-handling
    
    // For documents, prioritize the extracted text content
    if (contentCategory === 'document' && textContent) {
      console.log(`[GEMINI] Using extracted text for document (${textContent.length} chars) after File API failure`);
      return {
        text: `Document content (extracted from ${mimeType}):\n\n${textContent}`
      };
    }
    
    // For images (only) that are small enough, we can fallback to inlineData
    if (contentCategory === 'image' && content.length < 4 * 1024 * 1024) { // 4MB limit for inline
      console.warn('[GEMINI] Falling back to inlineData for image after File API failure');
      
      // Validate the image buffer before using it as inline data
      try {
        this.validateImageBuffer(content, mimeType);
        
        // Convert buffer to base64 and validate
        const base64Data = content.toString('base64');
        this.validateBase64Image(base64Data, mimeType);
        
        // Log successful validation
        console.log(`[GEMINI] Image validation successful, using as inlineData (${base64Data.length} base64 chars)`);
        
        return {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        };
      } catch (validationError) {
        console.error('[GEMINI] Image validation failed:', validationError);
        return { text: `[Image validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}]` };
      }
    }
    
    // For audio files, use any extracted text content (possibly from transcription)
    if (contentCategory === 'audio' && textContent) {
      console.warn('[GEMINI] Using transcription for audio after File API failure');
      return { 
        text: `Audio content transcription:\n\n${textContent}` 
      };
    }
    
    // For video files, use any extracted text content (possibly from transcription)
    if (contentCategory === 'video' && textContent) {
      console.warn('[GEMINI] Using transcription/description for video after File API failure');
      return { 
        text: `Video content description:\n\n${textContent}` 
      };
    }
    
    // For text-based documents, fall back to text content
    if (contentCategory === 'document' && 
        ['text/plain', 'text/csv', 'text/html', 'text/markdown', 'application/json'].includes(mimeType)) {
      console.warn('[GEMINI] Falling back to text content for document after File API failure');
      try {
        // Only attempt this for reasonable file sizes to avoid memory issues
        if (content.length < 10 * 1024 * 1024) { // 10MB limit
          const textData = content.toString('utf8');
          // Verify the text data is actually readable
          if (textData && textData.length > 0 && /^[\x00-\x7F\xC0-\xFF]*$/.test(textData.substring(0, 1000))) {
            return { text: textData };
          } else {
            console.warn('[GEMINI] Converted content appears to be binary/non-text data');
          }
        } else {
          console.warn('[GEMINI] Content too large for direct UTF-8 conversion');
        }
      } catch (textError) {
        console.error('[GEMINI] Error converting document to text:', textError);
      }
    }
    
    // For any other file type, if we have extracted text, use that
    if (textContent && textContent.trim().length > 0) {
      console.log(`[GEMINI] Using extracted text content for ${mimeType} after File API failure (${textContent.length} chars)`);
      return { text: textContent };
    }
    
    // Provide detailed information about the content for better context
    console.error(`[GEMINI] No fallback available for content type ${contentCategory} with MIME type ${mimeType}`);
    
    // Last resort - create a detailed error message with context
    return { 
      text: `[File of type ${mimeType} (${Math.round(content.length/1024)}KB) could not be processed by the AI system. For best results, try uploading content in one of these formats: images (jpg, png), documents (pdf, docx), or plain text files.]` 
    };
  }
  
  /**
   * Determine content category from MIME type
   */
  private getContentCategoryFromMimeType(mimeType: string): ContentType | 'unknown' {
    for (const [category, types] of Object.entries(SUPPORTED_MIME_TYPES)) {
      if (types.includes(mimeType)) {
        return category as ContentType;
      }
    }
    return 'unknown';
  }

  /**
   * Add inline image data to content parts for small images
   * Following Google AI Gemini API documentation: https://ai.google.dev/gemini-api/docs/image-understanding
   * @param contentParts Array of content parts to append to
   * @param content Image content as buffer or base64 string
   * @param mimeType Image MIME type
   */
  private addInlineImagePart(contentParts: Part[], content: string | Buffer, mimeType: string): void {
    try {
      console.log(`[GEMINI] Adding inline image data with MIME type: ${mimeType}`);
      
      let base64Data: string;
      let detectedMimeType = mimeType;
      
      // Convert Buffer to base64 string
      if (Buffer.isBuffer(content)) {
        console.log(`[GEMINI] Converting Buffer of size ${content.length} bytes to base64`);
        
        // Validate the image buffer before processing
        this.validateImageBuffer(content, mimeType);
        
        base64Data = content.toString('base64');
      } 
      // Handle data URI format (data:image/jpeg;base64,/9j/4AAQ...)
      else if (typeof content === 'string' && content.startsWith('data:')) {
        console.log(`[GEMINI] Processing data URI string (length: ${content.length})`);
        
        // Extract MIME type from data URI if not specified explicitly
        if (content.startsWith('data:image/') && content.includes(';base64,')) {
          const extractedMimeType = content.substring(5, content.indexOf(';base64,'));
          console.log(`[GEMINI] Extracted MIME type from data URI: ${extractedMimeType}`);
          
          // Use extracted MIME type if the provided one is generic
          if (mimeType === 'image/unknown' || mimeType === 'image/*') {
            detectedMimeType = `image/${extractedMimeType}`;
            console.log(`[GEMINI] Using detected MIME type: ${detectedMimeType}`);
          }
        }
        
        // Extract the base64 data from the data URI
        const dataUriMatch = content.match(/^data:image\/\w+;base64,(.+)$/);
        if (dataUriMatch && dataUriMatch[1]) {
          base64Data = dataUriMatch[1];
        } else {
          // Fallback to simple replace if regex match fails
          base64Data = content.replace(/^data:image\/\w+;base64,/, '');
          
          // Double-check we actually got a string without the prefix
          if (base64Data.startsWith('data:')) {
            throw new Error('Failed to extract base64 data from data URI');
          }
        }
      } 
      // Handle direct base64 string
      else if (typeof content === 'string') {
        console.log(`[GEMINI] Using provided string as base64 data (length: ${content.length})`);
        
        // Check if this is a partial data URI without the proper prefix
        if (content.includes(';base64,')) {
          console.warn('[GEMINI] String appears to be a partial data URI - extracting base64 part');
          base64Data = content.substring(content.indexOf(';base64,') + 8);
        } else {
          base64Data = content;
        }
      }
      else {
        throw new Error('Content must be a Buffer or string');
      }
      
      // Ensure we got some data
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Failed to extract base64 data');
      }
      
      // Fix padding if needed - base64 data must be a multiple of 4 characters in length
      if (base64Data.length % 4 !== 0) {
        const missingPadding = 4 - (base64Data.length % 4);
        console.warn(`[GEMINI] Base64 data is not padded correctly - adding ${missingPadding} padding characters`);
        base64Data += '='.repeat(missingPadding);
      }
      
      console.log(`[GEMINI] Successfully prepared base64 image data (length: ${base64Data.length})`);
      
      // Comprehensive validation of base64 data
      this.validateBase64Image(base64Data, detectedMimeType);
      
      // Log detailed information about the image for debugging
      console.log(`[GEMINI] Image details:`, {
        mimeType: detectedMimeType,
        base64Length: base64Data.length,
        estimatedSizeKB: Math.round(base64Data.length * 0.75 / 1024),
        firstChars: base64Data.substring(0, 20) + '...',
        lastChars: '...' + base64Data.substring(base64Data.length - 20)
      });
      
      // Add the image data to the content parts
      contentParts.push({
        inlineData: {
          data: base64Data,
          mimeType: detectedMimeType
        }
      });
      
      console.log(`[GEMINI] Successfully added inline image to content parts`);
    } catch (error) {
      console.error('[GEMINI] Error adding inline image:', error);
      
      // Provide more contextual information in the error message
      const errorContext = {
        mimeType,
        contentType: Buffer.isBuffer(content) ? 'Buffer' : typeof content,
        contentLength: Buffer.isBuffer(content) ? content.length : 
                      typeof content === 'string' ? content.length : 'unknown'
      };
      
      console.error('[GEMINI] Image processing error context:', errorContext);
      
      // If conversion fails, add a text part indicating the failure with useful context
      contentParts.push({
        text: `[IMAGE: Failed to process as inline data - ${error instanceof Error ? error.message : String(error)}. Type: ${errorContext.mimeType}, Size: ${errorContext.contentLength} bytes]`
      });
    }
  }
  
  /**
   * Validate an image buffer to ensure it's a valid image file
   * @param buffer The image buffer to validate
   * @param mimeType The expected MIME type
   * @throws Error if the image is invalid
   */
  private validateImageBuffer(buffer: Buffer, mimeType: string): void {
    console.log(`[GEMINI] Validating image buffer with MIME type ${mimeType}, size: ${buffer.length} bytes`);
    
    // Check if buffer is empty or undefined
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty image buffer provided');
    }
    
    // Check minimum size (Gemini requires at least some content)
    if (buffer.length < 100) {
      throw new Error(`Image buffer too small (${buffer.length} bytes) - likely not a valid image`);
    }
    
    // Check for known image headers
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      // JPEG starts with bytes FF D8
      if (buffer.length < 2 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        throw new Error('Invalid JPEG image - missing JPEG signature (FF D8)');
      }
      
      // Basic JPEG structure check: should end with FF D9
      if (buffer.length >= 2 && 
          (buffer[buffer.length - 2] !== 0xFF || buffer[buffer.length - 1] !== 0xD9)) {
        console.warn('[GEMINI] JPEG may be incomplete - missing end marker (FF D9)');
      }
      
    } else if (mimeType === 'image/png') {
      // PNG starts with the bytes 89 50 4E 47 0D 0A 1A 0A
      if (buffer.length < 8 || 
          buffer[0] !== 0x89 || 
          buffer[1] !== 0x50 ||
          buffer[2] !== 0x4E ||
          buffer[3] !== 0x47 ||
          buffer[4] !== 0x0D ||
          buffer[5] !== 0x0A ||
          buffer[6] !== 0x1A ||
          buffer[7] !== 0x0A) {
        throw new Error('Invalid PNG image - missing PNG signature');
      }
      
      // Check for IHDR chunk which contains width and height
      // IHDR chunk comes after the 8-byte signature and is required by the PNG spec
      if (buffer.length < 25) { // 8 (signature) + 4 (length) + 4 (IHDR) + 4 (width) + 4 (height) + 1 (other data)
        throw new Error('PNG image too small - missing IHDR chunk');
      }
      
    } else if (mimeType === 'image/gif') {
      // GIF starts with "GIF87a" or "GIF89a"
      if (buffer.length < 6 || 
          buffer[0] !== 0x47 || // G
          buffer[1] !== 0x49 || // I
          buffer[2] !== 0x46) { // F
        throw new Error('Invalid GIF image - missing GIF signature');
      }
      
      // Check for GIF version (should be either "87a" or "89a")
      const version = buffer.toString('ascii', 3, 6);
      if (version !== '87a' && version !== '89a') {
        console.warn(`[GEMINI] Unexpected GIF version: ${version}`);
      }
      
    } else if (mimeType === 'image/webp') {
      // WebP starts with "RIFF" followed by file size and "WEBP"
      if (buffer.length < 12 || 
          buffer[0] !== 0x52 || // R
          buffer[1] !== 0x49 || // I
          buffer[2] !== 0x46 || // F
          buffer[3] !== 0x46 || // F
          buffer[8] !== 0x57 || // W
          buffer[9] !== 0x45 || // E
          buffer[10] !== 0x42 || // B
          buffer[11] !== 0x50) { // P
        throw new Error('Invalid WebP image - missing WebP signature');
      }
    } else if (mimeType === 'image/svg+xml') {
      // For SVG, check for XML declaration or SVG tag
      const bufferStart = buffer.toString('utf8', 0, Math.min(buffer.length, 100));
      if (!bufferStart.includes('<svg') && !bufferStart.includes('<?xml')) {
        throw new Error('Invalid SVG image - missing SVG or XML declaration');
      }
    } else if (mimeType === 'image/bmp') {
      // BMP starts with "BM"
      if (buffer.length < 2 || buffer[0] !== 0x42 || buffer[1] !== 0x4D) { // "BM"
        throw new Error('Invalid BMP image - missing BM signature');
      }
    }
    
    // Size sanity check - Gemini has limits on how large images can be
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (buffer.length > maxSize) {
      console.warn(`[GEMINI] Image is very large (${Math.round(buffer.length/1024/1024)}MB) and may exceed Gemini's limits`);
    }
    
    console.log(`[GEMINI] Image validation passed for ${mimeType} (${buffer.length} bytes)`);
  }
  
  /**
   * Validate a base64 string to ensure it's a valid image
   * @param base64Data The base64 string to validate
   * @param mimeType The expected MIME type
   * @throws Error if the base64 string is invalid
   */
  private validateBase64Image(base64Data: string, mimeType: string): void {
    console.log(`[GEMINI] Validating base64 image data (length: ${base64Data.length}) with MIME type: ${mimeType}`);
    
    // Check for empty string
    if (!base64Data || base64Data.length === 0) {
      throw new Error('Base64 image data is empty');
    }
    
    // Check if the string is valid base64
    const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(base64Data.substring(0, 100));
    if (!isValidBase64) {
      // If the start doesn't match base64 pattern, provide more info for debugging
      const invalidChars = base64Data.substring(0, 100).match(/[^A-Za-z0-9+/=]/g);
      throw new Error(`Invalid base64 data - contains non-base64 characters: ${invalidChars ? invalidChars.join(', ') : 'unknown'}`);
    }
    
    // Size validation - too small = likely invalid
    if (base64Data.length < 50) {
      throw new Error(`Base64 data too small (${base64Data.length} chars) - likely not a valid image`);
    }
    
    // Size validation - warn if very large (might exceed API limits)
    if (base64Data.length > 5000000) { // ~5MB after base64 decoding
      console.warn(`[GEMINI] Very large image: ${Math.round(base64Data.length * 0.75 / 1024 / 1024)}MB decoded. May exceed API limits.`);
    }
    
    // Sanity check - ensure proper length for base64 (should be multiple of 4)
    if (base64Data.length % 4 !== 0) {
      console.warn(`[GEMINI] Base64 data length (${base64Data.length}) is not a multiple of 4 - may be truncated`);
      
      // Try to fix padding
      const paddingNeeded = 4 - (base64Data.length % 4);
      if (paddingNeeded > 0 && paddingNeeded < 4) {
        console.log(`[GEMINI] Attempting to fix base64 padding by adding ${paddingNeeded} padding characters`);
      }
    }
    
    // Specific checks for known MIME types
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      // JPEG in base64 typically starts with /9j/ (for FF D8 FF)
      if (!base64Data.startsWith('/9j/')) {
        console.warn(`[GEMINI] Base64 data doesn't start with typical JPEG pattern (/9j/)`);
      }
    } else if (mimeType === 'image/png') {
      // PNG in base64 typically starts with iVBORw0K (for 89 50 4E 47...)
      if (!base64Data.startsWith('iVBORw0K')) {
        console.warn(`[GEMINI] Base64 data doesn't start with typical PNG pattern (iVBORw0K)`);
      }
    } else if (mimeType === 'image/gif') {
      // GIF in base64 typically starts with R0lG (for GIF8...)
      if (!base64Data.startsWith('R0lG')) {
        console.warn(`[GEMINI] Base64 data doesn't start with typical GIF pattern (R0lG)`);
      }
    }
    
    console.log(`[GEMINI] Base64 validation passed for ${mimeType} image (length: ${base64Data.length})`);
  }

  async generateCompletion(prompt: string) {
    try {
      // Add JSON prompt instruction and responseMimeType for consistent JSON formatting
      const generationConfig = {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 64,
        responseMimeType: "application/json"
      };
      
      // Structure request to ensure JSON response
      const result = await this.model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ 
            text: prompt + "\n\nPlease provide your response in JSON format."
          }] 
        }],
        generationConfig
      });
      
      const response = result.response;
      const text = response.text();
      
      // Log successful API call with response format info
      console.log(`[GEMINI] Text completion API call successful with responseMimeType: application/json`);
      console.log(`[GEMINI] Response text beginning: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse the content as JSON using multiple fallback methods
      let parsedContent: ParsedContent = {};
      try {
        // First try direct JSON parsing with the responseMimeType: application/json
        try {
          parsedContent = JSON.parse(text);
          console.log(`[GEMINI] Successfully parsed direct JSON response`);
        } catch (jsonError) {
          console.warn(`[GEMINI] Direct JSON parsing failed, trying to extract from markdown code block`);
          
          // Try to extract JSON from markdown code block (```json ... ```)
          const markdownJsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (markdownJsonMatch && markdownJsonMatch[1]) {
            try {
              const cleanedJson = cleanJsonString(markdownJsonMatch[1]);
              parsedContent = JSON.parse(cleanedJson);
              console.log(`[GEMINI] Successfully extracted JSON from markdown code block`);
            } catch (error: unknown) {
              const markdownError = error instanceof Error ? error.message : String(error);
              console.warn(`[GEMINI] Failed to parse JSON from markdown block: ${markdownError}`);
              console.warn(`[GEMINI] Trying generic JSON extraction`);
              throw error; // Pass to next handler
            }
          } else {
            // Try to find anything that looks like a JSON object
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const cleanedJson = cleanJsonString(jsonMatch[0]);
                parsedContent = JSON.parse(cleanedJson);
                console.log(`[GEMINI] Successfully extracted JSON using regex pattern`);
              } catch (error: unknown) {
                const extractError = error instanceof Error ? error.message : String(error);
                console.warn(`[GEMINI] Failed to parse extracted JSON pattern: ${extractError}`);
                console.warn(`[GEMINI] Falling back to manual extraction`);
                throw error; // Pass to next handler
              }
            } else {
              throw new Error("No JSON-like content found in response");
            }
          }
        }
      } catch (e: unknown) {
        console.error("[GEMINI] All JSON parsing methods failed:", e);
        console.log("[GEMINI] Raw response:", text);
        
        // Final fallback: extract structured data manually from text
        console.log("[GEMINI] Attempting manual extraction of structured data");
        parsedContent = {
          strengths: extractListItems(text, "strengths"),
          improvements: extractListItems(text, "improvements"),
          suggestions: extractListItems(text, "suggestions"),
          summary: extractSummary(text),
          score: extractScore(text)
        };
      }
      
      /**
       * Get token usage information for standard (non-multimodal) completion
       * 
       * NOTE: The basic generateContent API response doesn't typically include token usage statistics.
       * We use an estimation method based on response length as a reasonable approximation.
       * The estimation method (text length / 4) is an approximation and may not match actual
       * token usage precisely, but provides a consistent way to track relative usage.
       */
      console.info("Token count not available from Gemini API for standard completion, using estimation method");
      const estimatedTokens = Math.ceil(text.length / 4); // Estimation: ~4 characters per token
      
      return {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.modelName,
        tokenCount: estimatedTokens
      };
    } catch (error: unknown) {
      console.error("Gemini API error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`AI generation failed: ${errorMessage}`);
    }
  }
  
  /**
   * Generate completion using multimodal inputs (text, images, audio, video, documents)
   * Properly processes content through Gemini API based on content type
   * Following Google AI Gemini API documentation for handling different media types:
   * https://ai.google.dev/gemini-api/docs/image-understanding
   * https://ai.google.dev/gemini-api/docs/video-understanding
   * https://ai.google.dev/gemini-api/docs/audio
   * https://ai.google.dev/gemini-api/docs/document-processing
   * 
   * @param parts Array of MultimodalPromptPart objects containing different content types
   * @param systemPrompt Optional system prompt to provide context to the model
   */
  async generateMultimodalCompletion(parts: MultimodalPromptPart[], systemPrompt?: string) {
    try {
      // Create the content parts
      const contentParts: Part[] = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        contentParts.push({
          text: systemPrompt
        });
      }
      
      // Track file objects for cleanup
      const fileObjects: GeminiFileData[] = [];
      
      // Process each part based on its type
      for (const part of parts) {
        const textContent = part.textContent;
        const mimeType = part.mimeType || this.getDefaultMimeType(part.type);
        
        // Determine file size if we have a buffer
        const fileSize = Buffer.isBuffer(part.content) ? part.content.length : 0;
        const isLargeFile = fileSize > 2 * 1024 * 1024; // 2MB threshold for image inlineData
        
        switch (part.type) {
          case 'text':
            // Text is always handled directly
            contentParts.push({
              text: part.content as string
            });
            break;
            
          case 'image':
            // Follow Gemini API image handling guidelines
            // https://ai.google.dev/gemini-api/docs/image-understanding
            if (Buffer.isBuffer(part.content)) {
              // Log detailed information about the image being processed
              console.log(`[GEMINI] Processing image with size: ${part.content.length} bytes, MIME type: ${mimeType}`);
              
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'image')) {
                console.warn(`[GEMINI] Unsupported image format: ${mimeType}`);
                contentParts.push({
                  text: `[IMAGE: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.image.join(', ')}]`
                });
                break;
              }
              
              try {
                // Validate image data before processing
                this.validateImageBuffer(part.content, mimeType);
                
                // Following best practices from https://ai.google.dev/gemini-api/docs/image-understanding
                // For gemini-2.5-* models, use the File API for ALL images to get best quality analysis
                // Gemini 2.5 models have enhanced understanding capabilities with the File API
                if (this.modelName.includes('gemini-2.5')) {
                  console.log(`[GEMINI] Using File API for image with gemini-2.5 model (${part.content.length} bytes)`);
                  
                  try {
                    // Use Gemini File API for best quality image analysis
                    const fileData = await this.createFileData(part.content, mimeType);
                    fileObjects.push(fileData);
                    
                    // Check for our special useInlineData flag that indicates the File API failed
                    // but we can use inline data instead
                    if ((fileData as any).useInlineData === true && (fileData as any).data) {
                      console.log(`[GEMINI] Using inlineData fallback from createFileData result for image`);
                      // Use the data directly from the fileData
                      const imageBuffer = (fileData as any).data;
                      // Convert to base64 if it's a buffer
                      const base64Data = Buffer.isBuffer(imageBuffer) 
                        ? imageBuffer.toString('base64') 
                        : typeof imageBuffer === 'string' ? imageBuffer : '';
                        
                      contentParts.push({
                        inlineData: {
                          data: base64Data,
                          mimeType: mimeType
                        }
                      });
                    } else {
                      // Normal flow - get the file URI and use it
                      const fileUri = this.getFileUri(fileData);
                      if (!fileUri) {
                        throw new Error('Failed to get valid fileUri from fileData');
                      }
                      
                      console.log(`[GEMINI] Successfully created file using File API, URI: ${fileUri.substring(0, 30)}...`);
                      
                      // Add the file part with fileData following recommended format for gemini-2.5 models
                      contentParts.push({
                        fileData: {
                          fileUri: fileUri,
                          mimeType: mimeType
                        }
                      });
                    }
                  } catch (fileApiError) {
                    console.warn(`[GEMINI] File API failed, falling back to inline data: ${fileApiError instanceof Error ? fileApiError.message : String(fileApiError)}`);
                    
                    // Fallback to inline data
                    if (part.content.length < 4 * 1024 * 1024) { // 4MB limit for inline images
                      this.addInlineImagePart(contentParts, part.content, mimeType);
                    } else {
                      // Image too large for inline, and File API failed - add error message
                      contentParts.push({
                        text: `[IMAGE: Too large for inline data (${Math.round(part.content.length/1024/1024)}MB) and File API failed]`
                      });
                      
                      // Include extracted text if available
                      if (textContent) {
                        contentParts.push({ text: `Image text content: ${textContent}` });
                      }
                    }
                  }
                } 
                // Size-based approach for older models
                else if (isLargeFile) {
                  console.log(`[GEMINI] Using File API for large image (${part.content.length} bytes)`);
                  
                  try {
                    // For large images, try to use Gemini File API
                    const fileData = await this.createFileData(part.content, mimeType);
                    fileObjects.push(fileData);
                    
                    // Get the file URI
                    const fileUri = this.getFileUri(fileData);
                    if (!fileUri) {
                      throw new Error('Failed to get valid fileUri from fileData');
                    }
                    
                    console.log(`[GEMINI] Successfully created file, URI: ${fileUri.substring(0, 30)}...`);
                    
                    // Add the file part with fileData
                    contentParts.push({
                      fileData: {
                        fileUri: fileUri,
                        mimeType: mimeType
                      }
                    });
                  } catch (fileApiError) {
                    console.warn(`[GEMINI] File API failed for large image: ${fileApiError instanceof Error ? fileApiError.message : String(fileApiError)}`);
                    contentParts.push({ 
                      text: `[IMAGE: ${Math.round(part.content.length/1024/1024)}MB image could not be processed]` 
                    });
                    
                    // Include extracted text if available
                    if (textContent) {
                      contentParts.push({ text: `Image text content: ${textContent}` });
                    }
                  }
                } else {
                  // For smaller images with older models, use inline data (more efficient)
                  console.log(`[GEMINI] Using inline data for small image (${part.content.length} bytes)`);
                  this.addInlineImagePart(contentParts, part.content, mimeType);
                }
              } catch (error) {
                console.error('[GEMINI] Error processing image:', error);
                
                // Enhanced error handling with fallback options
                // Following recommendations from https://ai.google.dev/gemini-api/docs/error-handling
                
                // Attempt to extract more informative error message
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.warn(`[GEMINI] Image processing error details: ${errorMessage}`);
                
                // For any error, try to fall back to inline data if the image is small enough
                if (part.content.length < 4 * 1024 * 1024) { // 4MB limit for inline data
                  console.warn('[GEMINI] Falling back to inline data after error');
                  try {
                    // Try to include image as inline data as a fallback
                    this.addInlineImagePart(contentParts, part.content, mimeType);
                    console.log('[GEMINI] Successfully fell back to inline image data');
                  } catch (inlineError) {
                    console.error('[GEMINI] Inline data fallback also failed:', inlineError);
                    
                    // Both File API and inline data failed, add text-only fallback
                    contentParts.push({
                      text: `[IMAGE: The image could not be processed due to technical limitations. Error: ${errorMessage}]`
                    });
                    
                    // Include extracted text from the image if available
                    if (textContent) {
                      contentParts.push({ 
                        text: `Image text content: ${textContent}` 
                      });
                    }
                  }
                } else {
                  // Image too large for inline fallback
                  console.warn(`[GEMINI] Image size (${Math.round(part.content.length/1024)}KB) exceeds inline data limit`);
                  contentParts.push({
                    text: `[IMAGE: The image is too large (${Math.round(part.content.length/1024/1024)}MB) and could not be processed through the Gemini API]`
                  });
                  
                  // Include extracted text from the image if available
                  if (textContent) {
                    contentParts.push({ 
                      text: `Image text content: ${textContent}` 
                    });
                  }
                }
              }
            } else if (typeof part.content === 'string') {
              // Handle base64 or data URI strings for images
              console.log(`[GEMINI] Processing string-based image data (length: ${part.content.length})`);
              try {
                this.addInlineImagePart(contentParts, part.content, mimeType);
              } catch (error) {
                console.error('[GEMINI] Error processing string image data:', error);
                contentParts.push({
                  text: `[IMAGE: Could not process the image data. Error: ${error instanceof Error ? error.message : String(error)}]`
                });
              }
            }
            break;
            
          case 'document':
            // Follow Gemini API document handling guidelines
            // https://ai.google.dev/gemini-api/docs/document-processing
            if (Buffer.isBuffer(part.content)) {
              console.log(`[GEMINI] Processing document of type ${mimeType}, size: ${part.content.length} bytes`);
              
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'document')) {
                console.warn(`[GEMINI] Unsupported document format: ${mimeType}. Using extracted text if available.`);
                contentParts.push({
                  text: `[DOCUMENT: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.document.join(', ')}]`
                });
                
                // Include extracted text if available
                if (textContent) {
                  console.log(`[GEMINI] Using extracted text from document (${textContent.length} chars)`);
                  contentParts.push({ text: textContent });
                } else {
                  console.warn(`[GEMINI] No extracted text available for unsupported document format ${mimeType}`);
                }
                break;
              }
              
              try {
                // For all document types, use File API (preferred method in Gemini 2.5+ models)
                // This allows the model to understand document structure, not just text
                console.log(`[GEMINI] Using File API for document processing (${mimeType})`);
                const fileData = await this.createFileData(part.content, mimeType);
                fileObjects.push(fileData);
                
                // Get the file URI
                const fileUri = this.getFileUri(fileData);
                if (!fileUri) {
                  throw new Error(`Failed to get valid fileUri from fileData for ${mimeType} document`);
                }
                
                console.log(`[GEMINI] Successfully created file for document, URI: ${fileUri.substring(0, 30)}...`);
                
                // Add the file part with fileData following the document processing guidelines
                contentParts.push({
                  fileData: {
                    fileUri: fileUri,
                    mimeType: mimeType
                  }
                });
              } catch (error) {
                console.warn(`[GEMINI] Failed to use Gemini File API for document (${mimeType}):`, error);
                
                // Enhanced error handling with clear error messages
                const errorMessage = error instanceof Error ? error.message : String(error);
                contentParts.push(
                  this.handleFileUploadFailure(part.content, mimeType, textContent)
                );
              }
            } else if (typeof part.content === 'string') {
              // Handle document content as text
              contentParts.push({ text: part.content });
            }
            break;
            
          case 'audio':
            // Follow Gemini API audio handling guidelines
            // https://ai.google.dev/gemini-api/docs/audio
            if (Buffer.isBuffer(part.content)) {
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'audio')) {
                contentParts.push({
                  text: `[AUDIO: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.audio.join(', ')}]`
                });
                
                // Include extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
                break;
              }
              
              try {
                // Audio must use File API (not inlineData)
                const fileData = await this.createFileData(part.content, mimeType);
                fileObjects.push(fileData);
                
                // Add the file part with fileData
                contentParts.push({
                  fileData: {
                    fileUri: this.getFileUri(fileData),
                    mimeType: mimeType
                  }
                });
              } catch (error) {
                console.warn(`Failed to use Gemini File API for audio (${mimeType}):`, error);
                
                // Use our specialized handler for file upload failures
                contentParts.push(
                  this.handleFileUploadFailure(part.content, mimeType, textContent)
                );
              }
            } else {
              contentParts.push({
                text: `[AUDIO: File format not supported]`
              });
            }
            break;
            
          case 'video':
            // Follow Gemini API video handling guidelines
            // https://ai.google.dev/gemini-api/docs/video-understanding
            if (Buffer.isBuffer(part.content)) {
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'video')) {
                contentParts.push({
                  text: `[VIDEO: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.video.join(', ')}]`
                });
                
                // Include extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
                break;
              }
              
              try {
                // Video must use File API (not inlineData)
                const fileData = await this.createFileData(part.content, mimeType);
                fileObjects.push(fileData);
                
                // Add the file part with fileData
                contentParts.push({
                  fileData: {
                    fileUri: this.getFileUri(fileData),
                    mimeType: mimeType
                  }
                });
              } catch (error) {
                console.warn(`Failed to use Gemini File API for video (${mimeType}):`, error);
                
                // Use our specialized handler for file upload failures
                contentParts.push(
                  this.handleFileUploadFailure(part.content, mimeType, textContent)
                );
              }
            } else {
              contentParts.push({
                text: `[VIDEO: File format not supported]`
              });
            }
            break;
            
          default:
            // Handle unknown types with appropriate warning
            contentParts.push({
              text: `[CONTENT of type ${String(part.type).toUpperCase()} - Not directly processed]`
            });
            
            // Include extracted text content if available
            if (textContent) {
              contentParts.push({ text: textContent });
            }
        }
      }
      
      // Create a prompt structure for assessment
      contentParts.push({
        text: `
Please analyze the above submission and provide feedback in the following JSON format:
{
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["area to improve 1", "area to improve 2", ...],
  "suggestions": ["specific suggestion 1", "specific suggestion 2", ...],
  "summary": "A concise summary of the overall assessment",
  "score": 85 // A numerical score from 0-100
}
`
      });
      
      // Generate content with the parts
      const generationConfig = {
        temperature: 0.7, 
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 64,
        responseMimeType: "application/json"
      };
      
      // Using responseMimeType instead of deprecated responseFormat
      console.log(`[GEMINI] Using responseMimeType: application/json for ${this.modelName}`);
      // This directs Gemini to return proper JSON format instead of markdown-wrapped content
      
      // Log details about the request we're about to make
      console.log(`[GEMINI] Sending multimodal request to Gemini API with ${contentParts.length} parts`);
      
      // For logging and debugging, summarize content parts without logging entire content
      const contentPartsInfo = contentParts.map(part => {
        if ('text' in part && part.text) {
          return { type: 'text', length: part.text.length };
        } else if ('inlineData' in part && part.inlineData) {
          return { 
            type: 'inlineData', 
            mimeType: part.inlineData.mimeType || 'unknown',
            dataLength: part.inlineData.data?.length || 0
          };
        } else if ('fileData' in part && part.fileData) {
          const fileUri = part.fileData.fileUri || '';
          return { 
            type: 'fileData', 
            mimeType: part.fileData.mimeType || 'unknown',
            fileUri: fileUri.substring(0, Math.min(20, fileUri.length)) + (fileUri.length > 20 ? '...' : '')
          };
        }
        return { type: 'unknown' };
      });
      console.log(`[GEMINI] Content parts summary:`, contentPartsInfo);
      
      // Make the API call
      let result;
      try {
        result = await this.model.generateContent({
          contents: [{ role: 'user', parts: contentParts }],
          generationConfig
        });
        console.log(`[GEMINI] Successfully received response from Gemini API`);
      } catch (generateError) {
        console.error(`[GEMINI] Error generating content:`, generateError);
        
        // Provide more context in the error message
        const modelInfo = {
          modelName: this.modelName,
          numContentParts: contentParts.length,
          hasImages: contentParts.some(part => 
            'inlineData' in part || 
            ('fileData' in part && part.fileData && part.fileData.mimeType && part.fileData.mimeType.startsWith('image/'))
          ),
          hasDocuments: contentParts.some(part => 
            'fileData' in part && part.fileData && part.fileData.mimeType && part.fileData.mimeType.startsWith('application/')
          ),
        };
        
        // Always clean up file resources even if generation fails
        try {
          for (const fileObject of fileObjects) {
            if (fileObject && typeof (fileObject as GeminiFileData).delete === 'function') {
              await (fileObject as GeminiFileData).delete?.();
              console.log('[GEMINI] Cleaned up file resource after error');
            }
          }
        } catch (cleanupError) {
          console.warn('[GEMINI] Error cleaning up file resources after generation error:', cleanupError);
        }
        
        throw new Error(`Gemini API error with ${this.modelName}: ${generateError instanceof Error ? generateError.message : String(generateError)}. Context: ${JSON.stringify(modelInfo)}`);
      }
      
      // Cleanup file resources
      for (const fileObject of fileObjects) {
        try {
          if (fileObject && typeof (fileObject as GeminiFileData).delete === 'function') {
            await (fileObject as GeminiFileData).delete?.();
            console.log('[GEMINI] Successfully cleaned up file resource');
          }
        } catch (cleanupError) {
          console.warn('[GEMINI] Error cleaning up file resource:', cleanupError);
        }
      }
      
      const response = result.response;
      const text = response.text();
      console.log(`[GEMINI] Response length: ${text.length} characters`);
      
      // Log a snippet of the response for debugging
      if (text.length > 0) {
        console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      }
      
      // Parse the content as JSON
      let parsedContent: ParsedContent = {};
      try {
        // First check for markdown code blocks (```json), which Gemini-2.5 loves to use
        const markdownMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
        if (markdownMatch) {
          console.log('[GEMINI] Found markdown code block in response');
          const jsonContent = markdownMatch[1].trim();
          try {
            // Log the content we're trying to parse for debugging
            console.log('[GEMINI] Attempting to parse markdown JSON content (first 200 chars):', 
              jsonContent.substring(0, 200) + (jsonContent.length > 200 ? '...' : ''));
              
            // First try fixing common JSON errors before parsing
            const cleanedJson = cleanJsonString(jsonContent);
            parsedContent = JSON.parse(cleanedJson);
            console.log('[GEMINI] Successfully parsed JSON from markdown code block');
          } catch (markdownError) {
            console.log('[GEMINI] Failed to parse markdown block as JSON:', markdownError.message);
            console.log('[GEMINI] JSON error position:', (markdownError as SyntaxError).message);
            
            // Try to extract just the valid parts
            try {
              // Sometimes the AI doesn't properly close lists/objects - try to fix that
              // Use a more compatible regex pattern without the 's' flag
              const partialJsonMatch = jsonContent.match(/\{\s*"strengths"\s*:\s*\[([\s\S]*?)\]/);
              if (partialJsonMatch) {
                const strengths = extractListItemsManually(partialJsonMatch[1]);
                parsedContent.strengths = strengths;
                console.log('[GEMINI] Recovered strengths using regex:', strengths.length);
              }
              
              // Try to extract improvements similarly
              // Use a more compatible regex pattern without the 's' flag
              const improvementsMatch = jsonContent.match(/"improvements"\s*:\s*\[([\s\S]*?)\]/);
              if (improvementsMatch) {
                const improvements = extractListItemsManually(improvementsMatch[1]);
                parsedContent.improvements = improvements;
                console.log('[GEMINI] Recovered improvements using regex:', improvements.length);
              }
              
              // Try to extract score
              const scoreMatch = jsonContent.match(/"score"\s*:\s*(\d+(?:\.\d+)?)/);
              if (scoreMatch) {
                parsedContent.score = parseFloat(scoreMatch[1]);
                console.log('[GEMINI] Recovered score using regex:', parsedContent.score);
              }
            } catch (recoveryError) {
              console.log('[GEMINI] Failed to recover partial JSON:', recoveryError.message);
            }
          }
        }
        
        // If no valid content from markdown block, try direct JSON parsing
        if (Object.keys(parsedContent).length === 0) {
          if (this.modelName.includes('gemini-2.5')) {
            console.log('[GEMINI] Attempting to parse direct structured response');
            try {
              const cleanedJson = cleanJsonString(text);
              parsedContent = JSON.parse(cleanedJson);
            } catch (directError) {
              console.log('[GEMINI] Failed to parse direct response:', directError.message);
            }
          } else {
            // For older models, we extract JSON from text
            console.log('[GEMINI] Attempting to extract JSON from text response');
            // Extract JSON object from the response if it's embedded in text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              console.log('[GEMINI] Found JSON block in response');
              try {
                const cleanedJson = cleanJsonString(jsonMatch[0]);
                parsedContent = JSON.parse(cleanedJson);
              } catch (jsonError) {
                console.log('[GEMINI] Failed to parse extracted JSON:', jsonError.message);
              }
            } else {
              console.log('[GEMINI] No JSON block found, trying direct parse as fallback');
              try {
                const cleanedJson = cleanJsonString(text);
                parsedContent = JSON.parse(cleanedJson);
              } catch (fallbackError) {
                console.log('[GEMINI] Failed fallback parse:', fallbackError.message);
              }
            }
          }
        }
        
        console.log('[GEMINI] Parsed JSON keys:', Object.keys(parsedContent));
        if (Object.keys(parsedContent).length > 0) {
          console.log('[GEMINI] Successfully extracted content from response');
        }
      } catch (parseError) {
        console.error("[GEMINI] Failed to parse JSON from Gemini response:", parseError);
        console.log("[GEMINI] Raw response:", text.substring(0, 500) + (text.length > 500 ? '...' : ''));
        
        // Attempt to extract structured data even from non-JSON response
        console.log('[GEMINI] Attempting to extract structured data using fallback extractors');
        parsedContent = {
          strengths: extractListItems(text, "strengths"),
          improvements: extractListItems(text, "improvements"),
          suggestions: extractListItems(text, "suggestions"),
          summary: extractSummary(text),
          score: extractScore(text)
        };
        
        console.log('[GEMINI] Extracted data using fallback methods:', Object.keys(parsedContent).filter(k => 
          Array.isArray(parsedContent[k]) ? parsedContent[k].length > 0 : parsedContent[k]
        ));
      }
      
      /**
       * Get token usage information using multiple fallback methods:
       * 1. Try to get actual token count from API response (different paths depending on API version)
       * 2. Fall back to estimation based on response length if API doesn't provide token count
       * 
       * NOTE: The Gemini API structure for token usage reporting changes between versions.
       * This code handles multiple known response structures and falls back to estimation
       * when necessary. The estimation method (text length / 4) is an approximation and
       * may not match actual token usage precisely.
       */
      let tokenCount = 0;
      
      // Try to get actual token usage from response metadata (structure varies by API version)
      try {
        // Cast response to our ResponseMetadata interface to access usage data
        const responseMetadata = response as unknown as ResponseMetadata;
        
        // Check multiple potential paths to token usage data based on different API versions
        // These paths have been observed in different versions of the Gemini API
        tokenCount = responseMetadata.candidates?.[0]?.usageMetadata?.totalTokens ||
                    responseMetadata.usageMetadata?.totalTokens ||
                    responseMetadata.usage?.totalTokens ||
                    0; // Default to 0 if none of the above paths exist
                    
        // If we couldn't get token count from API response metadata, estimate from text length
        if (tokenCount === 0) {
          console.info("[GEMINI] Token count not available from Gemini API response, using estimation method");
          tokenCount = Math.ceil(text.length / 4); // Estimation: ~4 characters per token
          console.log(`[GEMINI] Estimated token count: ${tokenCount}`);
        } else {
          console.log(`[GEMINI] Actual token count from API: ${tokenCount}`);
        }
      } catch (e) {
        // If any error occurs while trying to access the response metadata,
        // fall back to text length estimation
        console.warn("[GEMINI] Error accessing Gemini API response metadata for token count:", e);
        tokenCount = Math.ceil(text.length / 4); // Estimation: ~4 characters per token
        console.log(`[GEMINI] Fallback estimated token count: ${tokenCount}`);
      }
      
      // Create our standardized response object with all fields properly initialized
      const standardResponse = {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent as Record<string, unknown>,
        modelName: this.modelName,
        tokenCount: tokenCount
      };
      
      // Log successful completion of multimodal AI generation
      console.log(`[GEMINI] Successfully completed multimodal AI generation with ${this.modelName}`);
      console.log(`[GEMINI] Response contains: ${standardResponse.strengths.length} strengths, ${standardResponse.improvements.length} improvements, score: ${standardResponse.score || 'none'}`);
      
      return standardResponse;
    } catch (error: unknown) {
      console.error("Gemini multimodal API error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Multimodal AI generation failed: ${errorMessage}`);
    }
  }
}

// Helper functions to extract data from non-JSON responses
function extractListItems(text: string, section: string): string[] {
  const regex = new RegExp(`${section}[:\\s]*(.*?)(?=\\n\\n|$)`, 'i');
  const match = text.match(regex);
  if (!match) return [];
  
  const content = match[1];
  // Look for numbered or bulleted lists
  const items = content.split(/\n[-*\d.]\s*/).filter(item => item.trim().length > 0);
  return items.length > 0 ? items : [content];
}

function extractSummary(text: string): string {
  const regex = new RegExp('summary[:\\s]*(.*?)(?=\\n\\n|$)', 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function extractScore(text: string): number | undefined {
  const regex = /score[:\s]*(\d+)/i;
  const match = text.match(regex);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Helper function to manually extract list items from a JSON array string that might be malformed
 * Used by the GeminiAdapter class
 */
function extractListItemsManually(jsonArrayContent: string): string[] {
  // This handles cases where the JSON array is malformed but we can still extract the strings
  const items: string[] = [];
  
  // Match all quoted strings in the array portion
  const stringMatches = jsonArrayContent.match(/"([^"\\]*(\\.[^"\\]*)*)"/g);
  
  if (stringMatches) {
    stringMatches.forEach(match => {
      // Remove the quotes and add to our items array
      const item = match.substring(1, match.length - 1).trim();
      if (item) {
        items.push(item);
      }
    });
  }
  
  return items;
}

/**
 * Helper function to clean a JSON string before attempting to parse it
 * Handles common errors that the AI might make when generating JSON
 */
function cleanJsonString(jsonStr: string): string {
  let cleaned = jsonStr;
  
  // Sometimes the AI adds trailing commas in arrays or objects which is invalid JSON
  // Replace trailing commas in arrays
  cleaned = cleaned.replace(/,\s*]/g, ']');
  
  // Replace trailing commas in objects
  cleaned = cleaned.replace(/,\s*}/g, '}');
  
  // Sometimes the AI includes comments which are not valid in JSON
  // Remove single line comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Fix unescaped quotes in strings (this is tricky and might cause issues)
  // Only attempt if we detect obvious issues
  if (cleaned.includes('\\"') || cleaned.includes('\\\'')) {
    try {
      // Only apply this fix if we detect potential issues
      cleaned = cleaned.replace(/([^\\])"([^"]*)([^\\])"/g, '$1"$2$3\\"');
    } catch (e) {
      // If any error occurs during replacement, just keep the original
      console.log('[GEMINI] Error while trying to fix unescaped quotes:', e);
    }
  }
  
  return cleaned;
}