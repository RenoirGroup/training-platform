-- COMPLETE DATABASE SETUP SCRIPT
-- Copy and paste this entire file into Cloudflare D1 Console

-- Step 1: Create all tables
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'consultant', 'boss')),
  boss_id INTEGER,
  division TEXT,
  region TEXT,
  location TEXT,
  title TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  language_preference TEXT DEFAULT 'en' CHECK(language_preference IN ('en', 'zh')),
  FOREIGN KEY (boss_id) REFERENCES users(id)
);

-- Levels
CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  is_boss_level INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Training materials
CREATE TABLE IF NOT EXISTS training_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT NOT NULL CHECK(material_type IN ('powerpoint', 'video', 'word', 'excel', 'other')),
  sharepoint_url TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
);

-- Tests
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pass_percentage INTEGER DEFAULT 80,
  time_limit_minutes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN ('multiple_choice', 'true_false', 'open_text', 'multi_select', 'fill_blank', 'matching', 'ordering')),
  order_index INTEGER NOT NULL,
  points INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Answer options
CREATE TABLE IF NOT EXISTS answer_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  order_index INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Boss level tasks
CREATE TABLE IF NOT EXISTS boss_level_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL,
  task_description TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
);

-- User progress
CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  pathway_id INTEGER,
  cohort_id INTEGER,
  status TEXT NOT NULL CHECK(status IN ('locked', 'unlocked', 'in_progress', 'completed', 'awaiting_signoff')),
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id),
  FOREIGN KEY (cohort_id) REFERENCES cohort_groups(id),
  UNIQUE(user_id, level_id, pathway_id)
);

-- Test attempts
CREATE TABLE IF NOT EXISTS test_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_id INTEGER NOT NULL,
  score REAL NOT NULL,
  max_score INTEGER NOT NULL,
  percentage REAL NOT NULL,
  passed INTEGER NOT NULL,
  started_at DATETIME NOT NULL,
  completed_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- User answers
CREATE TABLE IF NOT EXISTS user_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_option_id INTEGER,
  answer_text TEXT,
  answer_data TEXT,
  is_correct INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (answer_option_id) REFERENCES answer_options(id)
);

-- Sign-off requests
CREATE TABLE IF NOT EXISTS signoff_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  boss_id INTEGER NOT NULL,
  evidence_notes TEXT,
  evidence_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
  boss_feedback TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
  FOREIGN KEY (boss_id) REFERENCES users(id)
);

-- Streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  current_login_streak INTEGER DEFAULT 0,
  longest_login_streak INTEGER DEFAULT 0,
  current_test_streak INTEGER DEFAULT 0,
  longest_test_streak INTEGER DEFAULT 0,
  current_practice_streak INTEGER DEFAULT 0,
  longest_practice_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  last_test_date DATE,
  last_practice_date DATE,
  total_points INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  points INTEGER DEFAULT 0
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  UNIQUE(user_id, achievement_id)
);

-- Leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  rungs_completed INTEGER DEFAULT 0,
  days_used INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  rank INTEGER,
  league TEXT CHECK(league IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('login', 'test_attempt', 'practice', 'level_complete')),
  activity_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Pathways
CREATE TABLE IF NOT EXISTS pathways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'fa-graduation-cap',
  color_primary TEXT DEFAULT '#7CB342',
  color_secondary TEXT DEFAULT '#558B2F',
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pathway levels
CREATE TABLE IF NOT EXISTS pathway_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pathway_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
  UNIQUE(pathway_id, level_id)
);

-- Pathway enrollments
CREATE TABLE IF NOT EXISTS pathway_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pathway_id INTEGER NOT NULL,
  cohort_id INTEGER,
  enrollment_status TEXT NOT NULL DEFAULT 'enrolled' CHECK(enrollment_status IN ('pending', 'approved', 'enrolled', 'rejected')),
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  FOREIGN KEY (cohort_id) REFERENCES cohort_groups(id),
  UNIQUE(user_id, pathway_id)
);

