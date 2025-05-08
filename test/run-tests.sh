#!/bin/bash

# Test runner script for various test types

show_help() {
  echo "AI Assignment Feedback - Test Runner"
  echo ""
  echo "Usage: ./test/run-tests.sh [command]"
  echo ""
  echo "Commands:"
  echo "  all         Run all tests"
  echo "  unit        Run unit tests only"
  echo "  integration Run integration tests only"
  echo "  components  Run component tests only"
  echo "  e2e         Run end-to-end tests only"
  echo "  coverage    Run all tests with coverage report"
  echo "  watch       Run tests in watch mode"
  echo "  help        Show this help message"
  echo ""
}

run_unit_tests() {
  echo "Running unit tests..."
  npx vitest run test/unit
}

run_integration_tests() {
  echo "Running integration tests..."
  npx vitest run test/integration
}

run_component_tests() {
  echo "Running component tests..."
  npx vitest run test/components
}

run_e2e_tests() {
  echo "Running end-to-end tests..."
  npx vitest run test/e2e
}

run_all_tests() {
  echo "Running all tests..."
  npx vitest run
}

run_coverage() {
  echo "Running tests with coverage..."
  npx vitest run --coverage
}

run_watch_mode() {
  echo "Running tests in watch mode..."
  npx vitest
}

# Parse command line arguments
case "$1" in
  "unit")
    run_unit_tests
    ;;
  "integration")
    run_integration_tests
    ;;
  "components")
    run_component_tests
    ;;
  "e2e")
    run_e2e_tests
    ;;
  "all")
    run_all_tests
    ;;
  "coverage")
    run_coverage
    ;;
  "watch")
    run_watch_mode
    ;;
  "help")
    show_help
    ;;
  *)
    show_help
    ;;
esac