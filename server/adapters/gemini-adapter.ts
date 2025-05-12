import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import fs from 'fs';

import { AIAdapter } from './ai-adapter';
import { fileToDataURI } from '../utils/multimodal-processor';

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
   * Generate completion using multimodal inputs (text, images, etc.)
   */
  async generateMultimodalCompletion(parts: any[], systemPrompt?: string) {
    try {
      // Create the content parts
      const contentParts: Part[] = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        // We'll add system prompt as a regular text part
        contentParts.push({
          text: systemPrompt
        });
      }
      
      // Process each part based on its type
      for (const part of parts) {
        switch (part.type) {
          case 'text':
            contentParts.push({
              text: part.content
            });
            break;
            
          case 'image':
            // For images, convert to data URI if it's a buffer
            let imageData;
            if (Buffer.isBuffer(part.content)) {
              const mimeType = part.mimeType || 'image/jpeg';
              imageData = fileToDataURI(part.content, mimeType);
            } else {
              imageData = part.content; // Assume it's already a data URI
            }
            
            // Handle different image data formats
            if (typeof imageData === 'string' && imageData.startsWith('data:')) {
              // It's a data URI
              contentParts.push({
                inlineData: {
                  data: imageData.replace(/^data:image\/\w+;base64,/, ''),
                  mimeType: part.mimeType || 'image/jpeg'
                }
              });
            } else if (Buffer.isBuffer(imageData)) {
              // It's still a buffer
              contentParts.push({
                inlineData: {
                  data: imageData.toString('base64'),
                  mimeType: part.mimeType || 'image/jpeg'
                }
              });
            } else {
              // Assume it's already a base64 string
              contentParts.push({
                inlineData: {
                  data: imageData,
                  mimeType: part.mimeType || 'image/jpeg'
                }
              });
            }
            break;
            
          default:
            // Handle other types as text with a note
            contentParts.push({
              text: `[${part.type.toUpperCase()} CONTENT - Not directly processed by the model]`
            });
            
            // If there's text content extracted from the file, add it
            if (part.textContent) {
              contentParts.push({
                text: part.textContent
              });
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