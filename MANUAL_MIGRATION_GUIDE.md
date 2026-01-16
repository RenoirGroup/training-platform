# Manual Data Migration Guide

## Problem
API tokens are having authentication issues. We need to manually copy data from the OLD Gmail Cloudflare account to the NEW YCP account.

## Solution: Manual SQL Export/Import

### Step 1: Login to OLD Account
1. Go to: https://dash.cloudflare.com
2. Login with: **keithsymondson@gmail.com**
3. Navigate to: **Workers & Pages → D1 → training-platform-production**
4. Click: **Console** tab

### Step 2: Export Critical Data

Run each query below in the OLD account Console and **copy the output**:

#### Query 1: Users (with passwords)
```sql
SELECT * FROM users;
```
**Copy all user rows** - we need the password hashes!

#### Query 2: Levels
```sql
SELECT * FROM levels ORDER BY order_index;
```

#### Query 3: Pathways
```sql
SELECT * FROM pathways ORDER BY order_index;
```

#### Query 4: Cohorts
```sql
SELECT * FROM cohort_groups;
```

#### Query 5: Training Materials
```sql
SELECT * FROM training_materials ORDER BY level_id, order_index;
```

#### Query 6: Tests
```sql
SELECT * FROM tests;
```

#### Query 7: Questions
```sql
SELECT * FROM questions ORDER BY test_id, order_index;
```

#### Query 8: Answer Options
```sql
SELECT * FROM answer_options ORDER BY question_id, order_index;
```

#### Query 9: User Progress
```sql
SELECT * FROM user_progress;
```

#### Query 10: Pathway Enrollments
```sql
SELECT * FROM pathway_enrollments;
```

### Step 3: Import to NEW Account

1. **Logout** from Gmail account
2. **Login** to https://dash.cloudflare.com with: **keith.symondson@ycp.com**
3. Navigate to: **Workers & Pages → D1 → training-platform-production**
4. Click: **Console** tab
5. **Delete the dummy admin** first:
   ```sql
   DELETE FROM users WHERE id = 1;
   ```

### Step 4: Convert and Import

For each table you exported, convert the data to INSERT statements like this:

**Example for users:**
```sql
INSERT INTO users (id, email, password_hash, name, role, boss_id, active, created_at, last_login, language_preference, division, region, location, title)
VALUES 
  (1, 'admin@training.com', '$2a$10$...hash...', 'System Admin', 'admin', NULL, 1, '2025-10-28 09:04:38', '2026-01-16 05:06:57', 'en', NULL, NULL, NULL, NULL),
  (2, 'boss@training.com', '$2a$10$...hash...', 'Jane Boss', 'boss', NULL, 1, '2025-10-28 09:04:47', '2025-12-10 08:51:18', 'en', NULL, NULL, NULL, NULL);
  -- ... add all users
```

## Alternative: Use the Working Exports

We already have good exports from earlier! Use these files:
- Check: `/home/user/webapp/*_raw.json` files
- These have all the data in JSON format
- I can convert them to SQL for you

Should I convert the existing JSON exports to SQL INSERT statements instead?
