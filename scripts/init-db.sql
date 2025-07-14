-- Initialize database for horizontal scaling testing
-- This script sets up the database schema for Docker Compose deployment

-- Create extension for UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE aigrader TO postgres;

-- Note: The actual table schema will be created by Drizzle migrations
-- This file just ensures the database is properly initialized