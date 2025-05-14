import { GoogleGenerativeAI, GenerativeModel, Content, Part, FileData } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { CriteriaScore } from '@shared/schema';
import { fileToDataURI } from '../utils/multimodal-processor';

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

/**
 * Extended FileData interface that includes cleanup methods
 * for the Gemini API which might have different versions
 */
interface GeminiFileData extends FileData {
  delete?: () => Promise<void>;
}

/**
 * Extended GoogleGenerativeAI interface that includes file handling methods
 * which might differ between API versions
 */
interface ExtendedGenerativeAI extends GoogleGenerativeAI {
  createFile?: (options: { data: Buffer, mimeType: string }) => Promise<FileData>;
  createBlob?: (options: { data: Buffer, mimeType: string }) => Promise<FileData>;
}

/**
 * Generation configuration options for Gemini API
 */
interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  responseFormat?: { type: string };
  [key: string]: unknown;
}

/**
 * Response metadata interface for token usage information
 * Different API versions might have different structures
 */
interface ResponseMetadata {
  candidates?: Array<{
    usageMetadata?: {
      totalTokens?: number;
    };
  }>;
  usageMetadata?: {
    totalTokens?: number;
  };
  usage?: {
    totalTokens?: number;
  };
  [key: string]: unknown;
}

