#!/usr/bin/env python3
import json
import glob

# Schema mapping: old column -> new column (or None to skip)
COLUMN_MAPPINGS = {
    'users': {
        'preferred_language': 'language_preference',
    },
    'questions': {
        'answer_data': None,  # Skip this column
    },
    'pathway_enrollments': {
        'status': 'enrollment_status',
        'request_note': None,  # Skip
        'enrolled_by': None,  # Skip
        'requested_at': None,  # Skip
        'response_note': None,  # Skip
        'reviewed_at': None,  # Skip
        'reviewed_by': None,  # Skip
        'active': None,  # Skip
    },
    'cohort_members': {
        'id': None,  # Skip - composite primary key
        'active': None,  # Skip - not in new schema
    },
    'cohort_pathways': {
        'assigned_by': None,  # Skip - not in new schema
    }
}

# Value transformations
def transform_value(table, column, value):
    # Handle NULL
    if value is None:
        return 'NULL'
    
    # Language mapping
    if table == 'users' and column in ['language_preference', 'preferred_language']:
        if value == 'en-US':
            return "'en'"
        elif value == 'zh-CN':
            return "'zh'"
        return "'en'"  # Default
    
    # Question type mapping
    if table == 'questions' and column == 'question_type':
        # Map old types to new schema types
        type_mapping = {
            'multiple_response': 'multi_select',
            'hotspot': 'multiple_choice',
            'odd_one_out': 'multiple_choice',
            'ranking': 'ordering',
        }
        value = type_mapping.get(value, value)
    
    # String values
    if isinstance(value, str):
        # Escape single quotes and newlines
        value = value.replace("'", "''")
        value = value.replace("\n", " ")
        value = value.replace("\r", "")
        return f"'{value}'"
    
    # Numbers and booleans
    return str(value)

# Generate SQL
print("-- COMPLETE DATABASE IMPORT")
print("-- Generated from OLD Gmail Cloudflare Account")
print("-- Ready for NEW YCP Cloudflare Account\n")

# Order tables by dependencies
tables_order = [
    'achievements',
    'users',
    'user_achievements',
    'levels',
    'training_materials',
    'tests',
    'questions',
    'answer_options',
    'boss_level_tasks',
    'user_streaks',
    'leaderboard',
    'activity_log',
    'pathways',
    'pathway_levels',
    'pathway_enrollments',
    'cohort_groups',
    'cohort_members',
    'cohort_pathways',
    'boss_consultant_relationships',
    'user_progress',
    'signoff_requests',
    'test_attempts',
    'user_answers',
]

for table in tables_order:
    filename = f'export_{table}.json'
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        if 'error' in data:
            print(f"-- Skipping {table}: error in export")
            continue
        
        results = data[0].get('results', [])
        if not results:
            print(f"-- Table {table}: no data")
            continue
        
        print(f"\n-- Table: {table} ({len(results)} rows)")
        
        for row in results:
            # Get columns and apply mappings
            columns = []
            values = []
            
            for col, val in row.items():
                # Check if we should skip this column
                if table in COLUMN_MAPPINGS and col in COLUMN_MAPPINGS[table]:
                    new_col = COLUMN_MAPPINGS[table][col]
                    if new_col is None:
                        continue  # Skip
                    col = new_col
                
                columns.append(col)
                values.append(transform_value(table, col, val))
            
            if columns:
                cols_str = ', '.join(columns)
                vals_str = ', '.join(values)
                print(f"INSERT INTO {table} ({cols_str}) VALUES ({vals_str});")
    
    except FileNotFoundError:
        print(f"-- Skipping {table}: file not found")
    except Exception as e:
        print(f"-- Error processing {table}: {e}")

print("\n-- Import complete!")
