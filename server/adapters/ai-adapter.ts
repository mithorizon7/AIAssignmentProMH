export interface AIAdapter {
  generateCompletion(prompt: string): Promise<{
    strengths: string[];
    improvements: string[];
    suggestions: string[];
    summary: string;
    score?: number;
    rawResponse: Record<string, any>;
    modelName: string;
    tokenCount: number;
  }>;
}