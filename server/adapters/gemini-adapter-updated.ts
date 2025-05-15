/**
 * Google Gemini AI adapter
 * Using @google/genai SDK with correct migration pattern
 */
import { GoogleGenAI } from '@google/genai';
import type { GenerateContentRequest, GenerateContentResult, Part } from '@google/genai';

// Define our own types since we can't find the shared ones
interface MultimodalPromptPart {
  type: 'text' | 'image' | 'file';
  text?: string;
  data?: string;
  mimeType?: string;
}

type PromptModifier = (prompt: string) => string;

interface AiFeedbackResponse {
  strengths: string[];
  improvements: string[];
  suggestions?: string[];
  summary: string;
  score?: number;
  criteriaScores?: Array<{ name: string; score: number; feedback: string }>;
  rawResponse?: any;
  modelName?: string;
  tokenCount?: number;
  rawContent?: string;
}

// Utility functions for parsing responses
function extractListItems(text: string, section: string): string[] {
  // Look for common patterns like:
  // Section name:
  // 1. Item one
  // 2. Item two
  // Or:
  // **Section name:**
  // - Item one
  // - Item two
  const sectionRegex = new RegExp(`(?:\\*\\*)?${section}(?:\\*\\*)?:?[^\\w]*(((?:\\d+\\.|[-*•]).*?(?:\\n|$))+)`, 'i');
  const match = text.match(sectionRegex);
  
  if (!match || !match[1]) return [];
  
  // Extract individual list items
  const itemsText = match[1];
  const items = itemsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^(\d+\.|[-*•])/.test(line)) // Only lines starting with a number, dash, asterisk or bullet
    .map(line => line.replace(/^\d+\.|[-*•]\s*/, '').trim()) // Remove the list marker
    .filter(line => line.length > 0);
  
  return items;
}

function extractScore(text: string): number {
  // Try to extract a score from text like "Score: 85/100" or "Overall score: 85" or just "85/100"
  const scoreRegex = /(?:score|rating|grade)[^\d]*?(\d+)(?:\/\d+|\s*(?:out of|\/)\s*\d+|%|\s*points)?/i;
  const match = text.match(scoreRegex);
  
  if (match && match[1]) {
    const score = parseInt(match[1], 10);
    // Normalize to 0-100 scale
    return score > 0 && score <= 100 ? score : 75; // Default to 75 if out of range
  }
  
  return 75; // Default score if not found
}

