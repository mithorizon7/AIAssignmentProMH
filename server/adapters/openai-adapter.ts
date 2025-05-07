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
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    this.model = "gpt-4o"; 
  }

  async generateCompletion(prompt: string) {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
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
        rawResponse: parsedContent,
        modelName: this.model,
        tokenCount
      };
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      throw new Error(`AI generation failed: ${error.message || String(error)}`);
    }
  }
}
