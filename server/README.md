# AI Feedback Platform - Server

This directory contains the backend server code for the AI-powered assignment feedback platform.

## Architecture Overview

The server is built with Express.js and follows a modular architecture pattern:

```
server/
├── adapters/           # AI service adapters (Gemini, OpenAI)
├── config/             # Environment-specific configurations
├── lib/                # Utility libraries and helpers
├── queue/              # BullMQ queue implementation
├── routes.ts           # API route definitions
├── services/           # Business logic services
├── storage.ts          # Data access layer
├── auth.ts             # Authentication configuration
├── db.ts               # Database connection
├── index.ts            # Application entry point
└── vite.ts             # Vite integration for development
```

## Key Components

### Adapters

The adapter pattern allows for interchangeable AI services:

- `adapters/ai-adapter.ts`: Interface defining the contract for AI services
- `adapters/gemini-adapter.ts`: Implementation using Google's Gemini API
- `adapters/openai-adapter.ts`: Alternative implementation using OpenAI's API

For comprehensive documentation on Gemini API integration, refer to the [Gemini API References](/docs/gemini_references/index.md) which includes detailed guides for:

- File handling and uploads
- Image and document processing
- Multipart content handling
- Function calling
- Code execution
- Schema definitions and more

### Services

Services implement core business logic:

- `services/ai-service.ts`: Handles AI interaction, prompt construction, and response parsing
- `services/storage-service.ts`: Provides higher-level data operations
- `services/batch-operations.ts`: Manages bulk data processing

### Queue System

The queue system provides reliable asynchronous processing:

- `queue/redis.ts`: Redis client configuration with development fallback
- `queue/bullmq-submission-queue.ts`: BullMQ implementation for assignment processing
- `queue/worker.ts`: Compatibility wrapper for legacy code
- `queue/dashboard.ts`: Bull Dashboard UI for queue monitoring

### Error Handling

Robust error handling is implemented through:

- `lib/error-handler.ts`: Centralized error handling middleware
- Custom error classes for different error types
- Structured logging

## API Authentication and Authorization

The server uses session-based authentication with different access levels:

- **Public routes**: Available to unauthenticated users
- **Authenticated routes**: Require valid session
- **Role-based routes**: Require specific user roles (student, instructor, admin)

CSRF protection is implemented for all state-changing operations.

## Database Access

Database access is implemented through:

- Drizzle ORM for type-safe database interactions
- Connection pooling for efficient database usage
- PostgreSQL as the database engine

## Environment Variables

The server depends on several environment variables:

- Database configuration: `DATABASE_URL`, `PGHOST`, etc.
- Redis configuration: `REDIS_URL`, `ENABLE_REDIS`, etc.
- AI API keys: `GEMINI_API_KEY`, `OPENAI_API_KEY`
- Session management: `SESSION_SECRET`
- Application mode: `NODE_ENV`

See the root `.env.example` file for all required environment variables.

## Development

To run the server in development mode:

```bash
npm run dev
```

This starts both the Express server and the Vite development server for the client.