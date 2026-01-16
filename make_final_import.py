import json
import os

def escape_sql(value):
    """Properly escape SQL values"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return '1' if value else '0'
    if isinstance(value, (int, float)):
        return str(value)
    # Escape single quotes by doubling them
    value = str(value).replace("'", "''")
    # Handle special characters
    return f"'{value}'"

def load_json_array(filename):
    """Load JSON array from file"""
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                # Check if it's a wrangler result format
                if isinstance(data[0], dict) and 'results' in data[0]:
                    return data[0]['results']
                return data
            return []
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []

# Table order (respecting foreign keys)
TABLES = [
    ('users', ['id', 'email', 'password_hash', 'name', 'role', 'boss_id', 'active', 'created_at', 'last_login', 'language_preference', 'division', 'region', 'location', 'title']),
    ('achievements', ['id', 'code', 'title', 'description', 'icon', 'points']),
    ('user_achievements', ['id', 'user_id', 'achievement_id', 'earned_at']),
    ('levels', ['id', 'title', 'description', 'order_index', 'is_boss_level', 'active', 'created_at']),
    ('training_materials', ['id', 'level_id', 'title', 'description', 'material_type', 'sharepoint_url', 'order_index', 'created_at']),
    ('tests', ['id', 'level_id', 'title', 'description', 'pass_percentage', 'time_limit_minutes', 'created_at']),
    ('questions', ['id', 'test_id', 'question_text', 'question_type', 'order_index', 'points', 'created_at']),
    ('answer_options', ['id', 'question_id', 'option_text', 'is_correct', 'order_index']),
    ('boss_level_tasks', ['id', 'level_id', 'task_description', 'order_index', 'created_at']),
    ('user_streaks', ['id', 'user_id', 'current_login_streak', 'longest_login_streak', 'current_test_streak', 'longest_test_streak', 'current_practice_streak', 'longest_practice_streak', 'last_login_date', 'last_test_date', 'last_practice_date', 'total_points']),
    ('leaderboard', ['id', 'user_id', 'rungs_completed', 'days_used', 'total_points', 'rank', 'league', 'updated_at']),
    ('activity_log', ['id', 'user_id', 'activity_type', 'activity_date', 'created_at']),
    ('pathways', ['id', 'title', 'description', 'order_index', 'active', 'created_at']),
    ('pathway_levels', ['id', 'pathway_id', 'level_id', 'order_index']),
    ('pathway_enrollments', ['id', 'user_id', 'pathway_id', 'cohort_id', 'status', 'enrolled_at', 'started_at', 'completed_at']),
    ('cohort_groups', ['id', 'name', 'description', 'manager_id', 'created_at']),
    ('cohort_members', ['cohort_id', 'user_id', 'joined_at']),
    ('cohort_pathways', ['id', 'cohort_id', 'pathway_id', 'deadline', 'assigned_at']),
    ('user_progress', ['id', 'user_id', 'level_id', 'pathway_id', 'cohort_id', 'status', 'started_at', 'completed_at']),
    ('signoff_requests', ['id', 'user_id', 'level_id', 'boss_id', 'evidence_notes', 'evidence_url', 'status', 'boss_feedback', 'requested_at', 'reviewed_at']),
    ('test_attempts', ['id', 'user_id', 'test_id', 'score', 'max_score', 'percentage', 'passed', 'started_at', 'completed_at']),
    ('user_answers', ['id', 'attempt_id', 'question_id', 'answer_option_id', 'answer_text', 'is_correct', 'points_earned']),
    ('boss_consultant_relationships', ['boss_id', 'consultant_id', 'created_at'])
]

print("Creating final import SQL...")

with open('FINAL_PRODUCTION_IMPORT.sql', 'w') as out:
    out.write("-- COMPLETE PRODUCTION DATA IMPORT\n")
    out.write("-- Generated from OLD Gmail Cloudflare account\n")
    out.write(f"-- Date: {os.popen('date').read().strip()}\n\n")
    
    out.write("-- Disable foreign key checks\n")
    out.write("PRAGMA foreign_keys = OFF;\n\n")
    
    out.write("-- Delete existing data (except schema)\n")
    out.write("DELETE FROM users WHERE id = 1; -- Remove dummy admin\n\n")
    
    total_rows = 0
    
    for table_name, columns in TABLES:
        json_file = f"{table_name}_raw.json"
        
        if not os.path.exists(json_file):
            print(f"Warning: {json_file} not found")
            continue
        
        rows = load_json_array(json_file)
        
        if not rows:
            print(f"No data in {table_name}")
            continue
        
        print(f"Converting {table_name}: {len(rows)} rows")
        
        out.write(f"\n-- {table_name} ({len(rows)} rows)\n")
        
        for row in rows:
            # Transform values
            values = []
            for col in columns:
                value = row.get(col)
                
                # Special transformations
                if table_name == 'users' and col == 'language_preference':
                    # Map language codes
                    if value == 'en-US':
                        value = 'en'
                    elif value == 'zh-CN':
                        value = 'zh'
                
                values.append(escape_sql(value))
            
            cols_str = ', '.join(columns)
            vals_str = ', '.join(values)
            out.write(f"INSERT OR IGNORE INTO {table_name} ({cols_str}) VALUES ({vals_str});\n")
            total_rows += 1
    
    out.write("\n-- Re-enable foreign key checks\n")
    out.write("PRAGMA foreign_keys = ON;\n\n")
    out.write(f"-- Total rows imported: {total_rows}\n")

print(f"\n✅ Generated FINAL_PRODUCTION_IMPORT.sql with {total_rows} rows!")
print(f"\nNext step: Copy this file and run it in the NEW Cloudflare D1 Console")