// Extracted from Google AI Gemini API documentation
// https://ai.google.dev/gemini-api/docs/image-understanding
// https://ai.google.dev/gemini-api/docs/video-understanding
// https://ai.google.dev/gemini-api/docs/audio
// https://ai.google.dev/gemini-api/docs/document-processing
export const SUPPORTED_MIME_TYPES = {
  // Images (inlineData for small, fileData for large)
  image: [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ],
  // Videos (always use fileData)
  video: [
    'video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ],
  // Audio (always use fileData)
  audio: [
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm'
  ],
  // Documents (use fileData)
  document: [
    'application/pdf', 'text/csv', 'text/plain', 'application/json', 
    'text/markdown', 'text/html', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

export class GeminiAdapter implements AIAdapter {
  private generativeAI: ExtendedGenerativeAI;
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
   * Check if a MIME type is supported by Gemini for a given content type
   * @param mimeType The MIME type to check
   * @param contentType The content category (image, video, audio, document)
   * @returns True if the MIME type is supported
   */
  private isMimeTypeSupported(mimeType: string, contentType: string): boolean {
    const supportedTypes = SUPPORTED_MIME_TYPES[contentType as keyof typeof SUPPORTED_MIME_TYPES];
    if (!supportedTypes) return false;
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get the default MIME type for a given content type
   * @param contentType The content category
   * @returns A default MIME type for the given category
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
   * Creates a file with the Gemini File API
   * @param content Buffer containing file data
   * @param mimeType MIME type of the file
   * @returns A FileData object that can be used in a content part
   */
  /**
   * Get the file URI from a FileData object, handling different API versions
   * @param fileData The FileData object from the Gemini API
   * @returns The file URI string
   */
  private getFileUri(fileData: FileData): string {
    // The FileData object might have different property names in different API versions
    // Handle all possible variants based on Gemini API documentation changes
    const fileDataObj = fileData as unknown as Record<string, unknown>;
    return (
      typeof fileDataObj.uri === 'string' ? fileDataObj.uri :
      typeof fileDataObj.fileUri === 'string' ? fileDataObj.fileUri :
      typeof fileDataObj.url === 'string' ? fileDataObj.url :
      typeof fileDataObj.fileUrl === 'string' ? fileDataObj.fileUrl :
      ''
    );
  }
  
  private async createFileData(content: Buffer, mimeType: string): Promise<GeminiFileData> {
    try {
      // Check if the GenerativeAI instance has the createFile method (latest API version)
      if (this.generativeAI.createFile && typeof this.generativeAI.createFile === 'function') {
        return await this.generativeAI.createFile({
          data: content,
          mimeType
        }) as GeminiFileData;
      }
      
      // Fallback to createBlob for older API versions
      if (this.generativeAI.createBlob && typeof this.generativeAI.createBlob === 'function') {
        return await this.generativeAI.createBlob({
          data: content,
          mimeType
        }) as GeminiFileData;
      }
      
      // Fallback for when File API is completely unavailable
      // Create a synthetic FileData object with a Data URI scheme
      console.warn('Gemini File API not available, using data URI fallback for content handling');
      const dataUri = await fileToDataURI(content, mimeType);
      
      // Create a valid FileData structure that strictly matches what generateContent expects
      // for Part.fileData: { mimeType: string, fileUri: string }
      return {
        fileUri: dataUri,
        mimeType: mimeType
      } as unknown as FileData;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating file with Gemini File API:', errorMessage);
      
      // Even if API call fails, provide a fallback that won't break the application
      try {
        const dataUri = await fileToDataURI(content, mimeType);
        console.warn('Using data URI fallback after File API error');
        return {
          fileUri: dataUri,
          mimeType: mimeType
        } as unknown as FileData;
      } catch (fallbackError) {
        console.error('Both Gemini File API and fallback failed:', fallbackError);
        throw error instanceof Error ? error : new Error(String(error)); // Throw the original error if fallback also fails
      }
    }
  }
  
  /**
   * Add inline image data to content parts for small images
   * Following Google AI Gemini API documentation: https://ai.google.dev/gemini-api/docs/image-understanding
   * @param contentParts Array of content parts to append to
   * @param content Image content as buffer or base64 string
   * @param mimeType Image MIME type
   */
  private addInlineImagePart(contentParts: Part[], content: string | Buffer, mimeType: string): void {
    // For images, convert to base64 if it's a buffer
    let base64Data: string;
    
    if (Buffer.isBuffer(content)) {
      // Convert buffer to base64 string (without data URI prefix)
      base64Data = content.toString('base64');
    } else if (typeof content === 'string' && content.startsWith('data:')) {
      // Extract base64 from data URI
      base64Data = content.replace(/^data:image\/\w+;base64,/, '');
    } else {
      // Assume it's already a base64 string
      base64Data = content as string;
    }
    
    // Add the image part with inline data
    contentParts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    });
  }

  async generateCompletion(prompt: string) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse the content as JSON
      let parsedContent: ParsedContent = {};
      try {
        // Extract JSON from the response if it's embedded in text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          parsedContent = JSON.parse(text);
        }
      } catch (e: unknown) {
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
    } catch (error: unknown) {
      console.error("Gemini API error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`AI generation failed: ${errorMessage}`);
    }
  }
  
  /**
   * Generate completion using multimodal inputs (text, images, audio, video, documents)
   * Properly processes content through Gemini API based on content type
   * Following Google AI Gemini API documentation for handling different media types:
   * https://ai.google.dev/gemini-api/docs/image-understanding
   * https://ai.google.dev/gemini-api/docs/video-understanding
   * https://ai.google.dev/gemini-api/docs/audio
   * https://ai.google.dev/gemini-api/docs/document-processing
   * 
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
      
      // Track file objects for cleanup
      const fileObjects: GeminiFileData[] = [];
      
      // Process each part based on its type
      for (const part of parts) {
        const textContent = part.textContent;
        const mimeType = part.mimeType || this.getDefaultMimeType(part.type);
        
        // Determine file size if we have a buffer
        const fileSize = Buffer.isBuffer(part.content) ? part.content.length : 0;
        const isLargeFile = fileSize > 2 * 1024 * 1024; // 2MB threshold for image inlineData
        
        switch (part.type) {
          case 'text':
            // Text is always handled directly
            contentParts.push({
              text: part.content as string
            });
            break;
            
          case 'image':
            // Follow Gemini API image handling guidelines
            // https://ai.google.dev/gemini-api/docs/image-understanding
            if (Buffer.isBuffer(part.content)) {
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'image')) {
                contentParts.push({
                  text: `[IMAGE: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.image.join(', ')}]`
                });
                break;
              }
              
              if (isLargeFile) {
                try {
                  // For large images (>2MB), use Gemini File API
                  const fileData = await this.createFileData(part.content, mimeType);
                  fileObjects.push(fileData);
                  
                  // Add the file part with fileData
                  // The FileData object might have different properties depending on API version
                  contentParts.push({
                    fileData: {
                      fileUri: this.getFileUri(fileData),
                      mimeType: mimeType
                    }
                  });
                } catch (error) {
                  console.warn('Failed to use Gemini File API for large image, falling back to inline data:', error);
                  // Fallback to inline data
                  this.addInlineImagePart(contentParts, part.content, mimeType);
                }
              } else {
                // For smaller images, use inline data (more efficient)
                this.addInlineImagePart(contentParts, part.content, mimeType);
              }
            } else if (typeof part.content === 'string') {
              // Handle base64 or data URI strings for images
              this.addInlineImagePart(contentParts, part.content, mimeType);
            }
            break;
            
          case 'document':
            // Follow Gemini API document handling guidelines
            // https://ai.google.dev/gemini-api/docs/document-processing
            if (Buffer.isBuffer(part.content)) {
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'document')) {
                contentParts.push({
                  text: `[DOCUMENT: Unsupported format ${mimeType}]`
                });
                
                // Include extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
                break;
              }
              
              try {
                // For all document types, use File API (preferred method)
                const fileData = await this.createFileData(part.content, mimeType);
                fileObjects.push(fileData);
                
                // Add the file part with fileData 
                contentParts.push({
                  fileData: {
                    fileUri: this.getFileUri(fileData),
                    mimeType: mimeType
                  }
                });
              } catch (error) {
                console.warn(`Failed to use Gemini File API for document (${mimeType}), falling back to text:`, error);
                
                // Fallback to text content for text-based documents
                if (textContent) {
                  contentParts.push({ text: textContent });
                } else if (['text/csv', 'text/plain', 'application/json', 'text/markdown', 'text/html'].includes(mimeType)) {
                  // Handle text-based document formats directly
                  contentParts.push({ text: part.content.toString('utf8') });
                } else {
                  contentParts.push({ text: `[DOCUMENT: ${mimeType} - Unable to process]` });
                }
              }
            } else if (typeof part.content === 'string') {
              // Handle document content as text
              contentParts.push({ text: part.content });
            }
            break;
            
          case 'audio':
            // Follow Gemini API audio handling guidelines
            // https://ai.google.dev/gemini-api/docs/audio
            if (Buffer.isBuffer(part.content)) {
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'audio')) {
                contentParts.push({
                  text: `[AUDIO: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.audio.join(', ')}]`
                });
                
                // Include extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
                break;
              }
              
              try {
                // Audio must use File API (not inlineData)
                const fileData = await this.createFileData(part.content, mimeType);
                fileObjects.push(fileData);
                
                // Add the file part with fileData
                contentParts.push({
                  fileData: {
                    fileUri: this.getFileUri(fileData),
                    mimeType: mimeType
                  }
                });
              } catch (error) {
                console.warn(`Failed to use Gemini File API for audio (${mimeType}):`, error);
                
                contentParts.push({
                  text: `[AUDIO: Could not process file directly]`
                });
                
                // Include extracted text or transcription if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
              }
            } else {
              contentParts.push({
                text: `[AUDIO: File format not supported]`
              });
            }
            break;
            
          case 'video':
            // Follow Gemini API video handling guidelines
            // https://ai.google.dev/gemini-api/docs/video-understanding
            if (Buffer.isBuffer(part.content)) {
              // Check if MIME type is supported
              if (!this.isMimeTypeSupported(mimeType, 'video')) {
                contentParts.push({
                  text: `[VIDEO: Unsupported format ${mimeType}. Supported formats are: ${SUPPORTED_MIME_TYPES.video.join(', ')}]`
                });
                
                // Include extracted text if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
                break;
              }
              
              try {
                // Video must use File API (not inlineData)
                const fileData = await this.createFileData(part.content, mimeType);
                fileObjects.push(fileData);
                
                // Add the file part with fileData
                contentParts.push({
                  fileData: {
                    fileUri: this.getFileUri(fileData),
                    mimeType: mimeType
                  }
                });
              } catch (error) {
                console.warn(`Failed to use Gemini File API for video (${mimeType}):`, error);
                
                contentParts.push({
                  text: `[VIDEO: Could not process file directly]`
                });
                
                // Include extracted text or description if available
                if (textContent) {
                  contentParts.push({ text: textContent });
                }
              }
            } else {
              contentParts.push({
                text: `[VIDEO: File format not supported]`
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
      const generationConfig: GenerationConfig = {
        temperature: 0.7, 
        maxOutputTokens: 2048
      };
      
      // Add responseFormat if available in this version of the API
      // This is added in newer versions of the Gemini API
      if (this.modelName.includes('gemini-2')) {  // For Gemini 2 models
        generationConfig.responseFormat = { type: "json" };
      }
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig
      });
      
      // Cleanup file resources
      for (const fileObject of fileObjects) {
        try {
          if (fileObject && typeof (fileObject as GeminiFileData).delete === 'function') {
            await (fileObject as GeminiFileData).delete?.();
          }
        } catch (cleanupError) {
          console.warn('Error cleaning up file resource:', cleanupError);
        }
      }
      
      const response = result.response;
      const text = response.text();
      
      // Parse the content as JSON
      let parsedContent: ParsedContent = {};
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
      
      // Get actual token usage if available, otherwise estimate
      let tokenCount = 0;
      
      // Different versions of the API have different ways to access token usage
      try {
        // Cast response to our ResponseMetadata interface to access usage data
        const responseMetadata = response as unknown as ResponseMetadata;
        
        // Try different paths to token usage information based on API version
        tokenCount = responseMetadata.candidates?.[0]?.usageMetadata?.totalTokens ||
                    responseMetadata.usageMetadata?.totalTokens ||
                    responseMetadata.usage?.totalTokens ||
                    Math.ceil(text.length / 4); // Fallback to estimation
      } catch (e) {
        // Fallback to estimation if access fails
        tokenCount = Math.ceil(text.length / 4);
      }
      
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
    } catch (error: unknown) {
      console.error("Gemini multimodal API error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Multimodal AI generation failed: ${errorMessage}`);
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