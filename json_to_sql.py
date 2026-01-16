#!/usr/bin/env python3
import json
import glob
import sys

def escape_sql_value(value):
    """Escape special characters for SQL"""
    if value is None:
        return 'NULL'
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, bool):
        return '1' if value else '0'
    else:
        # Escape single quotes and backslashes
        value = str(value).replace("\\", "\\\\").replace("'", "''")
        return f"'{value}'"

def json_to_insert(table_name, json_file):
    """Convert JSON export to SQL INSERT statements"""
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        if not data or not data[0].get('results'):
            print(f"-- No data in {table_name}")
            return []
        
        results = data[0]['results']
        if not results:
            print(f"-- No results in {table_name}")
            return []
        
        # Get column names from first row
        columns = list(results[0].keys())
        
        inserts = []
        inserts.append(f"-- Importing {len(results)} rows into {table_name}")
        
        for row in results:
            values = [escape_sql_value(row.get(col)) for col in columns]
            sql = f"INSERT OR REPLACE INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(values)});"
            inserts.append(sql)
        
        return inserts
    
    except Exception as e:
        print(f"Error processing {table_name}: {e}", file=sys.stderr)
        return []

# Process all JSON files
tables = [
    'users', 'achievements', 'user_achievements', 'levels', 'training_materials',
    'tests', 'questions', 'answer_options', 'boss_level_tasks', 'user_streaks',
    'leaderboard', 'activity_log', 'pathways', 'pathway_levels', 'pathway_enrollments',
    'cohort_groups', 'cohort_members', 'cohort_pathways', 'user_progress',
    'signoff_requests', 'test_attempts', 'user_answers', 'boss_consultant_relationships'
]

print("-- FULL DATABASE IMPORT")
print("-- Generated from OLD Gmail Cloudflare account")
print()

for table in tables:
    json_file = f"{table}_raw.json"
    print(f"\n-- Table: {table}")
    inserts = json_to_insert(table, json_file)
    for insert in inserts:
        print(insert)
