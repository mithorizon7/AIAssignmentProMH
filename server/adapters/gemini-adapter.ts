/**
 * Gemini AI adapter for the AI Grader platform
 * Using @google/genai SDK with the latest API patterns for version 0.14.0+
 */
// Import the correct types from @google/genai
import { 
  GoogleGenAI, 
  GenerateContentResponse,
  Part,
  FileData
} from '@google/genai';

// Custom types for file data in the format expected by the Gemini API
// Updated to match the latest SDK format requirements
interface GeminiFilePart {
  fileData?: {
    fileUri: string;
    mimeType: string;
  };
  inlineData?: {
    data: string;
    mimeType: string;
  }
}

// Token budget constants for two-step approach
const BASE_MAX_TOKENS = 2000;   // first attempt - increased for better document handling
const RETRY_MAX_TOKENS = 3000;  // if finishReason !== "STOP" - increased for complex documents

// The newest Gemini model is "gemini-2.5-flash-preview-05-20" which was released May 20, 2025
import { ContentType } from '../utils/file-type-settings';
import { AIAdapter, AIAdapterResponse, MultimodalPromptPart } from './interfaces';
import { CriteriaScore } from '@shared/schema';
import { parseStrict } from '../utils/json-parser';
import { GradingFeedback, SCHEMA_VERSION, gradingJSONSchema } from '../schemas/gradingSchema';
import { sanitizeText, detectInjectionAttempt } from '../utils/text-sanitizer';
import { isSchemaError, shouldRetry, SchemaValidationError } from '../utils/schema-errors';
import { pruneForGemini } from '../utils/schema-pruner';
// Fixed import path for file handler functions
import { createFileData, GeminiFileData, shouldUseFilesAPI, MAX_INLINE_IMAGE_SIZE } from '../utils/gemini-file-handler';
import { repairJson } from '../utils/json-repair';

// These are the MIME types supported by Google Gemini API
// Based on https://ai.google.dev/gemini-api/docs/
export const SUPPORTED_MIME_TYPES = {
  // Images
  image: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 
    'image/heic', 'image/heif', 'image/svg+xml', 'image/gif',
    'image/bmp', 'image/tiff'
  ],
  
  // Video 
  video: [
    'video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime',
    'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv'
  ],
  
  // Audio
  audio: [
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm',
    'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/mp3'
  ],
  
  // Documents
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
  ]
};

// This implements the standard AIAdapter interface for Gemini

/**
 * Google Gemini AI adapter for generating feedback
 * Using the latest API methods from the @google/genai SDK
 */
export class GeminiAdapter implements AIAdapter {
  private genAI: GoogleGenAI;
  private modelName: string;
  private processingStart: number;
  
  // Use a pruned version of the JSON schema from gradingSchema.ts
  // Gemini only supports a subset of JSON Schema fields
  private readonly responseSchema: unknown;
  
  // File cache cleanup interval
  private fileCacheCleanupInterval: NodeJS.Timeout | null = null;
  
  // Common configuration for all Gemini requests
  private readonly defaultConfig = {
    temperature: 0.2,
    topP: 0.8,
    topK: 40
  };
  
