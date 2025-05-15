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

// The newest Gemini model is "gemini-2.5-flash-preview-04-17" which was released April 17, 2025
import { ContentType } from '../utils/file-type-settings';
import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { CriteriaScore } from '@shared/schema';
import { parseStrict, shouldRetry } from '../utils/json-parser';
import { GradingFeedback } from '../schemas/gradingSchema';

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
  }

  // Define response schema structure once for reuse
  private responseSchema = {
    type: "object",
    properties: {
      strengths: {
        type: "array",
        items: { type: "string" }
      },
      improvements: {
        type: "array",
        items: { type: "string" }
      },
      suggestions: {
        type: "array",
        items: { type: "string" }
      },
      summary: { type: "string" },
      score: { type: "number" },
      criteriaScores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criteriaId: { type: "string" },
            score: { type: "number" },
            feedback: { type: "string" }
          }
        }
      }
    },
    required: ["strengths", "improvements", "suggestions", "summary", "score"]
  };
  
  /**
   * Standard text completion
   */
  async generateCompletion(prompt: string, systemPrompt?: string) {
    try {
      console.log(`[GEMINI] Generating completion with prompt length: ${prompt.length} chars`);
      
      // Reset processing timer
      this.processingStart = Date.now();
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
      // Prepare the request with proper placement of systemInstruction as a top-level field
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
      
      // Function to handle a single API request with retry capability
      const gradeWithRetry = async (): Promise<GenerateContentResponse> => {
        try {
          return await this.genAI.models.generateContent(requestParams);
        } catch (e: any) {
          // If the error is one that might be resolved with a retry, try once more
          if (shouldRetry(e)) {
            console.log(`[GEMINI] API call failed with error that warrants retry: ${e.message}`);
            console.log(`[GEMINI] Retrying API call once...`);
            return await this.genAI.models.generateContent(requestParams);
          }
          throw e;
        }
      };
      
      // Make the API call with a single retry if needed
      const result = await gradeWithRetry();
      
      // Log usage information for monitoring
      if (result.usageMetadata) {
        console.log(`[GEMINI] Response usage metadata:`, result.usageMetadata);
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
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse and validate the response with our strict parser 
      console.log(`[GEMINI] Parsing and validating JSON with schema`);
      
      let parsedContent: GradingFeedback;
      
      try {
        // Use the strict parser that validates against schema
        parsedContent = parseStrict(text);
        console.log(`[GEMINI] Successfully parsed and validated JSON response`);
      } catch (error) {
        console.error(`[GEMINI] JSON parsing or validation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Failed to parse or validate AI response: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Track performance
      const processingEnd = Date.now();
      
      // Return the parsed and validated content
      return {
        ...parsedContent,
        modelName: this.modelName,
        rawResponse: text,
        processTime: (processingEnd - this.processingStart)
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
          // Text parts are straightforward
          apiParts.push({ 
            text: part.text 
          });
        } 
        else if (part.type === 'image' && part.base64Data) {
          // Image parts need specific formatting with MIME type and base64
          apiParts.push({
            inlineData: {
              data: part.base64Data,
              mimeType: part.mimeType || 'image/jpeg'
            }
          });
        }
        else if (part.type === 'file' && part.fileData) {
          // File data also needs specific formatting
          apiParts.push({
            fileData: {
              mimeType: part.mimeType || 'application/octet-stream',
              fileUri: part.fileData
            }
          });
        }
      }
      
      // Log the number of parts being sent
      console.log(`[GEMINI] Sending ${apiParts.length} parts to the API`);
      
      // Generate config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
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
      
      console.log(`[GEMINI] Sending multimodal request to Gemini API with responseMimeType: application/json`);
      
      // Function to handle a single API request with retry capability
      const gradeWithRetry = async (): Promise<GenerateContentResponse> => {
        try {
          return await this.genAI.models.generateContent(requestParams);
        } catch (e: any) {
          // If the error is one that might be resolved with a retry, try once more
          if (shouldRetry(e)) {
            console.log(`[GEMINI] API call failed with error that warrants retry: ${e.message}`);
            console.log(`[GEMINI] Retrying API call once...`);
            return await this.genAI.models.generateContent(requestParams);
          }
          throw e;
        }
      };
      
      // Generate content with the model, with retry
      const result = await gradeWithRetry();
      
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
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse and validate the response with our strict parser 
      console.log(`[GEMINI] Parsing and validating JSON with schema`);
      
      let parsedContent: GradingFeedback;
      
      try {
        // Use the strict parser that validates against schema
        parsedContent = parseStrict(text);
        console.log(`[GEMINI] Successfully parsed and validated JSON response`);
      } catch (error) {
        console.error(`[GEMINI] JSON parsing or validation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Failed to parse or validate AI response: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Track performance
      const processingEnd = Date.now();
      
      // Return the parsed content
      return {
        ...parsedContent,
        modelName: this.modelName,
        rawResponse: text,
        processTime: (processingEnd - this.processingStart)
      };
    } catch (error) {
      console.error(`[GEMINI] Error in generateMultimodalCompletion: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Check if a file type is supported by the Gemini API
   */
  isSupportedMimeType(mimeType: string): boolean {
    return (
      SUPPORTED_MIME_TYPES.image.includes(mimeType) ||
      SUPPORTED_MIME_TYPES.video.includes(mimeType) ||
      SUPPORTED_MIME_TYPES.audio.includes(mimeType) ||
      SUPPORTED_MIME_TYPES.document.includes(mimeType)
    );
  }
  
  /**
   * Get the content type category for a given MIME type
   */
  getContentType(mimeType: string): ContentType | undefined {
    if (SUPPORTED_MIME_TYPES.image.includes(mimeType)) {
      return 'image';
    } else if (SUPPORTED_MIME_TYPES.video.includes(mimeType)) {
      return 'video';
    } else if (SUPPORTED_MIME_TYPES.audio.includes(mimeType)) {
      return 'audio';
    } else if (SUPPORTED_MIME_TYPES.document.includes(mimeType)) {
      return 'document';
    }
    return undefined;
  }
}