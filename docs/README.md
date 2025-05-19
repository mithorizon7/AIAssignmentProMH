# Project Documentation

This directory contains documentation for the AI-powered educational assessment platform.

## Sections

- [Gemini References](./gemini_references/index.md) - Reference documentation for the Google Gemini API and its various features

## Overview

Our platform leverages advanced AI technologies including Google's Gemini models to provide intelligent, adaptive learning feedback with robust file upload and processing capabilities. The documentation in this directory helps developers understand how different components work and how to implement new features.

## Guides

- For Gemini API implementation details, see the [Gemini References](./gemini_references/index.md) section
- For database schema information, refer to the `shared/schema.ts` file
- For API routes documentation, see the `server/routes.ts` file

## Best Practices

When working with multimodal AI features:

1. Always use the Files API for files larger than 20MB
2. Structure your prompts according to the guidelines in the documentation
3. Implement proper error handling for file uploads and AI processing
4. Use structured output where possible to ensure consistent response formats