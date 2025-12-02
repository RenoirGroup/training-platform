-- Migration 0002: Pathways System
-- Add support for multiple learning pathways (like Duolingo's language courses)

-- Pathways table: Different learning journeys (Operations, Strategy, etc.)
CREATE TABLE IF NOT EXISTS pathways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,  -- Font Awesome icon class or emoji
  color_primary TEXT,  -- Hex color for visual distinction
  color_secondary TEXT,  -- Secondary color for gradients
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pathway enrollments: Which consultants are enrolled in which pathways
-- Includes approval workflow: consultant requests → boss approves
CREATE TABLE IF NOT EXISTS pathway_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pathway_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  request_note TEXT,  -- Consultant's reason for enrollment
  response_note TEXT,  -- Boss's approval/rejection note
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by INTEGER,  -- Boss user_id who approved/rejected
  enrolled_by INTEGER,  -- Who initiated: consultant (self) or boss
  active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  FOREIGN KEY (enrolled_by) REFERENCES users(id),
  UNIQUE(user_id, pathway_id)
);

-- Add pathway_id to levels table
-- Levels can belong to one or more pathways (many-to-many via junction table below)
CREATE TABLE IF NOT EXISTS pathway_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pathway_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,  -- Order within this specific pathway
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
  UNIQUE(pathway_id, level_id)
);

-- Recreate user_progress table with pathway_id
-- Progress is tracked separately per pathway, even for shared levels
DROP TABLE IF EXISTS user_progress_backup;
CREATE TABLE user_progress_backup AS SELECT * FROM user_progress;

DROP TABLE IF EXISTS user_progress;
CREATE TABLE user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  pathway_id INTEGER NOT NULL,
  status TEXT DEFAULT 'locked' CHECK(status IN ('locked', 'unlocked', 'in_progress', 'awaiting_signoff', 'completed')),
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  UNIQUE(user_id, level_id, pathway_id)
);

-- Seed default "OXD" pathway
INSERT INTO pathways (title, description, icon, color_primary, color_secondary, order_index, active)
VALUES (
  'OXD',
  'Operational Excellence Development - Core consulting skills and methodologies',
  'fa-chart-line',
  '#1524A9',
  '#0077FF',
  1,
  1
);

-- Assign all existing levels to OXD pathway
INSERT INTO pathway_levels (pathway_id, level_id, order_index)
SELECT 1, id, order_index FROM levels WHERE active = 1;

-- Migrate existing user progress to OXD pathway
INSERT INTO user_progress (user_id, level_id, pathway_id, status, started_at, completed_at)
SELECT 
  user_id, 
  level_id, 
  1 as pathway_id,  -- OXD pathway
  status, 
  started_at, 
  completed_at
FROM user_progress_backup;

-- Auto-approve all existing consultants for OXD pathway
INSERT INTO pathway_enrollments (user_id, pathway_id, status, requested_at, reviewed_at, enrolled_by)
SELECT 
  id as user_id,
  1 as pathway_id,
  'approved' as status,
  CURRENT_TIMESTAMP as requested_at,
  CURRENT_TIMESTAMP as reviewed_at,
  id as enrolled_by  -- Self-enrolled (migration)
FROM users 
WHERE role = 'consultant' AND active = 1;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_user ON pathway_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_pathway ON pathway_enrollments(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_status ON pathway_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_pathway_levels_pathway ON pathway_levels(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_levels_level ON pathway_levels(level_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_pathway ON user_progress(pathway_id);
