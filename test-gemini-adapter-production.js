/**
 * Test script for the production-ready Gemini adapter
 * 
 * This demonstrates the complete solution with:
 * 1. Schema pruning to remove fields Gemini doesn't support
 * 2. Proper Files API integration with snake_case vs camelCase handling
 * 3. JSON repair for truncated responses
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY environment variable");
  process.exit(1);
}

// Simulating key utilities used in the production adapter

// 1. Schema pruning
function pruneForGemini(schema) {
  const BLOCKED_KEYS = new Set([
    "$schema", "title", "description", "examples", "default", "additionalProperties"
  ]);
  
  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map(pruneForGemini);
  }

  // Handle objects
  if (schema && typeof schema === "object") {
    return Object.fromEntries(
      Object.entries(schema)
        .filter(([key]) => !BLOCKED_KEYS.has(key))
        .map(([key, value]) => [key, pruneForGemini(value)])
    );
  }
  
  return schema;
}

// 2. JSON Repair
function repairJson(rawJson) {
  if (!rawJson || typeof rawJson !== 'string') {
    return rawJson;
  }

  let json = rawJson.trim();
  
  try {
    // If it's already valid, no need for repair
    JSON.parse(json);
    return json;
  } catch (error) {
    console.log(`Attempting to repair malformed JSON...`);
    
    // Remove markdown code block markers
    json = json.replace(/```json/g, '').replace(/```/g, '');
    
    // Check for truncated JSON - missing closing braces
    const openBraces = (json.match(/{/g) || []).length;
    const closeBraces = (json.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      console.log(`Detected missing closing braces: ${openBraces - closeBraces}`);
      // Add missing closing braces
      json = json + '}'.repeat(openBraces - closeBraces);
    }
    
    // Fix trailing commas before closing brackets or braces
    json = json.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      JSON.parse(json);
      return json;
    } catch (e) {
      // More advanced repair for specific schema
      console.error("JSON repair failed:", e.message);
      return json;
    }
  }
}

// 3. Snake_case to CamelCase conversion
function toSDKFormat(fileData) {
  return {
    fileUri: fileData.file_uri,
    mimeType: fileData.mime_type
  };
}

// Simulate a file upload process
async function createFileData(content, mimeType) {
  console.log(`Simulating file upload to Gemini Files API: ${mimeType}`);
  
  // In production, this would actually upload to the Files API
  // and return a file_uri in the format "files/abc123"
  
  return {
    file_uri: "files/simulated123", 
    mime_type: mimeType
  };
}

// Example schema that needs pruning
const sampleSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Grading Feedback",
  "description": "Schema for AI grading feedback",
  "type": "object",
  "properties": {
    "strengths": {
      "type": "array",
      "items": { "type": "string" }
    },
    "improvements": {
      "type": "array",
      "items": { "type": "string" }
    },
    "score": {
      "type": "number",
      "minimum": 0,
      "maximum": 100
    }
  },
  "required": ["strengths", "improvements", "score"],
  "additionalProperties": false
};

// In production, we prune this schema during adapter construction
const prunedSchema = pruneForGemini(sampleSchema);
console.log("Original schema fields:", Object.keys(sampleSchema));
console.log("Pruned schema fields:", Object.keys(prunedSchema));

// Example of a truncated JSON response
const truncatedJson = `{
  "improvements": [
    "The connection between the neck and the hat could be refined for a more natural or intentional appearance.",
    "The hands of the figure are not clearly defined and could benefit from more detail."
  ],
  "score": 85,
  `;

console.log("\nAttempting to repair truncated JSON...");
const repairedJson = repairJson(truncatedJson);
console.log(`Repaired JSON is valid: ${(() => {
  try {
    JSON.parse(repairedJson);
    return true;
  } catch (e) {
    return false;
  }
})()}`);

// Example of file data handling with proper casing
console.log("\nSimulating file upload and format conversion...");

async function testFileHandling() {
  // In production, this uploads a file and gets the File API URI
  const fileData = await createFileData("image content", "image/jpeg");
  console.log("API format (snake_case):", fileData);
  
  // Convert to SDK format for use in API requests
  const sdkData = toSDKFormat(fileData);
  console.log("SDK format (camelCase):", sdkData);
}

testFileHandling();