# AI Agent Guidelines for AIGrader

This document provides essential guidance for AI agents working with the AIGrader platform, focusing on best practices for prompt engineering, Gemini API usage, and AI-powered assessment.

## Required Documentation Resources

All agents MUST review these key resources before working with the AIGrader codebase:

- **[Gemini Prompting Strategies](docs/gemini_references/prompting-strategies.md)**: Comprehensive guide to designing effective prompts, including examples and best practices
- **[Gemini API Reference Index](docs/gemini_references/index.md)**: Central hub for all Gemini API capabilities
- **[Text Generation Guide](docs/gemini_references/text-generation.md)**: Core text generation capabilities
- **[Image Understanding Guide](docs/gemini_references/image-understanding.md)**: Processing and analyzing images
- **[Document Understanding Guide](docs/gemini_references/document-understanding.md)**: Working with PDFs and documents
- **[Structured Output Guide](docs/gemini_references/structured-output.md)**: Generating JSON and structured formats
- **[Function Calling Guide](docs/gemini_references/function-calling.md)**: Using function calling with Gemini

## Development Environment Setup

- Run `npm run dev` to start the development server
- Use `npm run db:push` to migrate database schema changes
- For testing Gemini API changes, use the test scripts in project root (e.g., `test-gemini-adapter.js`)
- Test image upload handling with small images (< 5MB) using data URIs
- For larger files, use the Files API with proper MIME type specification
- Run tests with `npm test` before submitting changes

## File Structure Conventions

Key directories to understand:
- `/server/adapters`: Contains all AI service adapters, including Gemini
- `/server/utils`: Contains essential utilities including `gemini-file-handler.ts`
- `/server/services`: Business logic including `ai-service.ts`
- `/docs/gemini_references`: All Gemini API documentation
- `/shared/schema.ts`: Data models and shared types

## Effective Prompt Design Guidelines

When designing prompts, follow these principles from the [Prompting Strategies Guide](docs/gemini_references/prompting-strategies.md):

1. **Be clear and specific**: Provide explicit instructions to minimize ambiguity
2. **Use few-shot examples**: Include 2-3 examples to demonstrate desired outputs
3. **Add relevant context**: Provide necessary background information
4. **Format responses appropriately**: Request specific output formats (JSON, markdown)
5. **Break down complex tasks**: Divide multi-step assignments into smaller components
6. **Apply constraints**: Set explicit boundaries on response length, style, etc.

## Multimodal Content Processing

When working with images, documents, and other media:

1. **Use data URIs for small images**: For images under 5MB, convert to base64 data URIs
2. **Use Files API for larger content**: For files over 5MB, use the Gemini Files API
3. **Always specify content types**: Include MIME types with all file uploads
4. **Validate file formats**: Check file extensions and MIME types before processing
5. **Handle binary data properly**: Use Buffer for binary content and ensure proper encoding

## Gemini API Configuration

Configure the Gemini API with these parameters:

1. **Temperature**: Use 0.2-0.4 for factual assessment, 0.7-0.9 for creative feedback
2. **TopP**: Default to 0.95 for most educational assessment tasks
3. **Max tokens**: 800-1500 for standard feedback, 2000+ for detailed analyses
4. **Response format**: Set `responseMimeType` to "application/json" for structured outputs
5. **System instructions**: Use to set global behavioral constraints

## PR Requirements

When submitting changes:

1. **Testing**: All changes must pass existing tests and include new tests for added functionality
2. **Documentation**: Update relevant docs in `/docs/gemini_references/` when changing API behavior
3. **Error handling**: Implement robust error handling for API failures
4. **Performance**: Consider token usage and optimize prompts for efficiency
5. **Accessibility**: Ensure all feedback is clearly formatted and easy to understand

## Best Practices for AI Assessment

When implementing AI-powered grading:

1. **Follow rubric criteria**: Ensure feedback aligns with defined rubric criteria
2. **Provide actionable feedback**: Give specific suggestions for improvement
3. **Balance criticism with encouragement**: Highlight strengths while addressing weaknesses
4. **Be evidence-based**: Reference specific parts of submissions in feedback
5. **Maintain consistency**: Use consistent evaluation standards across submissions

## Implementing Gemini Functionality

When writing code that uses Gemini:

1. **Use the adapter pattern**: All AI interactions should go through the adapter interface
2. **Implement robust error handling**: Catch and handle API errors gracefully
3. **Handle multimodal content correctly**: Use established patterns for image and document processing
4. **Cache responses when appropriate**: Use Redis caching for identical prompts
5. **Track token usage**: Log consumption for monitoring and optimization

## Internal Implementation Details

Implementation specifics:
- Gemini adapter follows the adapter pattern defined in `server/adapters/interfaces.ts`
- File handling utilities in `server/utils/gemini-file-handler.ts` handle data URIs and Files API
- Response schemas follow the formats defined in `server/schemas/gradingSchema.ts`
- Token usage tracking implemented in adapter response handling

For detailed information on architecture and implementation, refer to:
- [Server Documentation](server/README.md)
- [Gemini Adapter Improvements](gemini_adapter_improvements.md)