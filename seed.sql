-- Create default admin user (password: admin123)
-- Password hash for 'admin123' (bcrypt-compatible placeholder - will be replaced with real hash)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, active) VALUES 
  (1, 'admin@training.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye.J3K.6yLlCUJy0/L8n4.jLMwMPBFRLu', 'System Admin', 'admin', 1);

-- Create sample boss user (password: boss123)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, active) VALUES 
  (2, 'boss@training.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye.J3K.6yLlCUJy0/L8n4.jLMwMPBFRLu', 'Jane Boss', 'boss', 1);

-- Create sample consultant users (password: consultant123)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, boss_id, active) VALUES 
  (3, 'consultant1@training.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye.J3K.6yLlCUJy0/L8n4.jLMwMPBFRLu', 'John Consultant', 'consultant', 2, 1),
  (4, 'consultant2@training.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye.J3K.6yLlCUJy0/L8n4.jLMwMPBFRLu', 'Sarah Smith', 'consultant', 2, 1);

-- Create sample levels
INSERT OR IGNORE INTO levels (id, title, description, order_index, is_boss_level, active) VALUES 
  (1, 'Introduction to Consulting', 'Basic consulting principles and methodologies', 1, 0, 1),
  (2, 'Client Communication', 'Effective communication strategies with clients', 2, 0, 1),
  (3, 'Data Analysis Basics', 'Introduction to data analysis techniques', 3, 0, 1),
  (4, 'Boss Level 1: First Project Review', 'Demonstrate your learning from levels 1-3', 4, 1, 1),
  (5, 'Advanced Problem Solving', 'Complex problem-solving frameworks', 5, 0, 1);

-- Create sample training materials
INSERT OR IGNORE INTO training_materials (level_id, title, description, material_type, sharepoint_url, order_index) VALUES 
  (1, 'Consulting 101', 'Introduction to consulting fundamentals', 'powerpoint', 'https://sharepoint.com/consulting101.pptx', 1),
  (1, 'Case Study Video', 'Real-world consulting case study', 'video', 'https://sharepoint.com/case-study.mp4', 2),
  (2, 'Communication Guide', 'Best practices for client communication', 'word', 'https://sharepoint.com/comm-guide.docx', 1),
  (3, 'Excel Analysis Tutorial', 'Data analysis with Excel', 'excel', 'https://sharepoint.com/excel-tutorial.xlsx', 1);

-- Create sample tests
INSERT OR IGNORE INTO tests (id, level_id, title, description, pass_percentage, time_limit_minutes) VALUES 
  (1, 1, 'Consulting Fundamentals Test', 'Test your knowledge of basic consulting principles', 80, 30),
  (2, 2, 'Communication Skills Assessment', 'Assess your understanding of client communication', 80, 20),
  (3, 3, 'Data Analysis Quiz', 'Test your data analysis knowledge', 80, 25);

-- Create sample questions for Test 1
INSERT OR IGNORE INTO questions (id, test_id, question_text, question_type, order_index, points) VALUES 
  (1, 1, 'What is the primary goal of management consulting?', 'multiple_choice', 1, 1),
  (2, 1, 'The consulting process typically starts with problem identification.', 'true_false', 2, 1),
  (3, 1, 'Describe the key steps in a typical consulting engagement.', 'open_text', 3, 2);

-- Create answer options for Question 1 (multiple choice)
INSERT OR IGNORE INTO answer_options (question_id, option_text, is_correct, order_index) VALUES 
  (1, 'To maximize consultant billable hours', 0, 1),
  (1, 'To help clients solve problems and improve performance', 1, 2),
  (1, 'To replace client management teams', 0, 3),
  (1, 'To audit client finances', 0, 4);

-- Create answer options for Question 2 (true/false)
INSERT OR IGNORE INTO answer_options (question_id, option_text, is_correct, order_index) VALUES 
  (2, 'True', 1, 1),
  (2, 'False', 0, 2);

-- Create answer options for Question 3 (open text - correct answer for grading)
INSERT OR IGNORE INTO answer_options (question_id, option_text, is_correct, order_index) VALUES 
  (3, 'Discovery, Analysis, Recommendation, Implementation, Follow-up', 1, 1);

-- Create boss level task
INSERT OR IGNORE INTO boss_level_tasks (level_id, task_description, order_index) VALUES 
  (4, 'Complete a real client communication exercise and get feedback from your boss', 1),
  (4, 'Analyze a dataset and present findings to your team', 2);

-- Initialize streaks for sample users
INSERT OR IGNORE INTO user_streaks (user_id, current_login_streak, total_points) VALUES 
  (3, 0, 0),
  (4, 0, 0);

-- Initialize leaderboard for sample users
INSERT OR IGNORE INTO leaderboard (user_id, rungs_completed, days_used, total_points, league) VALUES 
  (3, 0, 0, 0, 'bronze'),
  (4, 0, 0, 0, 'bronze');

-- Initialize user progress - unlock first level for all consultants
INSERT OR IGNORE INTO user_progress (user_id, level_id, status) VALUES 
  (3, 1, 'unlocked'),
  (4, 1, 'unlocked');
