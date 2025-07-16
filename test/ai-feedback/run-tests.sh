#!/bin/bash

# AI Feedback Test Suite Runner
# Comprehensive testing script for the AI feedback system

set -e

echo "🚀 AI Feedback System Test Suite"
echo "=================================="

# Check if required tools are available
command -v npx >/dev/null 2>&1 || { echo "❌ npx is required but not installed. Aborting." >&2; exit 1; }

# Create reports directory
mkdir -p test/reports

# Parse command line arguments
PARALLEL=false
COVERAGE=false
CATEGORY=""
PRIORITY=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --parallel)
      PARALLEL=true
      shift
      ;;
    --coverage)
      COVERAGE=true
      shift
      ;;
    --category=*)
      CATEGORY="${1#*=}"
      shift
      ;;
    --priority=*)
      PRIORITY="${1#*=}"
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --parallel          Run tests in parallel"
      echo "  --coverage          Generate coverage report"
      echo "  --category=CATEGORY Filter by test category (unit|integration|e2e|performance|security)"
      echo "  --priority=PRIORITY Filter by priority (high|medium|low)"
      echo "  --verbose           Verbose output"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "❌ Unknown option $1"
      exit 1
      ;;
  esac
done

# Build vitest command
VITEST_CMD="npx vitest run --config=vitest.ai-feedback.config.ts"

if [ "$COVERAGE" = true ]; then
  VITEST_CMD="$VITEST_CMD --coverage"
fi

if [ "$VERBOSE" = true ]; then
  VITEST_CMD="$VITEST_CMD --reporter=verbose"
else
  VITEST_CMD="$VITEST_CMD --reporter=default"
fi

# Add test file patterns based on category
case $CATEGORY in
  unit)
    VITEST_CMD="$VITEST_CMD test/ai-feedback/gemini-adapter.test.ts"
    ;;
  integration)
    VITEST_CMD="$VITEST_CMD test/ai-feedback/queue-system.test.ts"
    ;;
  e2e)
    VITEST_CMD="$VITEST_CMD test/ai-feedback/*-workflow.test.ts test/ai-feedback/comprehensive-test-suite.test.ts"
    ;;
  performance)
    VITEST_CMD="$VITEST_CMD test/ai-feedback/performance-reliability.test.ts"
    ;;
  security)
    VITEST_CMD="$VITEST_CMD test/ai-feedback/security-compliance.test.ts"
    ;;
  *)
    VITEST_CMD="$VITEST_CMD test/ai-feedback/*.test.ts"
    ;;
esac

echo "📋 Configuration:"
echo "   Parallel: $PARALLEL"
echo "   Coverage: $COVERAGE"
echo "   Category: ${CATEGORY:-all}"
echo "   Priority: ${PRIORITY:-all}"
echo "   Verbose: $VERBOSE"
echo ""

# Run the test suite
echo "🧪 Running AI Feedback tests..."
echo "Command: $VITEST_CMD"
echo ""

START_TIME=$(date +%s)

if eval $VITEST_CMD; then
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  
  echo ""
  echo "✅ All tests completed successfully!"
  echo "⏱️  Total duration: ${DURATION}s"
  
  if [ "$COVERAGE" = true ]; then
    echo "📊 Coverage report generated in test/reports/coverage/"
  fi
  
  exit 0
else
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  
  echo ""
  echo "❌ Some tests failed!"
  echo "⏱️  Total duration: ${DURATION}s"
  echo "📋 Check the output above for details"
  
  exit 1
fi