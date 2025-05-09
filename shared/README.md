# AI Feedback Platform - Shared

This directory contains shared code and types used by both the client and server.

## Purpose

The shared directory ensures consistency between frontend and backend by:

1. Defining a single source of truth for data models
2. Sharing common enumerations and constants
3. Providing type safety across the application

## Key Files

### schema.ts

`schema.ts` defines the database schema and types using Drizzle ORM:

- Database table definitions with column types
- Interface definitions for key entities (Rubric, RubricCriterion, etc.)
- Type exports for client and server usage
- Insert schemas using `drizzle-zod` for validation

### enums.ts

`enums.ts` contains shared enumeration types:

- `FEEDBACK_TYPE`: Types of feedback (strengths, improvements, suggestions)
- `RUBRIC_CRITERIA_TYPE`: Types of rubric criteria
- TypeScript type definitions for type safety

## Usage

### In Server Code

```typescript
import { users, assignments, User, Assignment } from '@shared/schema';
import { FEEDBACK_TYPE } from '@shared/enums';
```

### In Client Code

```typescript
import { Rubric, RubricCriterion } from '@shared/schema';
import * as SharedEnums from '@shared/enums';
```

## Benefits

1. **Type Safety**: TypeScript ensures that data structures match between client and server
2. **Consistency**: Single source of truth for data models
3. **Maintainability**: Changes to the schema are reflected everywhere
4. **Developer Experience**: IntelliSense/autocomplete for shared types

## Type Generation

The types in this directory inform the Drizzle ORM for:

- Database schema migrations
- Runtime type checking
- Type-safe database queries

## Development Notes

When modifying shared types:

1. Update both the type definition and the database schema
2. Run migrations with `npm run db:push` to apply schema changes
3. Verify that client components using these types still compile