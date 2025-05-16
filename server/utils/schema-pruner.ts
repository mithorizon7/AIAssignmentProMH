/**
 * Utility for pruning JSON schemas before sending to Gemini
 * 
 * Gemini only supports a limited subset of JSON Schema, so we need
 * to strip out unsupported fields like $schema, additionalProperties, etc.
 */

const BLOCKED_KEYS = new Set([
  '$schema', 'title', 'description', 'examples', 'default', 'additionalProperties'
]);

/**
 * Remove fields from a JSON schema that aren't supported by Gemini
 * @param schema The original JSON schema
 * @returns A pruned version of the schema with unsupported fields removed
 */
export function pruneForGemini(schema: any): any {
  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map(pruneForGemini);
  }

  // Handle objects
  if (schema && typeof schema === 'object') {
    return Object.fromEntries(
      Object.entries(schema)
        .filter(([key]) => !BLOCKED_KEYS.has(key))
        .map(([key, value]) => [key, pruneForGemini(value)])
    );
  }
  
  // Return primitive values unchanged
  return schema;
}