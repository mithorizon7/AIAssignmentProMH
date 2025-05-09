import { CriteriaScore } from '@shared/schema';

export interface AIAdapter {
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
}