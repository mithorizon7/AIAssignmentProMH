/**
 * Gemini AI adapter for the AI Grader platform
 * Using @google/genai SDK with the latest API patterns for version 0.14.0+
 */
// Import the correct types from @google/genai
import { 
  GoogleGenAI, 
  GenerateContentResponse,
  Part 
} from '@google/genai';

// The newest Gemini model is "gemini-2.5-flash-preview-04-17" which was released April 17, 2025
import { ContentType } from '../utils/file-type-settings';
import { AIAdapter, MultimodalPromptPart } from './ai-adapter';
import { CriteriaScore } from '@shared/schema';

// These are the MIME types supported by Google Gemini API
// Based on https://ai.google.dev/gemini-api/docs/
export const SUPPORTED_MIME_TYPES = {
  // Images
  image: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 
    'image/heic', 'image/heif', 'image/svg+xml', 'image/gif',
    'image/bmp', 'image/tiff'
  ],
  
  // Video 
  video: [
    'video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime',
    'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv'
  ],
  
  // Audio
  audio: [
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm',
    'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/mp3'
  ],
  
  // Documents
  document: [
    // Standard document formats
    'application/pdf', 
    // Text formats
    'text/csv', 'text/plain', 'application/json', 'text/markdown', 'text/html',
    // Office formats
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-powerpoint', // .ppt
    // Open document formats
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'application/vnd.oasis.opendocument.presentation', // .odp
  ]
};

// This implements the standard AIAdapter interface for Gemini

/**
 * Google Gemini AI adapter for generating feedback
 * Using the latest API methods from the @google/genai SDK
 */
export class GeminiAdapter implements AIAdapter {
  private genAI: GoogleGenAI;
  private modelName: string;
  
  /**
   * Create a new GeminiAdapter instance
   */
  constructor() {
    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    
    // Initialize the Google Generative AI client
    this.genAI = new GoogleGenAI({ apiKey });
    
    // Make model name configurable with environment variable or use default
    this.modelName = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash-preview-04-17";
    
    console.log(`[GEMINI] Initializing with model: ${this.modelName}`);
  }

