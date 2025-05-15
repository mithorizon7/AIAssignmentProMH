/**
 * Zod schema for validating AI generated grading feedback
 * This schema ensures consistent structure for feedback data
 */
import { z } from "zod";

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
  criteriaScores: z.array(CriteriaScoreSchema).optional()
});

// Freeze to prevent modification
Object.freeze(GradingSchema);

// Export the types
export type GradingFeedback = z.infer<typeof GradingSchema>;
export type CriteriaScoreData = z.infer<typeof CriteriaScoreSchema>;