-- Add employee ID and join date fields to users table
ALTER TABLE users ADD COLUMN employee_id TEXT;
ALTER TABLE users ADD COLUMN join_date DATE;

-- Create index for employee_id lookups
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
