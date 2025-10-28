-- Insert default achievements
INSERT INTO achievements (code, title, description, icon, points) VALUES
  ('first_test', 'First Steps', 'Complete your first test', '🎯', 10),
  ('streak_10', 'Dedicated Learner', 'Maintain a 10-day streak', '🔥', 50),
  ('streak_50', 'Training Master', 'Maintain a 50-day streak', '💪', 200),
  ('streak_100', 'Legend', 'Maintain a 100-day streak', '👑', 500),
  ('level_10', 'Rising Star', 'Complete 10 levels', '⭐', 100),
  ('level_25', 'Expert', 'Complete 25 levels', '🏆', 250),
  ('level_50', 'Master', 'Complete 50 levels', '💎', 500),
  ('perfect_score', 'Perfectionist', 'Get 100% on a test', '💯', 25),
  ('speed_demon', 'Speed Demon', 'Complete a test in under 5 minutes', '⚡', 30),
  ('comeback', 'Never Give Up', 'Pass a test after failing', '💪', 20),
  ('boss_complete', 'Boss Slayer', 'Complete your first boss level', '🐉', 75),
  ('boss_perfect', 'Boss Master', 'Get all boss levels approved without rejection', '👑', 150),
  ('top_10', 'Elite Performer', 'Reach top 10 on leaderboard', '🥇', 100),
  ('top_3', 'Podium Finisher', 'Reach top 3 on leaderboard', '🥈', 200),
  ('rank_1', 'Champion', 'Reach #1 on leaderboard', '🏅', 500);
