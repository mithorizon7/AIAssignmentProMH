#!/bin/bash

# Optimized build script for production
# This script enhances the default build process with optimizations

echo "🚀 Starting optimized production build..."

# Set environment to production for better optimizations
export NODE_ENV=production

# Step 0: Install required production optimization packages
echo "📦 Installing production optimization packages..."
npm list compression > /dev/null 2>&1 || npm install --no-save compression

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

# Step 3: Validate build output
echo "🔍 Validating build output..."
if [ ! -f "dist/index.js" ]; then
  echo "❌ Error: Server build failed - dist/index.js not found"
  exit 1
fi

if [ ! -d "dist/public" ]; then
  echo "❌ Error: Client build failed - dist/public directory not found"
  exit 1
fi

# Step 4: Optimize assets (optional - for more advanced optimizations)
# echo "📦 Optimizing static assets..."
# if command -v find > /dev/null && command -v du > /dev/null; then
#   echo "   Before optimization: $(du -sh dist/public | cut -f1)"
#   # Add image optimization or other post-processing here if needed
#   echo "   After optimization: $(du -sh dist/public | cut -f1)"
# fi

echo "✅ Production build completed!"
echo "   - Client files in dist/public/"
echo "   - Server files in dist/"
echo ""
echo "🚀 Run with: NODE_ENV=production node dist/index.js"
echo ""
echo "💡 For maximum performance ensure compression and cache headers are enabled"