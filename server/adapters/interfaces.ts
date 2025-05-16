/**
 * Shared interfaces for AI adapters
 */
import { CriteriaScore } from '@shared/schema';
import { GradingFeedback } from '../schemas/gradingSchema';

// Define a structure for multimodal prompts
export interface MultimodalPromptPart {
  type: string;  // ContentType from file-type-settings.ts
  content: string | Buffer;
  mimeType?: string;
  textContent?: string; // Optional extracted text content from non-text files
}

// Standard response format for all AI adapters
export interface AIAdapterResponse extends GradingFeedback {
  modelName: string;
  rawResponse: Record<string, unknown>;
  tokenCount: number;
  _promptTokens?: number;   // Internal tracking
  _totalTokens?: number;    // Internal tracking
}

export interface AIAdapter {
  // Standard text completion
  generateCompletion(prompt: string, systemPrompt?: string): Promise<AIAdapterResponse>;
  
  // Multimodal content support
  generateMultimodalCompletion?(
    parts: MultimodalPromptPart[],
    systemPrompt?: string
  ): Promise<AIAdapterResponse>;
}