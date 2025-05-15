/**
 * Utility for sanitizing text before sending to AI models
 * Helps prevent prompt injection and other issues
 */

/**
 * Sanitize text by removing control characters and limiting length
 * @param text The input text to sanitize
 * @param maxTokens Maximum allowed tokens (estimated)
 * @returns Sanitized text
 */
export function sanitizeText(text: string, maxTokens: number = 8000): string {
  if (!text) return '';
  
  // Remove ASCII control characters (except newlines and tabs)
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Estimate token count (rough approximation)
  const estimatedTokens = Math.ceil(sanitized.length / 4);
  
  // Truncate if over token limit
  if (estimatedTokens > maxTokens) {
    const targetLength = maxTokens * 4;
    sanitized = sanitized.substring(0, targetLength);
    // Add notice about truncation
    sanitized += `\n[Content truncated to approximately ${maxTokens} tokens]`;
  }
  
  return sanitized;
}

/**
 * Check if text might contain prompt injection attempts
 * Very basic detection of common patterns
 * @param text The text to check
 * @returns True if potential injection detected
 */
export function detectInjectionAttempt(text: string): boolean {
  if (!text) return false;
  
  // Common injection patterns
  const patterns = [
    /ignore previous instructions/i,
    /ignore above instructions/i,
    /forget your instructions/i,
    /you are now/i,
    /system prompt:/i,
    /\<\!--/,  // HTML comment start 
    /\-\-\>/,  // HTML comment end
    /\/\*/, // JS/C comment start
    /\*\//, // JS/C comment end
    /```system/i,
    /```instructions/i
  ];
  
  return patterns.some(pattern => pattern.test(text));
}