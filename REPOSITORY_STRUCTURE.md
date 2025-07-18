# Repository Structure

AIGrader follows professional repository organization standards for scalability and maintainability.

## Directory Structure

```
├── client/                 # Frontend application (React + TypeScript)
├── server/                 # Backend application (Express + Node.js)
├── shared/                 # Shared types and schemas
├── docs/                   # Documentation (organized by audience)
├── config/                 # Configuration files for tools and services
├── assets/                 # Static assets (images, icons, etc.)
├── tools/                  # Development tools and test scripts
├── scripts/                # Build and deployment scripts
├── tests/                  # Organized test suite
├── archive/                # Historical documentation and reports
├── attached_assets/        # External assets and references
└── dist/                   # Build output (generated)
```

## Core Files

### Root Level (Essential Only)
- `README.md` - Main project documentation
- `CHANGELOG.md` - Version history
- `replit.md` - Repository context and preferences
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build tool configuration
- `drizzle.config.ts` - Database ORM configuration
- `.env.example` - Environment variable template

### Source Code
- **`client/`** - React frontend with TypeScript and Tailwind CSS
- **`server/`** - Express backend with comprehensive API and services
- **`shared/`** - Type-safe schemas and interfaces used by both frontend and backend

### Documentation
- **`docs/`** - Professional documentation organized by:
  - User guides and feature documentation
  - Developer technical documentation
  - Operations and deployment guides
  - Archive of historical reports

### Configuration Management
- **`config/`** - Centralized configuration for:
  - Docker and deployment (Dockerfile, docker-compose.yml)
  - Development tools (ESLint, PostCSS, Tailwind)
  - Testing frameworks (Vitest configurations)
  - External services (Google Cloud credentials)

### Development Support
- **`tools/`** - Development utilities and validation scripts
- **`scripts/`** - Build, deployment, and maintenance scripts
- **`assets/`** - Static assets accessible via import aliases

## Benefits of This Structure

### 🎯 **Professional Standards**
- Clear separation of concerns
- Logical grouping of related files
- Industry-standard directory naming

### 🔍 **Developer Experience**
- Easy navigation and file discovery
- Consistent organization across all areas
- Clear documentation for each section

### 🚀 **Scalability**
- Room for growth in each category
- Modular structure supports team development
- Configuration centralization

### 🛠 **Maintainability**
- Historical documentation preserved but organized
- Tools and utilities clearly separated
- Configuration changes centrally managed

## Migration Notes

This structure was created from a previously disorganized repository with 80+ files in the root directory. All functionality has been preserved while dramatically improving organization and professional presentation.

Core development files remain in their expected locations for tool compatibility, while auxiliary files have been properly organized into logical directories.