import OpenAI from "openai";
import { AIAdapter } from "./ai-adapter";

export class OpenAIAdapter implements AIAdapter {
  private openai: OpenAI;
  private model: string;

  constructor() {
    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
    
    this.openai = new OpenAI({ apiKey });
    // Using gpt-4.1-mini-2025-04-14 as requested, different from gpt-4o which was the previous default
    this.model = "gpt-4.1-mini-2025-04-14"; 
  }

  async generateCompletion(prompt: string, systemPrompt?: string) {
    try {
      // Create properly typed message arrays for OpenAI
      const messages = [];
      
      // Add system prompt if provided
      if (systemPrompt !== undefined && systemPrompt !== null) {
        console.log(`[OPENAI] Using system prompt (${systemPrompt.length} chars)`);
        messages.push({ 
          role: "system" as const, 
          content: systemPrompt 
        });
      }
      
      // Add user prompt
      messages.push({ 
        role: "user" as const, 
        content: prompt 
      });
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      // Parse the content as JSON
      const content = response.choices[0].message.content;
      const parsedContent = JSON.parse(content || "{}");
      
      // Extract usage information
      const tokenCount = response.usage?.total_tokens || 0;

      return {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.model,
        tokenCount
      };
    } catch (error: unknown) {
      console.error("OpenAI API error:", error);
      throw new Error(`AI generation failed: ${error.message || String(error)}`);
    }
  }
}
