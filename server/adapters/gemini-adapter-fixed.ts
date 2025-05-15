/**
 * Google Gemini AI adapter 
 * Uses the new @google/genai SDK (≥ 0.4.0)
 */
import { GoogleGenAI } from '@google/genai';
import type { MultimodalPromptPart, PromptModifier, AiFeedbackResponse } from '../../shared/types';

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

interface GenerationConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  responseMimeType?: string;
  responseSchema?: Record<string, any>;
}

interface ParsedContent {
  strengths?: string[];
  improvements?: string[];
  suggestions?: string[];
  summary?: string;
  score?: number;
  criteriaScores?: { name: string; score: number; feedback: string }[];
  [key: string]: any;
}

/**
 * Google Gemini AI adapter for generating feedback
 */
export class GeminiAdapter {
  private genAI: GoogleGenAI;
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
      const genConfig: GenerationConfig = {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024
      };
      
      // Configure response format if schema provided
      if (responseSchema) {
        genConfig.responseMimeType = "application/json";
        genConfig.responseSchema = responseSchema;
      }
      
      // Set up content parts based on whether system prompt is provided
      let contentParts: Array<{ text: string }> = [{ text: modifiedPrompt }];
      
      // Log the prompt being sent
      console.log(`[GEMINI] Sending prompt to Gemini API (${modifiedPrompt.length} chars)`);
      
      // Make the API call using models.generateContent with the correct parameters
      const params = {
        model: this.modelName,
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig: genConfig
      };
      
      const result = await this.genAI.models.generateContent(params);
      
