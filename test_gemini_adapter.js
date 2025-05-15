// Test script for Gemini adapter functionality
const { execSync } = require('child_process');
require('dotenv').config();

// Verify that the GEMINI_API_KEY is present
if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is missing.');
  console.error('Please add it to your .env file');
  process.exit(1);
}

// Simple test content
const testContent = `
This is a simple test of the Gemini AI model "gemini-2.5-flash-preview-04-17".
Please analyze this text and return a JSON object with the following fields:
- strengths (array of strings)
- improvements (array of strings)
- summary (string)
- score (number between 0 and 100)
`;

async function testGeminiAdapter() {
  console.log('Testing Gemini adapter functionality...');
  console.log(`Using API key: ${process.env.GEMINI_API_KEY.substring(0, 3)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 3)}`);
  
  try {
    // Execute the test using the GeminiAdapter directly from Node.js
    console.log('Creating temporary test file...');
    
    // Import the necessary modules using ES modules syntax via Node.js --eval
    const testCode = `
    import { GoogleGenAI } from '@google/genai';
    
    async function testGeminiModel() {
      try {
        console.log('Initializing Google GenAI client...');
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // The specific model to test
        const modelName = "gemini-2.5-flash-preview-04-17";
        console.log(\`Using model: \${modelName}\`);
        
        // Prepare the request with responseSchema for JSON output
        const prompt = \`${testContent}\`;
        
        const generationConfig = {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: {
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
              summary: { type: "string" },
              score: { type: "number" }
            },
            required: ["strengths", "improvements", "summary", "score"]
          }
        };
        
        const params = {
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        };
        
        console.log('Sending request to Gemini API...');
        const result = await genAI.models.generateContent(params);
        
        // Log the raw response structure
        console.log('Response object structure:');
        console.log(JSON.stringify(Object.keys(result), null, 2));
        
        // Check for candidates
        if (result.candidates && result.candidates.length > 0) {
          console.log('Found candidates in response');
          
          const firstCandidate = result.candidates[0];
          console.log('First candidate structure:');
          console.log(JSON.stringify(Object.keys(firstCandidate), null, 2));
          
          if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            const text = firstCandidate.content.parts[0].text;
            console.log('Response text preview:');
            console.log(text.substring(0, 200) + '...');
            
            try {
              // Try to parse the response as JSON
              const parsedContent = JSON.parse(text);
              console.log('Successfully parsed as JSON:');
              console.log(JSON.stringify(parsedContent, null, 2));
              
              return {
                success: true,
                message: 'Successfully tested Gemini adapter'
              };
            } catch (parseError) {
              console.error('Failed to parse response as JSON:', parseError.message);
              console.log('Raw text response:');
              console.log(text);
            }
          } else {
            console.error('No text content found in candidate');
          }
        } else {
          console.error('No candidates found in response');
          console.log('Raw response:');
          console.log(JSON.stringify(result, null, 2));
        }
        
        return {
          success: false,
          message: 'Test completed with warnings'
        };
      } catch (error) {
        console.error('Error testing Gemini adapter:', error.message);
        if (error.stack) {
          console.error(error.stack);
        }
        return {
          success: false,
          message: \`Test failed: \${error.message}\`
        };
      }
    }
    
    // Execute the test
    testGeminiModel().then(result => {
      console.log('Test result:', result);
      if (!result.success) {
        process.exit(1);
      }
    }).catch(err => {
      console.error('Unhandled error during test:', err);
      process.exit(1);
    });
    `;
    
    // Write the test code to a temporary file
    require('fs').writeFileSync('./temp_gemini_test.mjs', testCode);
    
    // Execute the test
    console.log('Running test...');
    const output = execSync('node --experimental-modules ./temp_gemini_test.mjs', { stdio: 'inherit' });
    
    // Clean up
    require('fs').unlinkSync('./temp_gemini_test.mjs');
    
    console.log('Test completed successfully');
    return true;
  } catch (error) {
    console.error('Error running test:', error.message);
    return false;
  }
}

// Run the test
testGeminiAdapter().then(success => {
  if (success) {
    console.log('All tests passed!');
    process.exit(0);
  } else {
    console.error('Tests failed.');
    process.exit(1);
  }
});