function extractSummary(text: string): string {
  // Look for a section labeled "Summary" or "Overview"
  const summaryRegex = /(?:\*\*)?(summary|overview)(?:\*\*)?:?\s*([\s\S]+?)(?:\n\n|\n(?=\*\*|#)|\n(?=\d\.|-)|\n\s*strengths|\n\s*improvements|$)/i;
  const match = text.match(summaryRegex);
  
  if (match && match[2]) {
    return match[2].trim();
  }
  
  // If no explicit summary section, use the first paragraph
  const firstParagraph = text.split(/\n\n/)[0];
  if (firstParagraph && firstParagraph.length > 10 && !firstParagraph.startsWith('#')) {
    return firstParagraph.trim();
  }
  
  return '';
}

/**
 * Google Gemini AI adapter for generating feedback
 */
export class GeminiAdapter {
  private genAI: GoogleGenAI;
  private model: any; // Use any type temporarily
  private modelName: string;
  
  /**
   * Create a new GeminiAdapter instance
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    
    // Initialize the Google Generative AI client
    this.genAI = new GoogleGenAI({ apiKey });
    
    // Using the specified model from Google's documentation
    this.modelName = "gemini-2.5-flash-preview-04-17";
    
    // Get the model instance
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    console.log(`[GEMINI] Initializing with model: ${this.modelName}`);
  }
  
  /**
   * Check if a MIME type is supported
   */
  supportsContentType(mimeType: string): boolean {
    // List of MIME types supported by Gemini models
    const supportedMimeTypes = [
      // Text formats
      'text/plain',
      'text/html',
      'text/markdown',
      'application/json',
      
      // Image formats
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      
      // Document formats (with limitations)
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      
      // Code formats
      'text/javascript',
      'text/typescript', // not standard but we'll treat it specially
      'text/css',
      'text/python',
      'text/x-python',
      'application/x-python-code',
      'text/x-c++src',
      'text/x-java',
      'text/x-csharp'
    ];
    
    // Check exact match
    if (supportedMimeTypes.includes(mimeType)) {
      return true;
    }
    
    // Check for generic text type
    if (mimeType.startsWith('text/')) {
      return true;
    }
    
    // Unsupported
    return false;
  }
  
  /**
   * Standard text completion
   */
  async generateCompletion(
    prompt: string, 
    systemPrompt?: string, 
    promptModifiers: PromptModifier[] = [],
    responseSchema?: Record<string, any>
  ): Promise<AiFeedbackResponse> {
    try {
      console.log(`[GEMINI] Generating completion with ${promptModifiers.length} modifiers`);
      
      // Apply prompt modifiers
      let modifiedPrompt = prompt;
      for (const modifier of promptModifiers) {
        modifiedPrompt = modifier(modifiedPrompt);
      }
      
      // Prepare generation config
      const genConfig = {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024
      };
      
      // Configure response format if schema provided
      if (responseSchema) {
        genConfig['responseMimeType'] = "application/json";
        genConfig['responseSchema'] = responseSchema;
      }
      
      // Set up content parts based on whether system prompt is provided
      const parts: Part[] = [{ text: modifiedPrompt }];
      
      // Log the prompt being sent
      console.log(`[GEMINI] Sending prompt to Gemini API (${modifiedPrompt.length} chars)`);
      
      // Generate content with the model - using the correct SDK pattern
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: genConfig
      });
      
      // Extract text from the response using the new SDK structure
      let text = '';
      
      // Access the response text through the proper path
      if (result.response && 
          result.response.candidates && 
          result.response.candidates[0]?.content?.parts) {
        const firstPart = result.response.candidates[0].content.parts[0];
        if (firstPart.text) {
          text = firstPart.text;
        } else {
          console.warn('[GEMINI] Response text not found in expected location');
          text = JSON.stringify(result.response);
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
            
            // Fallback to manual extraction
            parsedContent = {
              strengths: extractListItems(text, "strengths"),
              improvements: extractListItems(text, "improvements"),
              suggestions: extractListItems(text, "suggestions"),
              summary: extractSummary(text),
              score: extractScore(text)
            };
            console.log(`[GEMINI] Using manually extracted content`);
          }
        } else {
          // No markdown block found, extract manually
          parsedContent = {
            strengths: extractListItems(text, "strengths"),
            improvements: extractListItems(text, "improvements"),
            suggestions: extractListItems(text, "suggestions"),
            summary: extractSummary(text),
            score: extractScore(text)
          };
          console.log(`[GEMINI] Using manually extracted content (no JSON found)`);
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      
      if (result.response.usageMetadata) {
        const usageMetadata = result.response.usageMetadata;
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
  async generateMultimodalCompletion(parts: MultimodalPromptPart[], systemPrompt?: string): Promise<AiFeedbackResponse> {
    try {
      console.log(`[GEMINI] Generating multimodal completion with ${parts.length} parts`);
      
      // Prepare content parts for the new SDK
      const contentParts: Part[] = [];
      
      // Add system prompt as first text part if provided
      if (systemPrompt) {
        contentParts.push({ text: `${systemPrompt}\n\n` });
      }
      
      // Content type conversion for debugging
      const contentSummary = parts.map(part => {
        if (part.type === 'text') {
          return `text: ${part.text!.substring(0, 50)}...`;
        } else if (part.type === 'image') {
          return `image: ${part.mimeType} (${Math.round(part.data!.length / 1024)}KB)`;
        } else if (part.type === 'file') {
          return `file: ${part.mimeType} (${Math.round(part.data!.length / 1024)}KB)`;
        }
        return `unknown part type: ${part.type}`;
      });
      
      // Process each part by type
      for (const part of parts) {
        if (part.type === 'text' && part.text) {
          contentParts.push({ text: part.text });
        } else if ((part.type === 'image' || part.type === 'file') && part.data && part.mimeType) {
          contentParts.push({
            inlineData: {
              data: part.data,
              mimeType: part.mimeType
            }
          });
        }
      }
      
      // Prepare generation config with JSON response format
      const genConfig = {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: {
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
            score: { type: "number" }
          },
          required: ["strengths", "improvements", "summary", "score"]
        }
      };
      
      console.log(`[GEMINI] Content parts summary:`, contentSummary);
      
      // Generate content with the model - using the correct SDK pattern
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig: genConfig
      });
      
      console.log(`[GEMINI] Successfully received response from Gemini API`);
      
      // Extract text from the response using the new SDK structure
      let text = '';
      
      // Access the response text through the proper path
      if (result.response && 
          result.response.candidates && 
          result.response.candidates[0]?.content?.parts) {
        const firstPart = result.response.candidates[0].content.parts[0];
        if (firstPart.text) {
          text = firstPart.text;
        } else {
          console.warn('[GEMINI] Response text not found in expected location');
          text = JSON.stringify(result.response);
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
            
            // Fallback to manual extraction
            parsedContent = {
              strengths: extractListItems(text, "strengths"),
              improvements: extractListItems(text, "improvements"),
              suggestions: extractListItems(text, "suggestions"),
              summary: extractSummary(text),
              score: extractScore(text)
            };
            console.log(`[GEMINI] Using manually extracted content`);
          }
        } else {
          // No markdown block found, extract manually
          parsedContent = {
            strengths: extractListItems(text, "strengths"),
            improvements: extractListItems(text, "improvements"),
            suggestions: extractListItems(text, "suggestions"),
            summary: extractSummary(text),
            score: extractScore(text)
          };
          console.log(`[GEMINI] Using manually extracted content (no JSON found)`);
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      
      if (result.response.usageMetadata) {
        const usageMetadata = result.response.usageMetadata;
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
        tokenCount: tokenCount,
        modelName: this.modelName,
        rawContent: text
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