import { GoogleGenAI } from '@google/genai';

// Example of proper usage
const genAI = new GoogleGenAI("DUMMY_API_KEY");

// How to get a model
const model = genAI.genModel("gemini-pro"); // Try this method

// Or, maybe a different method
// const model = genAI.generativeModel({...}); 

// Or perhaps
// const model = genAI.getGenerativeModel({...});

console.log("Available on genAI:", Object.getOwnPropertyNames(Object.getPrototypeOf(genAI)));
