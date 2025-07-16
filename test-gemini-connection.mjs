/**
 * Simple test to verify Gemini API connectivity
 */
import { GoogleGenAI } from '@google/genai';

async function testGeminiConnection() {
  console.log('🔍 Testing Gemini API connection...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`API Key present: ${!!apiKey}`);
  console.log(`API Key prefix: ${apiKey ? apiKey.substring(0, 10) + '...' : 'None'}`);
  
  if (!apiKey) {
    console.log('❌ No API key found in environment');
    return;
  }
  
  try {
    const genAI = new GoogleGenAI(apiKey);
    
    const result = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hello, world!' }] }]
    });
    
    console.log('✅ Gemini API connection successful');
    console.log('Response:', result.response.text());
    
  } catch (error) {
    console.log('❌ Gemini API connection failed');
    console.log('Error:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.log('🔑 The API key appears to be invalid or expired');
      console.log('💡 Please verify your API key at https://aistudio.google.com/app/apikey');
    }
  }
}

testGeminiConnection().catch(console.error);