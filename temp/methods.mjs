// Test specific methods on GoogleGenAI
import { GoogleGenAI } from '@google/genai';

// Create an instance with a dummy API key
const genAI = new GoogleGenAI('dummy-key');

// List properties using more methods
console.log('Properties on GoogleGenAI instance:');
console.log('- Object.keys(genAI):', Object.keys(genAI));
console.log('- Object.getOwnPropertyNames(genAI):', Object.getOwnPropertyNames(genAI));

// Try all potential model-creation methods
console.log('\nTrying model creation methods:');

// Method 1: directly on genAI
if (typeof genAI.generateContent === 'function') {
  console.log('- Can call genAI.generateContent() directly');
} else {
  console.log('- Cannot call genAI.generateContent() directly');
}

// Method 2: genModel
try {
  if (typeof genAI.genModel === 'function') {
    console.log('- genAI.genModel() exists');
    const model = genAI.genModel('gemini-pro');
    console.log('  - Created model with genModel(): ', model !== null);
  } else {
    console.log('- genAI.genModel() does not exist');
  }
} catch (e) {
  console.log('- Error with genModel():', e.message);
}

// Method 3: getModel
try {
  if (typeof genAI.getModel === 'function') {
    console.log('- genAI.getModel() exists');
    const model = genAI.getModel('gemini-pro');
    console.log('  - Created model with getModel(): ', model !== null);
  } else {
    console.log('- genAI.getModel() does not exist');
  }
} catch (e) {
  console.log('- Error with getModel():', e.message);
}

// Method 4: generativeModel
try {
  if (typeof genAI.generativeModel === 'function') {
    console.log('- genAI.generativeModel() exists');
    const model = genAI.generativeModel({ model: 'gemini-pro' });
    console.log('  - Created model with generativeModel(): ', model !== null);
  } else {
    console.log('- genAI.generativeModel() does not exist');
  }
} catch (e) {
  console.log('- Error with generativeModel():', e.message);
}

// Method 5: getGenerativeModel
try {
  if (typeof genAI.getGenerativeModel === 'function') {
    console.log('- genAI.getGenerativeModel() exists');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('  - Created model with getGenerativeModel(): ', model !== null);
  } else {
    console.log('- genAI.getGenerativeModel() does not exist');
  }
} catch (e) {
  console.log('- Error with getGenerativeModel():', e.message);
}
