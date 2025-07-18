const genai = require('@google/genai');

// Create a dummy instance of GoogleGenAI
const genAI = new genai.GoogleGenAI('dummy-api-key');

console.log('genAI type:', typeof genAI);
console.log('genAI constructor name:', genAI.constructor.name);

console.log('\nMethods on genAI:');
for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(genAI))) {
  if (method !== 'constructor') {
    console.log();
  }
}

// Try to see if there's a model method
if (typeof genAI.generateContent === 'function') {
  console.log('\nFound generateContent method directly on genAI');
} else {
  console.log('\nNo generateContent method directly on genAI');
}

if (typeof genAI.getGenerativeModel === 'function') {
  console.log('Found getGenerativeModel method');
} else {
  console.log('No getGenerativeModel method');
}

// Check what's available as direct properties
console.log('\nDirect properties:');
for (const prop of Object.keys(genAI)) {
  console.log();
}

// Try to instantiate a model
try {
  console.log('\nTrying to create a model:');
  
  // Based on documentation, try the model creation
  const model = genAI.getGenerativeModel ?
                genAI.getGenerativeModel({ model: 'gemini-pro' }) :
                null;
                
  if (model) {
    console.log('Model created successfully!');
    console.log('Model methods:');
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(model))) {
      if (method !== 'constructor') {
        console.log();
      }
    }
  } else {
    console.log('Could not create model');
  }
} catch (err) {
  console.error('Error creating model:', err.message);
}
