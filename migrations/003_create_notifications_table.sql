-- Migration: 003_create_notifications_table
-- Description: Creates the notifications table for user notifications
-- Created: 2024-04-25

CREATE TYPE notification_type AS ENUM (
    'feed_created',
    'feed_liked',
    'feed_commented',
    'user_followed',
    'user_mentioned',
    'system_announcement'
);

CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'read',
    'failed'
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    status notification_status DEFAULT 'pending',
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    reference_id UUID, -- ID of related entity (feed_item, user, etc.)
    reference_type VARCHAR(50), -- Type of related entity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, status) 
    WHERE status != 'read';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Down migration
-- DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
-- DROP TABLE IF EXISTS notifications;
-- DROP TYPE IF EXISTS notification_status;
-- DROP TYPE IF EXISTS notification_type;
