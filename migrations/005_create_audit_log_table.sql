-- Migration: 005_create_audit_log_table
-- Description: Creates audit log for tracking important actions
-- Created: 2024-05-10

CREATE TYPE audit_action AS ENUM (
    'create',
    'read',
    'update',
    'delete',
    'login',
    'logout',
    'password_change',
    'permission_change'
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Partition table by month for better performance
-- CREATE TABLE audit_logs_2024_05 PARTITION OF audit_logs
--     FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Index for JSONB queries
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING gin(metadata);

-- Down migration
-- DROP TABLE IF EXISTS audit_logs;
-- DROP TYPE IF EXISTS audit_action;
