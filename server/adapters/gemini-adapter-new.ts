/**
 * Gemini AI adapter for the AI Grader platform
 * Using @google/genai SDK with the latest API patterns for version 0.14.0+
 */
import { GoogleGenAI } from '@google/genai';
import { ContentType } from '../utils/file-type-settings';
import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { CriteriaScore } from '@shared/schema';

// The newest Gemini model is "gemini-2.5-flash-preview-04-17" 
// which was released on April 17, 2025

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
    
    // Using the specified model from Google's documentation
    this.modelName = "gemini-2.5-flash-preview-04-17";
    
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
      
      // Prepare the request with JSON response format
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        temperature,
        topP,
        topK,
        maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: this.responseSchema
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
            
            // Fallback to default values
            parsedContent = {
              strengths: [],
              improvements: [],
              suggestions: [],
              summary: "Failed to parse AI response.",
              score: 0
            };
            console.log(`[GEMINI] Using default values due to parsing failure`);
          }
        } else {
          // No markdown block found, use default
          parsedContent = {
            strengths: [],
            improvements: [],
            suggestions: [],
            summary: "Failed to parse AI response.",
            score: 0
          };
          console.log(`[GEMINI] Using default values (no JSON found)`);
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
      const apiParts: any[] = [];
      
      // Add system prompt as first text part if provided
      if (systemPrompt) {
        apiParts.push({ text: `${systemPrompt}\n\n` });
      }
      
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
      
      // Process each part by type
      for (const part of parts) {
        if (part.type === 'text' && typeof part.content === 'string') {
          apiParts.push({ text: part.content });
        } else if (part.content instanceof Buffer && part.mimeType) {
          // Convert Buffer to base64 for the API
          const base64Data = part.content.toString('base64');
          
          apiParts.push({
            inlineData: {
              data: base64Data,
              mimeType: part.mimeType
            }
          });
        }
      }
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
      // Prepare the request with JSON response format
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: apiParts }],
        temperature,
        topP,
        topK,
        maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: this.responseSchema
      };
      
      console.log(`[GEMINI] Content parts summary:`, contentSummary);
      
      // Generate content with the correct API method from SDK
      const result = await this.genAI.models.generateContent(requestParams);
      
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
        parsedContent = JSON.parse(text);
        console.log(`[GEMINI] Successfully parsed direct JSON response for multimodal content`);
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
            
            // Fallback to default values
            parsedContent = {
              strengths: [],
              improvements: [],
              suggestions: [],
              summary: "Failed to parse AI response.",
              score: 0
            };
            console.log(`[GEMINI] Using default values due to parsing failure`);
          }
        } else {
          // No markdown block found, use default
          parsedContent = {
            strengths: [],
            improvements: [],
            suggestions: [],
            summary: "Failed to parse AI response.",
            score: 0
          };
          console.log(`[GEMINI] Using default values (no JSON found)`);
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