  // Define response schema structure once for reuse
  private responseSchema = {
    type: "object",
    properties: {
      strengths: {
        type: "array",
        items: { type: "string" }
      },
      improvements: {
        type: "array",
        items: { type: "string" }
      },
      suggestions: {
        type: "array",
        items: { type: "string" }
      },
      summary: { type: "string" },
      score: { type: "number" },
      criteriaScores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criteriaId: { type: "number" },
            score: { type: "number" },
            feedback: { type: "string" }
          }
        }
      }
    },
    required: ["strengths", "improvements", "suggestions", "summary", "score"]
  };
  
  /**
   * Attempt to extract structured feedback from unstructured text
   * This is a fallback method when JSON parsing fails
   */
  private extractStructuredFeedback(text: string): any {
    console.log(`[GEMINI] Attempting to extract structured feedback from text (${text.length} chars)`);
    
    // Default structure
    const result: any = {
      strengths: [],
      improvements: [],
      suggestions: [],
      summary: "",
      score: 0,
      criteriaScores: []
    };
    
    // Enhanced initial approach - try to find valid JSON first
    // Look for complete JSON objects enclosed in braces
    const jsonObjectRegex = /(\{[\s\S]*?\})/g;
    const potentialJsons = text.match(jsonObjectRegex);
    
    if (potentialJsons && potentialJsons.length > 0) {
      console.log(`[GEMINI] Found ${potentialJsons.length} potential JSON objects in the text`);
      
      // Try each potential JSON object from largest to smallest (more likely to be complete)
      const sortedJsons = [...potentialJsons].sort((a, b) => b.length - a.length);
      
      for (const jsonCandidate of sortedJsons) {
        try {
          const parsed = JSON.parse(jsonCandidate);
          // If we have strengths or improvements, we likely have a valid response
          if (parsed.strengths || parsed.improvements || parsed.summary) {
            console.log(`[GEMINI] Successfully parsed embedded JSON object (${jsonCandidate.length} chars)`);
            return parsed;
          }
        } catch (e) {
          // Continue to the next candidate
        }
      }
    }
    
    try {
      // First try to find JSON objects using regex
      const jsonObjectRegex = /\{[\s\S]*?\}/g;
      const potentialJsons = text.match(jsonObjectRegex);
      
      if (potentialJsons && potentialJsons.length > 0) {
        for (const jsonString of potentialJsons) {
          try {
            // Try to parse each potential JSON string
            const parsed = JSON.parse(jsonString);
            
            // If we find one with the right structure, use it
            if (parsed.strengths || parsed.score || parsed.summary) {
              console.log(`[GEMINI] Found valid JSON structure in text`);
              return parsed;
            }
          } catch (error) {
            // Continue with the next potential JSON
            continue;
          }
        }
      }
      
      // Check if the text seems to discuss an image
      const isImageAnalysis = text.toLowerCase().includes('image shows') || 
                             text.toLowerCase().includes('the image') ||
                             text.toLowerCase().includes('in the image') ||
                             text.toLowerCase().includes('this image depicts');
                             
      // For image analysis, we need to extract content differently
      if (isImageAnalysis) {
        console.log('[GEMINI] Detected image analysis content, using specialized extraction');
        
        // Create a summary from the first few sentences or paragraphs
        const paragraphs = text.split(/\n{2,}/);
        let imageSummary = paragraphs[0] || '';
        
        // If it's a short paragraph, include the next one too
        if (imageSummary.length < 100 && paragraphs.length > 1) {
          imageSummary += ' ' + paragraphs[1];
        }
        
        // For images, create a default set of strengths/improvements based on content
        result.summary = imageSummary.trim();
        
        // Try to identify positive aspects
        const positiveRegex = /(?:strength|positive|excellent|good|effective|successful|well|beautiful|impressive|creative|innovative|strong)/i;
        const positiveMatches = text.match(new RegExp(`[^.!?]*(?:${positiveRegex.source})[^.!?]*[.!?]`, 'gi')) || [];
        
        // Try to identify improvement aspects
        const negativeRegex = /(?:improvement|could be better|lacking|needs|should|would benefit|consider|try|might|missing|weak|unclear|confusing)/i;
        const negativeMatches = text.match(new RegExp(`[^.!?]*(?:${negativeRegex.source})[^.!?]*[.!?]`, 'gi')) || [];
        
        // Filter and clean up matches
        result.strengths = positiveMatches
          .map(s => s.trim())
          .filter(s => s.length > 10 && s.length < 200)
          .slice(0, 3);
          
        result.improvements = negativeMatches
          .map(s => s.trim())
          .filter(s => s.length > 10 && s.length < 200)
          .slice(0, 3);
        
        // Generate a simple suggestion based on improvements
        if (result.improvements.length > 0) {
          result.suggestions = [
            `Consider addressing: ${result.improvements[0].replace(/^you should|consider|try|i suggest/i, '').trim()}`
          ];
        }
        
        // Infer a score based on the overall tone
        const positiveCount = (text.match(positiveRegex) || []).length;
        const negativeCount = (text.match(negativeRegex) || []).length;
        
        if (positiveCount + negativeCount > 0) {
          // Calculate a score between 60-95 based on the ratio of positive to total matches
          const positiveRatio = positiveCount / (positiveCount + negativeCount);
          result.score = Math.round(60 + (positiveRatio * 35));
        } else {
          // Default score if no clear indicators
          result.score = 75;
        }
        
        console.log(`[GEMINI] Extracted image analysis with ${result.strengths.length} strengths and ${result.improvements.length} improvements`);
        
        return result;
      }
      
      // If JSON objects aren't found or valid, try to extract sections
      
      // Extract strengths section - More flexible pattern matching
      const strengthsMatch = text.match(/(?:Strengths|STRENGTHS|Strengths:|Positive aspects|Strong points)[\s\S]*?(?=Improvements|IMPROVEMENTS|Suggestions|SUGGESTIONS|Summary|SUMMARY|$)/i);
      if (strengthsMatch) {
        const strengthsText = strengthsMatch[0];
        // Enhanced pattern to match more types of lists (numbered, bulleted, etc.)
        const items = strengthsText.match(/(?:^|\n)(?:[*•-]|\d+\.)\s*(.*?)(?=\n(?:[*•-]|\d+\.)|$)/g);
        
        if (items && items.length > 0) {
          result.strengths = items.map(item => item.replace(/^[*•\d\s.-]+/, '').trim()).filter(i => i.length > 0);
        } else {
          // If no list markers found, try to split by lines or sentences
          const cleanText = strengthsText.replace(/(?:Strengths|STRENGTHS|Strengths:|Positive aspects|Strong points)[:\s]*/i, '').trim();
          const lines = cleanText.split(/\n+/).filter(line => line.trim().length > 0);
          
          if (lines.length > 1) {
            result.strengths = lines.map(line => line.trim());
          } else if (cleanText.includes('.')) {
            // Split by sentences
            result.strengths = cleanText.split(/\.(?:\s+|\s*$)/).map(s => s.trim() + '.').filter(s => s.length > 3);
          }
        }
      }
      
      // Extract improvements section - More flexible pattern matching
      const improvementsMatch = text.match(/(?:Improvements|IMPROVEMENTS|Improvements:|Areas for improvement|To improve)[\s\S]*?(?=Suggestions|SUGGESTIONS|Summary|SUMMARY|$)/i);
      if (improvementsMatch) {
        const improvementsText = improvementsMatch[0];
        // Enhanced pattern to match more types of lists
        const items = improvementsText.match(/(?:^|\n)(?:[*•-]|\d+\.)\s*(.*?)(?=\n(?:[*•-]|\d+\.)|$)/g);
        
        if (items && items.length > 0) {
          result.improvements = items.map(item => item.replace(/^[*•\d\s.-]+/, '').trim()).filter(i => i.length > 0);
        } else {
          // If no list markers found, try to split by lines or sentences
          const cleanText = improvementsText.replace(/(?:Improvements|IMPROVEMENTS|Improvements:|Areas for improvement|To improve)[:\s]*/i, '').trim();
          const lines = cleanText.split(/\n+/).filter(line => line.trim().length > 0);
          
          if (lines.length > 1) {
            result.improvements = lines.map(line => line.trim());
          } else if (cleanText.includes('.')) {
            // Split by sentences
            result.improvements = cleanText.split(/\.(?:\s+|\s*$)/).map(s => s.trim() + '.').filter(s => s.length > 3);
          }
        }
      }
      
      // Extract suggestions section - More flexible pattern matching
      const suggestionsMatch = text.match(/(?:Suggestions|SUGGESTIONS|Suggestions:|Recommendations|Next steps)[\s\S]*?(?=Summary|SUMMARY|Conclusion|$)/i);
      if (suggestionsMatch) {
        const suggestionsText = suggestionsMatch[0];
        // Enhanced pattern to match more types of lists
        const items = suggestionsText.match(/(?:^|\n)(?:[*•-]|\d+\.)\s*(.*?)(?=\n(?:[*•-]|\d+\.)|$)/g);
        
        if (items && items.length > 0) {
          result.suggestions = items.map(item => item.replace(/^[*•\d\s.-]+/, '').trim()).filter(i => i.length > 0);
        } else {
          // If no list markers found, try to split by lines or sentences
          const cleanText = suggestionsText.replace(/(?:Suggestions|SUGGESTIONS|Suggestions:|Recommendations|Next steps)[:\s]*/i, '').trim();
          const lines = cleanText.split(/\n+/).filter(line => line.trim().length > 0);
          
          if (lines.length > 1) {
            result.suggestions = lines.map(line => line.trim());
          } else if (cleanText.includes('.')) {
            // Split by sentences
            result.suggestions = cleanText.split(/\.(?:\s+|\s*$)/).map(s => s.trim() + '.').filter(s => s.length > 3);
          }
        }
      }
      
      // Extract summary - Enhanced pattern matching
      const summaryMatch = text.match(/(?:Summary|SUMMARY|Summary:|Overall|Conclusion|Assessment)[:.]?\s*([\s\S]*?)(?=\n\n|$)/i);
      if (summaryMatch && summaryMatch[1]) {
        result.summary = summaryMatch[1].trim();
      } else {
        // If no summary section found, use the first paragraph as summary
        const firstParagraph = text.split('\n\n')[0];
        if (firstParagraph && firstParagraph.length > 10) {
          result.summary = firstParagraph.trim();
        }
      }
      
      // Extract score - more flexible pattern matching
      // Try different score formats: "Score: 85", "85/100", "Grade: B (85%)", "85 out of 100"
      let scoreValue = null;
      
      // Format: "Score: 85" or "Rating: 8.5"
      const scoreMatch = text.match(/(?:Score|SCORE|Score:|Rating|Grade|Points|Mark)s?:?\s*([0-9.]+)/i);
      if (scoreMatch && scoreMatch[1]) {
        scoreValue = parseFloat(scoreMatch[1]);
      }
      
      // Format: "85/100" or "8.5/10"
      if (!scoreValue) {
        const fractionMatch = text.match(/\b([0-9.]+)\s*\/\s*(10|100)\b/i);
        if (fractionMatch) {
          const numerator = parseFloat(fractionMatch[1]);
          const denominator = parseFloat(fractionMatch[2]);
          
          // Convert to a score out of 100
          if (denominator === 10) {
            scoreValue = numerator * 10; // Scale up to 100
          } else {
            scoreValue = numerator; // Already out of 100
          }
        }
      }
      
      // Format: "85 out of 100" or "8.5 out of 10"
      if (!scoreValue) {
        const verbalMatch = text.match(/\b([0-9.]+)\s*out\s*of\s*(10|100)\b/i);
        if (verbalMatch) {
          const numerator = parseFloat(verbalMatch[1]);
          const denominator = parseFloat(verbalMatch[2]);
          
          // Convert to a score out of 100
          if (denominator === 10) {
            scoreValue = numerator * 10; // Scale up to 100
          } else {
            scoreValue = numerator; // Already out of 100
          }
        }
      }
      
      // Format: Letter grades with percentages like "Grade: A (95%)"
      if (!scoreValue) {
        const percentMatch = text.match(/Grade:?\s*[A-F][+-]?\s*\(([0-9.]+)%\)/i);
        if (percentMatch && percentMatch[1]) {
          scoreValue = parseFloat(percentMatch[1]);
        }
      }
      
      // If we found a valid score, set it
      if (scoreValue !== null) {
        // Normalize between 0-100
        if (scoreValue > 0 && scoreValue <= 5) {
          // Likely a 5-point scale
          result.score = scoreValue * 20;
        } else if (scoreValue > 0 && scoreValue <= 10) {
          // Likely a 10-point scale
          result.score = scoreValue * 10;
        } else {
          // Assume it's already a percentage
          result.score = scoreValue;
        }
        
        // Ensure we're in the range 0-100
        result.score = Math.max(0, Math.min(100, result.score));
      }
      
      // Fill in missing sections if needed
      if (result.strengths.length === 0 && result.improvements.length === 0) {
        console.log(`[GEMINI] No structured sections found, using semantic parsing fallback`);
        
        // First try bullet points anywhere in the text
        const bulletPoints = text.match(/(?:^|\n)(?:[*•-]|\d+\.)\s*(.*?)(?=\n(?:[*•-]|\d+\.)|$)/g);
        if (bulletPoints && bulletPoints.length > 0) {
          const cleanPoints = bulletPoints.map(item => item.replace(/^[*•\d\s.-]+/, '').trim());
          
          if (cleanPoints.length > 1) {
            // Try to categorize each point as a strength or improvement based on language
            const positiveRegex = /\b(?:good|great|excellent|impressive|effective|strong|well|success|positive|creative|accurate|clear|valuable)\b/i;
            const negativeRegex = /\b(?:improve|better|could|should|consider|try|issue|problem|lack|miss|weak|confusing|unclear|inconsistent)\b/i;
            
            const strengths = [];
            const improvements = [];
            
            for (const point of cleanPoints) {
              if (positiveRegex.test(point)) {
                strengths.push(point);
              } else if (negativeRegex.test(point)) {
                improvements.push(point);
              } else {
                // If can't determine, add to strengths by default
                strengths.push(point);
              }
            }
            
            if (strengths.length > 0) result.strengths = strengths;
            if (improvements.length > 0) result.improvements = improvements;
          } else {
            // If we have just one bullet point or can't categorize, split evenly
            const midpoint = Math.ceil(cleanPoints.length / 2);
            result.strengths = cleanPoints.slice(0, midpoint);
            result.improvements = cleanPoints.slice(midpoint);
          }
        } else {
          // If no bullet points found, try to extract sentences and categorize them
          const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 10);
          
          if (sentences.length > 1) {
            // Use sentiment analysis to categorize
            const positiveRegex = /\b(?:good|great|excellent|impressive|effective|strong|well|success|positive|creative|accurate|clear|valuable)\b/i;
            const negativeRegex = /\b(?:improve|better|could|should|consider|try|issue|problem|lack|miss|weak|confusing|unclear|inconsistent)\b/i;
            
            const strengths = [];
            const improvements = [];
            
            for (const sentence of sentences) {
              if (positiveRegex.test(sentence)) {
                strengths.push(sentence);
              } else if (negativeRegex.test(sentence)) {
                improvements.push(sentence);
              }
            }
            
            if (strengths.length > 0) result.strengths = strengths.slice(0, 3);
            if (improvements.length > 0) result.improvements = improvements.slice(0, 3);
          }
        }
      }
      
      console.log(`[GEMINI] Extracted ${result.strengths.length} strengths, ${result.improvements.length} improvements, and ${result.suggestions.length} suggestions`);
      return result;
    } catch (error) {
      console.error(`[GEMINI] Error extracting structured feedback:`, error instanceof Error ? error.message : String(error));
      return result; // Return the default structure
    }
  };
  
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
      
      // Prepare the request with JSON response format - use proper structure with config
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature,
          topP, 
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema,
          systemInstruction: systemPrompt ? { text: systemPrompt } : undefined
        }
      };
      
      // Log if system prompt was added
      if (systemPrompt) {
        console.log(`[GEMINI] Added system prompt as systemInstruction (${systemPrompt.length} chars)`);
      }
      
      console.log(`[GEMINI] Sending request to Gemini API`);
      
      // Generate content with the model
      const result = await this.genAI.models.generateContent(requestParams);
      
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
      
      // Parse the response as JSON with fallbacks
      let parsedContent: any = {};
      
      // Try to parse the text as JSON first (with advanced repair if needed)
      try {
        // First attempt direct parse
        let jsonToUse = text;
        
        try {
          parsedContent = JSON.parse(jsonToUse);
          console.log(`[GEMINI] Successfully parsed direct JSON response`);
        } catch (jsonError) {
          console.warn(`[GEMINI] Initial JSON parsing failed: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          console.log(`[GEMINI] Attempting to repair JSON response before parsing`);
          
          // Advanced JSON repair for truncated responses
          if (jsonToUse.trim().startsWith('{') && !jsonToUse.trim().endsWith('}')) {
            // Fix incomplete JSON - handle truncated responses
            console.log(`[GEMINI] Detected potential truncated JSON, attempting repair`);
            
            // First, try simple unclosed brace fix
            let fixedJson = jsonToUse;
            
            // Count open/close braces and brackets to match them
            const openingBraces = (jsonToUse.match(/{/g) || []).length;
            const closingBraces = (jsonToUse.match(/}/g) || []).length;
            const openingBrackets = (jsonToUse.match(/\[/g) || []).length;
            const closingBrackets = (jsonToUse.match(/\]/g) || []).length;
            
            if (openingBraces > closingBraces || openingBrackets > closingBrackets) {
              console.log(`[GEMINI] Imbalanced braces/brackets detected: ${openingBraces}:{, ${closingBraces}:}, ${openingBrackets}:[, ${closingBrackets}:]`);
              
              // Check for unclosed quotes
              const doubleQuotes = (jsonToUse.match(/"/g) || []).length;
              if (doubleQuotes % 2 !== 0) {
                console.log(`[GEMINI] Detected odd number of quotes, attempting to fix last property`);
                
                // Find the last properly formatted key-value pair
                const lastValidPropertyRegex = /"([^"]+)"\s*:\s*(?:"([^"]*)"(?=\s*[,}])|([0-9.]+)(?=\s*[,}])|(\[[^\]]*\])(?=\s*[,}])|(\{[^}]*\})(?=\s*[,}])|true(?=\s*[,}])|false(?=\s*[,}])|null(?=\s*[,}]))/g;
                
                let lastMatch;
                let lastIndex = 0;
                
                let match;
                while ((match = lastValidPropertyRegex.exec(jsonToUse)) !== null) {
                  lastMatch = match;
                  lastIndex = match.index + match[0].length;
                }
                
                if (lastMatch && lastIndex) {
                  // Truncate at the last valid property
                  fixedJson = jsonToUse.substring(0, lastIndex);
                  console.log(`[GEMINI] Truncated JSON at the last valid property ending at position ${lastIndex}`);
                }
              }
              
              // Add missing closing braces/brackets
              let suffix = '';
              for (let i = 0; i < openingBraces - closingBraces; i++) suffix += '}';
              for (let i = 0; i < openingBrackets - closingBrackets; i++) suffix += ']';
              
              jsonToUse = fixedJson + suffix;
              console.log(`[GEMINI] Advanced JSON repair: added ${openingBraces - closingBraces} braces and ${openingBrackets - closingBrackets} brackets`);
            }
          }
          
          // Attempt to parse the potentially repaired JSON
          parsedContent = JSON.parse(jsonToUse);
          console.log(`[GEMINI] Successfully parsed repaired JSON response`);
        }
      } catch (error) {
        console.warn(`[GEMINI] JSON parsing failed after repair attempts: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`[GEMINI] Falling back to manual parsing methods`);
        
        // Try to find JSON block in markdown
        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
        const jsonMatch = text.match(jsonBlockRegex);
        
        if (jsonMatch && jsonMatch[1]) {
          try {
            const jsonText = jsonMatch[1].trim();
            parsedContent = JSON.parse(jsonText);
            console.log(`[GEMINI] Successfully extracted JSON from markdown code block`);
          } catch (error) {
            console.warn(`[GEMINI] Failed to parse JSON from markdown block: ${error instanceof Error ? error.message : String(error)}`);
            
            // Use our structured feedback extractor
            console.log(`[GEMINI] Attempting structured feedback extraction`);
            parsedContent = this.extractStructuredFeedback(text);
          }
        } else {
          // No markdown block found, try structured extraction
          console.log(`[GEMINI] No JSON code blocks found, trying structured extraction`);
          parsedContent = this.extractStructuredFeedback(text);
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      
      if (result.usageMetadata) {
        const usageMetadata = result.usageMetadata;
        if ('promptTokenCount' in usageMetadata && 'candidatesTokenCount' in usageMetadata) {
          // Sum prompt and candidates token counts
          tokenCount = (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
        }
      }
      
      if (tokenCount === 0) {
        // Estimate token count based on response length (~4 chars per token)
        tokenCount = Math.ceil(text.length / 4);
        console.log(`[GEMINI] Token count not available, using estimation method`);
      }
      
      console.log(`[GEMINI] Estimated token count: ${tokenCount}`);
      
      return {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.modelName,
        tokenCount: tokenCount
      };
    } catch (error) {
      console.error("[GEMINI] API error:", error instanceof Error ? error.message : String(error));
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Multimodal completion (text + images, etc.)
   */
  async generateMultimodalCompletion(
    parts: MultimodalPromptPart[],
    systemPrompt?: string
  ) {
    try {
      console.log(`[GEMINI] Generating multimodal completion with ${parts.length} parts`);
      
      // Prepare content parts in the format expected by the API
      const apiParts: Part[] = [];
      
      // Content type conversion for debugging
      const contentSummary = parts.map(part => {
        if (part.type === 'text') {
          const text = typeof part.content === 'string' ? part.content : '(Buffer)';
          return `text: ${text.substring(0, 50)}...`;
        } else if (part.type === 'image') {
          const size = part.content instanceof Buffer ? part.content.length : 'unknown';
          return `image: ${part.mimeType} (${Math.round(Number(size) / 1024)}KB)`;
        } else {
          const size = part.content instanceof Buffer ? part.content.length : 'unknown';
          return `${part.type}: ${part.mimeType} (${Math.round(Number(size) / 1024)}KB)`;
        }
      });
      
      console.log(`[GEMINI] Content parts summary:`, contentSummary);
      
      // Process parts to match the expected API format
      for (const part of parts) {
        // Text content handling
        if (part.type === 'text' && typeof part.content === 'string') {
          apiParts.push({ text: part.content });
          continue;
        }
        
        // Buffer data handling (images, etc.)
        if (part.content instanceof Buffer && part.mimeType) {
          // Skip unsupported mime types (like SVG)
          if (part.mimeType === 'image/svg+xml') {
            console.warn(`[GEMINI] Skipping unsupported MIME type: ${part.mimeType}`);
            apiParts.push({ text: "Image format not supported (SVG). Please use PNG or JPEG." });
            continue;
          }
          
          // Convert Buffer to base64 for the API
          const base64Data = part.content.toString('base64');
          
          // Use inlineData format for API
          apiParts.push({
            inlineData: {
              data: base64Data,
              mimeType: part.mimeType
            }
          });
          
          console.log(`[GEMINI] Added ${part.mimeType} data of size ${Math.round(part.content.length / 1024)}KB`);
        }
      }
      
      // Generation config parameters
      const temperature = 0.2;
      const topP = 0.8;
      const topK = 40;
      const maxOutputTokens = 1024;
      
      // Prepare the request with JSON response format - use proper structure with config
      const requestParams: any = {
        model: this.modelName,
        contents: [{ role: 'user', parts: apiParts }],
        config: {
          temperature,
          topP,
          topK,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: this.responseSchema,
          // Add system instruction directly in config if provided
          systemInstruction: systemPrompt ? { text: systemPrompt } : undefined
        }
      };
      
      // Log if system prompt was added
      if (systemPrompt) {
        console.log(`[GEMINI] Added system prompt as systemInstruction (${systemPrompt.length} chars)`);
      }
      
      console.log(`[GEMINI] Making API request to model: ${this.modelName}`);
      console.log(`[GEMINI] Request has ${apiParts.length} content parts`);
      
      // Generate content with the model
      let result: GenerateContentResponse;
      try {
        result = await this.genAI.models.generateContent(requestParams);
        console.log(`[GEMINI] API request successful`);
      } catch (apiError) {
        // Log detailed error info for debugging
        console.error(`[GEMINI] API request failed:`, apiError instanceof Error ? apiError.message : String(apiError));
        if (apiError instanceof Error && apiError.stack) {
          console.error(`[GEMINI] Error stack:`, apiError.stack);
        }
        
        // Check for common errors like format issues
        const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
        
        if (errorMsg.includes('MIME type') || errorMsg.includes('format')) {
          // Try again without the image if there was a format error
          console.log(`[GEMINI] Retrying without problematic media format`);
          
          // Filter to only keep text parts
          const textOnlyParts: Part[] = apiParts.filter(part => 'text' in part);
          
          // Add a placeholder message about the image
          textOnlyParts.push({ 
            text: "Note: An image was included but could not be processed due to format limitations." 
          });
          
          // Retry with text-only, keeping the config structure
          const retryParams = {
            model: this.modelName,
            contents: [{ role: 'user', parts: textOnlyParts }],
            config: requestParams.config
          };
          result = await this.genAI.models.generateContent(retryParams);
        } else {
          // If not a recoverable error, rethrow
          throw apiError;
        }
      }
      
      console.log(`[GEMINI] Successfully received response from Gemini API`);
      
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
      
      console.log(`[GEMINI] Response length: ${text.length} characters`);
      console.log(`[GEMINI] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);
      
      // Parse the response as JSON with fallbacks
      let parsedContent: any = {};
      
      // Try to parse the text as JSON first
      try {
        // Log the raw text in development for debugging
        console.log(`[GEMINI] Attempting to parse direct structured response`);
        
        // Limit the logged text to prevent console flooding
        const logPreview = text.length > 200 ? 
          `${text.substring(0, 100)}...${text.substring(text.length - 100)}` : 
          text;
        console.log(`[GEMINI] Response preview for debugging: ${logPreview}`);
        
        // First try to repair any truncated JSON before parsing
        let jsonToUse = text;
        
        try {
          // First attempt direct parsing
          parsedContent = JSON.parse(jsonToUse);
          console.log(`[GEMINI] Successfully parsed direct JSON response`);
        } catch (initialParseError) {
          // JSON repair needed
          console.log('[GEMINI] Initial JSON parsing failed, attempting repair');
          
          // Check if the JSON string appears to be truncated
          const lastChar = text.trim().slice(-1);
          const startsWithOpenBrace = text.trim().startsWith('{');
          const needsRepair = (lastChar !== '}' && lastChar !== ']' && text.includes('{')) || 
              (startsWithOpenBrace && !text.trim().endsWith('}'));
              
          if (needsRepair) {
            console.log('[GEMINI] Response appears to be truncated or malformed JSON');
            
            // APPROACH 1: Find complete JSON objects in the text
            const jsonObjectRegex = /(\{[\s\S]*?\})/g;
            const potentialJsons = text.match(jsonObjectRegex);
            
            if (potentialJsons && potentialJsons.length > 0) {
              console.log(`[GEMINI] Found ${potentialJsons.length} complete JSON objects in the text`);
              
              // Sort by length (largest first - more likely to be complete)
              const sortedJsons = [...potentialJsons].sort((a, b) => b.length - a.length);
              
              for (const jsonCandidate of sortedJsons) {
                try {
                  const parsed = JSON.parse(jsonCandidate);
                  // Check if it has typical response fields
                  if (parsed.strengths || parsed.improvements || parsed.summary) {
                    console.log(`[GEMINI] Successfully extracted valid JSON object (${jsonCandidate.length} chars)`);
                    jsonToUse = jsonCandidate;
                    break;
                  }
                } catch (e) {
                  // Continue to next candidate
                }
              }
            }
            
            // APPROACH 2: Try normalized JSON parsing
            if (jsonToUse === text) {
              try {
                const normalizedJSON = text
                  .replace(/(\w+)(?=:)/g, '"$1"')              // Add quotes to unquoted keys
                  .replace(/,\s*([}\]])/g, '$1')               // Remove trailing commas
                  .replace(/,\s*$/, '')                        // Remove trailing commas at the end
                  .replace(/([^"]),(\s*})/, '$1$2');           // Remove trailing commas before ending braces
                  
                const parsed = JSON.parse(normalizedJSON);
                if (parsed && (parsed.strengths || parsed.improvements || parsed.summary)) {
                  console.log('[GEMINI] Successfully repaired and parsed JSON with normalization');
                  jsonToUse = normalizedJSON;
                }
              } catch (normalizationError) {
                // Continue with other approaches
                console.log('[GEMINI] Normalization failed, trying other repair methods');
              }
            }
            
            // APPROACH 3: Balance braces
            if (jsonToUse === text) {
              const firstBrace = text.indexOf('{');
              if (firstBrace !== -1) {
                // Count unmatched braces and brackets
                const openingBraces = (text.match(/{/g) || []).length;
                const closingBraces = (text.match(/}/g) || []).length;
                const openingBrackets = (text.match(/\[/g) || []).length;
                const closingBrackets = (text.match(/\]/g) || []).length;
                
                // Add missing closing braces/brackets
                if (openingBraces > closingBraces || openingBrackets > closingBrackets) {
                  let suffix = '';
                  for (let i = 0; i < openingBraces - closingBraces; i++) suffix += '}';
                  for (let i = 0; i < openingBrackets - closingBrackets; i++) suffix += ']';
                  
                  const fixedJson = text.substring(firstBrace);
                  jsonToUse = fixedJson + suffix;
                  console.log(`[GEMINI] Added ${openingBraces - closingBraces} braces and ${openingBrackets - closingBrackets} brackets`);
                }
              }
            }
          }
          
          // Try parsing with our repaired JSON
          try {
            parsedContent = JSON.parse(jsonToUse);
            console.log(`[GEMINI] Successfully parsed repaired JSON`);
          } catch (finalParseError) {
            // All repair attempts failed, fallback to markdown code block extraction
            console.log(`[GEMINI] All JSON repair attempts failed, trying other methods`);
            throw finalParseError; // Rethrow to be caught by the outer catch block
          }
        }
      } catch (error) {
        console.warn(`[GEMINI] Failed to parse direct response: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`[GEMINI] Falling back to manual parsing for multimodal content`);
        
        // Try to find JSON block in markdown
        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
        const jsonMatch = text.match(jsonBlockRegex);
        
        if (jsonMatch && jsonMatch[1]) {
          try {
            const jsonText = jsonMatch[1].trim();
            parsedContent = JSON.parse(jsonText);
            console.log(`[GEMINI] Successfully extracted JSON from markdown `);
          } catch (error) {
            console.warn(`[GEMINI] Failed to parse JSON from markdown block: ${error instanceof Error ? error.message : String(error)}`);
            
            // Use our structured feedback extractor
            console.log(`[GEMINI] Attempting structured feedback extraction (multimodal)`);
            parsedContent = this.extractStructuredFeedback(text);
          }
        } else {
          // No markdown block found, try structured extraction
          console.log(`[GEMINI] No JSON code blocks found, trying structured extraction (multimodal)`);
          parsedContent = this.extractStructuredFeedback(text);
        }
      }
      
      // Check what we got and log
      const parsedKeys = Object.keys(parsedContent);
      console.log(`[GEMINI] Parsed JSON keys: ${parsedKeys.join(', ')}`);
      
      // Try to get token usage from response metadata, fall back to estimation
      let tokenCount = 0;
      
      if (result.usageMetadata) {
        const usageMetadata = result.usageMetadata;
        if ('promptTokenCount' in usageMetadata && 'candidatesTokenCount' in usageMetadata) {
          // Sum prompt and candidates token counts
          tokenCount = (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
        }
      }
      
      if (tokenCount === 0) {
        // Estimate token count based on response length (~4 chars per token)
        tokenCount = Math.ceil(text.length / 4);
        console.log(`[GEMINI] Token count not available, using estimation method`);
      }
      
      console.log(`[GEMINI] Estimated token count: ${tokenCount}`);
      
      console.log(`[GEMINI] Response contains: ${parsedContent.strengths?.length || 0} strengths, ${parsedContent.improvements?.length || 0} improvements, score: ${parsedContent.score || 'none'}`);
      
      console.log(`[GEMINI] Successfully completed multimodal AI generation with ${this.modelName}`);
      
      return {
        strengths: parsedContent.strengths || [],
        improvements: parsedContent.improvements || [],
        suggestions: parsedContent.suggestions || [],
        summary: parsedContent.summary || "",
        score: parsedContent.score || 0,
        criteriaScores: parsedContent.criteriaScores || [],
        rawResponse: parsedContent,
        modelName: this.modelName,
        tokenCount: tokenCount
      };
    } catch (error) {
      console.error(`[GEMINI] Multimodal API error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Enhanced error logging for debugging
      if (error instanceof Error && error.stack) {
        console.error(`[GEMINI] Error stack: ${error.stack}`);
      }
      
      throw new Error(`AI multimodal generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default GeminiAdapter;