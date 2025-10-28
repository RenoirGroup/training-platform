-- Create junction table for many-to-many boss-consultant relationships
CREATE TABLE IF NOT EXISTS boss_consultant_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_id INTEGER NOT NULL,
  consultant_id INTEGER NOT NULL,
  project_name TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (boss_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (consultant_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(boss_id, consultant_id, project_name)
);

CREATE INDEX IF NOT EXISTS idx_boss_consultant_boss ON boss_consultant_relationships(boss_id);
CREATE INDEX IF NOT EXISTS idx_boss_consultant_consultant ON boss_consultant_relationships(consultant_id);

-- Note: The old boss_id column in users table can be kept for backward compatibility
-- or used as the "primary boss" while this table handles additional reporting relationships