  /**
   * Core shared method for running image-rubric evaluations
   * This reduces duplication between text and multimodal completion methods
   */
  private async runImageRubric(apiParts: Part[], systemPrompt?: string): Promise<{
    raw: string;
    finishReason: string;
    result: unknown;
    tokenCount?: number;
  }> {
    // Reset processing timer for accurate metrics
    this.processingStart = Date.now();
    
    // Prepare the base request with common parameters
    const requestParams: unknown = {
      model: this.modelName,
      contents: [{ role: 'user', parts: apiParts }],
      systemInstruction: systemPrompt,
      config: {
        ...this.defaultConfig,
        maxOutputTokens: 4000, // Increased from 2000 to prevent JSON truncation
        responseMimeType: "application/json",
        responseSchema: this.responseSchema
      }
    };
    
    // Log if system prompt was added
    if (systemPrompt !== undefined && systemPrompt !== null) {
      console.log(`[GEMINI] Added system prompt as top-level systemInstruction (${systemPrompt.length} chars)`);
    }
    
    console.log(`[GEMINI] Sending request to Gemini API with responseMimeType: application/json`);
    
    // Helper to build request with the specified token cap
    const buildRequest = (cap: number) => {
      const req = { ...requestParams };
      req.config.maxOutputTokens = cap;
      return req;
    };
    
    // Helper to run streaming request and collect all chunks
    const collectStream = async (req: unknown): Promise<{raw: string, finishReason: string, usageMetadata: unknown}> => {
      console.log(`[GEMINI] Using streaming with token limit: ${req.config.maxOutputTokens}`);
      
      const stream = await this.genAI.models.generateContentStream(req);
      let streamedText = '';
      let finishReason = 'STOP'; // Default to successful finish
      let usageMetadata = null; // Will store metadata when available
      
      // Process the stream chunks
      for await (const chunk of stream) {
        // Check for usage metadata in the chunk (typically comes in the last chunk)
        if (chunk.usageMetadata) {
          usageMetadata = chunk.usageMetadata;
          console.log(`[GEMINI] Received usage metadata from stream: `, {
            promptTokenCount: usageMetadata.promptTokenCount,
            candidatesTokenCount: usageMetadata.candidatesTokenCount,
            totalTokenCount: usageMetadata.totalTokenCount
          });
        }
        
        if (chunk.candidates && chunk.candidates?.length > 0) {
          // Get finish reason from the last chunk if available
          if (chunk.candidates[0].finishReason) {
            finishReason = chunk.candidates[0].finishReason;
          }
          
          if (chunk.candidates[0]?.content?.parts) {
            const responsePart = chunk.candidates[0].content.parts[0];
            if (responsePart.text) {
              streamedText += responsePart.text;
            }
          }
        }
      }
      
      console.log(`[GEMINI] Stream received ${streamedText.length} characters, finish reason: ${finishReason}`);
      return { raw: streamedText, finishReason, usageMetadata };
    };
    
    // Run the request once with a specific token limit
    const runOnce = async (cap: number) => collectStream(buildRequest(cap));
    
    // First try with base token limit
    let { raw, finishReason, usageMetadata } = await runOnce(4000);
    
    // If the model stopped early, retry with a higher token limit
    if (finishReason !== 'STOP') {
      console.warn(`[GEMINI] early stop ${finishReason} – retry ↑ tokens`);
      ({ raw, finishReason, usageMetadata } = await runOnce(8000));
    }
    
    // If still having issues, throw an error
    if (finishReason !== 'STOP') {
      throw new Error(`Gemini failed twice (reason: ${finishReason})`);
    }
    
    // Create a response object similar to the API structure
    const result = {
      candidates: [{
        content: {
          parts: [{ text: raw }]
        },
        finishReason
      }],
      // Use actual metadata from the stream (not from request parameters)
      usageMetadata: usageMetadata 
    };
    
    // Get token count from actually captured metadata (no fallbacks)
    const tokenCount = result.usageMetadata?.totalTokenCount;
    
    // Log comprehensive usage information
    if (result.usageMetadata) {
      const retryInfo = finishReason !== 'STOP' ? '(retry required)' : '';
      const metrics = {
        modelName: this.modelName,
        promptTokens: result.usageMetadata.promptTokenCount || 0,
        candidatesTokens: result.usageMetadata.candidatesTokenCount || 0,
        totalTokens: result.usageMetadata.totalTokenCount || 0,
        streamingUsed: true, // Always using streaming now
        partsCount: apiParts.length,
        processingTimeMs: Date.now() - this.processingStart
      };
      
      console.log(`[GEMINI] Response usage metrics ${retryInfo}:`, metrics);
    } else {
      console.log(`[GEMINI] No usage metrics available from API, raw length: ${raw.length} chars`);
    }
    
    // Ensure tokenCount is always a number (even if it's 0)
    const finalTokenCount = tokenCount !== undefined ? tokenCount : 0;
    
    return { 
      raw, 
      finishReason, 
      result, 
      tokenCount: finalTokenCount 
    };
  };
  
