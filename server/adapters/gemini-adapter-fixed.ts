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
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  audio: ['audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm'],
  video: ['video/mp4', 'video/mpeg', 'video/webm'],
  document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

export class GeminiAdapter implements AIAdapter {
  private modelName: string;
  private genAI: GoogleGenAI;
  private model: any;
  private safetySettings: any[];
  private token: string;

  constructor(token: string, modelName: string = 'gemini-2.5-flash-preview-04-17') {
    this.token = token;
    this.modelName = modelName;
    
    this._initializeClient();
    
    // Default safety settings (appropriate for most educational contexts)
    this.safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH'
      }
    ];
  }
  
  /**
   * Initialize the Gemini client
   * @private
   */
  private _initializeClient() {
    // Initialize the Google Generative AI client
    this.genAI = new GoogleGenAI(this.token);
    
    // Get the model (with common configuration)
    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      safetySettings: this.safetySettings
    });
    
    console.log(`[GEMINI] Initialized adapter with model: ${this.modelName}`);
  }
  
  /**
   * Collect streamed content and metadata from Gemini
   * @param request Request object to stream
   * @returns Object with raw text, finish reason, and metadata
   */
  private async collectStream(request: any) {
    console.log('[GEMINI] Sending streaming request to Gemini API...');
    
    const stream = await this.model.generateContentStream(request);
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
    return { raw: streamedText, finishReason, usageMetadata };
  }
  
  /**
   * Generate completion with Gemini for a text prompt
   * Implements the AIAdapter interface
   * @param prompt Text prompt to send to Gemini
   * @param systemPrompt Optional system prompt that instructs the model
   * @returns Grading feedback for the submission according to AIAdapter interface
   */
  async generateCompletion(prompt: string, systemPrompt?: string): Promise<{
    strengths: string[];
    improvements: string[];
    suggestions: string[];
    summary: string;
    score?: number;
    criteriaScores?: CriteriaScore[];
    rawResponse: Record<string, unknown>;
    modelName: string;
    tokenCount: number;
  }> {
    // Validate and sanitize input
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Empty prompt provided');
    }
    
    // Check for potential injection attacks
    if (detectInjectionAttempt(prompt)) {
      throw new Error('Potential prompt injection detected');
    }
    
    const sanitizedPrompt = sanitizeText(prompt);
    
    // Prepare the request for the model
    // Using responseMimeType for more reliable JSON parsing
    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: sanitizedPrompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: BASE_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: pruneForGemini(gradingJSONSchema)
      },
      safetySettings: this.safetySettings
    };
    
    // Add system prompt if provided
    if (systemPrompt && systemPrompt.trim().length > 0) {
      request.contents.unshift({
        role: 'system',
        parts: [{ text: systemPrompt }]
      });
    }
    
    try {
      // Use streaming for more reliable response handling
      const result = await this.collectStream(request);
      
      // If result indicates stop was due to token limit, retry with larger token budget
      if (result.finishReason === 'MAX_TOKENS' || result.raw.endsWith('}') === false) {
        console.log('[GEMINI] Response was cut off, retrying with higher token budget');
        
        // Update the request with higher token budget
        request.generationConfig.maxOutputTokens = RETRY_MAX_TOKENS;
        
        // Retry with higher token budget
        const retryResult = await this.collectStream(request);
        
        // If still cut off, try to repair the JSON
        if (retryResult.finishReason === 'MAX_TOKENS' || !retryResult.raw.endsWith('}')) {
          console.log('[GEMINI] Response still cut off, attempting to repair JSON');
          const repairedJson = repairJson(retryResult.raw);
          console.log(`[GEMINI] Repaired JSON (${repairedJson.length} chars)`);
          
          // Update the raw result with repaired JSON
          retryResult.raw = repairedJson;
        }
        
        // Use the retry result
        result.raw = retryResult.raw;
        result.finishReason = retryResult.finishReason;
        
        // Merge usage metadata to get total token count
        if (retryResult.usageMetadata) {
          result.usageMetadata = retryResult.usageMetadata;
        }
      }
      
      // Get token count from API-reported usage metadata
      const tokenCount = result.usageMetadata?.totalTokenCount || 0;
      
      // Extract raw response from result
      const raw = result.raw;
      
      // Try parsing the response as JSON
      let parsedContent: GradingFeedback;
      try {
        parsedContent = await parseStrict(raw);
        
        console.log(`[GEMINI] Successfully parsed response JSON (${raw.length} chars)`);
        
        // Return a properly formatted AIAdapterResponse with all required fields
        return {
          ...parsedContent,
          modelName: this.modelName,
          rawResponse: JSON.parse(raw),
          tokenCount: tokenCount
        };
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
   * Generate completion with Gemini for a multimodal prompt (text + images)
   * Implements the AIAdapter interface
   * @param parts Array of multimodal prompt parts (text, images, etc.)
   * @param systemPrompt Optional system prompt that instructs the model
   * @returns Grading feedback for the submission according to AIAdapter interface
   */
  async generateMultimodalCompletion(
    multimodalPromptParts: MultimodalPromptPart[],
    systemPrompt?: string
  ): Promise<{
    strengths: string[];
    improvements: string[];
    suggestions: string[];
    summary: string;
    score?: number;
    criteriaScores?: CriteriaScore[];
    rawResponse: Record<string, unknown>;
    modelName: string;
    tokenCount: number;
  }> {
    // Validate input
    if (!multimodalPromptParts || multimodalPromptParts.length === 0) {
      throw new Error('Empty multimodal prompt provided');
    }
    
    // Convert to Gemini-compatible parts
    const parts: Part[] = [];
    
    for (const part of multimodalPromptParts) {
      // Check if this is a text part
      if (part.type === 'text') {
        // Add as text
        if (typeof part.content === 'string') {
          const sanitizedText = sanitizeText(part.content);
          parts.push({ text: sanitizedText });
        } else {
          // Assume buffer contains text
          const textContent = part.content.toString('utf-8');
          const sanitizedText = sanitizeText(textContent);
          parts.push({ text: sanitizedText });
        }
      } 
      // Handle documents and images differently
      else if (['document', 'image', 'audio', 'video'].includes(part.type)) {
        // Get the proper MIME type
        const mimeType = part.mimeType || 'application/octet-stream';
        
        // Document must be handled through the Files API
        if (part.type === 'document' || (part.content instanceof Buffer && part.content.length > 1024 * 1024)) {
          try {
            // Always pass genAI as the first parameter to createFileData
            const fileData = await createFileData(this.genAI, part.content, mimeType);
            const sdkFileData = toSDKFormat(fileData);
            parts.push({ fileData: sdkFileData });
            
            // Add the text extraction if available
            if (part.textContent) {
              parts.push({ text: `Extracted text content: ${part.textContent}` });
            }
          } catch (error) {
            console.error(`[GEMINI] Error processing file: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to process ${part.type} file: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          // Handle image and other media data
          if (part.content instanceof Buffer) {
            try {
              // For images under 4MB, we can use fileData API or inlineData depending on size
              if (shouldUseFilesAPI(part.content, mimeType)) {
                // Always pass genAI as the first parameter to createFileData
                const fileData = await createFileData(this.genAI, part.content, mimeType);
                const sdkFileData = toSDKFormat(fileData);
                parts.push({ fileData: sdkFileData });
              } else {
                // For small files, use inline data
                const base64Data = part.content.toString('base64');
                parts.push({
                  inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                  }
                });
              }
            } catch (error) {
              console.error(`[GEMINI] Error processing image: ${error instanceof Error ? error.message : String(error)}`);
              throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else if (typeof part.content === 'string') {
            try {
              // Handle string content that might be base64 data or data URI
              let base64Data = part.content;
              // Check if it's a data URI and extract the base64 part if so
              if (part.content.startsWith('data:')) {
                const parts = part.content.split(',');
                base64Data = parts.length > 1 ? parts[1] : part.content;
              }
              
              // Add as inline data
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              });
            } catch (error) {
              console.error(`[GEMINI] Error processing string content: ${error instanceof Error ? error.message : String(error)}`);
              throw new Error(`Failed to process string content: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }
    }
    
    // Add a part that asks for the scoring result in our format
    parts.push({ 
      text: "Please evaluate this submission and provide helpful feedback. Format your response as valid JSON according to the schema."
    });
    
    // Prepare the request for the model
    const request = {
      contents: [{
        role: 'user',
        parts: parts
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: BASE_MAX_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: pruneForGemini(gradingJSONSchema)
      },
      safetySettings: this.safetySettings
    };
    
    // Add system prompt if provided
    if (systemPrompt && systemPrompt.trim().length > 0) {
      request.contents.unshift({
        role: 'system',
        parts: [{ text: systemPrompt }]
      });
    }
    
    try {
      // Use streaming for more reliable response handling
      const result = await this.collectStream(request);
      
      // If result indicates stop was due to token limit, retry with larger token budget
      if (result.finishReason === 'MAX_TOKENS' || result.raw.endsWith('}') === false) {
        console.log('[GEMINI] Response was cut off, retrying with higher token budget');
        
        // Update the request with higher token budget
        request.generationConfig.maxOutputTokens = RETRY_MAX_TOKENS;
        
        // Retry with higher token budget
        const retryResult = await this.collectStream(request);
        
        // If still cut off, try to repair the JSON
        if (retryResult.finishReason === 'MAX_TOKENS' || !retryResult.raw.endsWith('}')) {
          console.log('[GEMINI] Response still cut off, attempting to repair JSON');
          const repairedJson = repairJson(retryResult.raw);
          console.log(`[GEMINI] Repaired JSON (${repairedJson.length} chars)`);
          
          // Update the raw result with repaired JSON
          retryResult.raw = repairedJson;
        }
        
        // Use the retry result
        result.raw = retryResult.raw;
        result.finishReason = retryResult.finishReason;
        
        // Merge usage metadata to get total token count
        if (retryResult.usageMetadata) {
          result.usageMetadata = retryResult.usageMetadata;
        }
      }
      
      // Get token count from API-reported usage metadata
      const tokenCount = result.usageMetadata?.totalTokenCount || 0;
      
      // Extract raw response from result
      const raw = result.raw;
      
      // Try parsing the response as JSON
      let parsedContent: GradingFeedback;
      try {
        parsedContent = await parseStrict(raw);
        
        console.log(`[GEMINI] Successfully parsed response JSON (${raw.length} chars)`);
        
        // Return a properly formatted AIAdapterResponse with all required fields
        return {
          ...parsedContent,
          modelName: this.modelName,
          rawResponse: JSON.parse(raw),
          tokenCount: tokenCount
        };
      } catch (error) {
        console.error(`[GEMINI] Failed to parse multimodal response JSON: ${error instanceof Error ? error.message : String(error)}`);
        
        // Try to repair the JSON if it's malformed
        try {
          console.log('[GEMINI] Attempting to repair JSON response...');
          const repairedJson = repairJson(raw);
          parsedContent = await parseStrict(repairedJson);
          
          console.log(`[GEMINI] Successfully parsed repaired JSON (${repairedJson.length} chars)`);
          
          // Return a properly formatted AIAdapterResponse with all required fields
          return {
            ...parsedContent,
            modelName: this.modelName,
            rawResponse: JSON.parse(repairedJson),
            tokenCount: tokenCount
          };
        } catch (repairError) {
          console.error(`[GEMINI] Failed to repair JSON: ${repairError instanceof Error ? repairError.message : String(repairError)}`);
          throw new Error(`Failed to parse or repair Gemini response: ${error instanceof Error ? error.message : String(error)}\nRaw: ${raw.slice(0, 200)}...`);
        }
      }
    } catch (error) {
      console.error(`[GEMINI] Error generating multimodal completion: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`[GEMINI] Stack trace: ${error.stack}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Helper method to run the AI rubric evaluation for image submissions
   * @param imageBuffer The image buffer to evaluate
   * @param assignmentRubric The rubric text to use for evaluation
   * @param mimeType The MIME type of the image
   * @returns Grading feedback for the image submission
   */
  async runImageRubric(
    imageBuffer: Buffer, 
    assignmentRubric: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{
    strengths: string[];
    improvements: string[];
    suggestions: string[];
    summary: string;
    score?: number;
    criteriaScores?: CriteriaScore[];
    rawResponse: Record<string, unknown>;
    modelName: string;
    tokenCount: number;
  }> {
    // Create multimodal prompt parts
    const multimodalParts: MultimodalPromptPart[] = [
      {
        type: 'image',
        content: imageBuffer,
        mimeType: mimeType
      },
      {
        type: 'text',
        content: `Use the following rubric to evaluate this image:\n${assignmentRubric}\n\nProvide detailed feedback with specific strengths and areas for improvement.`
      }
    ];
    
    // Generate multimodal completion
    return await this.generateMultimodalCompletion(multimodalParts);
  }
}