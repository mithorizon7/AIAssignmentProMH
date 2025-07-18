/**
 * Test for the fixed Gemini adapter implementation
 * Using ESM syntax with top-level await
 */
import { GoogleGenAI } from '@google/genai';

// Read API key from environment
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Please set GEMINI_API_KEY environment variable");
  process.exit(1);
}

// Initialize the client
const genAI = new GoogleGenAI({ apiKey });
const modelName = "gemini-2.5-flash-preview-04-17";

// Define response schema structure
const responseSchema = {
  type: "object",
  properties: {
    strengths: {
      type: "array",
      items: { type: "string" }
    },
    improvements: {
      type: "array",
      items: { type: "string" }
    },
    suggestions: {
      type: "array",
      items: { type: "string" }
    },
    summary: { type: "string" },
    score: { type: "number" },
    criteriaScores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criteriaId: { type: "string" }, // Must be string to match shared schema
          score: { type: "number" },
          feedback: { type: "string" }
        },
        required: ["criteriaId", "score", "feedback"]
      }
    }
  },
  required: ["strengths", "improvements", "suggestions", "summary", "score"]
};

async function main() {
  try {
    console.log("Testing Gemini Adapter with proper systemInstruction placement...");
    
    // Sample prompt
    const prompt = "Evaluate this programming submission: function calculateSum(a, b) { return a + b; }";
    
    // System prompt for guiding response format
    const systemPrompt = `You are an expert programming instructor giving feedback on student code. 
    Provide a balanced evaluation with specific strengths, areas for improvement, and actionable suggestions.
    Format your response as a valid JSON object only.`;
    
    // Prepare the request with proper placement of systemInstruction
    const requestParams = {
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // systemInstruction is top-level field, not inside config
      systemInstruction: systemPrompt,
      config: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    };
    
    console.log(`Sending request to Gemini API with responseMimeType: application/json`);
    
    // Generate content
    const result = await genAI.models.generateContent(requestParams);
    
    // Log the response
    if (result.candidates && 
        result.candidates.length > 0 && 
        result.candidates[0]?.content?.parts) {
      const firstPart = result.candidates[0].content.parts[0];
      if (firstPart.text) {
        console.log("RESPONSE TEXT:");
        console.log(firstPart.text);
        
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(firstPart.text);
          console.log("\nPARSED JSON:");
          console.log(JSON.stringify(parsed, null, 2));
          console.log("\nTEST PASSED: Response was valid JSON");
        } catch (e) {
          console.error("\nTEST FAILED: Response was not valid JSON");
          console.error(e);
        }
      }
    } else {
      console.log("No text response found in the expected location");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("Error in test:", error);
  }
}

main();
