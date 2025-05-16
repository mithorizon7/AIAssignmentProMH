/**
 * Utilities for repairing and completing malformed JSON responses
 * Used when AI models return partial or truncated JSON
 */

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
  
  try {
    // If it's already valid, no need for repair
    JSON.parse(json);
    return json;
  } catch (error) {
    console.log(`[GEMINI] Attempting to repair malformed JSON...`);
    
    // Remove markdown code block markers
    json = json.replace(/```json/g, '').replace(/```/g, '');
    
    // Check for truncated JSON - missing closing braces
    const openBraces = (json.match(/{/g) || []).length;
    const closeBraces = (json.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      console.log(`[GEMINI] Detected missing closing braces: ${openBraces - closeBraces}`);
      // Add missing closing braces
      json = json + '}'.repeat(openBraces - closeBraces);
    }
    
    // Fix trailing commas before closing brackets or braces
    json = json.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      JSON.parse(json);
      console.log(`[GEMINI] JSON repair successful`);
      return json;
    } catch (e) {
      // More advanced repair for specific schema
      console.log(`[GEMINI] Basic repair failed, attempting schema-specific repair`);
      return repairGradingJson(json, rawJson);
    }
  }
}

/**
 * Extract fields from malformed grading schema JSON to construct a valid response
 * This is a more aggressive repair strategy for handling incomplete responses
 */
function repairGradingJson(json: string, originalJson: string): string {
  const template: {
    strengths: string[],
    improvements: string[],
    score: number,
    summary: string
  } = {
    "strengths": [],
    "improvements": [],
    "score": 0,
    "summary": ""
  };
  
  function extractArray(fieldName: string): string[] {
    const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[(.*?)\\]`, 's');
    const match = originalJson.match(regex);
    
    if (match && match[1]) {
      // Extract the items and clean them up
      return match[1]
        .split(/",\s*"/)
        .map(item => item.replace(/^"/, '').replace(/"$/, '').trim())
        .filter(item => item.length > 0);
    }
    
    return [];
  }
  
  function extractScore(): number {
    const regex = /"score"\s*:\s*(\d+)/;
    const match = originalJson.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  function extractSummary(): string {
    const regex = /"summary"\s*:\s*"([^"]*?)"/;
    const match = originalJson.match(regex);
    return match ? match[1] : "";
  }
  
  // Extract fields and construct a valid JSON
  template.strengths = extractArray("strengths");
  template.improvements = extractArray("improvements");
  template.score = extractScore();
  template.summary = extractSummary();
  
  console.log(`[GEMINI] Constructed JSON with ${template.strengths.length} strengths, ${template.improvements.length} improvements`);
  
  return JSON.stringify(template, null, 2);
}