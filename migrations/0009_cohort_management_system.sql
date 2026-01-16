-- Migration 0009: Cohort Management System
-- Creates tables for cohort groups, members, and pathway assignments with deadlines

-- Create cohort_groups table
CREATE TABLE IF NOT EXISTS cohort_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Create cohort_members table (users can belong to multiple cohorts)
CREATE TABLE IF NOT EXISTS cohort_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (cohort_id) REFERENCES cohort_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(cohort_id, user_id)
);

-- Create cohort_pathways table (cohorts assigned to learning paths with deadlines)
CREATE TABLE IF NOT EXISTS cohort_pathways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER NOT NULL,
  pathway_id INTEGER NOT NULL,
  deadline DATE,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (cohort_id) REFERENCES cohort_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE(cohort_id, pathway_id)
);

-- Add cohort_id to user_progress to track which cohort context
ALTER TABLE user_progress ADD COLUMN cohort_id INTEGER REFERENCES cohort_groups(id);

-- Add cohort_id to pathway_enrollments for tracking
ALTER TABLE pathway_enrollments ADD COLUMN cohort_id INTEGER REFERENCES cohort_groups(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort ON cohort_members(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_user ON cohort_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_pathways_cohort ON cohort_pathways(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_pathways_pathway ON cohort_pathways(pathway_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_cohort ON user_progress(cohort_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_cohort ON pathway_enrollments(cohort_id);

-- Create default "Legacy" cohort for existing enrollments
INSERT INTO cohort_groups (id, name, description, manager_id, active)
VALUES (1, 'Legacy Enrollments', 'Auto-created cohort for existing pathway enrollments before cohort system', NULL, 1);

-- Migrate existing pathway_enrollments to Legacy cohort
UPDATE pathway_enrollments 
SET cohort_id = 1 
WHERE cohort_id IS NULL AND status = 'approved';

-- Create cohort_members entries for all users in Legacy cohort
INSERT OR IGNORE INTO cohort_members (cohort_id, user_id, joined_at)
SELECT DISTINCT 1, user_id, requested_at
FROM pathway_enrollments
WHERE cohort_id = 1 AND status = 'approved';

-- Create cohort_pathways entries for all pathways in Legacy cohort
INSERT OR IGNORE INTO cohort_pathways (cohort_id, pathway_id, assigned_at)
SELECT DISTINCT 1, pathway_id, MIN(requested_at)
FROM pathway_enrollments
WHERE cohort_id = 1 AND status = 'approved'
GROUP BY pathway_id;

-- Update user_progress to set cohort_id to Legacy for existing records
UPDATE user_progress
SET cohort_id = 1
WHERE cohort_id IS NULL;