  /**
   * Create a new GeminiAdapter instance
   */
  constructor() {
    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    
    // Initialize the Google Generative AI client
    this.genAI = new GoogleGenAI({ apiKey });
    
    // Make model name configurable with environment variable or use default
    this.modelName = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash-preview-05-20";
    
    console.log(`[GEMINI] Initializing with model: ${this.modelName}`);
    
    // Initialize processing timer
    this.processingStart = Date.now();
    
    // Prune the schema to remove fields not supported by Gemini API
    // This prevents the "Unknown name" errors for standard JSON Schema fields
    this.responseSchema = pruneForGemini(gradingJSONSchema);
    
    console.log(`[GEMINI] Schema pruned for Gemini API compatibility`);
    
    // Start file cache cleanup
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    this.fileCacheCleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        console.log(`[GEMINI] Running scheduled file cache cleanup at ${new Date(now).toISOString()}`);
        // The actual cleanup runs in gemini-file-handler.ts
      } catch (error) {
        console.error(`[GEMINI] File cache cleanup error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, CLEANUP_INTERVAL);
  }
  
  /**
   * Standard text completion
   */
  async generateCompletion(prompt: string, systemPrompt?: string): Promise<AIAdapterResponse> {
    try {
      console.log(`[GEMINI] Generating completion with prompt length: ${prompt.length} chars`);
      // Log preview of the prompt, truncated for privacy/security
      console.log(`[GEMINI] Prompt preview: ${prompt.slice(0, 250)}${prompt?.length > 0 && 250 ? '...' : ''}`);
      
      // Sanitize input text to prevent prompt injection and other issues
      const sanitizedPrompt = sanitizeText(prompt, 8000);
      
      // Check for potential injection attempts
      const potentialInjection = detectInjectionAttempt(prompt);
      if (potentialInjection !== undefined && potentialInjection !== null) {
        console.warn(
          `[GEMINI] Potential prompt injection detected in input: ` +
          `${prompt.slice(0, 120)}${prompt?.length > 0 && 120 ? '...' : ''}`
        );
      }
      
      // Log if text was truncated
      if (sanitizedPrompt.length < prompt.length) {
        console.log(`[GEMINI] Input text truncated from ${prompt.length} to ${sanitizedPrompt.length} characters`);
      }
      
      // Prepare a single text part for the API
      const apiParts = [{ text: sanitizedPrompt }];
      
      // Use our shared image-rubric helper (works for text-only too)
      const { raw, result, tokenCount } = await this.runImageRubric(apiParts, systemPrompt);
      
      // Try parsing the response as JSON
      let parsedContent: GradingFeedback;
      try {
        parsedContent = await parseStrict(raw);
        
        // Create a properly formatted AIAdapterResponse
        const response: AIAdapterResponse = {
          ...parsedContent,
          modelName: this.modelName,
          rawResponse: JSON.parse(raw),
          tokenCount: tokenCount !== undefined ? tokenCount : 0,
          _promptTokens: result.usageMetadata?.promptTokenCount,
          _totalTokens: tokenCount !== undefined ? tokenCount : 0
        };
        
        console.log(`[GEMINI] Successfully parsed response JSON (${raw.length} chars)`);
        return response;
      } catch (error) {
        console.error(`[GEMINI] Failed to parse response JSON: ${error instanceof Error ? error.message : String(error)}`);
        
        // Rethrow with the raw response for debugging
        throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : String(error)}\nRaw: ${raw.slice(0, 200)}...`);
      }
    } catch (error) {
      // Enhanced error handling
      console.error(`[GEMINI] Error generating completion: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`[GEMINI] Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }
  
  /**
   * Multimodal completion (text + images, etc.)
   */
  async generateMultimodalCompletion(
    multimodalPromptParts: MultimodalPromptPart[], 
    systemPrompt?: string
  ): Promise<AIAdapterResponse> {
    try {
      console.log(`[GEMINI] Generating multimodal completion with ${multimodalPromptParts.length} parts`);
      
      // Reset processing timer
      this.processingStart = Date.now();
      
      // Convert our MultimodalPromptParts to Gemini's Part format
      const apiParts: Part[] = [];
      
      // Track files to cleanup from cache later
      const fileDataList: GeminiFileData[] = [];
      
      // Process each prompt part
      for (const promptPart of multimodalPromptParts) {
        // Text part
        if (promptPart.type === 'text' && typeof promptPart.content === 'string') {
          const sanitizedText = sanitizeText(promptPart.content, 8000);
          
          // Check for potential injection attempts
          const potentialInjection = detectInjectionAttempt(promptPart.content);
          if (potentialInjection !== undefined && potentialInjection !== null) {
            console.warn(
              `[GEMINI] Potential prompt injection detected in text part: ` +
              `${promptPart.content.slice(0, 120)}${promptPart.content?.length > 0 && 120 ? '...' : ''}`
            );
          }
          
          // Log if text was truncated
          if (sanitizedText.length < promptPart.content.length) {
            console.log(`[GEMINI] Text part truncated from ${promptPart.content.length} to ${sanitizedText.length} characters`);
          }
          
          apiParts.push({ text: sanitizedText });
        }
        // Image or other file content
        else if (promptPart.mimeType) {
          let contentType: ContentType = 'image';
          
          // Determine content type from MIME type
          if (SUPPORTED_MIME_TYPES.video.includes(promptPart.mimeType)) {
            contentType = 'video';
          } else if (SUPPORTED_MIME_TYPES.audio.includes(promptPart.mimeType)) {
            contentType = 'audio';
          } else if (SUPPORTED_MIME_TYPES.document.includes(promptPart.mimeType)) {
            contentType = 'document';
          }
          
          // Handle the special case of SVG, which needs to be treated differently
          const isSVG = promptPart.mimeType === 'image/svg+xml';
          
          // Determine if we should use the Files API for this content
          // Ensure mimeType is a string before passing it to shouldUseFilesAPI
          const mimeType = typeof promptPart.mimeType === 'string' ? promptPart.mimeType : 'application/octet-stream';
          
          // Get content length safely from either string or Buffer
          const contentLength = Buffer.isBuffer(promptPart.content) 
            ? promptPart.content.length 
            : (typeof promptPart.content === 'string' ? Buffer.from(promptPart.content).length : 0);
            
          // Add safety check to ensure we have valid content
          if (contentLength <= 0) {
            console.error(`[GEMINI] Invalid content length for ${contentType} with MIME type ${mimeType}: ${contentLength}`);
            throw new Error(`Invalid or empty content for ${contentType} with MIME type ${mimeType}`);
          }
            
          const useFilesAPI = shouldUseFilesAPI(mimeType, contentLength);
          
          try {
            // Create the appropriate file data representation
            // Always use Files API for document content types
            if (useFilesAPI || contentType === 'document') {
              console.log(`[GEMINI] Using Files API for ${contentType} content (${(contentLength / 1024).toFixed(1)}KB, MIME: ${mimeType})`);
              
              // Pass content as-is to createFileData
              const fileData = await createFileData(this.genAI, promptPart.content, mimeType);
              fileDataList.push(fileData);
              
              // Create properly typed fileData structure with correct format for Gemini API
              // Updated to match the required data field format in newer SDK versions
              // Create properly typed part structure
              const filePart: Part = {
                fileData: {
                  fileUri: fileData.fileUri,
                  mimeType: fileData.mimeType
                }
              };
              apiParts.push(filePart);
            } else {
              // Use inline data for smaller images
              console.log(`[GEMINI] Using inline data URI for ${contentType} content (${(promptPart.content.length / 1024).toFixed(1)}KB, MIME: ${promptPart.mimeType})`);
              
              // For inline files, use a data URI
              // Handle both string and Buffer content types safely
              let inlineData = '';
              
              if (typeof promptPart.content === 'string') {
                // If it's already a data URI, use it as is
                if (promptPart.content.startsWith('data:')) {
                  inlineData = promptPart.content;
                } else {
                  // Convert string to base64 data URI
                  inlineData = `data:${mimeType};base64,${Buffer.from(promptPart.content).toString('base64')}`;
                }
              } else if (Buffer.isBuffer(promptPart.content)) {
                // Convert Buffer to base64 data URI
                inlineData = `data:${mimeType};base64,${promptPart.content.toString('base64')}`;
              } else {
                // Fallback for other content types
                inlineData = `data:${mimeType};base64,${Buffer.from(String(promptPart.content)).toString('base64')}`;
              }
              
              // Using the appropriate part structure
              // For images, use the inlineData property
              if (contentType === 'image' && !isSVG) {
                // We know inlineData is a string at this point
                const dataParts = inlineData.split(',');
                const base64Data = dataParts?.length > 0 && 1 ? dataParts[1] : inlineData;
                
                apiParts.push({
                  inlineData: {
                    mimeType: promptPart.mimeType,
                    data: base64Data // Remove the data:mime/type;base64, prefix if present
                  }
                });
              } else {
                // SVGs and other file types need to be uploaded even when small
                const fileData = await createFileData(this.genAI, promptPart.content, promptPart.mimeType);
                fileDataList.push(fileData);
                
                // Create properly typed part structure directly
                const filePart: Part = {
                  fileData: {
                    fileUri: fileData.fileUri,
                    mimeType: fileData.mimeType
                  }
                };
                apiParts.push(filePart);
              }
            }
          } catch (error) {
            console.error(`[GEMINI] Error processing ${contentType} content: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to process ${contentType} content: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      // Use our shared image-rubric helper for the API call
      const { raw, result, tokenCount } = await this.runImageRubric(apiParts, systemPrompt);
      
      // Try parsing the response as JSON
      let parsedContent: GradingFeedback;
      try {
        parsedContent = await parseStrict(raw);
        
        // Create a properly formatted AIAdapterResponse
        const response: AIAdapterResponse = {
          ...parsedContent,
          modelName: this.modelName,
          rawResponse: JSON.parse(raw),
          tokenCount: tokenCount ? tokenCount : 0,
          _promptTokens: result.usageMetadata?.promptTokenCount,
          _totalTokens: tokenCount ? tokenCount : 0
        };
        
        console.log(`[GEMINI] Successfully parsed response JSON (${raw.length} chars)`);
        return response;
      } catch (error) {
        console.error(`[GEMINI] Failed to parse response JSON: ${error instanceof Error ? error.message : String(error)}`);
        
        // Try to repair JSON if it's truncated - the parseStrict function now handles this internally
        if (raw && (raw.includes('"criteriaScores":') || raw.includes('"overallFeedback":'))) {
          try {
            console.log('[GEMINI] Attempting to repair potentially truncated JSON');
            parsedContent = await parseStrict(raw); // parseStrict now handles repair internally
            
            // Create a properly formatted AIAdapterResponse
            const response: AIAdapterResponse = {
              ...parsedContent,
              modelName: this.modelName,
              rawResponse: parsedContent, // Use parsed content directly
              tokenCount: tokenCount ? tokenCount : 0,
              _promptTokens: result.usageMetadata?.promptTokenCount,
              _totalTokens: tokenCount ? tokenCount : 0
            };
            
            console.log(`[GEMINI] Successfully parsed JSON response after repair attempt`);
            return response;
          } catch (repairError) {
            console.error(`[GEMINI] Repair attempt failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`);
          }
        }
        
        // Rethrow with the raw response for debugging
        throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : String(error)}\nRaw: ${raw.slice(0, 200)}...`);
      }
    } catch (error) {
      // Enhanced error handling
      console.error(`[GEMINI] Error generating multimodal completion: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`[GEMINI] Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }
}