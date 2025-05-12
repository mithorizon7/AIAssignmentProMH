#!/bin/bash

# Set environment variables for tests
export NODE_ENV=test
export SESSION_SECRET="test_session_secret_with_at_least_32_characters"
export CSRF_SECRET="test_csrf_secret_with_at_least_32_characters"

# Run all tests
echo "Running all tests..."
npx vitest run --config ./test/vitest.config.ts

# Run specific test categories if needed
# echo "Running middleware tests..."
# npx vitest run test/middleware --config ./test/vitest.config.ts

# echo "Running auth tests..."
# npx vitest run test/auth --config ./test/vitest.config.ts

# echo "Running integration tests..."
# npx vitest run test/integration --config ./test/vitest.config.ts

# echo "Running client tests..."
# npx vitest run test/client --config ./test/vitest.config.ts