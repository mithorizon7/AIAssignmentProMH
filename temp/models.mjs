// Test models property on GoogleGenAI
import { GoogleGenAI } from '@google/genai';

// Create an instance with a dummy API key
const genAI = new GoogleGenAI('dummy-key');

// Check what models provides
console.log('genAI.models properties:');
console.log('- typeof:', typeof genAI.models);
console.log('- instance of:', genAI.models.constructor.name);
console.log('- methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(genAI.models)));
console.log('- properties:', Object.keys(genAI.models));

// Try to use models to get a generative model
try {
  console.log('\nTrying to get a model via models property:');
  if (typeof genAI.models.getGenerativeModel === 'function') {
    console.log('- genAI.models.getGenerativeModel() exists');
    const model = genAI.models.getGenerativeModel({ model: 'gemini-pro' });
    console.log('  - Created model:', model !== null);
    console.log('  - Model type:', typeof model);
    console.log('  - Model methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(model)));
  } else {
    console.log('- genAI.models.getGenerativeModel() does not exist');
  }
} catch (e) {
  console.log('- Error with models.getGenerativeModel():', e.message);
}
