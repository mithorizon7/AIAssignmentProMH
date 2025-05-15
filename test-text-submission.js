/**
 * Test script for diagnosing text submission issues with the Gemini adapter
 */
import pkg from '@google/genai';
const { GoogleGenerativeAI } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize client with API key (from env)
const API_KEY = process.env.GEMINI_API_KEY;

// Exit if no API key
if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable');
  process.exit(1);
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.genModel('gemini-2.5-flash-preview-04-17');

// Response schema for structured output
const responseSchema = {
  "type": "object",
  "properties": {
    "strengths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of strengths in the submission"
    },
    "improvements": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of areas that need improvement"
    },
    "suggestions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of specific suggestions to improve the work"
    },
    "summary": {
      "type": "string",
      "description": "Overall summary of the feedback"
    },
    "score": {
      "type": "number",
      "description": "Numeric score from 0-100"
    }
  },
  "required": ["strengths", "improvements", "suggestions", "summary"]
};

// Test prompt with system prompt
async function testTextSubmission() {
  console.log("Testing text submission with Gemini...");
  
  const prompt = `Please analyze the following student submission for an assignment about fish in Saudi Arabia:

## Student Submission:
The Arabian Gulf and Red Sea surrounding Saudi Arabia contain diverse marine ecosystems. Common fish species include Hammour (grouper), Shaari (emperor), and Hamra (red snapper). These waters face challenges from overfishing and environmental changes. Conservation efforts focus on sustainable fishing practices and marine protected areas to preserve biodiversity.

## Assignment Details:
Assignment: Write about fish species in Saudi Arabian waters

Provide constructive feedback on this submission.`;

  const systemPrompt = `You are an expert AI Teaching Assistant analyzing a text-based submission.
Your task is to provide precise, detailed, and constructive feedback on the student's work.

Your feedback should be:
- Specific and reference exact elements in the submission
- Constructive and actionable
- Balanced, noting both strengths and areas for improvement
- Free of personal opinions or bias
- Focused on helping the student improve

Respond ONLY with valid, complete JSON matching the requested structure.
Do not include explanatory text, comments, or markdown outside the JSON object.`;

  try {
    // Create properly structured request with system prompt in config
    const requestParams = {
      model: 'gemini-2.5-flash-preview-04-17',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        topP: 0.8, 
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: systemPrompt ? { text: systemPrompt } : undefined
      }
    };

    console.log("Sending request to Gemini with system prompt...");
    
    // Make request
    const result = await genAI.models.generateContent(requestParams);
    
    // Extract and parse response
    const text = result.candidates[0].content.parts[0].text;
    console.log("Raw response:", text);
    
    // Try to parse JSON
    try {
      const parsedJson = JSON.parse(text);
      console.log("Successfully parsed JSON response:", JSON.stringify(parsedJson, null, 2));
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError.message);
      
      // Log truncated response for debugging
      console.log("Response preview (first 100 chars):", text.substring(0, 100));
      
      // Try to debug the JSON
      try {
        // Simple repair for common issues (e.g. missing closing braces)
        let repairedJson = text;
        
        // Count opening/closing braces
        const openBraces = (text.match(/{/g) || []).length;
        const closeBraces = (text.match(/}/g) || []).length;
        
        if (openBraces > closeBraces) {
          console.log(`Detected unbalanced braces: ${openBraces} open, ${closeBraces} close`);
          // Add missing closing braces
          for (let i = 0; i < openBraces - closeBraces; i++) {
            repairedJson += '}';
          }
          console.log("Attempting repair by adding closing braces");
          const repaired = JSON.parse(repairedJson);
          console.log("Repair successful:", JSON.stringify(repaired, null, 2));
        }
      } catch (repairError) {
        console.error("JSON repair failed:", repairError.message);
      }
    }
    
  } catch (error) {
    console.error("Error calling Gemini API:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

// Run the test
testTextSubmission().then(() => {
  console.log("Test completed");
}).catch(err => {
  console.error("Unhandled error:", err);
});