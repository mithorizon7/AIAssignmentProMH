# AIGrader - Agent Contributor Guide

This guide provides instructions for AI agents working on the AIGrader codebase. AIGrader is an AI-powered assignment feedback platform.

## Overview

The AIGrader platform is designed to enhance educational workflows through intelligent error handling and robust parsing mechanisms, scaling for large classes.

-   **Main Project README**: For a comprehensive overview of the project, features, technology stack, and setup, please refer to the main [AIGrader/README.md](README.md).
-   **Directory Structure**: A detailed directory structure is available in the main [README.md](README.md). Familiarize yourself with the `client/`, `server/`, `shared/`, and `test/` directories. Each major directory contains its own detailed README:
    -   [Server Documentation](server/README.md)
    -   [Client Documentation](client/README.md)
    -   [Shared Types Documentation](shared/README.md) (describes `shared/schema.ts` and `shared/enums.ts`)
    -   [Testing Documentation](test/README.md)

## Critical AI Integration & Gemini API Usage

**This is the most critical section for tasks involving AI functionality.**

The AIGrader platform heavily utilizes Google's Gemini model for AI-driven feedback. All development, modification, or debugging related to AI capabilities, especially concerning the Gemini API, **MUST** start by consulting the dedicated documentation in the `docs/gemini_references/` directory.

-   **Primary AI Documentation Hub**: [AIGrader Documentation Overview](docs/README.md). This file provides a high-level map of all documentation.
-   **Gemini API References**: The **MOST IMPORTANT** set of documents for any AI-related task. Located in [docs/gemini_references/](docs/gemini_references/).
    -   **Index**: Start with [docs/gemini_references/index.md](docs/gemini_references/index.md) for an overview of all Gemini API topics.
    -   **Key Gemini Topics**: Pay close attention to documents covering:
        -   [Text Generation](docs/gemini_references/text-generation.md)
        -   [Image Understanding](docs/gemini_references/image-understanding.md)
        -   [Document Understanding (PDFs, etc.)](docs/gemini_references/document-understanding.md)
        -   [Structured Output (JSON)](docs/gemini_references/structured-output.md)
        -   [Files API Overview (for uploads)](docs/gemini_references/files-api-overview.md)
        -   [Parts and Content (multi-part requests)](docs/gemini_references/parts-and-content.md)
        -   [Function Calling](docs/gemini_references/function-calling.md)
        -   [Code Execution](docs/gemini_references/code-execution.md)
        -   [Caching](docs/gemini_references/caching.md)
        -   [Schema Reference](docs/gemini_references/schema-reference.md)
-   **AI Adapters**: The core logic for AI service interaction is in `server/adapters/`.
    -   The primary Gemini adapter is located at `server/adapters/gemini-adapter.ts`.
    -   The general AI adapter interface is `server/adapters/ai-adapter.ts`.
    -   When modifying AI behavior, ensure changes align with the patterns and documentation referenced above.

**Before implementing any changes to AI features, verify your understanding by reviewing the relevant `docs/gemini_references/` documents.**

## Dev Environment & Setup

-   **Prerequisites**: Ensure Node.js and PostgreSQL are installed.
-   **Installation**:
    ```bash
    npm install
    ```
   
-   **Environment Variables**: Copy `.env.example` to `.env` and configure as needed. Critical variables include `NODE_ENV`, `GEMINI_API_KEY`, `DATABASE_URL`, and Redis settings. See [AIGrader/README.md](README.md) for more details.
-   **Database Setup**:
    ```bash
    npm run db:push
    ```
   
-   **Development Server**:
    ```bash
    npm run dev
    ```
    (This runs both backend and frontend with hot reloading).

## Testing Instructions

Comprehensive testing is crucial. Refer to the [Testing Strategy Document](test/README.md) for full details.

-   **Running All Tests**:
    ```bash
    ./test/run-tests.sh all
    ```
   
    Alternatively, from `package.json`:
    ```bash
    npm test
    ```
-   **Specific Test Types** (using the shell script in `test/` directory):
    ```bash
    ./test/run-tests.sh unit
    ./test/run-tests.sh integration
    ./test/run-tests.sh components
    ./test/run-tests.sh e2e
    ```
   
-   **Linting**:
    ```bash
    npm run lint
    ```
    (from `package.json`, though not explicitly listed in `AGENTS.md` example, it's a common validation step)
-   **Type Checking**:
    ```bash
    npm run typecheck
    ```
    (from `package.json`) or `npm run check`
-   **Testing Tools**: Vitest, React Testing Library, Mock Service Worker (MSW), Supertest.
-   **Validation**:
    -   All code changes should pass relevant tests.
    -   Fix any test or type errors until the entire suite is green for the affected package or in general.
    -   After moving files or changing imports, run `npm run lint` to ensure ESLint and TypeScript rules still pass.
    -   Add or update tests for the code you change, even if not explicitly asked.

## Code Style and Contributions

-   Follow existing code style and patterns.
-   Ensure new code is well-documented, especially public APIs and complex logic.
-   When making changes to AI integration or file processing, update the relevant documentation in `docs/gemini_references/` or other READMEs.

## PR (Pull Request) Instructions

-   **Title Format**: `[area_of_code] Brief description of changes` (e.g., `[server/gemini] Fix for file upload handling`)
-   **Description**:
    -   Clearly describe the problem and the solution.
    -   Reference any relevant issue numbers.
    -   Detail how to test the changes.
    -   **Explicitly state which `docs/gemini_references/` documents were consulted if the changes involve AI/Gemini API features.**
-   Ensure all tests and linters pass before submitting a PR.

## How to Work in This Repository

1.  **Understand the Task**: Clarify the requirements.
2.  **Consult Documentation**:
    -   For general structure, refer to the main [README.md](README.md) and specific directory READMEs (`server/`, `client/`, etc.).
    -   **For ANY AI-related tasks (Gemini API, prompts, AI feedback logic), ALWAYS start with [docs/README.md](docs/README.md) and dive deep into the relevant files within [docs/gemini_references/](docs/gemini_references/).**
3.  **Locate Relevant Code**: Use the directory structure and READMEs to find the modules you need to modify.
4.  **Implement Changes**: Write clear, maintainable code.
5.  **Test Thoroughly**: Run relevant unit, integration, and/or e2e tests. Add new tests as needed. Refer to [test/README.md](test/README.md).
6.  **Validate**: Run linters (`npm run lint`) and type checkers (`npm run check` or `npm run typecheck`).
7.  **Document**: Update any necessary documentation, especially for AI changes.
8.  **Prepare PR**: Follow the PR instructions above.

If you need to work with specific files like those related to the Gemini adapter (`server/adapters/gemini-adapter.ts`), ensure you cross-reference with the documentation in `docs/gemini_references/` to understand the expected behavior and API usage.