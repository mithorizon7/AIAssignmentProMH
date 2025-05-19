/**
 * Token management utilities for handling large inputs to the Gemini API
 * 
 * This provides functions to:
 * - Estimate token counts for different content types
 * - Truncate content to fit within token limits
 * - Split content into manageable chunks
 */

import { MultimodalPromptPart } from '../types';

// Token limits for different Gemini models
export const TOKEN_LIMITS = {
  'gemini-1.0-pro': 32768,
  'gemini-1.5-pro': 1048576, // 1M tokens
  'gemini-1.5-flash': 1048576, // 1M tokens
  'gemini-2.0-pro': 2097152, // 2M tokens
  'gemini-2.0-flash': 1048576 // 1M tokens
};

// Default token limit if model not specified
const DEFAULT_TOKEN_LIMIT = 32768;

// Reserve tokens for the completion
const RESERVE_TOKENS_FOR_COMPLETION = 2048;

// Approximate token counts for different content types
export const TOKEN_ESTIMATES = {
  text: {
    // Approximate tokens per character for English text
    tokensPerChar: 0.25
  },
  image: {
    // Fixed token cost for small images (<= 384px in both dimensions)
    small: 258,
    // Token cost for larger images that get tiled (each tile costs 258 tokens)
    large: (width: number, height: number) => {
      // Calculate number of tiles (min tile 256px, max 768x768)
      const tilesX = Math.ceil(width / 768);
      const tilesY = Math.ceil(height / 768);
      return tilesX * tilesY * 258;
    }
  },
  pdf: {
    // Each page costs approximately 258 tokens
    tokensPerPage: 258
  },
  document: {
    // Each page costs approximately 258 tokens
    tokensPerPage: 258
  }
};

/**
 * Calculate the approximate token count for a text string
 * @param text The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensForText(text: string): number {
  return Math.ceil(text.length * TOKEN_ESTIMATES.text.tokensPerChar);
}

/**
 * Truncate text to fit within a maximum token count
 * @param text The text to truncate
 * @param maxTokens Maximum number of tokens
 * @returns Truncated text
 */
export function truncateTextToFitTokens(text: string, maxTokens: number): string {
  const estimatedChars = maxTokens / TOKEN_ESTIMATES.text.tokensPerChar;
  if (text.length <= estimatedChars) {
    return text;
  }
  
  // Truncate with some buffer to ensure we're under the limit
  const bufferFactor = 0.95; 
  return text.substring(0, Math.floor(estimatedChars * bufferFactor));
}

/**
 * Calculate the maximum token capacity available for prompt content
 * @param modelName The name of the model being used
 * @returns Maximum tokens available for prompt content
 */
export function getMaxPromptTokens(modelName: string): number {
  const totalLimit = TOKEN_LIMITS[modelName] || DEFAULT_TOKEN_LIMIT;
  return totalLimit - RESERVE_TOKENS_FOR_COMPLETION;
}

/**
 * Estimate total tokens for a multimodal prompt
 * @param parts Array of prompt parts
 * @returns Estimated token count
 */
export function estimateTokensForMultimodalParts(parts: MultimodalPromptPart[]): number {
  let totalTokens = 0;
  
  for (const part of parts) {
    if (part.type === 'text' && typeof part.content === 'string') {
      totalTokens += estimateTokensForText(part.content);
    } 
    else if (part.type === 'file') {
      // For files, we use a fixed estimate of 1000 tokens as a conservative approach
      // This is a simplification since we don't know the exact content dimensions
      totalTokens += 1000;
    }
  }
  
  return totalTokens;
}

/**
 * Determine if a prompt is likely to exceed token limits
 * @param parts Array of prompt parts
 * @param modelName The name of the model being used
 * @returns True if the prompt is likely to exceed token limits
 */
export function willExceedTokenLimits(
  parts: MultimodalPromptPart[], 
  modelName: string
): boolean {
  const maxPromptTokens = getMaxPromptTokens(modelName);
  const estimatedTokens = estimateTokensForMultimodalParts(parts);
  
  return estimatedTokens > maxPromptTokens;
}

/**
 * Optimize a prompt to fit within token limits
 * @param parts Array of prompt parts
 * @param modelName The name of the model being used
 * @returns Optimized array of prompt parts
 */
export function optimizePromptForTokenLimits(
  parts: MultimodalPromptPart[], 
  modelName: string
): MultimodalPromptPart[] {
  if (!willExceedTokenLimits(parts, modelName)) {
    return parts;
  }
  
  const maxPromptTokens = getMaxPromptTokens(modelName);
  const optimizedParts: MultimodalPromptPart[] = [];
  let tokenBudget = maxPromptTokens;
  
  // Prioritize file parts (images, documents) and truncate text as needed
  const textParts: MultimodalPromptPart[] = [];
  const fileParts: MultimodalPromptPart[] = [];
  
  // Split parts into text and file
  for (const part of parts) {
    if (part.type === 'text') {
      textParts.push(part);
    } else {
      fileParts.push(part);
    }
  }
  
  // Add all file parts first (they're typically more important)
  for (const part of fileParts) {
    // Estimate tokens for file (using 1000 as conservative estimate)
    const estimatedTokens = 1000;
    
    if (tokenBudget >= estimatedTokens) {
      optimizedParts.push(part);
      tokenBudget -= estimatedTokens;
    } else {
      console.warn('[TOKEN_MANAGER] Not enough token budget for all file parts');
      break;
    }
  }
  
  // Then add text parts with truncation if needed
  for (const part of textParts) {
    if (part.type === 'text' && typeof part.content === 'string') {
      const text = part.content;
      const estimatedTokens = estimateTokensForText(text);
      
      if (tokenBudget >= estimatedTokens) {
        // Fits as is
        optimizedParts.push(part);
        tokenBudget -= estimatedTokens;
      } else if (tokenBudget > 100) {
        // Truncate to fit
        const truncatedText = truncateTextToFitTokens(text, tokenBudget);
        optimizedParts.push({
          type: 'text',
          content: truncatedText + "\n\n[Note: Text was truncated to fit token limits]"
        });
        tokenBudget = 0;
      } else {
        console.warn('[TOKEN_MANAGER] Not enough token budget for text part');
      }
    }
  }
  
  return optimizedParts;
}