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
            criteriaId: { type: "number" },
            score: { type: "number" },
            feedback: { type: "string" }
          }
        }
      }
    },
    required: ["strengths", "improvements", "suggestions", "summary", "score"]
  };
  
  /**
   * Attempt to extract structured feedback from unstructured text
   * This is a fallback method when JSON parsing fails
   */
  private extractStructuredFeedback(text: string): any {
    console.log(`[GEMINI] Attempting to extract structured feedback from text`);
    
    // Default structure
    const result: any = {
      strengths: [],
      improvements: [],
      suggestions: [],
      summary: "",
      score: 0,
      criteriaScores: []
    };
    
    try {
      // First try to find JSON objects using regex
      const jsonObjectRegex = /\{[\s\S]*?\}/g;
      const potentialJsons = text.match(jsonObjectRegex);
      
      if (potentialJsons && potentialJsons.length > 0) {
        for (const jsonString of potentialJsons) {
          try {
            // Try to parse each potential JSON string
            const parsed = JSON.parse(jsonString);
            
            // If we find one with the right structure, use it
            if (parsed.strengths || parsed.score || parsed.summary) {
              console.log(`[GEMINI] Found valid JSON structure in text`);
              return parsed;
            }
          } catch (error) {
            // Continue with the next potential JSON
            continue;
          }
        }
      }
      
      // If JSON objects aren't found or valid, try to extract sections
      
      // Extract strengths section
      const strengthsMatch = text.match(/(?:Strengths|STRENGTHS|Strengths:)[\s\S]*?(?=Improvements|IMPROVEMENTS|Suggestions|SUGGESTIONS|Summary|SUMMARY|$)/i);
      if (strengthsMatch) {
        const strengthsText = strengthsMatch[0];
        const items = strengthsText.match(/(?:^|\n)[*•-]\s*(.*?)(?=\n[*•-]|\n\n|$)/g);
        
        if (items) {
          result.strengths = items.map(item => item.replace(/^[*•-\s\n]+/, '').trim());
        }
      }
      
      // Extract improvements section
      const improvementsMatch = text.match(/(?:Improvements|IMPROVEMENTS|Improvements:)[\s\S]*?(?=Suggestions|SUGGESTIONS|Summary|SUMMARY|$)/i);
      if (improvementsMatch) {
        const improvementsText = improvementsMatch[0];
        const items = improvementsText.match(/(?:^|\n)[*•-]\s*(.*?)(?=\n[*•-]|\n\n|$)/g);
        
        if (items) {
          result.improvements = items.map(item => item.replace(/^[*•-\s\n]+/, '').trim());
        }
      }
      
      // Extract suggestions section
      const suggestionsMatch = text.match(/(?:Suggestions|SUGGESTIONS|Suggestions:)[\s\S]*?(?=Summary|SUMMARY|$)/i);
      if (suggestionsMatch) {
        const suggestionsText = suggestionsMatch[0];
        const items = suggestionsText.match(/(?:^|\n)[*•-]\s*(.*?)(?=\n[*•-]|\n\n|$)/g);
        
        if (items) {
          result.suggestions = items.map(item => item.replace(/^[*•-\s\n]+/, '').trim());
        }
      }
      
      // Extract summary
      const summaryMatch = text.match(/(?:Summary|SUMMARY|Summary:)\s*([\s\S]*?)(?=\n\n|$)/i);
      if (summaryMatch && summaryMatch[1]) {
        result.summary = summaryMatch[1].trim();
      } else {
        // If no summary section found, use the first paragraph as summary
        const firstParagraph = text.split('\n\n')[0];
        if (firstParagraph && firstParagraph.length > 10) {
          result.summary = firstParagraph.trim();
        }
      }
      
      // Extract score - look for numeric values
      const scoreMatch = text.match(/(?:Score|SCORE|Score:)\s*([0-9.]+)/i);
      if (scoreMatch && scoreMatch[1]) {
        result.score = parseFloat(scoreMatch[1]);
      }
      
      // Fill in missing sections if needed
      if (result.strengths.length === 0 && result.improvements.length === 0) {
        console.log(`[GEMINI] No structured sections found, using fallback parsing`);
        
        // Look for bullet points anywhere in the text
        const bulletPoints = text.match(/(?:^|\n)[*•-]\s*(.*?)(?=\n[*•-]|\n\n|$)/g);
        if (bulletPoints && bulletPoints.length > 0) {
          const cleanPoints = bulletPoints.map(item => item.replace(/^[*•-\s\n]+/, '').trim());
          
          // Split points between strengths and improvements
          const midpoint = Math.ceil(cleanPoints.length / 2);
          result.strengths = cleanPoints.slice(0, midpoint);
          result.improvements = cleanPoints.slice(midpoint);
        }
      }
      
      console.log(`[GEMINI] Extracted ${result.strengths.length} strengths, ${result.improvements.length} improvements, and ${result.suggestions.length} suggestions`);
      return result;
    } catch (error) {
      console.error(`[GEMINI] Error extracting structured feedback:`, error instanceof Error ? error.message : String(error));
      return result; // Return the default structure
    }
  };
  
  /**
   * Standard text completion
   */
  async generateCompletion(prompt: string) {
    try {
      console.log(`[GEMINI] Generating completion with prompt length: ${prompt.length} chars`);
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
      // Prepare the request with JSON response format - use proper structure with config
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature,
          topP, 
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema
        }
      };
      
      console.log(`[GEMINI] Sending request to Gemini API`);
      
      // Generate content with the model
      const result = await this.genAI.models.generateContent(requestParams);
      
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
      
      // Parse the response as JSON with fallbacks
      let parsedContent: any = {};
      
      // Try to parse the text as JSON first
      try {
        parsedContent = JSON.parse(text);
        console.log(`[GEMINI] Successfully parsed direct JSON response`);
      } catch (error) {
        console.warn(`[GEMINI] Direct JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`[GEMINI] Falling back to manual parsing methods`);
        
        // Try to find JSON block in markdown
        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
        const jsonMatch = text.match(jsonBlockRegex);
        
        if (jsonMatch && jsonMatch[1]) {
          try {
            const jsonText = jsonMatch[1].trim();
            parsedContent = JSON.parse(jsonText);
            console.log(`[GEMINI] Successfully extracted JSON from markdown code block`);
          } catch (error) {
            console.warn(`[GEMINI] Failed to parse JSON from markdown block: ${error instanceof Error ? error.message : String(error)}`);
            
            // Use our structured feedback extractor
            console.log(`[GEMINI] Attempting structured feedback extraction`);
            parsedContent = this.extractStructuredFeedback(text);
          }
        } else {
          // No markdown block found, try structured extraction
          console.log(`[GEMINI] No JSON code blocks found, trying structured extraction`);
          parsedContent = this.extractStructuredFeedback(text);
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      
      if (result.usageMetadata) {
        const usageMetadata = result.usageMetadata;
        if ('promptTokenCount' in usageMetadata && 'candidatesTokenCount' in usageMetadata) {
          // Sum prompt and candidates token counts
          tokenCount = (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
        }
      }
      
      if (tokenCount === 0) {
        // Estimate token count based on response length (~4 chars per token)
        tokenCount = Math.ceil(text.length / 4);
        console.log(`[GEMINI] Token count not available, using estimation method`);
      }
      
      console.log(`[GEMINI] Estimated token count: ${tokenCount}`);
      
      return {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.modelName,
        tokenCount: tokenCount
      };
    } catch (error) {
      console.error("[GEMINI] API error:", error instanceof Error ? error.message : String(error));
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : String(error)}`);
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
      
      // Prepare content parts in the format expected by the API
      const apiParts: Part[] = [];
      
      // Content type conversion for debugging
      const contentSummary = parts.map(part => {
        if (part.type === 'text') {
          const text = typeof part.content === 'string' ? part.content : '(Buffer)';
          return `text: ${text.substring(0, 50)}...`;
        } else if (part.type === 'image') {
          const size = part.content instanceof Buffer ? part.content.length : 'unknown';
          return `image: ${part.mimeType} (${Math.round(Number(size) / 1024)}KB)`;
        } else {
          const size = part.content instanceof Buffer ? part.content.length : 'unknown';
          return `${part.type}: ${part.mimeType} (${Math.round(Number(size) / 1024)}KB)`;
        }
      });
      
      console.log(`[GEMINI] Content parts summary:`, contentSummary);
      
      // Process parts to match the expected API format
      for (const part of parts) {
        // Text content handling
        if (part.type === 'text' && typeof part.content === 'string') {
          apiParts.push({ text: part.content });
          continue;
        }
        
        // Buffer data handling (images, etc.)
        if (part.content instanceof Buffer && part.mimeType) {
          // Skip unsupported mime types (like SVG)
          if (part.mimeType === 'image/svg+xml') {
            console.warn(`[GEMINI] Skipping unsupported MIME type: ${part.mimeType}`);
            apiParts.push({ text: "Image format not supported (SVG). Please use PNG or JPEG." });
            continue;
          }
          
          // Convert Buffer to base64 for the API
          const base64Data = part.content.toString('base64');
          
          // Use inlineData format for API
          apiParts.push({
            inlineData: {
              data: base64Data,
              mimeType: part.mimeType
            }
          });
          
          console.log(`[GEMINI] Added ${part.mimeType} data of size ${Math.round(part.content.length / 1024)}KB`);
        }
      }
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
      // Prepare the request with JSON response format - use proper structure with config
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: apiParts }],
        config: {
          temperature,
          topP,
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema,
          // Add system instruction directly in config if provided
          systemInstruction: systemPrompt ? { text: systemPrompt } : undefined
        }
      };
      
      // Log if system prompt was added
      if (systemPrompt) {
        console.log(`[GEMINI] Added system prompt as systemInstruction (${systemPrompt.length} chars)`);
      }
      
      console.log(`[GEMINI] Making API request to model: ${this.modelName}`);
      console.log(`[GEMINI] Request has ${apiParts.length} content parts`);
      
      // Generate content with the model
      let result: GenerateContentResponse;
      try {
        result = await this.genAI.models.generateContent(requestParams);
        console.log(`[GEMINI] API request successful`);
      } catch (apiError) {
        // Log detailed error info for debugging
        console.error(`[GEMINI] API request failed:`, apiError instanceof Error ? apiError.message : String(apiError));
        if (apiError instanceof Error && apiError.stack) {
          console.error(`[GEMINI] Error stack:`, apiError.stack);
        }
        
        // Check for common errors like format issues
        const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
        
        if (errorMsg.includes('MIME type') || errorMsg.includes('format')) {
          // Try again without the image if there was a format error
          console.log(`[GEMINI] Retrying without problematic media format`);
          
          // Filter to only keep text parts
          const textOnlyParts: Part[] = apiParts.filter(part => 'text' in part);
          
          // Add a placeholder message about the image
          textOnlyParts.push({ 
            text: "Note: An image was included but could not be processed due to format limitations." 
          });
          
          // Retry with text-only, keeping the config structure
          const retryParams = {
            model: this.modelName,
            contents: [{ role: 'user', parts: textOnlyParts }],
            config: requestParams.config
          };
          result = await this.genAI.models.generateContent(retryParams);
        } else {
          // If not a recoverable error, rethrow
          throw apiError;
        }
      }
      
      console.log(`[GEMINI] Successfully received response from Gemini API`);
      
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
      
      console.log(`[GEMINI] Response length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse the response as JSON with fallbacks
      let parsedContent: any = {};
      
      // Try to parse the text as JSON first
      try {
        // Log the raw text in development for debugging
        console.log(`[GEMINI] Attempting to parse direct structured response`);
        console.log(`[GEMINI] Response preview for debugging: ${text.substring(0, 100)}`);
        
        parsedContent = JSON.parse(text);
        console.log(`[GEMINI] Successfully parsed direct JSON response for multimodal content`);
      } catch (error) {
        console.warn(`[GEMINI] Failed to parse direct response: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`[GEMINI] Falling back to manual parsing for multimodal content`);
        
        // Try to find JSON block in markdown
        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
        const jsonMatch = text.match(jsonBlockRegex);
        
        if (jsonMatch && jsonMatch[1]) {
          try {
            const jsonText = jsonMatch[1].trim();
            parsedContent = JSON.parse(jsonText);
            console.log(`[GEMINI] Successfully extracted JSON from markdown `);
          } catch (error) {
            console.warn(`[GEMINI] Failed to parse JSON from markdown block: ${error instanceof Error ? error.message : String(error)}`);
            
            // Use our structured feedback extractor
            console.log(`[GEMINI] Attempting structured feedback extraction (multimodal)`);
            parsedContent = this.extractStructuredFeedback(text);
          }
        } else {
          // No markdown block found, try structured extraction
          console.log(`[GEMINI] No JSON code blocks found, trying structured extraction (multimodal)`);
          parsedContent = this.extractStructuredFeedback(text);
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      
      if (result.usageMetadata) {
        const usageMetadata = result.usageMetadata;
        if ('promptTokenCount' in usageMetadata && 'candidatesTokenCount' in usageMetadata) {
          // Sum prompt and candidates token counts
          tokenCount = (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
        }
      }
      
      if (tokenCount === 0) {
        // Estimate token count based on response length (~4 chars per token)
        tokenCount = Math.ceil(text.length / 4);
        console.log(`[GEMINI] Token count not available, using estimation method`);
      }
      
      console.log(`[GEMINI] Estimated token count: ${tokenCount}`);
      
      console.log(`[GEMINI] Response contains: ${parsedContent.strengths?.length || 0} strengths, ${parsedContent.improvements?.length || 0} improvements, score: ${parsedContent.score || 'none'}`);
      
      console.log(`[GEMINI] Successfully completed multimodal AI generation with ${this.modelName}`);
      
      return {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score || 0,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.modelName,
        tokenCount: tokenCount
      };
    } catch (error) {
      console.error(`[GEMINI] Multimodal API error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Enhanced error logging for debugging
      if (error instanceof Error && error.stack) {
        console.error(`[GEMINI] Error stack: ${error.stack}`);
      }
      
      throw new Error(`AI multimodal generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default GeminiAdapter;