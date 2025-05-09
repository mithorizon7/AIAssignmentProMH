#!/bin/bash

# Optimized build script for production
# This script enhances the default build process with optimizations

echo "🚀 Starting optimized production build..."

# Set environment to production for better optimizations
export NODE_ENV=production

# Step 1: Build the client with Vite
echo "📦 Building client with Vite..."
npx vite build --mode production

# Step 2: Build the server with ESBuild with optimizations
echo "📦 Building server with ESBuild..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --minify \
  --tree-shaking=true \
  --target=es2020 \
  --sourcemap=production

echo "✅ Production build completed!"
echo "   - Client files in dist/public/"
echo "   - Server files in dist/"
echo ""
echo "🚀 Run with: NODE_ENV=production node dist/index.js"