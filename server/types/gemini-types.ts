/**
 * Type definitions for Gemini adapter
 */

export interface GeminiFileData {
  fileUri: string;
  mimeType: string;
}

export interface GradingFeedback {
  strengths: string[];
  improvements: string[];
  score: number;
  summary: string;
}