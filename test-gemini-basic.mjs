/**
 * Basic test script for Gemini API 
 * Using ESM syntax
 */
import * as dotenv from 'dotenv';
import pkg from '@google/genai';

// Load environment variables
dotenv.config();

// Verify the GEMINI_API_KEY is present
if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is missing.');
  process.exit(1);
}

const { GoogleGenAI } = pkg;

async function testGeminiAPI() {
  try {
    console.log('Testing available Gemini API methods...');
    
    // Initialize the client with API key
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Print available methods and properties
    console.log('Available methods and properties on genAI:');
    console.log(Object.getOwnPropertyNames(genAI));
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(genAI)));
    
    // Try to list available models
    console.log('\nTrying to list available models...');
    
    // Check if there's a method to list models
    if (typeof genAI.listModels === 'function') {
      console.log('Found listModels method, attempting to call it...');
      const models = await genAI.listModels();
      console.log('Available models:', models);
    } else {
      console.log('listModels method not found');
    }
    
    // Try direct model creation if possible
    console.log('\nTrying direct model creation...');
    
    // Check what methods are available
    for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(genAI))) {
      if (typeof genAI[methodName] === 'function' && !methodName.startsWith('_')) {
        console.log(`Found method: ${methodName}`);
      }
    }
    
    // Try generative model by guessing the method name
    try {
      if (typeof genAI.getGenerativeModel === 'function') {
        console.log('Found getGenerativeModel method');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
        console.log('Model created successfully');
        
        // Print model properties
        console.log('Model properties:');
        console.log(Object.getOwnPropertyNames(model));
        console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(model)));
      } else {
        console.log('getGenerativeModel method not found');
      }
    } catch (modelError) {
      console.error('Error creating model:', modelError.message);
    }
    
    // Try other potential methods
    if (typeof genAI.gemini === 'object') {
      console.log('\nFound "gemini" property, trying to access it...');
      console.log('gemini properties:', Object.getOwnPropertyNames(genAI.gemini));
    }
    
    if (typeof genAI.models === 'object') {
      console.log('\nFound "models" property, trying to access it...');
      console.log('models properties:', Object.getOwnPropertyNames(genAI.models));
      
      if (typeof genAI.models.generateContent === 'function') {
        console.log('Found models.generateContent method, this might be the right approach');
      }
    }
    
    // Try a minimal test with the gemini-pro model (text-only)
    console.log('\nAttempting a minimal test with gemini-pro model...');
    
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-pro",
        contents: [{ role: 'user', parts: [{ text: 'Write a short poem about coding' }] }]
      });
      
      console.log('Response received:');
      console.log(JSON.stringify(response, null, 2));
      
      console.log('\nAccessing text content from response...');
      if (response.response && response.response.candidates && response.response.candidates[0]?.content?.parts) {
        const firstPart = response.response.candidates[0].content.parts[0];
        console.log(firstPart.text);
      } else {
        console.log('Unable to find text in response structure');
      }
      
      return true;
    } catch (error) {
      console.error('Error in minimal test:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      return false;
    }
  } catch (error) {
    console.error('General error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

// Run the test
testGeminiAPI().then(success => {
  if (success) {
    console.log('\n✅ Test passed');
    process.exit(0);
  } else {
    console.error('\n❌ Test failed');
    process.exit(1);
  }
});