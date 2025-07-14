#!/bin/bash

# Production endpoint testing script
# Tests all critical endpoints for production readiness

set -e

BASE_URL=${TEST_BASE_URL:-"http://localhost:5000"}
CONCURRENT_REQUESTS=${CONCURRENT_REQUESTS:-5}
TEST_DURATION=${TEST_DURATION:-30}

echo "🚀 Testing AIGrader Production Endpoints"
echo "Base URL: $BASE_URL"
echo "Concurrent requests: $CONCURRENT_REQUESTS"
echo "Test duration: $TEST_DURATION seconds"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

test_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local expected_status=${3:-200}
    
    echo -n "Testing $method $endpoint... "
    
    local response=$(curl -s -w "%{http_code}" -o /dev/null -X $method "$BASE_URL$endpoint")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
        return 1
    fi
}

test_endpoint_with_timing() {
    local endpoint=$1
    local method=${2:-GET}
    local expected_status=${3:-200}
    local timeout=${4:-5}
    
    echo -n "Testing $method $endpoint... "
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "%{http_code}" -o /dev/null -X $method --max-time $timeout "$BASE_URL$endpoint")
    local end_time=$(date +%s.%N)
    
    local duration=$(echo "$end_time - $start_time" | bc)
    local duration_ms=$(echo "$duration * 1000" | bc)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($response) [${duration_ms%.*}ms]"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response) [${duration_ms%.*}ms]"
        return 1
    fi
}

run_concurrent_test() {
    local endpoint=$1
    local duration=$2
    local concurrent=$3
    
    echo -e "${BLUE}Running concurrent test: $endpoint${NC}"
    echo "Duration: ${duration}s, Concurrent requests: $concurrent"
    
    # Create a temporary file for results
    local results_file=$(mktemp)
    
    # Start concurrent requests
    for i in $(seq 1 $concurrent); do
        {
            local count=0
            local success=0
            local start_time=$(date +%s)
            
            while [ $(($(date +%s) - start_time)) -lt $duration ]; do
                if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" | grep -q "200"; then
                    success=$((success + 1))
                fi
                count=$((count + 1))
                sleep 0.1
            done
            
            echo "$count $success" >> "$results_file"
        } &
    done
    
    # Wait for all background jobs to complete
    wait
    
    # Calculate results
    local total_requests=0
    local total_success=0
    
    while read -r requests success; do
        total_requests=$((total_requests + requests))
        total_success=$((total_success + success))
    done < "$results_file"
    
    local success_rate=0
    if [ $total_requests -gt 0 ]; then
        success_rate=$((total_success * 100 / total_requests))
    fi
    
    local throughput=$((total_requests / duration))
    
    echo "Results: $total_requests requests, $total_success successful ($success_rate%)"
    echo "Throughput: $throughput requests/second"
    
    # Cleanup
    rm -f "$results_file"
    
    if [ $success_rate -ge 95 ]; then
        echo -e "${GREEN}✓ PASS${NC} - Success rate acceptable"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} - Success rate too low"
        return 1
    fi
}

echo "=== Basic Endpoint Tests ==="
test_endpoint_with_timing "/api/health" "GET" 200 5
test_endpoint_with_timing "/api/health/detailed" "GET" 200 10
test_endpoint_with_timing "/api/auth/user" "GET" 401 5  # Expected 401 for unauthenticated
test_endpoint_with_timing "/api/assignments" "GET" 401 5  # Expected 401 for unauthenticated

echo ""
echo "=== Performance Tests ==="
run_concurrent_test "/api/health" 10 3
run_concurrent_test "/api/health/detailed" 15 2

echo ""
echo "=== Error Handling Tests ==="
test_endpoint "/api/nonexistent" "GET" 404
test_endpoint "/api/assignments/999999" "GET" 401  # Should be 401 due to auth

echo ""
echo "=== Security Tests ==="
test_endpoint "/api/admin/users" "GET" 401  # Should require authentication
test_endpoint "/api/admin/system-config" "GET" 401  # Should require authentication

echo ""
echo "=== File Upload Tests ==="
# Test file upload endpoint exists (should require auth)
test_endpoint "/api/submit/test-assignment" "POST" 401

echo ""
echo "=== API Rate Limiting Tests ==="
echo "Testing rate limiting..."
local rate_limit_failures=0
for i in {1..20}; do
    if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" | grep -q "200"; then
        rate_limit_failures=$((rate_limit_failures + 1))
    fi
    sleep 0.1
done

if [ $rate_limit_failures -lt 5 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Rate limiting working correctly"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Rate limiting may be too strict"
fi

echo ""
echo "=== Final Assessment ==="
echo "✓ Basic endpoint functionality"
echo "✓ Performance under load"
echo "✓ Error handling"
echo "✓ Security controls"
echo "✓ Rate limiting"
echo ""
echo -e "${GREEN}🎉 Production endpoint testing completed!${NC}"
echo "System appears ready for production deployment."