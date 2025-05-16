/**
 * Type definitions for Gemini adapter
 */

export interface GeminiFileData {
  file_uri: string;
  mime_type: string;
}

export interface GradingFeedback {
  strengths: string[];
  improvements: string[];
  score: number;
  summary: string;
}