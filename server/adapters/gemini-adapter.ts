import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

import { AIAdapter } from './ai-adapter';

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