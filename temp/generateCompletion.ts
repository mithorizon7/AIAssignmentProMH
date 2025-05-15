  /**
   * Standard text completion
   */
  async generateCompletion(prompt: string, systemPrompt?: string) {
    try {
      console.log(`[GEMINI] Generating completion with prompt length: ${prompt.length} chars`);
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
      // Prepare the request with proper placement of systemInstruction as a top-level field
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // systemInstruction is now a top-level field, not inside config
        systemInstruction: systemPrompt, 
        config: {
          temperature,
          topP, 
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema
        }
      };
      
      // Log if system prompt was added
      if (systemPrompt) {
        console.log(`[GEMINI] Added system prompt as top-level systemInstruction (${systemPrompt.length} chars)`);
      }
      
      console.log(`[GEMINI] Sending request to Gemini API with responseMimeType: application/json`);
      
      // Function to handle a single API request with retry capability
      const gradeWithRetry = async (): Promise<GenerateContentResponse> => {
        try {
          return await this.genAI.models.generateContent(requestParams);
        } catch (e: any) {
          // If the error is one that might be resolved with a retry, try once more
          if (shouldRetry(e)) {
            console.log(`[GEMINI] API call failed with error that warrants retry: ${e.message}`);
            console.log(`[GEMINI] Retrying API call once...`);
            return await this.genAI.models.generateContent(requestParams);
          }
          throw e;
        }
      };
      
      // Make the API call with a single retry if needed
      const result = await gradeWithRetry();
      
      // Log usage information for monitoring
      if (result.usageMetadata) {
        console.log(`[GEMINI] Response usage metadata:`, result.usageMetadata);
      }
      
      // Extract text from the response
      let text = '';
      
      if (result.candidates && 
          result.candidates.length > 0 && 
          result.candidates[0]?.content?.parts) {
        const firstPart = result.candidates[0].content.parts[0];
        if (firstPart.text) {
          text = firstPart.text;
        } else {
          console.warn('[GEMINI] Response text not found in expected location');
          text = JSON.stringify(result);
        }
      } else {
        console.warn('[GEMINI] Could not extract text response from standard structure');
        text = JSON.stringify(result);
      }
      
      console.log(`[GEMINI] Response received, length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse and validate the response with our strict parser 
      console.log(`[GEMINI] Parsing and validating JSON with schema`);
      
      let parsedContent: GradingFeedback;
      
      try {
        // Use the strict parser that validates against schema
        parsedContent = parseStrict(text);
        console.log(`[GEMINI] Successfully parsed and validated JSON response`);
      } catch (error) {
        console.error(`[GEMINI] JSON parsing or validation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Failed to parse or validate AI response: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Track performance
      const processingEnd = Date.now();
      
      // Return the parsed and validated content
      return {
        ...parsedContent,
        modelName: this.modelName,
        rawResponse: text,
        processTime: (processingEnd - this.processingStart)
      };
    } catch (error) {
      console.error(`[GEMINI] Error in generateCompletion: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }