/**
 * Utility to strip unsupported fields from JSON schemas before sending to Gemini
 * 
 * Gemini's response_schema supports only a subset of JSON-Schema:
 * - Supported: type, properties, required, items, enum, format, and numerical/string constraints
 * - Not supported: $schema, title, description, examples, additionalProperties, etc.
 */

// Keys that Gemini will reject in schema definitions
const BLOCKED_KEYS = new Set([
  "$schema", 
  "title", 
  "description", 
  "examples", 
  "default", 
  "additionalProperties"
]);

/**
 * Prunes a JSON schema object to remove fields not supported by Gemini API
 * 
 * @param schema The JSON schema object to prune
 * @returns A new schema object with unsupported fields removed
 */
export function pruneForGemini(schema: any): any {
  // Handle arrays (e.g., for enum values or required fields)
  if (Array.isArray(schema)) {
    return schema.map(pruneForGemini);
  }

  // Handle objects recursively
  if (schema && typeof schema === "object") {
    return Object.fromEntries(
      Object.entries(schema)
        // Filter out keys that Gemini doesn't support
        .filter(([key]) => !BLOCKED_KEYS.has(key))
        // Recursively process nested objects and arrays
        .map(([key, value]) => [key, pruneForGemini(value)])
    );
  }
  
  // Pass through primitive values (strings, numbers, booleans, null)
  return schema;
}