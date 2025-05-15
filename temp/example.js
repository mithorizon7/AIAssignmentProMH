// Simple example to test the @google/genai package
const genai = require('@google/genai');

// Print the exported modules
console.log('Exported modules from @google/genai:');
console.log(Object.keys(genai));

// Check if GoogleGenAI exists
if (genai.GoogleGenAI) {
  console.log('\nFound GoogleGenAI class');
  
  // Create an instance with a dummy API key
  const ai = new genai.GoogleGenAI('dummy-key');
  
  // List available methods
  console.log('\nMethods on GoogleGenAI instance:');
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(ai))
    .filter(name => name !== 'constructor'));
  
  // Check if we can create a model
  try {
    console.log('\nChecking model creation:');
    if (typeof ai.genModel === 'function') {
      console.log('- Found ai.genModel() method');
    }
    if (typeof ai.generativeModel === 'function') {
      console.log('- Found ai.generativeModel() method');
    }
    if (typeof ai.getGenerativeModel === 'function') {
      console.log('- Found ai.getGenerativeModel() method');
    }
  } catch (e) {
    console.error('Error checking model methods:', e);
  }
}
