// Test direct generateContent
import { GoogleGenAI } from '@google/genai';

// Create an instance with a dummy API key
const genAI = new GoogleGenAI('dummy-key');

// Try to use models to generate content directly
try {
  console.log('Checking genAI.models.generateContent:');
  
  if (typeof genAI.models.generateContent === 'function') {
    console.log('- genAI.models.generateContent() exists');
    
    // Let's look at what this function expects
    console.log('- Function parameters expected:');
    const funcStr = genAI.models.generateContent.toString();
    console.log(funcStr.slice(0, funcStr.indexOf('{')));
    
    // Simulate what this function might need
    const params = {
      model: 'gemini-pro',
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 64,
        responseMimeType: "application/json"
      }
    };
    
    console.log('- Parameters we would pass:', JSON.stringify(params, null, 2));
  } else {
    console.log('- genAI.models.generateContent() does not exist');
  }
} catch (e) {
  console.log('- Error checking generateContent:', e.message);
}
