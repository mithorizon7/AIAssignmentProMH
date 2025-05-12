# AI Model Configuration Guide

This document outlines the AI models used in the AI Feedback Platform and how to configure them.

## Supported Models

### Google Gemini (Preferred Provider)

The platform is configured to prioritize Google Gemini over other AI providers. 

- **Default Model**: `models/gemini-2.5-flash-preview-04-17`
- **Alternate Model**: `gemini-2.0-flash`

### OpenAI (Fallback Provider)

OpenAI models are used as a fallback when Gemini API keys are not available.

- **Default Model**: `gpt-4.1-mini-2025-04-14`
- **Alternate Model**: `gpt-4o`

## Configuration

### Environment Variables

To enable AI providers, set the following environment variables:

```
# Required for Gemini (preferred)
GEMINI_API_KEY=your_gemini_api_key

# Required for OpenAI (fallback)
OPENAI_API_KEY=your_openai_api_key
```

### Admin Dashboard Configuration

The system administrator can configure AI model settings through the Admin Dashboard:

1. Navigate to `System Configuration > AI Models`
2. Select the desired provider (Gemini is recommended)
3. Choose the specific model
4. Adjust token limits and temperature settings as needed

## Model Selection Logic

The platform uses the following priority order when selecting an AI provider:

1. Google Gemini (if `GEMINI_API_KEY` is available)
2. OpenAI (if `OPENAI_API_KEY` is available and Gemini is unavailable)
3. A fallback to Gemini (with a warning log) if no API keys are available

This prioritization logic is implemented in `server/queue/bullmq-submission-queue.ts`.

## Extending with New Models

To add support for a new AI model:

1. Create a new adapter class that implements the `AIAdapter` interface
2. Update the model selection options in `client/src/pages/admin/system-config.tsx`
3. Add the necessary selection logic in `server/queue/bullmq-submission-queue.ts`