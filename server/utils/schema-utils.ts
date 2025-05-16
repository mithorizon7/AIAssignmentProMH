/**
 * Schema utilities for working with Gemini API
 * 
 * Gemini's schema validation is more limited than full JSON Schema,
 * so we need to prune unsupported features before sending schemas to the API
 */

/**
 * Prune a JSON schema to be compatible with Gemini's limited schema support
 * 
 * Removes unsupported features such as:
 * - examples
 * - additionalProperties
 * - default values
 * - pattern validation
 * - format validation
 * 
 * @param schema The JSON schema to prune
 * @returns A Gemini-compatible version of the schema
 */
export function pruneGeminiSchema(schema: any): any {
  // Make a deep copy to avoid modifying the original
  const prunedSchema = JSON.parse(JSON.stringify(schema));
  
  // Keys that aren't supported by Gemini's schema implementation
  const unsupportedKeys = [
    'examples', 
    'additionalProperties', 
    'pattern', 
    'format',
    'patternProperties',
    'dependencies',
    'propertyNames',
    'if',
    'then',
    'else',
    'allOf',
    'anyOf',
    'oneOf',
    'not'
  ];
  
  // Recursively process the schema
  const pruneObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    // Remove unsupported keys from this level
    for (const key of unsupportedKeys) {
      if (key in obj) {
        delete obj[key];
      }
    }
    
    // Handle default values specially
    // (Gemini doesn't support them in the schema, but we capture them separately)
    const defaultValue = obj.default;
    delete obj.default;
    
    // Keep track of defaults for later use in prompt construction
    if (defaultValue !== undefined && obj.title) {
      // Store defaults in a special property that we'll extract before sending to Gemini
      if (!obj.__defaults) obj.__defaults = {};
      obj.__defaults[obj.title] = defaultValue;
    }
    
    // Process nested properties
    if (obj.properties) {
      for (const prop in obj.properties) {
        pruneObject(obj.properties[prop]);
      }
    }
    
    // Process array items
    if (obj.items) {
      pruneObject(obj.items);
    }
  };
  
  pruneObject(prunedSchema);
  return prunedSchema;
}

/**
 * Extract defaults from a schema that has been processed with pruneGeminiSchema
 * 
 * @param schema The processed schema with __defaults properties
 * @returns Object mapping property names to their default values
 */
export function extractDefaults(schema: any): Record<string, any> {
  const defaults: Record<string, any> = {};
  
  // Recursively collect defaults
  const collectDefaults = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    // Collect defaults at this level
    if (obj.__defaults) {
      Object.assign(defaults, obj.__defaults);
      delete obj.__defaults; // Clean up after extraction
    }
    
    // Process nested properties
    if (obj.properties) {
      for (const prop in obj.properties) {
        collectDefaults(obj.properties[prop]);
      }
    }
    
    // Process array items
    if (obj.items) {
      collectDefaults(obj.items);
    }
  };
  
  collectDefaults(schema);
  return defaults;
}

/**
 * Apply default values to an object based on extracted defaults
 * 
 * @param obj The object to apply defaults to
 * @param defaults The defaults mapping from extractDefaults
 * @returns The object with defaults applied
 */
export function applyDefaults(obj: any, defaults: Record<string, any>): any {
  if (!obj || typeof obj !== 'object' || !defaults) return obj;
  
  // Copy the object to avoid modifying the original
  const result = { ...obj };
  
  // Apply defaults for missing properties
  for (const key in defaults) {
    if (result[key] === undefined) {
      result[key] = defaults[key];
    }
  }
  
  return result;
}

/**
 * Attempt to repair a potentially truncated JSON string
 * 
 * @param jsonString The potentially truncated JSON string
 * @returns Repaired JSON string if possible, or the original
 */
export function repairJson(jsonString: string): string {
  try {
    // If it's already valid JSON, return as is
    JSON.parse(jsonString);
    return jsonString;
  } catch (error) {
    // Try to repair the JSON
    
    // Check for unbalanced braces
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      // Add missing closing braces
      const missingBraces = openBraces - closeBraces;
      return jsonString + '}'.repeat(missingBraces);
    }
    
    // Check for trailing commas
    if (jsonString.trim().endsWith(',')) {
      // Remove trailing comma and add closing brace
      return jsonString.trimEnd().slice(0, -1) + '}';
    }
    
    // If simple repairs don't work, return the original
    return jsonString;
  }
}