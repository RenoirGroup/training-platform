-- Migration: Add language preference support
-- Created: 2025-12-04
-- Description: Add preferred_language column to users table for multi-language support

-- Add preferred_language column to users table
ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en-US';

-- Update existing users to default language
UPDATE users SET preferred_language = 'en-US' WHERE preferred_language IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language);
