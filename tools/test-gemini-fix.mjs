/**
 * Test script for diagnosing text submission issues with the Gemini adapter
 * Using MJS extension to ensure ESM compatibility
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

// Check if API key is available
if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable - aborting test');
  process.exit(1);
}

// Initialize client
const genAI = new GoogleGenAI(API_KEY);
const modelName = 'gemini-2.5-flash-preview-04-17';

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

// Test text completion with system prompt
async function testTextCompletion() {
  try {
    console.log('Testing text completion with Gemini...');
    
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

    console.log('Sending request to Gemini API with system prompt...');
    
    // Create properly structured request
    const requestParams = {
      model: modelName,
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
    
    // Make API request
    const result = await genAI.models.generateContent(requestParams);
    
    // Extract text from response
    const text = result.candidates[0].content.parts[0].text;
    console.log('Raw response:', text);
    
    // Log token usage if available
    if (result.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount } = result.usageMetadata;
      console.log(`Token usage: ${promptTokenCount + candidatesTokenCount} (${promptTokenCount} prompt + ${candidatesTokenCount} completion)`);
    }
    
    // Try to parse the response as JSON
    try {
      const parsedJson = JSON.parse(text);
      console.log('Successfully parsed JSON response:', JSON.stringify(parsedJson, null, 2));
      
      // Check if we have the expected fields
      const { strengths, improvements, suggestions, summary, score } = parsedJson;
      console.log(`Response contains: ${strengths.length} strengths, ${improvements.length} improvements, score: ${score || 'none'}`);
      
      return parsedJson;
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError.message);
      
      // Try simple JSON repair
      console.log('Attempting JSON repair...');
      const repairedJson = repairJson(text);
      
      if (repairedJson) {
        console.log('JSON repair successful!');
        return repairedJson;
      } else {
        console.error('JSON repair failed.');
      }
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    if (error.stack) console.error(error.stack);
  }
  
  return null;
}

// JSON repair function
function repairJson(text) {
  try {
    // Basic approach - try to add missing closing braces/brackets
    let repairedJson = text;
    
    // Count opening/closing braces and brackets
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/]/g) || []).length;
    
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      console.log(`Detected unbalanced delimiters: ${openBraces}:{, ${closeBraces}:}, ${openBrackets}:[, ${closeBrackets}:]`);
      
      // Add missing closing delimiters
      let suffix = '';
      for (let i = 0; i < openBraces - closeBraces; i++) suffix += '}';
      for (let i = 0; i < openBrackets - closeBrackets; i++) suffix += ']';
      
      repairedJson = repairedJson + suffix;
      console.log(`Added ${openBraces - closeBraces} closing braces and ${openBrackets - closeBrackets} closing brackets`);
      
      // Try to parse the repaired JSON
      return JSON.parse(repairedJson);
    }
  } catch (error) {
    console.error('JSON repair attempt failed:', error.message);
  }
  
  return null;
}

// Run the test
console.log('Starting Gemini text completion test...');
testTextCompletion().then(result => {
  console.log('Test completed.');
  
  // Save results to a file for analysis
  if (result) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(`gemini-text-test-${timestamp}.json`, JSON.stringify(result, null, 2));
    console.log(`Test results saved to gemini-text-test-${timestamp}.json`);
  }
}).catch(err => {
  console.error('Unhandled error:', err);
});