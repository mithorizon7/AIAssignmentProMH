#!/bin/bash

# Production deployment script for AIGrader
# This script validates the environment and deploys the application to production

set -e  # Exit on any error

echo "🚀 Starting AIGrader production deployment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it with the required environment variables."
    exit 1
fi

# Load environment variables
source .env

print_status "Validating environment configuration..."

# Check required environment variables
REQUIRED_VARS=(
    "NODE_ENV"
    "DATABASE_URL"
    "SESSION_SECRET"
    "CSRF_SECRET"
    "GEMINI_API_KEY"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

# Validate NODE_ENV is set to production
if [ "$NODE_ENV" != "production" ]; then
    print_error "NODE_ENV must be set to 'production' for production deployment"
    exit 1
fi

# Check if SESSION_SECRET and CSRF_SECRET are long enough
if [ ${#SESSION_SECRET} -lt 32 ]; then
    print_error "SESSION_SECRET must be at least 32 characters long"
    exit 1
fi

if [ ${#CSRF_SECRET} -lt 32 ]; then
    print_error "CSRF_SECRET must be at least 32 characters long"
    exit 1
fi

print_success "Environment validation passed"

# Install dependencies
print_status "Installing production dependencies..."
npm ci --production=false

# Run security audit
print_status "Running security audit..."
npm audit --audit-level=high

# Run TypeScript compilation
print_status "Compiling TypeScript..."
npx tsc --noEmit

# Run tests
print_status "Running tests..."
npm test

# Build the application
print_status "Building application..."
npm run build

# Run database migrations
print_status "Running database migrations..."
npm run db:push

# Start the application with PM2 (if available)
if command -v pm2 &> /dev/null; then
    print_status "Starting application with PM2..."
    pm2 start ecosystem.config.js --env production
    pm2 save
else
    print_warning "PM2 not found. Starting application directly..."
    NODE_ENV=production npm start
fi

print_success "Production deployment completed successfully!"

# Show deployment summary
echo ""
echo "📊 Deployment Summary:"
echo "  - Node.js version: $(node --version)"
echo "  - NPM version: $(npm --version)"
echo "  - Environment: $NODE_ENV"
echo "  - Database: Connected"
echo "  - Redis: ${REDIS_URL:+Connected}"
echo "  - AI Service: ${GEMINI_API_KEY:+Gemini} ${OPENAI_API_KEY:+OpenAI}"
echo "  - Storage: ${GCS_BUCKET_NAME:+Google Cloud Storage}"
echo ""
echo "🌐 Application should be running on port ${PORT:-5000}"
echo "🔍 Monitor logs: pm2 logs (if using PM2)"
echo "📈 Health check: curl http://localhost:${PORT:-5000}/api/health"
echo ""
echo "✅ Deployment completed successfully!"