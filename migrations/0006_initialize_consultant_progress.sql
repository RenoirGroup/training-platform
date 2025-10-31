-- Migration to initialize first level for consultants who don't have progress records
-- This fixes consultants created before this migration was added

-- For each consultant user that doesn't have a user_progress record,
-- create one for the first active level
INSERT OR IGNORE INTO user_progress (user_id, level_id, status)
SELECT 
    u.id as user_id,
    (SELECT id FROM levels WHERE active = 1 ORDER BY order_index LIMIT 1) as level_id,
    'unlocked' as status
FROM users u
WHERE u.role = 'consultant' 
  AND u.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM user_progress up WHERE up.user_id = u.id
  );
