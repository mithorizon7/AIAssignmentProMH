/**
 * Zod schema for validating AI generated grading feedback
 * This schema ensures consistent structure for feedback data
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Define schema version for tracking/history
export const SCHEMA_VERSION = "1.0.0";

// Define a schema for criteria scores
const CriteriaScoreSchema = z.object({
  criteriaId: z.string(), // Must be string to match shared schema
  score: z.number(),
  feedback: z.string()
});

// Define the grading schema
export const GradingSchema = z.object({
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  suggestions: z.array(z.string()),
  summary: z.string(),
  score: z.number().min(0).max(100),
  criteriaScores: z.array(CriteriaScoreSchema).optional(),
  schemaVersion: z.string().default(SCHEMA_VERSION)
});

// We don't freeze the schemas to allow Zod to use its internal caching
// Object.freeze would prevent Zod from writing to its internal _cached property

// Convert Zod schema to JSON Schema for API requests
export const gradingJSONSchema = zodToJsonSchema(GradingSchema, {
  $refStrategy: "none",
  errorMessages: true,
});

// Export the types
export type GradingFeedback = z.infer<typeof GradingSchema>;
export type CriteriaScoreData = z.infer<typeof CriteriaScoreSchema>;