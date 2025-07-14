/**
 * Lint-staged configuration for optimized pre-commit hooks
 * Only runs checks on staged files for better performance
 */

module.exports = {
  // TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix --max-warnings 0',
    'prettier --write',
    () => 'tsc --noEmit', // Type check all files, not just staged
  ],
  
  // JSON, Markdown, and YAML files
  '*.{json,md,yml,yaml}': [
    'prettier --write',
  ],
  
  // Package.json specifically
  'package.json': [
    'prettier --write',
  ],
  
  // Test files - run tests for changed files
  '*.{test,spec}.{ts,tsx,js,jsx}': [
    'vitest run --reporter=basic',
  ],
  
  // Configuration files
  '*.config.{ts,js}': [
    'prettier --write',
    'eslint --fix',
  ],
  
  // Environment files - security check
  '.env*': [
    () => 'echo "⚠️  Remember: Never commit actual secrets in .env files"',
  ],
};