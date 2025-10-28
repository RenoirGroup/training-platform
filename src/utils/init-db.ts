// Initialize database with seed data on first request
export async function initializeDatabase(db: D1Database) {
  try {
    // Check if users table has data
    const result = await db.prepare('SELECT COUNT(*) as count FROM users').first();
    
    if (result && result.count > 0) {
      // Database already initialized
      return;
    }
  } catch (error) {
    // Tables don't exist, need to create them
    console.log('Initializing database schema...');
  }

  // Create tables
  await db.batch([
    // Users table
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'consultant', 'boss')),
      boss_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      FOREIGN KEY (boss_id) REFERENCES users(id)
    )`),
    
    // Levels table
    db.prepare(`CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL,
      is_boss_level INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    
    // Training materials
    db.prepare(`CREATE TABLE IF NOT EXISTS training_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      material_type TEXT NOT NULL CHECK(material_type IN ('powerpoint', 'video', 'word', 'excel', 'other')),
      sharepoint_url TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
    )`),
    
    // Tests
    db.prepare(`CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      pass_percentage INTEGER DEFAULT 80,
      time_limit_minutes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
    )`),
    
    // Questions
    db.prepare(`CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('multiple_choice', 'true_false', 'open_text')),
      order_index INTEGER NOT NULL,
      points INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
    )`),
    
    // Answer options
    db.prepare(`CREATE TABLE IF NOT EXISTS answer_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )`),
    
    // Boss level tasks
    db.prepare(`CREATE TABLE IF NOT EXISTS boss_level_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL,
      task_description TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
    )`),
    
    // User progress
    db.prepare(`CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      level_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('locked', 'unlocked', 'in_progress', 'completed', 'awaiting_signoff')),
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
      UNIQUE(user_id, level_id)
    )`),
    
    // Test attempts
    db.prepare(`CREATE TABLE IF NOT EXISTS test_attempts (
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
    )`),
    
    // User answers
    db.prepare(`CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer_option_id INTEGER,
      answer_text TEXT,
      is_correct INTEGER NOT NULL,
      points_earned INTEGER NOT NULL,
      FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (answer_option_id) REFERENCES answer_options(id)
    )`),
    
    // Sign-off requests
    db.prepare(`CREATE TABLE IF NOT EXISTS signoff_requests (
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
    )`),
    
    // User streaks
    db.prepare(`CREATE TABLE IF NOT EXISTS user_streaks (
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
    )`),
    
    // Achievements
    db.prepare(`CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT,
      points INTEGER DEFAULT 0
    )`),
    
    // User achievements
    db.prepare(`CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE(user_id, achievement_id)
    )`),
    
    // Leaderboard
    db.prepare(`CREATE TABLE IF NOT EXISTS leaderboard (
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
    )`),
    
    // Activity log
    db.prepare(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL CHECK(activity_type IN ('login', 'test_attempt', 'practice', 'level_complete')),
      activity_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`)
  ]);

  console.log('Database schema created successfully');

  // Seed achievements
  await db.batch([
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('first_test', 'First Steps', 'Complete your first test', '🎯', 10)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('streak_10', 'Dedicated Learner', 'Maintain a 10-day streak', '🔥', 50)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('streak_50', 'Training Master', 'Maintain a 50-day streak', '💪', 200)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('streak_100', 'Legend', 'Maintain a 100-day streak', '👑', 500)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('level_10', 'Rising Star', 'Complete 10 levels', '⭐', 100)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('level_25', 'Expert', 'Complete 25 levels', '🏆', 250)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('level_50', 'Master', 'Complete 50 levels', '💎', 500)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('perfect_score', 'Perfectionist', 'Get 100% on a test', '💯', 25)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('speed_demon', 'Speed Demon', 'Complete a test in under 5 minutes', '⚡', 30)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('comeback', 'Never Give Up', 'Pass a test after failing', '💪', 20)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('boss_complete', 'Boss Slayer', 'Complete your first boss level', '🐉', 75)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('boss_perfect', 'Boss Master', 'Get all boss levels approved without rejection', '👑', 150)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('top_10', 'Elite Performer', 'Reach top 10 on leaderboard', '🥇', 100)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('top_3', 'Podium Finisher', 'Reach top 3 on leaderboard', '🥈', 200)`),
    db.prepare(`INSERT INTO achievements (code, title, description, icon, points) VALUES ('rank_1', 'Champion', 'Reach #1 on leaderboard', '🏅', 500)`)
  ]);

  // Seed sample users with proper bcrypt hashes
  await db.batch([
    db.prepare(`INSERT INTO users (id, email, password_hash, name, role, active) VALUES (1, 'admin@training.com', '$2a$10$bYp0rjnlmeQK5teL0zSQE.i.zhAD2zEICiVN57O/Z2FfSirmTE222', 'System Admin', 'admin', 1)`),
    db.prepare(`INSERT INTO users (id, email, password_hash, name, role, active) VALUES (2, 'boss@training.com', '$2a$10$hpk4FXC0EXumkILY3qhOf.K6xYpybs7ZVWgj8UCYW4PFlcrSAhOeq', 'Jane Boss', 'boss', 1)`),
    db.prepare(`INSERT INTO users (id, email, password_hash, name, role, boss_id, active) VALUES (3, 'consultant1@training.com', '$2a$10$J76AEMkd1igkiEcjTSumLebNex5wSO4WlfasKlryMQKOGO9nFH.Ye', 'John Consultant', 'consultant', 2, 1)`),
    db.prepare(`INSERT INTO users (id, email, password_hash, name, role, boss_id, active) VALUES (4, 'consultant2@training.com', '$2a$10$J76AEMkd1igkiEcjTSumLebNex5wSO4WlfasKlryMQKOGO9nFH.Ye', 'Sarah Smith', 'consultant', 2, 1)`)
  ]);

  // Seed sample levels
  await db.batch([
    db.prepare(`INSERT INTO levels (id, title, description, order_index, is_boss_level, active) VALUES (1, 'Introduction to Consulting', 'Basic consulting principles and methodologies', 1, 0, 1)`),
    db.prepare(`INSERT INTO levels (id, title, description, order_index, is_boss_level, active) VALUES (2, 'Client Communication', 'Effective communication strategies with clients', 2, 0, 1)`),
    db.prepare(`INSERT INTO levels (id, title, description, order_index, is_boss_level, active) VALUES (3, 'Data Analysis Basics', 'Introduction to data analysis techniques', 3, 0, 1)`),
    db.prepare(`INSERT INTO levels (id, title, description, order_index, is_boss_level, active) VALUES (4, 'Boss Level 1: First Project Review', 'Demonstrate your learning from levels 1-3', 4, 1, 1)`),
    db.prepare(`INSERT INTO levels (id, title, description, order_index, is_boss_level, active) VALUES (5, 'Advanced Problem Solving', 'Complex problem-solving frameworks', 5, 0, 1)`)
  ]);

  // Seed training materials
  await db.batch([
    db.prepare(`INSERT INTO training_materials (level_id, title, description, material_type, sharepoint_url, order_index) VALUES (1, 'Consulting 101', 'Introduction to consulting fundamentals', 'powerpoint', 'https://sharepoint.com/consulting101.pptx', 1)`),
    db.prepare(`INSERT INTO training_materials (level_id, title, description, material_type, sharepoint_url, order_index) VALUES (1, 'Case Study Video', 'Real-world consulting case study', 'video', 'https://sharepoint.com/case-study.mp4', 2)`),
    db.prepare(`INSERT INTO training_materials (level_id, title, description, material_type, sharepoint_url, order_index) VALUES (2, 'Communication Guide', 'Best practices for client communication', 'word', 'https://sharepoint.com/comm-guide.docx', 1)`),
    db.prepare(`INSERT INTO training_materials (level_id, title, description, material_type, sharepoint_url, order_index) VALUES (3, 'Excel Analysis Tutorial', 'Data analysis with Excel', 'excel', 'https://sharepoint.com/excel-tutorial.xlsx', 1)`)
  ]);

  // Seed tests
  await db.batch([
    db.prepare(`INSERT INTO tests (id, level_id, title, description, pass_percentage, time_limit_minutes) VALUES (1, 1, 'Consulting Fundamentals Test', 'Test your knowledge of basic consulting principles', 80, 30)`),
    db.prepare(`INSERT INTO tests (id, level_id, title, description, pass_percentage, time_limit_minutes) VALUES (2, 2, 'Communication Skills Assessment', 'Assess your understanding of client communication', 80, 20)`),
    db.prepare(`INSERT INTO tests (id, level_id, title, description, pass_percentage, time_limit_minutes) VALUES (3, 3, 'Data Analysis Quiz', 'Test your data analysis knowledge', 80, 25)`)
  ]);

  // Seed questions
  await db.batch([
    db.prepare(`INSERT INTO questions (id, test_id, question_text, question_type, order_index, points) VALUES (1, 1, 'What is the primary goal of management consulting?', 'multiple_choice', 1, 1)`),
    db.prepare(`INSERT INTO questions (id, test_id, question_text, question_type, order_index, points) VALUES (2, 1, 'The consulting process typically starts with problem identification.', 'true_false', 2, 1)`),
    db.prepare(`INSERT INTO questions (id, test_id, question_text, question_type, order_index, points) VALUES (3, 1, 'Describe the key steps in a typical consulting engagement.', 'open_text', 3, 2)`)
  ]);

  // Seed answer options
  await db.batch([
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (1, 'To maximize consultant billable hours', 0, 1)`),
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (1, 'To help clients solve problems and improve performance', 1, 2)`),
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (1, 'To replace client management teams', 0, 3)`),
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (1, 'To audit client finances', 0, 4)`),
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (2, 'True', 1, 1)`),
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (2, 'False', 0, 2)`),
    db.prepare(`INSERT INTO answer_options (question_id, option_text, is_correct, order_index) VALUES (3, 'Discovery, Analysis, Recommendation, Implementation, Follow-up', 1, 1)`)
  ]);

  // Seed boss level tasks
  await db.batch([
    db.prepare(`INSERT INTO boss_level_tasks (level_id, task_description, order_index) VALUES (4, 'Complete a real client communication exercise and get feedback from your boss', 1)`),
    db.prepare(`INSERT INTO boss_level_tasks (level_id, task_description, order_index) VALUES (4, 'Analyze a dataset and present findings to your team', 2)`)
  ]);

  // Initialize streaks and leaderboard
  await db.batch([
    db.prepare(`INSERT INTO user_streaks (user_id, current_login_streak, total_points) VALUES (3, 0, 0)`),
    db.prepare(`INSERT INTO user_streaks (user_id, current_login_streak, total_points) VALUES (4, 0, 0)`),
    db.prepare(`INSERT INTO leaderboard (user_id, rungs_completed, days_used, total_points, league) VALUES (3, 0, 0, 0, 'bronze')`),
    db.prepare(`INSERT INTO leaderboard (user_id, rungs_completed, days_used, total_points, league) VALUES (4, 0, 0, 0, 'bronze')`)
  ]);

  console.log('Database seeded successfully');
}
