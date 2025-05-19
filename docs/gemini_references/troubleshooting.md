# Gemini API Troubleshooting Guide

This document provides solutions for common issues encountered when working with the Gemini API in our application.

## Common API Request Issues

### Missing Content Error

**Error Message:** `{"message":"Content is required"}`

**Cause:** When making requests to the Gemini API, the content field is mandatory. This error occurs if you're submitting a request without providing the necessary content in the body.

**Solution:**
1. Ensure your request body includes a `content` field
2. For text submissions, include a non-empty string in the content field
3. For file submissions, ensure the file content is properly included

**Example Fix:**
```javascript
// Incorrect
const response = await fetch('/api/test-rubric', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    rubric: "Evaluate based on clarity and accuracy"
    // Missing content field!
  })
});

// Correct
const response = await fetch('/api/test-rubric', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    content: "This is the student submission to evaluate",
    rubric: "Evaluate based on clarity and accuracy"
  })
});
```

### Invalid Input Syntax for Type Integer

**Error Message:** `Error: invalid input syntax for type integer: "NaN"`

**Cause:** This occurs when a numeric field in the database receives a non-numeric value or when NaN is provided where an integer is expected.

**Solution:**
1. Add validation to ensure numeric fields contain valid numbers
2. Provide default values for optional numeric fields
3. Check for NaN values before database operations

**Example Fix:**
```javascript
// Add validation to your form schemas
const submissionSchema = z.object({
  // ...other fields
  score: z.number().optional().default(null),
  // ...
});

// Validate before database operations
const score = Number(req.body.score);
if (isNaN(score)) {
  // Use a default or null instead
  req.body.score = null;
}
```

## File Handling Issues

### Failed to Download File from URL

**Error Message:** `Error: Failed to download file from URL: Failed to download file: Invalid URL`

**Cause:** The URL provided to the Files API is invalid or inaccessible.

**Solution:**
1. Ensure the URL is properly formatted and accessible
2. For local development, use a publicly accessible URL or a direct file upload
3. Verify that the URL is not expired if using signed URLs

### MIME Type Issues

**Error Message:** `Error: Unsupported MIME type`

**Cause:** The Gemini API only supports specific MIME types for different file formats.

**Solution:**
1. Ensure you're using the correct MIME type for your file
2. For images: `image/jpeg`, `image/png`, `image/webp`, etc.
3. For documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (for DOCX)
4. When in doubt, use the Files API which handles a wider range of file types

## Authentication Issues

### API Key Not Valid

**Error Message:** `Error: API key not valid. Please pass a valid API key.`

**Cause:** The Gemini API key is invalid, expired, or missing.

**Solution:**
1. Verify that the GEMINI_API_KEY is set in your environment
2. Ensure the API key is correct and not expired
3. Check that the API key has access to the Gemini models you're using

```javascript
// Verify API key in server startup
if (!process.env.GEMINI_API_KEY) {
  console.error("Warning: GEMINI_API_KEY is not set. AI features will not work correctly.");
}
```

## Response Structure Issues

### Invalid Schema Format

**Error Message:** `Error: Invalid schema format provided to Gemini API.`

**Cause:** The response schema provided to the Gemini API does not follow the expected format or contains unsupported fields.

**Solution:**
1. Use the schema pruning helper to remove unsupported fields
2. Ensure the schema follows the structure expected by Gemini
3. Verify that all required fields are present

**Example Fix:**
```javascript
// Use the pruneForGemini helper from our utilities
import { pruneForGemini } from '../utils/schema-helpers';

const rawSchema = {
  type: 'OBJECT',
  properties: {
    feedback: {
      type: 'STRING',
      description: 'Detailed feedback about the submission'
    },
    score: {
      type: 'NUMBER',
      description: 'Numerical score from 0-100'
    },
    // Unsupported fields will be pruned
    metadata: {
      $ref: 'SomeOtherSchema'  // References not supported
    }
  },
  required: ['feedback', 'score']
};

// Prune the schema before sending to Gemini
const compatibleSchema = pruneForGemini(rawSchema);
```

## Performance and Reliability

### Timeout Issues

**Error Message:** `Error: Request timed out`

**Cause:** Long-running requests to the Gemini API may time out, especially for complex prompts or large files.

**Solution:**
1. Use smaller, more focused prompts
2. For large files, consider splitting them into smaller chunks
3. Implement retry logic with exponential backoff
4. Use the asynchronous processing queue for long-running operations

**Example Retry Logic:**
```javascript
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

async function requestWithRetry(requestFn, maxRetries = MAX_RETRIES) {
  let lastError;
  let delay = INITIAL_DELAY;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1} failed: ${error.message}`);
      
      // Don't retry on certain errors
      if (error.message.includes('API key not valid') || 
          error.message.includes('Invalid schema')) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError;
}
```

## Debugging Tips

1. **Enable Detailed Logging:** Set `DEBUG=true` in your environment to see detailed logs of Gemini API requests and responses

2. **Check Token Usage:** Monitor token usage in the Gemini response metadata to optimize prompts and reduce costs

3. **Validate with Test Scripts:** Use the test scripts in the root directory (starting with `test-`) to validate your Gemini API integration in isolation

4. **Review Reference Documentation:** Consult the [Schema Reference](./schema-reference.md) and other reference documents for detailed information about API structures and requirements