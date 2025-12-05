-- Migration: Add organizational structure fields and new manager roles
-- Date: 2024-12-04
-- Purpose: Support hierarchical management with division, region, location tracking

-- Add organizational fields to users table
ALTER TABLE users ADD COLUMN division TEXT;
ALTER TABLE users ADD COLUMN region TEXT;
ALTER TABLE users ADD COLUMN location TEXT;
ALTER TABLE users ADD COLUMN title TEXT;

-- Add indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_users_division ON users(division);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Note: Role enum now supports:
-- 'admin', 'boss', 'consultant', 'region_manager', 'business_unit_manager'
-- SQLite doesn't have enum types, so we use TEXT with application-level validation
