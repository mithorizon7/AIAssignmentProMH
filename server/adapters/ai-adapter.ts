import { CriteriaScore } from '@shared/schema';

// Define a structure for multimodal prompts
export interface MultimodalPromptPart {
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  content: string | Buffer;
  mimeType?: string;
  textContent?: string; // Optional extracted text content from non-text files
}

export interface AIAdapter {
  // Standard text completion
  generateCompletion(prompt: string): Promise<{
    strengths: string[];
    improvements: string[];
    suggestions: string[];
    summary: string;
    score?: number;
    criteriaScores?: CriteriaScore[];
    rawResponse: Record<string, any>;
    modelName: string;
    tokenCount: number;
  }>;
  
  // Multimodal content support
  generateMultimodalCompletion?(
    parts: MultimodalPromptPart[],
    systemPrompt?: string
  ): Promise<{
    strengths: string[];
    improvements: string[];
    suggestions: string[];
    summary: string;
    score?: number;
    criteriaScores?: CriteriaScore[];
    rawResponse: Record<string, any>;
    modelName: string;
    tokenCount: number;
  }>;
}