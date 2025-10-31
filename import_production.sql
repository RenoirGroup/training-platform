-- Disable foreign keys and delete existing data
PRAGMA foreign_keys = OFF;

-- Delete existing data in correct order
DELETE FROM user_achievements;
DELETE FROM test_attempts;
DELETE FROM answer_options;
DELETE FROM questions;
DELETE FROM tests;
DELETE FROM training_materials;
DELETE FROM boss_level_tasks;
DELETE FROM user_progress;
DELETE FROM user_streaks;
DELETE FROM leaderboard;
DELETE FROM users;
DELETE FROM levels;
DELETE FROM achievements;

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;
