# Handling Token Limits in Gemini API

This document provides guidance on managing token limits when working with the Gemini API, which is particularly important when processing large inputs such as images, documents, or extensive text prompts.

## Understanding Token Limits

Each Gemini model has specific token limits for both input and output:

| Model | Input Token Limit | Output Token Limit |
|-------|-------------------|-------------------|
| gemini-1.0-pro | 30,720 | 2,048 |
| gemini-1.5-pro | 1,000,000 | 8,192 |
| gemini-1.5-flash | 1,000,000 | 8,192 |
| gemini-2.0-pro | 2,000,000 | 8,192 |
| gemini-2.0-flash | 1,000,000 | 8,192 |

When a request exceeds these limits, the API returns a `MAX_TOKENS` error.

## Common Causes of Token Limit Errors

1. **Large images or documents**: High-resolution images and lengthy documents consume many tokens
2. **Complex rubrics or instructions**: Detailed evaluation criteria increase token usage
3. **Long conversation histories**: Multi-turn conversations accumulate tokens
4. **Streaming responses**: When using streaming, partial responses may hit token limits

## Strategies for Managing Token Limits

### 1. Content Chunking

Break large content into manageable chunks:

```javascript
async function processLargeDocument(document, maxTokensPerChunk = 10000) {
  // Split document into chunks (implementation depends on document type)
  const chunks = splitIntoChunks(document, maxTokensPerChunk);
  
  let results = [];
  for (const chunk of chunks) {
    const chunkResult = await processChunk(chunk);
    results.push(chunkResult);
  }
  
  return combineResults(results);
}
```

### 2. Image Optimization

Reduce image token consumption:

```javascript
async function optimizeImageForGemini(imageBuffer) {
  // Resize large images to reduce token usage
  const maxDimension = 1024; // Balance between quality and token usage
  
  // Example implementation using Sharp library
  const optimizedImage = await sharp(imageBuffer)
    .resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toBuffer();
    
  return optimizedImage;
}
```

### 3. Prompt Optimization

Refine prompts to be more token-efficient:

```javascript
function optimizePrompt(rubric, submission) {
  // Extract only essential information from the rubric
  const essentialCriteria = extractCoreRubricCriteria(rubric);
  
  // Focus the model on specific aspects of the submission
  const focusedPrompt = `
    Evaluate the following submission according to these critical criteria:
    ${essentialCriteria.join('\n')}
    
    Provide concise feedback on each criterion.
  `;
  
  return focusedPrompt;
}
```

### 4. Retry Logic with Fallbacks

Implement retry logic with fallback strategies:

```javascript
async function generateCompletionWithRetry(prompt, parts, options = {}) {
  try {
    // First attempt with standard settings
    return await generateCompletion(prompt, parts, options);
  } catch (error) {
    if (error.message.includes('MAX_TOKENS')) {
      console.log('[GEMINI] Token limit exceeded, attempting with reduced content...');
      
      // Fallback 1: Reduce image quality/size
      if (parts.some(part => part.inlineData?.data || part.fileData)) {
        const optimizedParts = await optimizeMultimodalParts(parts);
        return await generateCompletion(prompt, optimizedParts, options);
      }
      
      // Fallback 2: Truncate prompt
      const truncatedPrompt = truncatePrompt(prompt);
      return await generateCompletion(truncatedPrompt, parts, options);
    }
    
    throw error; // Re-throw if it's not a token limit issue
  }
}
```

### 5. Model Selection Strategy

Select an appropriate model based on content complexity:

```javascript
function selectAppropriateModel(content) {
  const estimatedTokens = estimateTokenCount(content);
  
  if (estimatedTokens > 30000) {
    return 'gemini-1.5-pro'; // Higher token limit for large content
  } else if (content.includes('code') || content.includes('structured')) {
    return 'gemini-2.0-pro'; // Better for code and structured data
  } else {
    return 'gemini-2.0-flash'; // Faster for standard content
  }
}
```

## Implementation in AIGrader

In our AIGrader application, we handle token limits through:

1. **Adaptive model selection**: Choosing the appropriate model based on submission type
2. **Streaming with retry**: Using streaming with fallback mechanisms for token issues
3. **Progressive enhancement**: Starting with core evaluation and adding detail if tokens permit
4. **Content optimization**: Pre-processing images and documents to reduce token usage

## Example Implementation

Here's an example of how we handle token limits in the Gemini adapter:

```javascript
// In gemini-adapter.ts
async function generateCompletionWithTokenProtection(prompt, parts, options) {
  const maxRetries = 2;
  let retryCount = 0;
  let tokenLimit = options.maxOutputTokens || 1000;
  
  while (retryCount < maxRetries) {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: tokenLimit,
          temperature: options.temperature || 0.2,
        }
      });
      
      return processResponse(result);
    } catch (error) {
      if (error.message.includes('MAX_TOKENS') && retryCount < maxRetries - 1) {
        console.log(`[GEMINI] early stop MAX_TOKENS – retry ↑ tokens`);
        
        // Increase token limit for next attempt
        tokenLimit = Math.min(tokenLimit * 1.5, 2000);
        retryCount++;
        continue;
      }
      
      throw new Error(`Gemini failed ${retryCount > 0 ? 'twice' : ''} (reason: ${getErrorReason(error)})`);
    }
  }
}
```

## Monitoring and Debugging

To track token usage and diagnose issues:

1. **Log token counts**: Record token usage from the `usageMetadata` in API responses
2. **Track errors**: Log specific error types to identify token limit problems
3. **Establish baselines**: Document expected token usage for different submission types
4. **Performance monitoring**: Regularly review token usage patterns to optimize costs

## Best Practices

1. Always optimize images before sending to Gemini
2. Use structured output for efficiency when possible
3. Implement progressive enhancement for complex evaluations
4. Consider parallel processing for large batch operations
5. Cache frequent prompts or partial results when appropriate