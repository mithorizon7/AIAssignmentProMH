import { GoogleGenAI } from '@google/genai';

// Function to inspect the GenerateContentResponse structure
async function inspectGeminiResponse() {
  try {
    // Create a dummy API client
    const genAI = new GoogleGenAI('dummy-key');
    
    // Print all fields on the GenerateContentResponse type
    console.log("Examining GoogleGenAI response structure...");
    
    // Create a mock result object based on inspecting the API
    const mockResult = {
      candidates: [
        {
          content: {
            parts: [
              { text: "This is mock text content" }
            ],
            role: "model"
          },
          finishReason: "STOP",
          safetyRatings: [],
          // If parsed is available, it would be here
        }
      ],
      promptFeedback: {},
      // Other fields that might be present
    };
    
    console.log("\nMock Gemini response structure:");
    console.log(JSON.stringify(mockResult, null, 2));
    
    console.log("\nAccessing text would likely be:");
    console.log("result.candidates[0].content.parts[0].text");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

inspectGeminiResponse();
