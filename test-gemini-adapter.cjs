/**
 * Test script for Gemini adapter functionality with the gemini-2.5-flash-preview-04-17 model
 */
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Verify the GEMINI_API_KEY is present
if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is missing.');
  console.error('Please add it to your .env file or provide it when running the script.');
  process.exit(1);
}

// Sample text content to test the Gemini adapter
const testTextContent = `
This is a test submission for the Gemini AI model using "gemini-2.5-flash-preview-04-17".
Please analyze this text and provide feedback with:
- strengths
- improvements
- summary
- score (0-100)

The square root of 16 is 4. The capital of France is Paris.
`;

// Create a simple test script that can be run with Node.js
async function createTestScript() {
  const testFile = path.join(__dirname, 'temp_gemini_test.mjs');
  
  // ES modules syntax for the test
  const testCode = `
  import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

  async function testGeminiAdapter() {
    try {
      console.log('Testing Gemini adapter with the gemini-2.5-flash-preview-04-17 model...');
      
      // Initialize the Google Generative AI client
      const genAI = new GoogleGenerativeAI('${process.env.GEMINI_API_KEY}');
      
      // The model name to test
      const modelName = "gemini-2.5-flash-preview-04-17";
      console.log(\`Using model: \${modelName}\`);
      
      // Get the model
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Set up generation config
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
      
      // The test content
      const testContent = \`${testTextContent}\`;
      
      // Create the content for generation
      const content = [
        {
          role: "user",
          parts: [{ text: testContent }]
        }
      ];
      
      console.log('Sending request to Gemini API...');
      
      // Generate content
      const result = await model.generateContent({
        contents: content,
        generationConfig
      });
      
      // Print the structure for debugging
      console.log('\\nResponse structure:');
      console.log(JSON.stringify(Object.keys(result), null, 2));
      
      if (result.response) {
        console.log('\\nResponse.response structure:');
        console.log(JSON.stringify(Object.keys(result.response), null, 2));
        
        if (result.response.candidates && result.response.candidates.length > 0) {
          console.log('\\nFound', result.response.candidates.length, 'candidates');
          
          const firstCandidate = result.response.candidates[0];
          console.log('\\nCandidate structure:');
          console.log(JSON.stringify(Object.keys(firstCandidate), null, 2));
          
          if (firstCandidate.content) {
            console.log('\\nContent structure:');
            console.log(JSON.stringify(Object.keys(firstCandidate.content), null, 2));
            
            if (firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
              console.log('\\nFound', firstCandidate.content.parts.length, 'parts');
              
              const firstPart = firstCandidate.content.parts[0];
              if (firstPart.text) {
                console.log('\\nResponse text preview:');
                console.log(firstPart.text.substring(0, 200) + '...');
                
                try {
                  // Try to parse as JSON
                  const parsed = JSON.parse(firstPart.text);
                  console.log('\\nParsed JSON:');
                  console.log(JSON.stringify(parsed, null, 2));
                  
                  return { success: true, message: 'Test completed successfully' };
                } catch (error) {
                  console.error('\\nError parsing response as JSON:', error.message);
                  console.log('Raw text response:');
                  console.log(firstPart.text);
                }
              } else {
                console.error('\\nNo text found in part');
                console.log('Part structure:');
                console.log(JSON.stringify(firstPart, null, 2));
              }
            } else {
              console.error('\\nNo parts found in content');
            }
          } else {
            console.error('\\nNo content found in candidate');
          }
        } else {
          console.error('\\nNo candidates found in response');
        }
      } else {
        console.error('\\nNo response field in result');
        console.log('Raw result:');
        console.log(JSON.stringify(result, null, 2));
      }
      
      return { success: false, message: 'Test completed with issues' };
    } catch (error) {
      console.error('\\nError testing Gemini adapter:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      return { success: false, message: \`Test failed: \${error.message}\` };
    }
  }

  // Run the test
  testGeminiAdapter().then(result => {
    console.log('\\nTest result:', result);
    if (!result.success) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('Unhandled error during test:', err);
    process.exit(1);
  });
  `;

  fs.writeFileSync(testFile, testCode);
  return testFile;
}

// Run the test
async function runGeminiTest() {
  try {
    console.log('Creating test script...');
    const testFile = await createTestScript();
    
    console.log('Running Gemini adapter test...');
    execSync(`node --experimental-modules ${testFile}`, { stdio: 'inherit' });
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log('Test completed successfully');
    return true;
  } catch (error) {
    console.error('Error running test:', error.message);
    return false;
  }
}

// Execute the test
runGeminiTest().then(success => {
  if (success) {
    console.log('✅ Gemini adapter test passed!');
    process.exit(0);
  } else {
    console.error('❌ Gemini adapter test failed.');
    process.exit(1);
  }
});