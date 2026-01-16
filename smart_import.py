#!/usr/bin/env python3
import json
import sys

# Schema mapping: old columns -> new columns (or None to skip)
SCHEMA_FIXES = {
    'users': {
        'skip': [],
        'rename': {'preferred_language': 'language_preference'}
    },
    'questions': {
        'skip': ['answer_data'],  # This column doesn't exist in new schema
        'rename': {}
    }
}

def escape_sql_value(value):
    if value is None:
        return 'NULL'
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, bool):
        return '1' if value else '0'
    else:
        value = str(value).replace("\\", "\\\\").replace("'", "''")
        # Fix language codes
        if value == 'en-US':
            value = 'en'
        elif value == 'zh-CN':
            value = 'zh'
        return f"'{value}'"

def process_table(table_name, json_file):
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        if not data or not data[0].get('results'):
            return []
        
        results = data[0]['results']
        if not results:
            return []
        
        # Get schema fixes for this table
        fixes = SCHEMA_FIXES.get(table_name, {'skip': [], 'rename': {}})
        
        # Process columns
        old_columns = list(results[0].keys())
        new_columns = []
        for col in old_columns:
            if col in fixes['skip']:
                continue
            new_col = fixes['rename'].get(col, col)
            new_columns.append((col, new_col))
        
        inserts = []
        inserts.append(f"\n-- Table: {table_name} ({len(results)} rows)")
        
        for row in results:
            col_names = [new_col for old_col, new_col in new_columns]
            values = [escape_sql_value(row.get(old_col)) for old_col, new_col in new_columns]
            sql = f"INSERT OR REPLACE INTO {table_name} ({', '.join(col_names)}) VALUES ({', '.join(values)});"
            inserts.append(sql)
        
        return inserts
    
    except Exception as e:
        print(f"Error processing {table_name}: {e}", file=sys.stderr)
        return []

# Process all tables
tables = [
    'users', 'achievements', 'user_achievements', 'levels', 'training_materials',
    'tests', 'questions', 'answer_options', 'boss_level_tasks', 'user_streaks',
    'leaderboard', 'activity_log', 'pathways', 'pathway_levels', 'pathway_enrollments',
    'cohort_groups', 'cohort_members', 'cohort_pathways', 'user_progress',
    'signoff_requests', 'test_attempts', 'user_answers', 'boss_consultant_relationships'
]

print("-- CLEANED DATABASE IMPORT")
print("-- Schema-aware import from OLD Gmail account to NEW YCP account")
print()

for table in tables:
    json_file = f"{table}_raw.json"
    inserts = process_table(table, json_file)
    for insert in inserts:
        print(insert)
