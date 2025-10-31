-- Clean existing data
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
DELETE FROM users WHERE id > 0;
DELETE FROM levels WHERE id > 0;

-- Insert users (with correct password hashes)
INSERT OR REPLACE INTO users (id, email, password_hash, name, role, boss_id, active, created_at, last_login) VALUES
(1,'admin@training.com','$2a$10$bYp0rjnlmeQK5teL0zSQE.i.zhAD2zEICiVN57O/Z2FfSirmTE222','System Admin','admin',NULL,1,'2025-10-28 09:04:38','2025-10-31 04:10:44'),
(2,'boss@training.com','$2a$10$hpk4FXC0EXumkILY3qhOf.K6xYpybs7ZVWgj8UCYW4PFlcrSAhOeq','Jane Boss','boss',NULL,1,'2025-10-28 09:04:47','2025-10-31 03:12:21'),
(3,'consultant1@training.com','$2a$10$J76AEMkd1igkiEcjTSumLebNex5wSO4WlfasKlryMQKOGO9nFH.Ye','John Consultant','consultant',2,1,'2025-10-28 09:04:47','2025-10-31 04:08:58'),
(4,'consultant2@training.com','$2a$10$J76AEMkd1igkiEcjTSumLebNex5wSO4WlfasKlryMQKOGO9nFH.Ye','Sarah Smith','consultant',2,1,'2025-10-28 09:04:47',NULL);

-- Insert levels
INSERT OR REPLACE INTO levels (id, title, description, order_index, is_boss_level, active, created_at) VALUES
(6,'Renoir Introduction & Product Knowledge',NULL,1,0,1,'2025-10-29 00:09:36'),
(7,'Renoir Project Management',NULL,2,0,1,'2025-10-29 04:33:05'),
(9,'Renoir Change Management',NULL,3,0,1,'2025-10-29 05:50:46'),
(10,'Client Management',NULL,4,0,1,'2025-10-31 02:00:25'),
(4,'Boss Level 1: Has the consultant demonstrated understanding of Renoir basic project principles?','Demonstrate your learning from levels 1-4',5,1,1,'2025-10-28 09:04:47'),
(11,'Renoir Resource Analysis',NULL,6,0,1,'2025-10-31 02:01:58'),
(12,'Renoir Process Mapping',NULL,7,0,1,'2025-10-31 02:02:26'),
(13,'Renoir Management Control Systems (MCS)',NULL,8,0,1,'2025-10-31 02:07:43'),
(19,'Boss- Level 2: Has the consultant demonstrated their ability to build MCS Brown Papers and Process Maps',NULL,9,1,1,'2025-10-31 02:39:05'),
(14,'Renoir Structures',NULL,10,0,1,'2025-10-31 02:09:15'),
(15,'Boss Level- Has the consultant demonstrated their ability to map a org structure?',NULL,11,1,1,'2025-10-31 02:10:17'),
(16,'Renoir Bases and Evaluation',NULL,12,0,1,'2025-10-31 02:14:27'),
(17,'Data Analytics - Business Intelligence',NULL,13,0,1,'2025-10-31 02:19:41'),
(18,'Renoir Strategy',NULL,14,0,1,'2025-10-31 02:36:55');
