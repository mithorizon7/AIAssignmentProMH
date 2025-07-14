# Multi-stage Dockerfile for Horizontal Scaling
# Optimized for production deployment with minimal image size

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/shared ./shared
COPY --from=builder --chown=nextjs:nodejs /app/client ./client

# Copy configuration files
COPY --chown=nextjs:nodejs ecosystem.config.js ./
COPY --chown=nextjs:nodejs drizzle.config.ts ./
COPY --chown=nextjs:nodejs package.json ./

# Create logs directory
RUN mkdir -p logs && chown -R nextjs:nodejs logs

# Create temp directory for file processing
RUN mkdir -p temp && chown -R nextjs:nodejs temp

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 5000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Environment variables for production
ENV NODE_ENV=production
ENV PORT=5000
ENV NPM_CONFIG_CACHE=/tmp/.npm

# Start command
CMD ["npm", "start"]