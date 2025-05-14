import { CriteriaScore } from '@shared/schema';

import { ContentType } from '../utils/file-type-settings';

// Define a structure for multimodal prompts
export interface MultimodalPromptPart {
  type: ContentType;
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
    rawResponse: Record<string, unknown>;
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
    rawResponse: Record<string, unknown>;
    modelName: string;
    tokenCount: number;
  }>;
}