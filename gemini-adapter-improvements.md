# Gemini Adapter Improvements

## 1. Schema Pruning Implementation
The `pruneForGemini` function removes fields that Gemini doesn't support from JSON Schema:

```typescript
// In constructor:
this.responseSchema = Object.freeze(pruneForGemini(gradingJSONSchema));
```

## 2. JSON Repair Implementation
Add repair logic before and after parsing attempts:

```typescript
// First check if the JSON appears to be truncated or malformed
const jsonValid = text.trim().startsWith('{') && text.trim().endsWith('}');
if (!jsonValid) {
  console.log(`[GEMINI] JSON appears truncated or malformed, attempting repair before parsing`);
  const repairedText = repairJson(text);
  if (repairedText !== text) {
    console.log(`[GEMINI] JSON was repaired before parsing`);
    text = repairedText;
  }
}

try {
  // Use the strict parser that validates against schema
  parsedContent = parseStrict(text);
  console.log(`[GEMINI] Successfully parsed and validated JSON response`);
} catch (error) {
  console.log(`[GEMINI] Initial JSON parsing failed, attempting repair: ${error instanceof Error ? error.message : String(error)}`);
  
  // Try to repair the JSON and parse again
  const repairedText = repairJson(text);
  if (repairedText !== text) {
    try {
      // Try to parse the repaired JSON
      parsedContent = parseStrict(repairedText);
      console.log(`[GEMINI] Successfully parsed and validated repaired JSON`);
    } catch (repairError) {
      console.error(`[GEMINI] JSON repair and parsing failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`);
      throw new SchemaValidationError(
        `Gemini returned JSON that failed schema validation, even after repair attempts`, 
        text, 
        error
      );
    }
  } else {
    console.error(`[GEMINI] JSON parsing or validation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new SchemaValidationError(
      `Gemini returned JSON that failed schema validation`, 
      text, 
      error
    );
  }
}
```

## 3. Smart File Handling with Type and Size Decision Logic

```typescript
if (part.type === 'image' || part.type === 'document' || part.type === 'audio' || part.type === 'video') {
  try {
    const mimeType = part.mimeType || 
      (part.type === 'image' ? 'image/jpeg' : 
       part.type === 'document' ? 'application/pdf' : 
       part.type === 'audio' ? 'audio/mpeg' : 
       'video/mp4');
    
    console.log(`[GEMINI] Processing ${part.type} with mime type ${mimeType}`);
    
    // Determine file size
    const fileSize = Buffer.isBuffer(part.content) 
      ? part.content.length 
      : (typeof part.content === 'string' ? Buffer.from(part.content, 'base64').length : 0);
    
    // Check if we should use Files API based on type and size
    const useFilesAPI = shouldUseFilesAPI(mimeType, fileSize);
    
    if (useFilesAPI) {
      console.log(`[GEMINI] Using Files API for ${part.type} (${(fileSize / (1024 * 1024)).toFixed(2)}MB)`);
      
      // Use Files API - returns snake_case formatted data
      const fileData = await createFileData(
        this.genAI,
        part.content as Buffer | string,
        mimeType
      );
      
      // Convert to the SDK's expected camelCase format
      const sdkFileData = toSDKFormat(fileData);
      
      // Add file data using the SDK's expected structure
      apiParts.push({
        fileData: sdkFileData
      });
      
      console.log(`[GEMINI] Successfully uploaded ${part.type} to Files API`);
    } else {
      // For small images only, use inline data
      if (part.type === 'image') {
        // Convert Buffer to base64 string if needed
        const base64Data = Buffer.isBuffer(part.content)
          ? part.content.toString('base64')
          : part.content as string;
          
        // Standard image handling for smaller files
        apiParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
        
        console.log(`[GEMINI] Added inline image data (${(fileSize / 1024).toFixed(2)}KB)`);
      } else {
        // If this is a non-image that we thought would be small enough for inline,
        // we should still use Files API as Gemini only supports inline for images
        console.log(`[GEMINI] Non-image content must use Files API, uploading...`);
        
        const fileData = await createFileData(
          this.genAI,
          part.content as Buffer | string,
          mimeType
        );
        
        apiParts.push({
          fileData: toSDKFormat(fileData)
        });
        
        console.log(`[GEMINI] Successfully uploaded ${part.type} to Files API`);
      }
    }
  } catch (error) {
    console.error(`[GEMINI] Error processing ${part.type}: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to process ${part.type}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

## 4. Streaming & Token Count Optimization

```typescript
// Determine if we should use streaming to avoid truncated responses
const BASE_MAX = 1200;   // covers 99% of image feedback
const RETRY_MAX = 1600;  // bump once on early stop
let maxOutputTokens = BASE_MAX;

const run = async (cap: number) => {
  const params = {
    ...requestParams,
    config: {
      ...requestParams.config,
      maxOutputTokens: cap
    }
  };
  
  const stream = await this.genAI.models.generateContentStream(params);
  let streamedText = '';
  let finishReason = null;
  
  for await (const chunk of stream) {
    if (chunk.candidates && 
        chunk.candidates.length > 0 && 
        chunk.candidates[0]?.content?.parts) {
      const part = chunk.candidates[0].content.parts[0];
      if (part.text) {
        streamedText += part.text;
      }
    }
    
    if (chunk.candidates && 
        chunk.candidates.length > 0 && 
        chunk.candidates[0]?.finishReason) {
      finishReason = chunk.candidates[0].finishReason;
    }
  }
  
  return { text: streamedText, finishReason };
};

// First run with standard token limit
let { text, finishReason } = await run(maxOutputTokens);

// If the response was truncated, retry with higher token limit
if (finishReason !== 'STOP') {
  console.warn(`[GEMINI] early stop ${finishReason} – retry ↑ tokens`);
  ({ text, finishReason } = await run(RETRY_MAX));
}

// If still truncated, this is a real problem
if (finishReason !== 'STOP') {
  throw new Error(`Gemini failed twice (reason: ${finishReason})`);
}
```

## 5. Remove Default Token Fallbacks

```typescript
// Old code with defaults:
const tokenCount = result.usageMetadata?.totalTokenCount || 1000;

// Replace with:
const tokenCount = result.usageMetadata?.totalTokenCount;
```