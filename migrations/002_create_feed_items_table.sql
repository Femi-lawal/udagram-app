-- Migration: 002_create_feed_items_table
-- Description: Creates the feed_items table for storing posts/images
-- Created: 2024-04-20

CREATE TABLE IF NOT EXISTS feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    caption TEXT,
    image_url TEXT NOT NULL,
    image_key VARCHAR(500), -- S3 object key
    thumbnail_url TEXT,
    content_type VARCHAR(100),
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    is_public BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_feed_items_user_id ON feed_items(user_id);
CREATE INDEX idx_feed_items_created_at ON feed_items(created_at DESC);
CREATE INDEX idx_feed_items_is_public ON feed_items(is_public) WHERE is_deleted = false;
CREATE INDEX idx_feed_items_is_deleted ON feed_items(is_deleted);

-- Full-text search index on caption
CREATE INDEX idx_feed_items_caption_fts ON feed_items 
    USING gin(to_tsvector('english', COALESCE(caption, '')));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_feed_items_updated_at
    BEFORE UPDATE ON feed_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Down migration
-- DROP TRIGGER IF EXISTS update_feed_items_updated_at ON feed_items;
-- DROP TABLE IF EXISTS feed_items;
