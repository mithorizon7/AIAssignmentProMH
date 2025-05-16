/**
 * Gemini AI adapter for the AI Grader platform
 * Using @google/genai SDK with the latest API patterns for version 0.14.0+
 */
// Import the correct types from @google/genai
import { 
  GoogleGenAI, 
  GenerateContentResponse,
  Part
} from '@google/genai';

// Token budget constants for two-step approach
const BASE_MAX_TOKENS = 1200;   // first attempt
const RETRY_MAX_TOKENS = 1600;  // if finishReason !== "STOP"

// The newest Gemini model is "gemini-2.5-flash-preview-04-17" which was released April 17, 2025
import { ContentType } from '../utils/file-type-settings';
import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { CriteriaScore } from '@shared/schema';
import { parseStrict } from '../utils/json-parser';
import { GradingFeedback, SCHEMA_VERSION, gradingJSONSchema } from '../schemas/gradingSchema';
import { sanitizeText, detectInjectionAttempt } from '../utils/text-sanitizer';
import { isSchemaError, shouldRetry, SchemaValidationError } from '../utils/schema-errors';
import { pruneForGemini } from '../utils/schema-pruner';
import { createFileData, GeminiFileData, toSDKFormat, shouldUseFilesAPI } from '../utils/gemini-file-handler';
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
  private readonly responseSchema: any;
  
  // File cache cleanup interval
  private fileCacheCleanupInterval: NodeJS.Timeout | null = null;
  
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
    this.modelName = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash-preview-04-17";
    
    console.log(`[GEMINI] Initializing with model: ${this.modelName}`);
    
    // Initialize processing timer
    this.processingStart = Date.now();
    
    // Prune the schema to remove fields not supported by Gemini API
    // This prevents the "Unknown name" errors for standard JSON Schema fields
    this.responseSchema = Object.freeze(pruneForGemini(gradingJSONSchema));
    
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
  async generateCompletion(prompt: string, systemPrompt?: string) {
    try {
      console.log(`[GEMINI] Generating completion with prompt length: ${prompt.length} chars`);
      // Log preview of the prompt, truncated for privacy/security
      console.log(`[GEMINI] Prompt preview: ${prompt.slice(0, 250)}${prompt.length > 250 ? '...' : ''}`);
      
      // Reset processing timer
      this.processingStart = Date.now();
      
      // Sanitize input text to prevent prompt injection and other issues
      const sanitizedPrompt = sanitizeText(prompt, 8000);
      
      // Check for potential injection attempts
      const potentialInjection = detectInjectionAttempt(prompt);
      if (potentialInjection) {
        console.warn(
          `[GEMINI] Potential prompt injection detected in input: ` +
          `${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}`
        );
      }
      
      // Log if text was truncated
      if (sanitizedPrompt.length < prompt.length) {
        console.log(`[GEMINI] Input text truncated from ${prompt.length} to ${sanitizedPrompt.length} characters`);
      }
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      let maxOutputTokens = BASE_MAX_TOKENS;
      
      // Prepare the request with proper placement of systemInstruction as a top-level field
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: sanitizedPrompt }] }],
        // systemInstruction is now a top-level field, not inside config
        systemInstruction: systemPrompt, 
        config: {
          temperature,
          topP, 
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema
        }
      };
      
      // Log if system prompt was added
      if (systemPrompt) {
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
      const collectStream = async (req: any): Promise<{raw: string, finishReason: string}> => {
        console.log(`[GEMINI] Using streaming with token limit: ${req.config.maxOutputTokens}`);
        
        const stream = await this.genAI.models.generateContentStream(req);
        let streamedText = '';
        let finishReason = 'STOP'; // Default to successful finish
        
        // Process the stream chunks
        for await (const chunk of stream) {
          if (chunk.candidates && chunk.candidates.length > 0) {
            // Get finish reason from the last chunk if available
            if (chunk.candidates[0].finishReason) {
              finishReason = chunk.candidates[0].finishReason;
            }
            
            if (chunk.candidates[0]?.content?.parts) {
              const part = chunk.candidates[0].content.parts[0];
              if (part.text) {
                streamedText += part.text;
              }
            }
          }
        }
        
        console.log(`[GEMINI] Stream received ${streamedText.length} characters, finish reason: ${finishReason}`);
        return { raw: streamedText, finishReason };
      };
      
      // Run the request once with a specific token limit
      const runOnce = async (cap: number) => collectStream(buildRequest(cap));
      
      // First try with base token limit
      let { raw, finishReason } = await runOnce(BASE_MAX_TOKENS);
      
      // If the model stopped early, retry with a higher token limit
      if (finishReason !== 'STOP') {
        console.warn(`[GEMINI] early stop ${finishReason} – retry ↑ tokens`);
        ({ raw, finishReason } = await runOnce(RETRY_MAX_TOKENS));
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
        usageMetadata: requestParams.usageMetadata
      };
      
      // Log comprehensive usage information for monitoring
      if (result.usageMetadata) {
        const retryInfo = finishReason !== 'STOP' ? '(retry required)' : '';
        const metrics = {
          modelName: this.modelName,
          promptTokens: result.usageMetadata.promptTokenCount || 0,
          candidatesTokens: result.usageMetadata.candidatesTokenCount || 0,
          totalTokens: result.usageMetadata.totalTokenCount || 0,
          streamingUsed: true, // Always using streaming now
          processingTimeMs: Date.now() - this.processingStart
        };
        
        console.log(`[GEMINI] Response usage metrics ${retryInfo}:`, metrics);
      } else {
        // Log when we don't get usage metrics from the API
        console.log(`[GEMINI] No usage metrics available from API, metrics will be incomplete`);
      }
      
      // Extract text from the response
      let text = '';
      
      if (result.candidates && 
          result.candidates.length > 0 && 
          result.candidates[0]?.content?.parts) {
        const firstPart = result.candidates[0].content.parts[0];
        if (firstPart.text) {
          text = firstPart.text;
        } else {
          console.warn('[GEMINI] Response text not found in expected location');
          text = JSON.stringify(result);
        }
      } else {
        console.warn('[GEMINI] Could not extract text response from standard structure');
        text = JSON.stringify(result);
      }
      
      console.log(`[GEMINI] Response received, length: ${text.length} characters`);
      // Only log validity, not actual content for privacy
      console.log(`[GEMINI] Response format check - appears to be valid JSON: ${text.trim().startsWith('{') && text.trim().endsWith('}')}`);
      
      // Parse and validate the response with our strict parser 
      console.log(`[GEMINI] Parsing and validating JSON with schema`);
      
      let parsedContent: GradingFeedback;
      
      try {
        // Use the strict parser that validates against schema
        parsedContent = parseStrict(text);
        console.log(`[GEMINI] Successfully parsed and validated JSON response`);
      } catch (error) {
        console.error(`[GEMINI] JSON parsing or validation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new SchemaValidationError(
          `Gemini returned JSON that failed schema validation`, 
          text, 
          error
        );
      }
      
      // Use the actual token count from API if available, or set a reasonable default
      // Don't use fallback values for token count to avoid bogus cost data
      const tokenCount = result.usageMetadata?.totalTokenCount;
      
      // Return the parsed and validated content in the expected interface format
      return {
        ...parsedContent,
        modelName: this.modelName,
        rawResponse: JSON.parse(text), // Convert string to Record<string, unknown>
        tokenCount: tokenCount ?? 0 // Use 0 as fallback for the interface requirement
      };
    } catch (error) {
      console.error(`[GEMINI] Error in generateCompletion: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Multimodal completion (text + images, etc.)
   */
  async generateMultimodalCompletion(
    parts: MultimodalPromptPart[],
    systemPrompt?: string
  ) {
    try {
      console.log(`[GEMINI] Generating multimodal completion with ${parts.length} parts`);
      
      // Reset processing timer
      this.processingStart = Date.now();
      
      // Prepare content parts in the format expected by the API
      const apiParts: Part[] = [];
      
      // Process each part based on its type
      for (const part of parts) {
        if (part.type === 'text') {
          // Text parts need sanitization
          const originalText = part.content as string;
          const sanitizedText = sanitizeText(originalText, 8000);
          
          // Check for potential injection attempts
          const potentialInjection = detectInjectionAttempt(originalText);
          if (potentialInjection) {
            console.warn(
              `[GEMINI] Potential prompt injection detected in multimodal text input: ` +
              `${originalText.slice(0, 120)}${originalText.length > 120 ? '...' : ''}`
            );
          }
          
          // Log if text was truncated
          if (sanitizedText.length < originalText.length) {
            console.log(`[GEMINI] Multimodal text truncated from ${originalText.length} to ${sanitizedText.length} characters`);
          }
          
          apiParts.push({ 
            text: sanitizedText 
          });
        } 
        else if (part.type === 'image') {
          try {
            // Get file size to determine best handling approach
            let fileSize = 0;
            
            if (Buffer.isBuffer(part.content)) {
              fileSize = part.content.length;
            } else if (typeof part.content === 'string' && part.content.startsWith('data:')) {
              // It's a data URL, extract the base64 part and calculate size
              const base64Data = part.content.split(',')[1];
              fileSize = base64Data ? Math.ceil(base64Data.length * 0.75) : 0;  // base64 is ~4/3 of binary size
            }
            
            const IMAGE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB threshold for Files API
            
            if (fileSize > IMAGE_SIZE_THRESHOLD) {
              console.log(`[GEMINI] Large image detected (${(fileSize / (1024 * 1024)).toFixed(2)}MB), using Files API`);
              
              // Use Files API for large images
              const fileData = await createFileData(
                this.genAI,
                part.content as Buffer | string,
                part.mimeType || 'image/jpeg'
              );
              
              // Add file data using snake_case format for the API
              apiParts.push({
                file_data: fileData
              });
              
              console.log(`[GEMINI] Successfully uploaded large image to Files API`);
            } else {
              // Convert Buffer to base64 string if needed
              const base64Data = Buffer.isBuffer(part.content)
                ? part.content.toString('base64')
                : part.content as string;
                
              // Standard image handling for smaller files
              apiParts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: part.mimeType || 'image/jpeg'
                }
              });
              
              console.log(`[GEMINI] Added inline image data (${(fileSize / 1024).toFixed(2)}KB)`);
            }
          } catch (error) {
            console.error(`[GEMINI] Error processing image: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        else if (part.type === 'file') {
          try {
            // All document files go through the Files API
            console.log(`[GEMINI] Processing file with MIME type: ${part.mimeType}`);
            
            // Upload the file to Gemini Files API
            const fileData = await createFileData(
              this.genAI,
              part.content as Buffer | string,
              part.mimeType || 'application/octet-stream'
            );
            
            // Add file data using snake_case format for the API
            apiParts.push({
              file_data: fileData
            });
            
            console.log(`[GEMINI] Successfully uploaded file to Files API with URI: ${fileData.file_uri}`);
          } catch (error) {
            console.error(`[GEMINI] Error processing file: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to process file: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        else {
          console.warn(`[GEMINI] Unsupported content type: ${part.type}`);
        }
      }
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      let maxOutputTokens = BASE_MAX_TOKENS;
      
      // Create the request object with responseSchema for JSON output
      const requestParams: any = {
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: apiParts
          }
        ],
        // Place systemInstruction at the top level, not inside config
        systemInstruction: systemPrompt,
        config: {
          temperature,
          topP,
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema
        }
      };
      
      if (systemPrompt) {
        console.log(`[GEMINI] Added system prompt as top-level systemInstruction (${systemPrompt.length} chars)`);
      }
      
      // Helper to build request with the specified token cap
      const buildRequest = (cap: number) => {
        const req = { ...requestParams };
        req.config.maxOutputTokens = cap;
        return req;
      };
      
      // Helper to run streaming request and collect all chunks
      const collectStream = async (req: any): Promise<{raw: string, finishReason: string}> => {
        console.log(`[GEMINI] Using streaming for multimodal with token limit: ${req.config.maxOutputTokens}`);
        
        const stream = await this.genAI.models.generateContentStream(req);
        let streamedText = '';
        let finishReason = 'STOP'; // Default to successful finish
        
        // Process the stream chunks
        for await (const chunk of stream) {
          if (chunk.candidates && chunk.candidates.length > 0) {
            // Get finish reason from the last chunk if available
            if (chunk.candidates[0].finishReason) {
              finishReason = chunk.candidates[0].finishReason;
            }
            
            if (chunk.candidates[0]?.content?.parts) {
              const part = chunk.candidates[0].content.parts[0];
              if (part.text) {
                streamedText += part.text;
              }
            }
          }
        }
        
        console.log(`[GEMINI] Multimodal stream received ${streamedText.length} characters, finish reason: ${finishReason}`);
        return { raw: streamedText, finishReason };
      };
      
      // Run the request once with a specific token limit
      const runOnce = async (cap: number) => collectStream(buildRequest(cap));
      
      // First try with base token limit
      let { raw, finishReason } = await runOnce(BASE_MAX_TOKENS);
      
      // If the model stopped early, retry with a higher token limit
      if (finishReason !== 'STOP') {
        console.warn(`[GEMINI] Multimodal early stop ${finishReason} – retry with increased token limit`);
        ({ raw, finishReason } = await runOnce(RETRY_MAX_TOKENS));
      }
      
      // If still having issues, throw an error
      if (finishReason !== 'STOP') {
        throw new Error(`Gemini failed twice for multimodal content (reason: ${finishReason})`);
      }
      
      // Create a response object similar to the API structure
      const result = {
        candidates: [{
          content: {
            parts: [{ text: raw }]
          },
          finishReason
        }],
        usageMetadata: requestParams.usageMetadata
      };
      
      // Log JSON response content for debugging (truncated for privacy/security)
      console.log(`[GEMINI] Multimodal streaming complete, received ${raw.length} characters, finish reason: ${finishReason}`);

      // Extract and parse the JSON text
      let text = raw;
      
      // Verify the text is valid JSON
      console.log(`[GEMINI] Multimodal response format check - appears to be valid JSON: ${text.trim().startsWith('{') && text.trim().endsWith('}')}`);
      
      // Parse and validate the response with our strict parser 
      console.log(`[GEMINI] Parsing and validating multimodal JSON with schema`);
      
      let parsedContent: GradingFeedback;
      
      try {
        // Use the strict parser that validates against schema
        parsedContent = parseStrict(text);
        console.log(`[GEMINI] Successfully parsed and validated multimodal JSON response`);
      } catch (error) {
        console.error(`[GEMINI] Multimodal JSON parsing or validation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new SchemaValidationError(
          `Gemini returned multimodal JSON that failed schema validation`, 
          text, 
          error
        );
      }
      
      let tokenCount = 0;
      
      // Log comprehensive usage information
      if (result.usageMetadata) {
        // Use actual token count from API if available
        tokenCount = result.usageMetadata.totalTokenCount;
        
        // Log comprehensive usage information
        const retryInfo = finishReason !== 'STOP' ? '(retry required)' : '';
        const metrics = {
          modelName: this.modelName,
          promptTokens: result.usageMetadata.promptTokenCount || 0,
          candidatesTokens: result.usageMetadata.candidatesTokenCount || 0,
          totalTokens: result.usageMetadata.totalTokenCount || 0,
          streamingUsed: true, // Always using streaming now
          multimodalParts: apiParts.length,
          processingTimeMs: Date.now() - this.processingStart
        };
        
        console.log(`[GEMINI] Multimodal response usage metrics ${retryInfo}:`, metrics);
      } else {
        // Only use the actual token count from API, no fallbacks to avoid bogus cost data
        // as per recommendation #4
        tokenCount = result.usageMetadata?.totalTokenCount;
        
        console.log(`[GEMINI] Multimodal content processed, token count: ${tokenCount ?? 'not available'}`);
      }
      
      // Return the parsed content with the interface-required format
      return {
        ...parsedContent,
        modelName: this.modelName,
        rawResponse: JSON.parse(text), // Convert string to Record<string, unknown>
        tokenCount: tokenCount ?? 0 // Use 0 as fallback for the interface requirement
      };
    } catch (error) {
      console.error(`[GEMINI] Error in generateMultimodalCompletion: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
