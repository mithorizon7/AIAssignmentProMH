import { 
  GoogleGenAI, 
  HarmCategory,
  HarmBlockThreshold,
  FileState,
  GenerateContentResponse
} from '@google/genai';
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
    // Rich text format
    'application/rtf'
  ]
};

export class GeminiAdapter implements AIAdapter {
  private genAI: GoogleGenAI;
  private model: any; // Using any temporarily since types differ 
  private modelName: string;

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

  constructor() {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    
    this.genAI = new GoogleGenAI(apiKey);
    
    // Using a supported model from Google's documentation
    this.modelName = "gemini-2.5-flash-preview-04-17";
    
    console.log(`[GEMINI] Initializing with model: ${this.modelName}`);
    
    // Get the model with our default configuration including responseSchema
    this.model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 64,
        responseMimeType: "application/json",
        responseSchema: this.responseSchema
      }
    });
  }
  
  /**
   * Check if a MIME type is supported
   */
  private isMimeTypeSupported(mimeType: string, contentType: ContentType): boolean {
    const supportedTypes = SUPPORTED_MIME_TYPES[contentType as keyof typeof SUPPORTED_MIME_TYPES];
    if (!supportedTypes) return false;
    return supportedTypes.includes(mimeType);
  }
  
  /**
   * Get default MIME type for a content category
   */
  private getDefaultMimeType(contentType: ContentType): string {
    const typeMap: { [key in ContentType]: string } = {
      image: 'image/jpeg',
      video: 'video/mp4',
      audio: 'audio/mpeg',
      document: 'application/pdf'
    };
    return typeMap[contentType] || 'application/octet-stream';
  }
  
  /**
   * Validate an image buffer
   */
  private validateImageBuffer(buffer: Buffer, mimeType: string): void {
    console.log(`[GEMINI] Validating image buffer with MIME type ${mimeType}, size: ${buffer.length} bytes`);
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty image buffer provided');
    }
    
    if (buffer.length < 100) {
      throw new Error(`Image buffer too small (${buffer.length} bytes)`);
    }
    
    // Basic validation for common image formats
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      if (buffer.length < 2 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        throw new Error('Invalid JPEG image signature');
      }
    } else if (mimeType === 'image/png') {
      if (buffer.length < 8 || 
          buffer[0] !== 0x89 || 
          buffer[1] !== 0x50 ||
          buffer[2] !== 0x4E ||
          buffer[3] !== 0x47) {
        throw new Error('Invalid PNG image signature');
      }
    }
    // Add validation for other formats as needed
    
    console.log(`[GEMINI] Image validation passed for ${mimeType} (${buffer.length} bytes)`);
  }
  
  /**
   * Standard text completion 
   */
  async generateCompletion(prompt: string) {
    try {
      // Configure for consistent JSON responses with schema validation
      const genConfig = {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 64,
        responseMimeType: "application/json",
        responseSchema: this.responseSchema
      };
      
      console.log(`[GEMINI] Sending text completion request with responseMimeType: application/json`);
      
      // Create the content with instructions for JSON format
      const result = await this.model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ 
            text: prompt + "\n\nProvide your response in JSON format."
          }] 
        }],
        generationConfig: genConfig
      });
      
      const response = result.response;
      const text = response.text();
      
      console.log(`[GEMINI] Response received, length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Use responseSchema parsed property if available, with fallbacks
      let parsedContent: ParsedContent = {};
      
      // First, check if the SDK parsed the response according to our schema
      if (response.candidates && 
          response.candidates[0] && 
          response.candidates[0].parsed) {
        // With responseSchema, we should have a parsed property
        try {
          parsedContent = response.candidates[0].parsed as ParsedContent;
          console.log(`[GEMINI] Successfully used SDK-parsed response`);
        } catch (error) {
          console.warn(`[GEMINI] Error accessing parsed response: ${error instanceof Error ? error.message : String(error)}`);
          // Continue to fallbacks
        }
      } else {
        console.log(`[GEMINI] No parsed response available from SDK, falling back to manual parsing`);
      }
      
      // If parsed content is empty or missing required fields, fall back to manual parsing
      if (!parsedContent || 
          !parsedContent.strengths || 
          !parsedContent.improvements || 
          parsedContent.strengths.length === 0) {
          
        console.log(`[GEMINI] Parsed content missing required fields, trying direct JSON parsing`);
        
        try {
          // Try direct JSON parsing first
          parsedContent = JSON.parse(text);
          console.log(`[GEMINI] Successfully parsed direct JSON response`);
        } catch (error) {
          console.warn(`[GEMINI] Direct JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
          
          // Try to extract from markdown code block
          const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (markdownMatch && markdownMatch[1]) {
            try {
              parsedContent = JSON.parse(markdownMatch[1]);
              console.log(`[GEMINI] Successfully extracted JSON from markdown`);
            } catch (mdError) {
              console.warn(`[GEMINI] Markdown JSON extraction failed: ${mdError instanceof Error ? mdError.message : String(mdError)}`);
              
              // Try to find JSON-like content
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  parsedContent = JSON.parse(jsonMatch[0]);
                  console.log(`[GEMINI] Successfully extracted JSON pattern`);
                } catch (jsonError) {
                  console.warn(`[GEMINI] JSON pattern extraction failed`);
                  
                  // Manual extraction as last resort
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
          } else {
            // No markdown block found, try for raw JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                parsedContent = JSON.parse(jsonMatch[0]);
                console.log(`[GEMINI] Successfully extracted raw JSON`);
              } catch (jsonError) {
                console.warn(`[GEMINI] Raw JSON extraction failed`);
                
                // Manual extraction as last resort
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
      
      // Estimate token usage (Gemini doesn't always provide it directly)
      const estimatedTokens = Math.ceil(text.length / 4);
      console.log(`[GEMINI] Estimated token count: ${estimatedTokens}`);
      
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
    } catch (error) {
      console.error("[GEMINI] API error:", error instanceof Error ? error.message : String(error));
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Multimodal completion (text + images, etc.)
   */
  async generateMultimodalCompletion(parts: MultimodalPromptPart[], systemPrompt?: string) {
    console.log(`[GEMINI] Generating multimodal completion with ${parts.length} parts`);
    
    if (systemPrompt) {
      console.log(`[GEMINI] System prompt: ${systemPrompt.substring(0, 100)}...`);
    }
    
    try {
      // Prepare the model parts array
      const contentParts: any[] = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        contentParts.push({ text: systemPrompt });
      }
      
      // Process each content part based on its type
      for (const part of parts) {
        const textContent = part.textContent; 
        const mimeType = part.mimeType || this.getDefaultMimeType(part.type);
        
        switch (part.type) {
          case 'text':
            // Text is straightforward
            contentParts.push({ text: part.content as string });
            break;
            
          case 'image':
            if (Buffer.isBuffer(part.content)) {
              console.log(`[GEMINI] Processing image (${part.content.length} bytes) with MIME type: ${mimeType}`);
              
              // Validate image
              try {
                this.validateImageBuffer(part.content, mimeType);
              } catch (error) {
                console.warn(`[GEMINI] Image validation failed: ${error instanceof Error ? error.message : String(error)}`);
                contentParts.push({ text: `[Invalid image: ${error instanceof Error ? error.message : String(error)}]` });
                
                // Include extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
                break;
              }
              
              // For Gemini 2.5 models, we can use inline data for images (Files API is still in private beta)
              // Base64-encode the image for inline usage
              console.log(`[GEMINI] Adding image inline (${part.content.length} bytes)`);
              contentParts.push({
                inlineData: {
                  mimeType: mimeType,
                  data: part.content.toString('base64')
                }
              });
              
            } else if (typeof part.content === 'string') {
              // Handle base64-encoded or URL image
              if (part.content.startsWith('data:')) {
                // Handle data URI
                const dataUriComponents = part.content.split(',');
                if (dataUriComponents.length === 2) {
                  const base64Data = dataUriComponents[1];
                  contentParts.push({
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  });
                  console.log(`[GEMINI] Added image from data URI`);
                } else {
                  contentParts.push({ text: '[IMAGE: Invalid data URI format]' });
                }
              } else if (part.content.startsWith('http')) {
                // URLs are not directly supported, should be downloaded first
                contentParts.push({ text: `[IMAGE URL: ${part.content.substring(0, 50)}...]` });
              } else {
                // Assume it's base64 encoded
                contentParts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: part.content
                  }
                });
                console.log(`[GEMINI] Added image from base64 data`);
              }
            } else {
              contentParts.push({ text: '[IMAGE: Unknown format]' });
            }
            break;
            
          case 'video':
          case 'audio':
          case 'document':
            // Note: Newer APIs require Files API which is in private beta
            // For now, we'll handle these as text descriptions
            if (textContent) {
              contentParts.push({ 
                text: `[${part.type.toUpperCase()} content described as: ${textContent}]` 
              });
              console.log(`[GEMINI] Added ${part.type} as text description`);
            } else {
              contentParts.push({ 
                text: `[${part.type.toUpperCase()} content not processable with current API version]` 
              });
            }
            break;
            
          default:
            // Unknown type
            contentParts.push({
              text: `[Content of type ${String(part.type).toUpperCase()} - not processed]`
            });
            
            // Include extracted text if available
            if (textContent) {
              contentParts.push({ text: textContent });
            }
        }
      }
      
      // Add the analysis instructions
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
      
      // Configure with responseMimeType and responseSchema for structured JSON responses
      const genConfig = {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 64,
        responseMimeType: "application/json",
        responseSchema: this.responseSchema
      };
      
      console.log(`[GEMINI] Using responseMimeType: application/json for ${this.modelName}`);
      
      // Log content parts summary for debugging
      const contentSummary = contentParts.map(part => {
        if ('text' in part) {
          return { type: 'text', length: part.text.length };
        } else if ('inlineData' in part) {
          return { 
            type: 'inlineData', 
            mimeType: part.inlineData.mimeType,
            dataLength: part.inlineData.data.length 
          };
        }
        return { type: 'unknown' };
      });
      
      console.log(`[GEMINI] Content parts summary:`, contentSummary);
      
      // Make the API call
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig: genConfig
      });
      
      console.log(`[GEMINI] Successfully received response from Gemini API`);
      
      const response = result.response;
      const text = response.text();
      
      console.log(`[GEMINI] Response length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse the response as JSON with fallbacks
      let parsedContent: ParsedContent = {};
      
      // First, check if we have a parsed response from the SDK using our responseSchema
      if (response.candidates && 
          response.candidates[0] && 
          response.candidates[0].parsed) {
        // With responseSchema, we should have a parsed property
        try {
          parsedContent = response.candidates[0].parsed as ParsedContent;
          console.log(`[GEMINI] Successfully used SDK-parsed response for multimodal content`);
        } catch (error) {
          console.warn(`[GEMINI] Error accessing parsed response for multimodal: ${error instanceof Error ? error.message : String(error)}`);
          // Continue to fallbacks
        }
      } else {
        console.log(`[GEMINI] No parsed response available from SDK for multimodal, falling back to manual parsing`);
      }
      
      // If parsed content is empty or missing required fields, fall back to manual parsing
      if (!parsedContent || 
          !parsedContent.strengths || 
          !parsedContent.improvements || 
          parsedContent.strengths.length === 0) {
      
        console.log(`[GEMINI] Attempting to parse direct structured response`);
        try {
          parsedContent = JSON.parse(text);
          console.log(`[GEMINI] Successfully parsed JSON response`);
        } catch (parseError) {
          console.warn(`[GEMINI] Failed to parse direct response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          
          // Try to extract from markdown code block
          const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (markdownMatch && markdownMatch[1]) {
            try {
              parsedContent = JSON.parse(markdownMatch[1]);
              console.log(`[GEMINI] Successfully extracted JSON from markdown`);
            } catch (mdError) {
              console.warn(`[GEMINI] Markdown JSON extraction failed: ${mdError instanceof Error ? mdError.message : String(mdError)}`);
              
              // Try to find JSON-like content
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const cleanedJson = cleanJsonString(jsonMatch[0]);
                  parsedContent = JSON.parse(cleanedJson);
                  console.log(`[GEMINI] Successfully extracted JSON pattern`);
                } catch (jsonError) {
                  console.warn(`[GEMINI] JSON pattern extraction failed`);
                  
                  // Manual extraction as last resort
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
          } else {
            // No markdown block found, try for raw JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const cleanedJson = cleanJsonString(jsonMatch[0]);
                parsedContent = JSON.parse(cleanedJson);
                console.log(`[GEMINI] Successfully extracted raw JSON`);
              } catch (jsonError) {
                console.warn(`[GEMINI] Raw JSON extraction failed`);
                
                // Manual extraction as last resort
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
      if (response.usageMetadata?.totalTokens) {
        tokenCount = response.usageMetadata.totalTokens;
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
        score: parsedContent.score,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.modelName,
        tokenCount
      };
    } catch (error) {
      console.error(`[GEMINI] Error in multimodal generation:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide detailed error information
      const errorDetails = {
        message: errorMessage,
        modelName: this.modelName,
        numInputParts: parts.length
      };
      console.error(`[GEMINI] Error details:`, errorDetails);
      
      throw new Error(`AI multimodal generation failed: ${errorMessage}`);
    }
  }
}

/**
 * Helper function to extract list items from a specific section of text
 */
function extractListItems(text: string, section: string): string[] {
  // Look for the section header and capture list items that follow
  const sectionRegex = new RegExp(`${section}[:\\s]*((?:\\s*[-•*].*(?:\\n|$))+)`, 'i');
  const match = text.match(sectionRegex);
  
  if (match && match[1]) {
    // Extract individual list items
    const itemsText = match[1];
    return itemsText
      .split('\n')
      .map(line => line.trim().replace(/^[-•*]\s*/, ''))
      .filter(item => item.length > 0);
  }
  
  // Also look for list items within array-like structures
  return extractListItemsManually(text, section);
}

/**
 * Helper function to extract a summary section from text
 */
function extractSummary(text: string): string {
  // Look for summary section
  const summaryRegex = /summary[:\s]*([^\n]+)/i;
  const match = text.match(summaryRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Alternative: look for a conclusion section
  const conclusionRegex = /conclusion[:\s]*([^\n]+)/i;
  const conclusionMatch = text.match(conclusionRegex);
  
  if (conclusionMatch && conclusionMatch[1]) {
    return conclusionMatch[1].trim();
  }
  
  // Fall back to using the first paragraph after 'Overall'
  const overallRegex = /overall[:\s]*([^\n]+)/i;
  const overallMatch = text.match(overallRegex);
  
  if (overallMatch && overallMatch[1]) {
    return overallMatch[1].trim();
  }
  
  return "";
}

/**
 * Helper function to extract a numerical score from text
 */
function extractScore(text: string): number | undefined {
  // Look for score:X or score: X or score is X
  const scoreRegex = /score\s*(?:is|:|=)?\s*(\d+)/i;
  const match = text.match(scoreRegex);
  
  if (match && match[1]) {
    const score = parseInt(match[1], 10);
    if (!isNaN(score) && score >= 0 && score <= 100) {
      return score;
    }
  }
  
  // Also look for a rating out of 100
  const ratingRegex = /(\d+)(?:\s*\/\s*|\s*out of\s*)100/i;
  const ratingMatch = text.match(ratingRegex);
  
  if (ratingMatch && ratingMatch[1]) {
    const rating = parseInt(ratingMatch[1], 10);
    if (!isNaN(rating) && rating >= 0 && rating <= 100) {
      return rating;
    }
  }
  
  return undefined;
}

/**
 * Helper function to manually extract list items from text when JSON parsing fails
 */
function extractListItemsManually(text: string, section: string): string[] {
  // Look for array notation like "strengths": [ "item1", "item2" ]
  const arrayRegex = new RegExp(`"${section}"\\s*:\\s*\\[(.*?)\\]`, 's');
  const arrayMatch = text.match(arrayRegex);
  
  if (arrayMatch && arrayMatch[1]) {
    try {
      // Try to parse the array contents
      const arrayText = '[' + arrayMatch[1] + ']';
      const cleanedArrayText = cleanJsonString(arrayText);
      const items = JSON.parse(cleanedArrayText);
      if (Array.isArray(items)) {
        return items.filter(item => typeof item === 'string');
      }
    } catch (e) {
      // If parsing fails, try to extract manually
      const items = arrayMatch[1]
        .split(',')
        .map(item => {
          // Clean up quotes and whitespace
          const cleaned = item.trim();
          return cleaned.replace(/^["']|["']$/g, '');
        })
        .filter(item => item.length > 0);
      
      return items;
    }
  }
  
  return [];
}

/**
 * Clean a JSON string to fix common issues before parsing
 */
function cleanJsonString(jsonStr: string): string {
  // Fix trailing commas in arrays and objects
  let cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
  
  // Fix missing commas between array items or object properties
  cleaned = cleaned.replace(/"\s*}\s*{/g, '", {');
  cleaned = cleaned.replace(/"\s*]\s*\[/g, '", [');
  
  // Fix duplicate commas
  cleaned = cleaned.replace(/,\s*,/g, ',');
  
  // Fix malformed boolean values
  cleaned = cleaned.replace(/:\s*True/g, ': true');
  cleaned = cleaned.replace(/:\s*False/g, ': false');
  
  return cleaned;
}