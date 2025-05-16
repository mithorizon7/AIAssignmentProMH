# Gemini Adapter Production Fixes

## Overview
This document describes the critical fixes implemented to make the Gemini adapter production-ready for AIGrader. These improvements address specific issues with the Google Gemini API's schema expectations and file handling requirements.

## Key Fixes Implemented

### 1. Schema Compatibility
The Gemini API expects a simplified JSON Schema format compared to the standard. We created a utility to prune unsupported fields:

- Created `schema-pruner.ts` with a `pruneForGemini()` function that removes problematic fields like:
  - `$schema`
  - `additionalProperties`
  - `title`
  - `description`
  - `examples`
  - `default`

This prevents 400 errors where Gemini rejects standard schema fields as "Unknown name".

### 2. Files API Integration
Implemented proper handling for large files and documents using the Gemini Files API:

- Created `gemini-file-handler.ts` with utilities to:
  - Upload files to Gemini's Files API correctly
  - Cache uploaded files for 47 hours (just under the API's 48h limit)
  - Generate proper snake_case file references (`file_uri` instead of `fileUri`)
  - Handle file upload status checking

This ensures PDFs and large files are properly processed by the AI.

### 3. Property Naming & Type Safety
Fixed issues with camelCase vs. snake_case field naming that were causing API errors:

- The Google API expects `file_uri` and `mime_type` (snake_case)
- The TS type declarations expect `fileUri` and `mimeType` (camelCase)
- Created conversion utilities to handle these discrepancies safely

### 4. Large Image Handling
Added size-based routing for images:
- Small images (<5MB): Use inline base64 encoding
- Large images (>5MB): Use the Files API (same as documents)

### 5. Previous Improvements (from earlier commits)
- Enhanced token usage metrics by using API-provided counts
- Added named constants for important thresholds
- Improved error handling with proper error class
- Enhanced security with content truncation
- Set appropriate token limits

## Technical Details

### Files API Process
1. When a file is uploaded, it's first sent to Gemini's Files API
2. The API returns a URI in the format `files/abc123`
3. This URI is cached with the file's hash to avoid duplicate uploads
4. The URI is then used in subsequent requests in the proper snake_case format

### Schema Processing
The adapter now automatically prunes JSON Schema during initialization:
```typescript
this.responseSchema = Object.freeze(pruneForGemini(gradingJSONSchema));
```

## Benefits
- PDFs, documents, and large files now work correctly
- Schema validation errors resolved
- Better error messages and debugging
- Improved reliability for production deployments