import { GoogleGenerativeAI } from '@google/genai';

// Create a simple dummy instance
const genAI = new GoogleGenerativeAI('dummy-api-key');

// Check what methods and properties are available
console.log('GoogleGenerativeAI instance methods:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(genAI)));

// Try to introspect the object
console.log('\nInstance properties:');
console.log(Object.keys(genAI));

// Check how to get a model
console.log('\nHow to get a model:');
try {
  const methods = Object.getOwnPropertyNames(genAI).filter(name => typeof genAI[name] === 'function');
  console.log('Available methods:', methods);
  
  // Test the genModel method if it exists
  if (typeof genAI.genModel === 'function' || typeof genAI.getModel === 'function' || typeof genAI.getGenerativeModel === 'function') {
    console.log('Found model method!');
  }
} catch (err) {
  console.error('Error inspecting methods:', err);
}