      // Extract text from the response - modern @google/genai SDK format
      let text = '';
      if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
        text = result.candidates[0].content.parts[0].text;
      } else {
        console.warn('[GEMINI] Could not extract text response from standard structure');
        // Fallback to stringify the result as JSON
        text = JSON.stringify(result);
      }
      
      console.log(`[GEMINI] Response received, length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Use responseSchema parsed property if available, with fallbacks
      let parsedContent: ParsedContent = {};
      
      // First, check if we can parse the response as JSON directly
      try {
        // Try to parse the text as JSON first (most reliable method)
        parsedContent = JSON.parse(text);
        console.log(`[GEMINI] Successfully parsed direct JSON response`);
      } catch (error) {
        console.warn(`[GEMINI] Direct JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`[GEMINI] Falling back to manual parsing methods`);
      }
      
      // If parsed content is empty or missing required fields, fall back to manual parsing
      if (!parsedContent || 
          (!parsedContent.strengths && !parsedContent.improvements && !parsedContent.score)) {
          
        console.log('[GEMINI] Using fallback parsing methods for response');
        
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
            
            // If JSON parsing failed but we have a code block, it might be missing outer braces
            try {
              const fallbackJson = `{${jsonMatch[1].trim()}}`;
              parsedContent = JSON.parse(fallbackJson);
              console.log(`[GEMINI] Successfully parsed with added outer braces`);
            } catch (innerError) {
              console.warn(`[GEMINI] Failed fallback JSON parsing: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
              
              // Last resort for malformed JSON - look for key-value pairs
              const keyValuePairs = jsonMatch[1].match(/"([^"]+)":\s*("[^"]*"|[\d.]+|\[[^\]]*\]|{[^}]*})/g);
              if (keyValuePairs) {
                try {
                  const reconstructedJson = `{${keyValuePairs.join(',')}}`;
                  parsedContent = JSON.parse(reconstructedJson);
                  console.log(`[GEMINI] Using manually extracted content`);
                } catch (kvError) {
                  // Continue to manual extraction
                }
              }
            }
          }
        } else {
          // No markdown block found, try for raw JSON
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedContent = JSON.parse(jsonMatch[0]);
              console.log(`[GEMINI] Successfully extracted raw JSON`);
            } catch (error) {
              console.warn(`[GEMINI] Failed to parse raw JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        
        // If still no valid JSON found, extract manually
        if (!parsedContent || Object.keys(parsedContent).length === 0) {
          // Fallback to manual extraction
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
      if (result.usageMetadata && 'promptTokenCount' in result.usageMetadata && 'candidatesTokenCount' in result.usageMetadata) {
        // Sum prompt and candidates token counts
        tokenCount = (result.usageMetadata.promptTokenCount || 0) + (result.usageMetadata.candidatesTokenCount || 0);
      } else {
        // Estimate token count based on response length (~4 chars per token)
        tokenCount = Math.ceil(text.length / 4);
        console.log(`[GEMINI] Token count not available from Gemini API response, using estimation method`);
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
  async generateMultimodalCompletion(parts: MultimodalPromptPart[], systemPrompt?: string) {
    try {
      console.log(`[GEMINI] Generating multimodal completion with ${parts.length} parts`);
      
      // Prepare content parts
      const contentParts: any[] = [];
      
      // Add system prompt as first text part if provided
      if (systemPrompt) {
        contentParts.push({ text: `${systemPrompt}\n\n` });
      }
      
      // Content type conversion for debugging
      const contentSummary = parts.map(part => {
        if (part.type === 'text') {
          return `text: ${part.text.substring(0, 50)}...`;
        } else if (part.type === 'image') {
          return `image: ${part.mimeType} (${Math.round(part.data.length / 1024)}KB)`;
        } else if (part.type === 'file') {
          return `file: ${part.mimeType} (${Math.round(part.data.length / 1024)}KB)`;
        }
        return `unknown part type: ${part.type}`;
      });
      
      // Process each part by type
      for (const part of parts) {
        if (part.type === 'text') {
          contentParts.push({ text: part.text });
        } else if (part.type === 'image') {
          contentParts.push({
            inlineData: {
              data: part.data,
              mimeType: part.mimeType
            }
          });
        } else if (part.type === 'file') {
          // For file contents as base64 data
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
      
      // Make the API call using models.generateContent with the correct parameters
      const params = {
        model: this.modelName,
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig: genConfig
      };
      
      const result = await this.genAI.models.generateContent(params);
      
      console.log(`[GEMINI] Successfully received response from Gemini API`);
      
      // Extract text from the response - modern @google/genai SDK format
      let text = '';
      if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
        text = result.candidates[0].content.parts[0].text;
      } else {
        console.warn('[GEMINI] Could not extract text response from standard structure');
        // Fallback to stringify the result as JSON
        text = JSON.stringify(result);
      }
      
      console.log(`[GEMINI] Response length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse the response as JSON with fallbacks
      let parsedContent: ParsedContent = {};
      
      // First try direct JSON parsing (most reliable with responseMimeType: "application/json")
      try {
        parsedContent = JSON.parse(text);
        console.log(`[GEMINI] Successfully parsed direct JSON response for multimodal content`);
      } catch (parseError) {
        console.warn(`[GEMINI] Failed to parse direct response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        console.log(`[GEMINI] Falling back to manual parsing for multimodal content`);
      }
      
      // If parsed content is empty or missing required fields, fall back to manual parsing
      if (!parsedContent || 
          (!parsedContent.strengths && !parsedContent.improvements && !parsedContent.score)) {
        
        // Try to extract JSON from markdown code block
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
          // No markdown block found, try for raw JSON
          const rawJsonMatch = text.match(/\{[\s\S]*\}/);
          if (rawJsonMatch) {
            try {
              parsedContent = JSON.parse(rawJsonMatch[0]);
              console.log(`[GEMINI] Successfully extracted raw JSON`);
            } catch (error) {
              console.warn(`[GEMINI] Failed to parse raw JSON: ${error instanceof Error ? error.message : String(error)}`);
              
              // Fallback to manual extraction
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
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      if (result.usageMetadata && 'promptTokenCount' in result.usageMetadata && 'candidatesTokenCount' in result.usageMetadata) {
        // Sum prompt and candidates token counts
        tokenCount = (result.usageMetadata.promptTokenCount || 0) + (result.usageMetadata.candidatesTokenCount || 0);
      } else {
        // Estimate token count based on response length (~4 chars per token)
        tokenCount = Math.ceil(text.length / 4);
        console.log(`[GEMINI] Token count not available from Gemini API response, using estimation method`);
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