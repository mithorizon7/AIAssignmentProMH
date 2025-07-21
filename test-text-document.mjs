/**
 * Test script to verify text document handling in Gemini adapter
 * 
 * This tests:
 * 1. Text document processing
 * 2. Proper conversion of text documents to API formats
 * 3. Proper MIME type handling for text
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

// Helper function to ensure mime type is a string
function ensureMimeTypeString(mimeType) {
  return typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash-preview-04-17";
  console.log(`Using model: ${modelName}`);

  // Test with a text document
  await testTextDocument(genAI, modelName);
}

async function testTextDocument(genAI, modelName) {
  console.log("\n🧪 Test: Text document processing");
  
  try {
    // Create a test text document
    const textDocument = `# Sample Essay: Climate Change Impact

Climate change represents one of the most significant global challenges of the 21st century. Rising temperatures, extreme weather events, and sea level rises threaten ecosystems, economies, and human well-being worldwide.

## Key Impacts

1. **Environmental Effects**: Melting ice caps, ocean acidification, and habitat loss for numerous species.
2. **Economic Consequences**: Increased costs from natural disasters, agricultural disruption, and infrastructure damage.
3. **Human Health**: Heat-related illnesses, expanded range of disease vectors, and air quality degradation.

## Mitigation Strategies

International cooperation through agreements like the Paris Accord represents a critical step toward addressing these challenges. Additionally, transitioning to renewable energy sources, improving energy efficiency, and implementing carbon pricing mechanisms offer promising pathways for reducing emissions.

## Conclusion

The scientific consensus is clear: immediate and substantial action is required to mitigate the worst effects of climate change. While the challenges are significant, technological innovation and policy changes provide hope for a sustainable future.`;

    console.log(`Text document length: ${textDocument.length} characters`);
    
    const mimeType = 'text/plain';
    
    // Create a prompt with text document
    const textPrompt = "Analyze this document and provide feedback on its quality, structure, and content.";
    
    // Create a multimodal request with text document
    const requestParams = {
      model: modelName,
      contents: [
        {
          role: 'user', 
          parts: [
            { text: textPrompt },
            { text: textDocument }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        responseSchema: simpleSchema
      }
    };

    console.log("Sending request to Gemini API with text document...");
    const response = await genAI.models.generateContent(requestParams);
    
    if (response && response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log(`Response finish reason: ${candidate.finishReason}`);
      
      const content = candidate.content;
      if (content && content.parts && content.parts.length > 0) {
        const text = content.parts[0].text;
        console.log(`Received ${text.length} characters`);
        
        // Verify it's valid JSON
        try {
          const parsed = JSON.parse(text);
          console.log("✅ Successfully parsed response as JSON:");
          console.log(`Summary: ${parsed.summary.substring(0, 100)}...`);
          console.log(`Score: ${parsed.score}`);
          console.log(`Strengths: ${parsed.strengths.length} items`);
          console.log(`Improvements: ${parsed.improvements.length} items`);
        } catch (err) {
          console.error("❌ Failed to parse response as JSON:", err.message);
          console.log("Raw text:", text.substring(0, 200) + "...");
        }
      } else {
        console.error("❌ No content parts in response");
      }
    } else {
      console.error("❌ No valid response candidates");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the tests
main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});