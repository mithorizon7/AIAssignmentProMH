/**
 * Test script to verify the Gemini adapter improvements
 * 
 * This tests:
 * 1. Text-only submissions
 * 2. Two-step token budget approach
 * 3. Streaming API calls
 * 4. Proper finish reason handling
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants from gemini-adapter.ts
const BASE_MAX_TOKENS = 1200;
const RETRY_MAX_TOKENS = 1600;

// Define a simple test schema (subset of the actual grading schema)
const simpleSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A concise summary of the submission"
    },
    strengths: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Key strengths identified in the submission"
    },
    improvements: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Areas that could be improved in the submission"
    },
    score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Overall score from 0-100"
    }
  },
  required: ["summary", "strengths", "improvements", "score"]
};

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash-preview-04-17";
  console.log(`Using model: ${modelName}`);

  // Test 1: Basic text completion with streaming
  await testTextCompletion(genAI, modelName);

  // Test 2: Text completion that might need retry (large output)
  await testTokenRetry(genAI, modelName);

  console.log("\nAll tests completed!");
}

async function testTextCompletion(genAI, modelName) {
  console.log("\n🧪 Test: Basic text completion with streaming");
  
  const prompt = "Please provide feedback on this student essay:\n\n" +
    "Title: The Impact of Technology on Society\n\n" +
    "Technology has transformed how we live, work, and interact. " +
    "From smartphones to AI, our world has changed dramatically. " +
    "While there are benefits like increased efficiency and connectivity, " +
    "there are also concerns about privacy and the digital divide. " +
    "Overall, technology's impact requires careful consideration of both advantages and drawbacks.";

  console.log(`Prompt length: ${prompt.length} characters`);
  
  try {
    // Simulate our runImageRubric helper's behavior
    const requestParams = {
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: BASE_MAX_TOKENS,
        responseMimeType: "application/json",
        responseSchema: simpleSchema
      }
    };

    console.log("Sending streaming request to Gemini API");
    const stream = await genAI.models.generateContentStream(requestParams);
    
    let streamedText = '';
    let finishReason = 'STOP'; // Default
    
    for await (const chunk of stream) {
      if (chunk.candidates && chunk.candidates.length > 0) {
        if (chunk.candidates[0].finishReason) {
          finishReason = chunk.candidates[0].finishReason;
        }
        
        if (chunk.candidates[0]?.content?.parts) {
          const part = chunk.candidates[0].content.parts[0];
          if (part.text) {
            streamedText += part.text;
            // Show progressive output
            process.stdout.write('.');
          }
        }
      }
    }
    
    console.log(`\nReceived ${streamedText.length} characters`);
    console.log(`Finish reason: ${finishReason}`);
    
    // Verify it's valid JSON
    try {
      const parsed = JSON.parse(streamedText);
      console.log("✅ Successfully parsed response:");
      console.log(`Summary: ${parsed.summary.substring(0, 100)}...`);
      console.log(`Score: ${parsed.score}`);
      console.log(`Strengths: ${parsed.strengths.length} items`);
      console.log(`Improvements: ${parsed.improvements.length} items`);
    } catch (err) {
      console.error("❌ Failed to parse response as JSON:", err.message);
      console.log("Raw text:", streamedText.substring(0, 200) + "...");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

async function testTokenRetry(genAI, modelName) {
  console.log("\n🧪 Test: Token retry mechanism");
  
  // Create a longer prompt that might trigger a retry
  let longPrompt = "Provide detailed feedback on this complex assignment:\n\n";
  
  // Add enough text to potentially exceed the base token limit
  longPrompt += "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50);
  longPrompt += "\n\nPles analyze in extreme detail with many strengths and improvement suggestions.";
  
  console.log(`Long prompt length: ${longPrompt.length} characters`);
  
  try {
    // First try with BASE_MAX_TOKENS
    console.log(`First attempt with ${BASE_MAX_TOKENS} max tokens`);
    let result = await testWithTokenLimit(genAI, modelName, longPrompt, BASE_MAX_TOKENS);
    
    // If it didn't complete, retry with increased token limit
    if (result.finishReason !== 'STOP') {
      console.log(`Early stop (${result.finishReason}) - retrying with ${RETRY_MAX_TOKENS} tokens`);
      result = await testWithTokenLimit(genAI, modelName, longPrompt, RETRY_MAX_TOKENS);
    }
    
    console.log(`Final finish reason: ${result.finishReason}`);
    
    if (result.finishReason === 'STOP') {
      console.log("✅ Successfully generated complete response");
    } else {
      console.log("❌ Failed to generate complete response even with increased tokens");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

async function testWithTokenLimit(genAI, modelName, prompt, tokenLimit) {
  console.log(`Testing with max output tokens: ${tokenLimit}`);
  
  const requestParams = {
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: tokenLimit,
      responseMimeType: "application/json",
      responseSchema: simpleSchema
    }
  };
  
  const stream = await genAI.models.generateContentStream(requestParams);
  let streamedText = '';
  let finishReason = 'STOP';
  
  for await (const chunk of stream) {
    if (chunk.candidates && chunk.candidates.length > 0) {
      if (chunk.candidates[0].finishReason) {
        finishReason = chunk.candidates[0].finishReason;
      }
      
      if (chunk.candidates[0]?.content?.parts) {
        const part = chunk.candidates[0].content.parts[0];
        if (part.text) {
          streamedText += part.text;
          process.stdout.write('.');
        }
      }
    }
  }
  
  console.log(`\nReceived ${streamedText.length} characters with ${tokenLimit} max tokens`);
  return { streamedText, finishReason };
}

// Run the tests
main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});