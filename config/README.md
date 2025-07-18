# Configuration Directory

This directory contains configuration files for various tools and services used in the AIGrader project.

## Build & Deployment Configuration
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Docker Compose orchestration
- `nginx.conf` - Nginx reverse proxy configuration
- `ecosystem.config.js` - PM2 process manager configuration
- `axial-chemist-459819-h4-5c8a24efbaed.json` - Google Cloud service account credentials

## Development Tools Configuration
- `eslint.config.js` - ESLint code quality configuration
- `postcss.config.js` - PostCSS build configuration  
- `tailwind.config.ts` - Tailwind CSS styling configuration
- `lint-staged.config.js` - Pre-commit hooks configuration

## Testing Configuration
- `vitest.config.ts` - Main Vitest test runner configuration
- `vitest.ai-feedback.config.ts` - AI feedback specific test configuration

## UI Components
- `components.json` - Shadcn UI components configuration

## Usage Notes

Configuration files in this directory are referenced by their respective tools. Most tools expect configuration files in the project root, but they have been organized here for better project structure while maintaining proper tool references.

Key configuration files that must remain in the project root:
- `tsconfig.json` - TypeScript compiler configuration
- `vite.config.ts` - Vite build tool configuration  
- `drizzle.config.ts` - Database ORM configuration
- `package.json` - Node.js project configuration