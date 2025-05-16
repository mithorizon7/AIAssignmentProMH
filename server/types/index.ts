/**
 * Common types for the AI grading system
 */

/**
 * Content types for multimodal submissions
 */
export type AIContentType = 'text' | 'image' | 'pdf' | 'document' | 'audio' | 'video' | 'unknown';

/**
 * Multimodal prompt part (text or file)
 */
export interface MultimodalPromptPart {
  type: 'text' | 'file';
  content: string | Buffer;
  mimeType?: string;  // Required for file type
}

/**
 * Token usage information
 */
export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Criteria score entry
 */
export interface CriteriaScore {
  criteriaId: string;
  score: number;
  feedback: string;
}

/**
 * Structured grading feedback
 */
export interface GradingFeedback {
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  summary: string;
  score?: number;
  criteriaScores?: CriteriaScore[];
  schemaVersion?: string;
}

/**
 * File upload information
 */
export interface FileUploadInfo {
  url: string;
  mimeType: string;
  size: number;
  filename: string;
}

/**
 * Submission metadata
 */
export interface SubmissionMetadata {
  submissionId: string;
  userId: string;
  assignmentId: string;
  timestamp: string;
  contentType: AIContentType;
  fileInfo?: FileUploadInfo;
}