-- Boss consultant relationships
CREATE TABLE IF NOT EXISTS boss_consultant_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss_id INTEGER NOT NULL,
  consultant_id INTEGER NOT NULL,
  project_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (boss_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (consultant_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(boss_id, consultant_id)
);

-- Cohort groups
CREATE TABLE IF NOT EXISTS cohort_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  manager_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Cohort members
CREATE TABLE IF NOT EXISTS cohort_members (
  cohort_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cohort_id, user_id),
  FOREIGN KEY (cohort_id) REFERENCES cohort_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cohort pathways
CREATE TABLE IF NOT EXISTS cohort_pathways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER NOT NULL,
  pathway_id INTEGER NOT NULL,
  deadline DATE,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (cohort_id) REFERENCES cohort_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES pathways(id) ON DELETE CASCADE,
  UNIQUE(cohort_id, pathway_id)
);

-- Step 2: Create all indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_boss_id ON users(boss_id);
CREATE INDEX IF NOT EXISTS idx_levels_order ON levels(order_index);
CREATE INDEX IF NOT EXISTS idx_training_materials_level ON training_materials(level_id);
CREATE INDEX IF NOT EXISTS idx_tests_level ON tests(level_id);
CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_answer_options_question ON answer_options(question_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_level ON user_progress(level_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_pathway ON user_progress(pathway_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_cohort ON user_progress(cohort_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_signoff_requests_user ON signoff_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_signoff_requests_boss ON signoff_requests(boss_id);
CREATE INDEX IF NOT EXISTS idx_signoff_requests_status ON signoff_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_pathways_order ON pathways(order_index);
CREATE INDEX IF NOT EXISTS idx_pathway_levels_pathway ON pathway_levels(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_levels_level ON pathway_levels(level_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_user ON pathway_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_pathway ON pathway_enrollments(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_cohort ON pathway_enrollments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_boss_consultant_boss ON boss_consultant_relationships(boss_id);
CREATE INDEX IF NOT EXISTS idx_boss_consultant_consultant ON boss_consultant_relationships(consultant_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort ON cohort_members(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_user ON cohort_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_pathways_cohort ON cohort_pathways(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_pathways_pathway ON cohort_pathways(pathway_id);

-- Step 3: Seed achievements
INSERT OR IGNORE INTO achievements (code, title, description, icon, points) VALUES
('first_login', 'First Steps', 'Logged in for the first time', 'fa-sign-in-alt', 10),
('first_test', 'Test Taker', 'Completed first test', 'fa-clipboard-check', 20),
('first_pass', 'Ace Student', 'Passed first test', 'fa-trophy', 30),
('perfect_score', 'Perfect Score', 'Got 100% on a test', 'fa-star', 50),
('streak_7', 'Week Warrior', '7-day login streak', 'fa-fire', 40),
('streak_30', 'Month Master', '30-day login streak', 'fa-medal', 100),
('level_complete', 'Level Up', 'Completed first level', 'fa-level-up-alt', 25),
('speed_demon', 'Speed Demon', 'Completed test in under 5 minutes', 'fa-bolt', 35);

-- Step 4: Create Legacy Enrollments cohort
INSERT INTO cohort_groups (id, name, description, manager_id, active) 
VALUES (1, 'Legacy Enrollments', 'Auto-created cohort for existing pathway enrollments before cohort system', NULL, 1);

-- Step 5: Create admin user (password: admin123)
-- Note: Password hash is bcrypt for 'admin123'
INSERT OR IGNORE INTO users (email, password_hash, name, role, active) 
VALUES ('admin@training.com', '$2a$10$rXkGqH8vq5Q6vZ8ZJZxkAuEKE3PFGpNFY5hYYH8N7vqH5Q6vZ8ZJZ', 'System Admin', 'admin', 1);
