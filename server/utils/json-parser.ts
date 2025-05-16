/**
 * Strict JSON parser that validates against a schema
 */
import { z } from "zod";
import { GradingSchema } from "../schemas/gradingSchema";
import { SchemaValidationError } from "./schema-errors";

/**
 * Parse and validate JSON text against the GradingSchema
 * Removes markdown code fences if present
 * @param raw The raw text that should contain JSON
 * @returns A validated object that matches the GradingSchema
 * @throws Error if parsing fails or validation fails
 */
export function parseStrict(raw: string) {
  // 1. quick fence strip for markdown code blocks
  const jsonText = raw.trim().replace(/^```json|```$/g, "");
  
  try {
    // 2. Parse JSON
    const parsed = JSON.parse(jsonText);
    
    // 3. Validate against schema
    return GradingSchema.parse(parsed);
  } catch (error) {
    // Include the raw text in the error for debugging
    console.error("JSON parse or validation error:", error);
    console.error("Raw text (first 200 chars):", raw.substring(0, 200));
    
    // Throw custom error with original response for possible retry or fallback
    throw new SchemaValidationError(
      `Failed to parse or validate JSON response: ${error instanceof Error ? error.message : String(error)}`,
      raw
    );
  }
}

/**
 * Determine if an error should trigger a retry attempt
 * @param error The error from a previous attempt
 * @returns boolean indicating if retry is appropriate
 */
export function shouldRetry(error: any): boolean {
  // Retry on validation errors or typical AI model errors
  const errorStr = String(error);
  return (
    errorStr.includes("validation failed") || 
    errorStr.includes("parse") ||
    errorStr.includes("schema") ||
    errorStr.includes("timeout") ||
    errorStr.includes("rate limit") ||
    errorStr.includes("temporarily unavailable")
  );
}