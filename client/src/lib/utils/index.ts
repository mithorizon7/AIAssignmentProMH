/**
 * Centralized exports for utility functions
 * This allows importing from "@/lib/utils" instead of specific files
 */

// Re-export from format.ts
export {
  formatDate,
  formatShortDate,
  formatTimeRemaining,
  getTimeAgo,
  formatPercentage,
  formatProcessingTime,
  getUserInitials
} from './format';

// Re-export from file.ts
export {
  isValidFileType,
  isValidFileSize,
  getFileErrorMessage,
  readFileAsText,
  getFileIconByExtension,
  formatFileSize
} from './file';