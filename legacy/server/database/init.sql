-- Database initialization script for Drone Derby
-- This script is run automatically by Docker on first startup

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable full-text search extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database user for the application (if needed)
-- Note: In Docker, the main user is already created via environment variables

-- Performance optimizations
-- Set some PostgreSQL configuration for better performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking more than 1 second

-- Restart is required for some settings, but we'll handle that in production

-- Create indexes that might be useful for full-text search later
-- (These will be added after tables are created by migrations)

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Drone Derby database initialization completed successfully';
END
$$;