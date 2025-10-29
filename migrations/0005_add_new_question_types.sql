-- Add support for new question types
-- Drop the old CHECK constraint and add new one with all 8 types + multiple_response

-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we need to recreate the table
-- First, create a new table with the updated constraint
CREATE TABLE questions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN (
    'multiple_choice', 
    'true_false', 
    'open_text',
    'matching',
    'fill_blank',
    'ranking',
    'odd_one_out',
    'hotspot',
    'multiple_response'
  )),
  order_index INTEGER DEFAULT 1,
  points INTEGER DEFAULT 1,
  answer_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO questions_new 
SELECT * FROM questions;

-- Drop old table
DROP TABLE questions;

-- Rename new table
ALTER TABLE questions_new RENAME TO questions;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
