-- Udagram Database Initialization Script
-- This script runs when PostgreSQL container starts for the first time
-- Tables are managed by GORM auto-migration, this just creates indexes and test data

-- Enable UUID extension (for generating UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to update updated_at timestamp (used by all tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant permissions (tables will be created by GORM migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO udagram;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO udagram;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Udagram database initialized successfully - GORM will manage table schemas';
END $$;
