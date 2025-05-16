/**
 * Custom error classes for schema validation and related errors
 */

/**
 * Error thrown when AI response fails schema validation
 * Preserves the raw response text for debugging and potential recovery
 */
export class SchemaValidationError extends Error {
  public readonly rawResponse: unknown;
  
  constructor(message: string, public readonly rawText: string, cause?: unknown) {
    super(message);
    this.name = 'SchemaValidationError';
    this.rawResponse = cause;
    this.cause = cause;
  }
}

/**
 * Type guard to check if an error is related to schema validation
 * Used to determine if retrying the request might help
 */
export function isSchemaError(err: unknown): err is { code: string; message?: string } {
  return typeof err === "object" && err !== null && "code" in err;
}

/**
 * Determines if an error warrants a retry attempt
 * Schema-related errors like JSON parsing issues are retryable
 */
export function shouldRetry(err: { code: string; message?: string }): boolean {
  // Retryable error codes from Gemini API
  const retryableCodes = [
    'SCHEMA_VALIDATION_ERROR',
    'INVALID_ARGUMENT',
    'FAILED_PRECONDITION'
  ];
  
  return retryableCodes.includes(err.code);
}