import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { fileToDataURI } from '../utils/multimodal-processor';

const readFileAsync = promisify(fs.readFile);

export class GeminiAdapter implements AIAdapter {
  private generativeAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor() {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    
    this.generativeAI = new GoogleGenerativeAI(apiKey);
    this.modelName = "models/gemini-2.5-flash-preview-04-17"; // Default recommended model
    this.model = this.generativeAI.getGenerativeModel({ model: this.modelName });
  }
  
  /**
   * Get the default MIME type for a given content type
   */
  private getDefaultMimeType(contentType: string): string {
    const defaults = {
      'text': 'text/plain',
      'image': 'image/jpeg',
      'audio': 'audio/mpeg',
      'video': 'video/mp4',
      'document': 'application/pdf'
    };
    
    return defaults[contentType as keyof typeof defaults] || 'application/octet-stream';
  }
  
  /**
   * Add inline image data to content parts
   */
  private addInlineImagePart(contentParts: Part[], content: string | Buffer, mimeType: string): void {
    // For images, convert to data URI if it's a buffer
    let imageData;
    if (Buffer.isBuffer(content)) {
      imageData = fileToDataURI(content, mimeType);
    } else {
      imageData = content; // Assume it's already a data URI
    }
    
    // Handle different image data formats
    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      // It's a data URI
      contentParts.push({
        inlineData: {
          data: imageData.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: mimeType
        }
      });
    } else if (Buffer.isBuffer(imageData)) {
      // It's still a buffer
      contentParts.push({
        inlineData: {
          data: imageData.toString('base64'),
          mimeType: mimeType
        }
      });
    } else {
      // Assume it's already a base64 string
      contentParts.push({
        inlineData: {
          data: imageData,
          mimeType: mimeType
        }
      });
    }
  }

  async generateCompletion(prompt: string) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse the content as JSON
      let parsedContent: any = {};
      try {
        // Extract JSON from the response if it's embedded in text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          parsedContent = JSON.parse(text);
        }
      } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
        console.log("Raw response:", text);
        // Attempt to extract structured data even from non-JSON response
        parsedContent = {
          strengths: extractListItems(text, "strengths"),
          improvements: extractListItems(text, "improvements"),
          suggestions: extractListItems(text, "suggestions"),
          summary: extractSummary(text),
          score: extractScore(text)
        };
      }
      
      // We don't have token count from Gemini API directly,
      // so we'll estimate based on text length
      const estimatedTokens = Math.ceil(text.length / 4);
      
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
    } catch (error: any) {
      console.error("Gemini API error:", error);
      throw new Error(`AI generation failed: ${error.message || String(error)}`);
    }
  }
  
  /**
   * Generate completion using multimodal inputs (text, images, audio, video, documents)
   * Properly processes content through Gemini API based on content type
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
      
      // Track any file objects for cleanup
      const fileObjects: any[] = [];
      
      // Process each part based on its type
      for (const part of parts) {
        const textContent = part.textContent;
        const mimeType = part.mimeType || this.getDefaultMimeType(part.type);
        
        // Determine file size if we have a buffer
        const fileSize = Buffer.isBuffer(part.content) ? part.content.length : 0;
        const isLargeFile = fileSize > 3 * 1024 * 1024; // 3MB threshold
        
        switch (part.type) {
          case 'text':
            contentParts.push({
              text: part.content as string
            });
            break;
            
          case 'image':
            if (Buffer.isBuffer(part.content)) {
              if (isLargeFile) {
                try {
                  // For large images, try to use file handling if available
                  // This is a conditional approach that works with or without type definitions
                  if (typeof (this.generativeAI as any).createBlob === 'function') {
                    // Gemini API sometimes uses 'createBlob' instead of 'createBlobFile'
                    const fileData = await (this.generativeAI as any).createBlob({
                      data: part.content,
                      mimeType
                    });
                    
                    fileObjects.push(fileData);
                    
                    contentParts.push({
                      // Using 'as any' to bypass strict type checking
                      // as the fileData structure might vary between API versions
                      inlineData: { 
                        data: fileData,
                        mimeType
                      } as any
                    });
                  } else {
                    // Fallback to inline data if the File API method isn't available
                    this.addInlineImagePart(contentParts, part.content, mimeType);
                  }
                } catch (error) {
                  console.warn('Failed to use Gemini File API for large image, falling back to inline data:', error);
                  this.addInlineImagePart(contentParts, part.content, mimeType);
                }
              } else {
                // For smaller images, use inline data
                this.addInlineImagePart(contentParts, part.content, mimeType);
              }
            } else if (typeof part.content === 'string') {
              // Handle base64 or data URI strings
              contentParts.push({
                inlineData: {
                  data: part.content.replace(/^data:image\/\w+;base64,/, ''),
                  mimeType: mimeType
                }
              });
            }
            break;
            
          case 'document':
            // Special handling for PDF documents
            if (mimeType === 'application/pdf' && Buffer.isBuffer(part.content)) {
              try {
                if (typeof (this.generativeAI as any).createBlob === 'function') {
                  // PDF is directly supported by Gemini API
                  const fileData = await (this.generativeAI as any).createBlob({
                    data: part.content,
                    mimeType: 'application/pdf'
                  });
                  
                  fileObjects.push(fileData);
                  
                  contentParts.push({
                    inlineData: {
                      data: fileData,
                      mimeType: 'application/pdf'
                    } as any
                  });
                } else {
                  // If File API not available, use text content
                  if (textContent) {
                    contentParts.push({ text: textContent });
                  } else {
                    contentParts.push({ text: `[PDF: Unable to process content directly]` });
                  }
                }
              } catch (error) {
                console.warn('Failed to use Gemini File API for PDF, falling back to text content:', error);
                // Use extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                } else {
                  contentParts.push({ text: `[PDF: Unable to process content directly]` });
                }
              }
            } else {
              // For other document types, use extracted text or direct content
              if (textContent) {
                contentParts.push({ text: textContent });
              } else if (Buffer.isBuffer(part.content) && 
                        ['text/csv', 'text/plain', 'application/json', 'text/markdown'].includes(mimeType)) {
                // Handle text-based document formats directly
                contentParts.push({ text: part.content.toString('utf8') });
              } else {
                contentParts.push({ text: `[DOCUMENT: ${mimeType} - See extracted text below if available]` });
                if (Buffer.isBuffer(part.content)) {
                  try {
                    // Attempt to extract text from unknown document format
                    const text = part.content.toString('utf8', 0, Math.min(part.content.length, 4000));
                    if (text && /[\x20-\x7E]/.test(text)) { // Has printable ASCII
                      contentParts.push({ text: `Extracted content sample:\n${text}` });
                    }
                  } catch (e) {
                    // Ignore errors in content extraction
                  }
                }
              }
            }
            break;
            
          case 'audio':
          case 'video':
            if (Buffer.isBuffer(part.content)) {
              try {
                if (typeof (this.generativeAI as any).createBlob === 'function') {
                  const fileData = await (this.generativeAI as any).createBlob({
                    data: part.content,
                    mimeType
                  });
                  
                  fileObjects.push(fileData);
                  
                  contentParts.push({
                    inlineData: {
                      data: fileData,
                      mimeType
                    } as any
                  });
                } else {
                  // Fallback to text description if File API not available
                  contentParts.push({
                    text: `[${part.type.toUpperCase()}: Media file of type ${mimeType}]`
                  });
                  
                  // Include extracted text content if available
                  if (textContent) {
                    contentParts.push({ text: textContent });
                  }
                }
              } catch (error) {
                console.warn(`Failed to use Gemini File API for ${part.type}, falling back to text:`, error);
                
                contentParts.push({
                  text: `[${part.type.toUpperCase()}: Could not process file directly]`
                });
                
                // Include extracted text content if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
              }
            } else {
              // For non-buffer content
              contentParts.push({
                text: `[${part.type.toUpperCase()}: File format not supported]`
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
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      });
      
      const response = result.response;
      const text = response.text();
      
      // Parse the content as JSON
      let parsedContent: any = {};
      try {
        // Extract JSON from the response if it's embedded in text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          parsedContent = JSON.parse(text);
        }
      } catch (e) {
        console.error("Failed to parse JSON from Gemini multimodal response:", e);
        console.log("Raw response:", text);
        // Attempt to extract structured data even from non-JSON response
        parsedContent = {
          strengths: extractListItems(text, "strengths"),
          improvements: extractListItems(text, "improvements"),
          suggestions: extractListItems(text, "suggestions"),
          summary: extractSummary(text),
          score: extractScore(text)
        };
      }
      
      // Estimate tokens
      const estimatedTokens = Math.ceil(text.length / 4);
      
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
    } catch (error: any) {
      console.error("Gemini multimodal API error:", error);
      throw new Error(`Multimodal AI generation failed: ${error.message || String(error)}`);
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