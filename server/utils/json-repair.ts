/**
 * Utilities for repairing and completing malformed JSON responses
 * Used when AI models return partial or truncated JSON
 */

import { GradingFeedback, GradingSchema } from '../schemas/gradingSchema';

/**
 * Common reasons for JSON failures from AI models:
 * 1. Truncation (incomplete responses)
 * 2. Missing closing brackets or braces
 * 3. Missing commas
 * 4. Trailing commas
 * 5. Unescaped quotes
 */

/**
 * Attempt to repair common issues with AI-generated JSON
 * @param rawJson The raw, potentially malformed JSON string
 * @returns Fixed JSON string that's more likely to parse correctly
 */
export function repairJson(rawJson: string): string {
  if (!rawJson || typeof rawJson !== 'string') {
    return rawJson;
  }

  let json = rawJson.trim();
  const originalJson = json;
  
  try {
    // If it's already valid, no need for repair
    JSON.parse(json);
    return json;
  } catch (error) {
    // If invalid, try to repair it
    console.log(`[JSON-REPAIR] Attempting to repair malformed JSON...`);
    
    // Remove any markdown code block markers
    json = json.replace(/```json/g, '').replace(/```/g, '');
    
    // Check for obviously truncated JSON - missing closing braces
    const openBraces = (json.match(/{/g) || []).length;
    const closeBraces = (json.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      console.log(`[JSON-REPAIR] Detected missing closing braces: ${openBraces - closeBraces}`);
      // Add missing closing braces
      json = json + '}'.repeat(openBraces - closeBraces);
    }
    
    // Fix trailing commas before closing brackets or braces
    json = json.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix missing commas between fields (common in LLM outputs)
    json = json.replace(/}(\s*){/g, '}, {');
    json = json.replace(/](\s*)\[/g, '], [');
    
    // If JSON still doesn't parse, but we have key parts of the grading schema,
    // try to reconstruct a valid response
    try {
      JSON.parse(json);
      return json;
    } catch (e) {
      // More advanced repair for grading schema
      return repairGradingJson(json, originalJson);
    }
  }
}

/**
 * Extract fields from malformed grading schema JSON to construct a valid response
 * This is a more aggressive repair strategy for handling incomplete responses
 */
function repairGradingJson(json: string, originalJson: string): string {
  console.log(`[JSON-REPAIR] Attempting advanced repair for grading schema JSON`);
  
  // Initialize with default values
  const repairedGrading: Partial<GradingFeedback> = {
    strengths: [],
    improvements: [],
    suggestions: [],
    summary: "Generated from incomplete AI response",
    score: 0,
    schemaVersion: "1.0.0"
  };
  
  // Try to extract arrays like strengths, improvements, suggestions
  function extractArray(fieldName: string): string[] {
    const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[(.*?)\\]`, 's');
    const match = json.match(regex) || originalJson.match(regex);
    
    if (match && match[1]) {
      try {
        // Try parsing the array directly
        return JSON.parse(`[${match[1]}]`);
      } catch (e) {
        // If that fails, manually extract string items
        const itemRegex = /"([^"]*?)"/g;
        const items: string[] = [];
        let itemMatch;
        
        while ((itemMatch = itemRegex.exec(match[1])) !== null) {
          items.push(itemMatch[1]);
        }
        
        return items;
      }
    }
    return [];
  }
  
  // Try to extract score
  function extractScore(): number {
    const scoreRegex = /"score"\s*:\s*(\d+)/;
    const match = json.match(scoreRegex) || originalJson.match(scoreRegex);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  // Try to extract summary
  function extractSummary(): string {
    const summaryRegex = /"summary"\s*:\s*"(.*?)"/;
    const match = json.match(summaryRegex) || originalJson.match(summaryRegex);
    return match ? match[1] : "Generated from incomplete AI response";
  }
  
  // Extract what we can from the malformed JSON
  repairedGrading.strengths = extractArray('strengths');
  repairedGrading.improvements = extractArray('improvements');
  repairedGrading.suggestions = extractArray('suggestions');
  repairedGrading.score = extractScore();
  repairedGrading.summary = extractSummary();
  
  // Ensure we have at least minimal content
  if (repairedGrading.strengths.length === 0 && 
      repairedGrading.improvements.length === 0 && 
      repairedGrading.suggestions.length === 0) {
    // No useful content was recovered, return minimal fallback
    console.log(`[JSON-REPAIR] Could not extract any useful content from malformed JSON`);
    return JSON.stringify({
      strengths: ["The submission has been processed"],
      improvements: ["Unable to extract specific feedback from AI response"],
      suggestions: ["Please try submitting again for detailed feedback"],
      summary: "The AI feedback was incomplete. Please try submitting again.",
      score: 0,
      schemaVersion: "1.0.0"
    });
  }
  
  // We have some content, return what we recovered
  console.log(`[JSON-REPAIR] Recovered partial content from malformed JSON`);
  return JSON.stringify(repairedGrading);
}