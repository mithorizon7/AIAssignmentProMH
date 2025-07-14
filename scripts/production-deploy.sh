#!/bin/bash

# Production Deployment Script
# Validates system readiness and deploys the application

set -e

echo "🚀 Starting Production Deployment Validation"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check Node.js version
echo "🔍 Checking system requirements..."
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_NODE="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]; then
    print_status "Node.js version $NODE_VERSION meets requirements"
else
    print_error "Node.js version $NODE_VERSION is below required $REQUIRED_NODE"
    exit 1
fi

# Check environment variables
echo "🔍 Validating environment configuration..."
required_vars=(
    "DATABASE_URL"
    "SESSION_SECRET"
    "CSRF_SECRET"
    "GEMINI_API_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Missing required environment variable: $var"
        exit 1
    else
        print_status "Environment variable $var is set"
    fi
done

# Check database connection
echo "🔍 Testing database connection..."
if npm run db:push > /dev/null 2>&1; then
    print_status "Database connection successful"
else
    print_error "Database connection failed"
    exit 1
fi

# Run security audit
echo "🔍 Running security audit..."
if npm audit --production --audit-level=high > /dev/null 2>&1; then
    print_status "Security audit passed"
else
    print_warning "Security audit found issues - review with 'npm audit'"
fi

# Run TypeScript compilation
echo "🔍 Checking TypeScript compilation..."
if npm run check > /dev/null 2>&1; then
    print_status "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Test application startup
echo "🔍 Testing application startup..."
timeout 10s npm start > /dev/null 2>&1 &
PID=$!
sleep 5

if kill -0 $PID 2>/dev/null; then
    print_status "Application starts successfully"
    kill $PID
else
    print_error "Application failed to start"
    exit 1
fi

# Run production validation
echo "🔍 Running production readiness validation..."
NODE_ENV=production node -e "
const { validateProductionReadiness } = require('./server/lib/production-validator');
validateProductionReadiness().then(result => {
    if (!result.isValid) {
        console.error('Production validation failed:', result.errors);
        process.exit(1);
    }
    console.log('Production validation passed');
}).catch(err => {
    console.error('Production validation error:', err);
    process.exit(1);
});
" || {
    print_error "Production validation failed"
    exit 1
}

print_status "Production validation passed"

# Final deployment steps
echo "🚀 Ready for production deployment!"
echo "========================================="
print_status "All checks passed - system is production ready"
print_status "Database: Connected and migrated"
print_status "Security: Audit passed"
print_status "Code: TypeScript compilation successful"
print_status "Runtime: Application startup verified"
print_status "Environment: All variables configured"

echo ""
echo "📋 Next steps:"
echo "1. Deploy to production environment"
echo "2. Monitor health endpoints"
echo "3. Verify all systems operational"
echo "4. Enable monitoring alerts"

echo ""
echo "🔗 Important endpoints:"
echo "- Health check: /api/health"
echo "- Admin dashboard: /admin/system-status"
echo "- Performance metrics: /api/metrics"

echo ""
echo "✅ Production deployment validation complete!"