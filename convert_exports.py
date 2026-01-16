import json
import os

# Schema mapping for columns that differ between old and new DB
COLUMN_MAPPINGS = {
    'users': {
        'preferred_language': 'language_preference'
    }
}

# Columns to skip (don't exist in new schema)
SKIP_COLUMNS = {
    'questions': ['answer_data']
}

def escape_sql_value(value):
    """Escape SQL values properly"""
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, bool):
        return '1' if value else '0'
    # Escape single quotes
    value = str(value).replace("'", "''")
    return f"'{value}'"

def convert_table(table_name):
    """Convert a JSON export to SQL INSERT statements"""
    json_file = f"{table_name}_export.json"
    
    if not os.path.exists(json_file):
        print(f"Warning: {json_file} not found")
        return []
    
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        if not data or not isinstance(data, list) or len(data) == 0:
            print(f"No data in {table_name}")
            return []
        
        results = data[0].get('results', [])
        if not results:
            print(f"No results in {table_name}")
            return []
        
        sql_statements = []
        sql_statements.append(f"\n-- Importing {table_name} ({len(results)} rows)")
        
        # Get columns from first row
        first_row = results[0]
        columns = list(first_row.keys())
        
        # Apply column mappings
        if table_name in COLUMN_MAPPINGS:
            mapping = COLUMN_MAPPINGS[table_name]
            columns = [mapping.get(col, col) for col in columns]
        
        # Skip certain columns
        if table_name in SKIP_COLUMNS:
            skip_cols = SKIP_COLUMNS[table_name]
            columns = [col for col in columns if col not in skip_cols]
        
        # Generate INSERT statements
        for row in results:
            # Apply transformations
            if table_name == 'users' and 'preferred_language' in row:
                # Map language codes
                lang = row['preferred_language']
                if lang == 'en-US':
                    row['preferred_language'] = 'en'
                elif lang == 'zh-CN':
                    row['preferred_language'] = 'zh'
            
            # Get values in the correct order
            values = []
            for col in columns:
                # Handle column mapping for values
                original_col = col
                if table_name in COLUMN_MAPPINGS:
                    reverse_mapping = {v: k for k, v in COLUMN_MAPPINGS[table_name].items()}
                    original_col = reverse_mapping.get(col, col)
                
                value = row.get(original_col)
                values.append(escape_sql_value(value))
            
            columns_str = ', '.join(columns)
            values_str = ', '.join(values)
            sql_statements.append(f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});")
        
        return sql_statements
    
    except Exception as e:
        print(f"Error processing {table_name}: {e}")
        return [f"-- Error processing {table_name}: {e}"]

# Tables in dependency order (respect foreign keys)
TABLES_IN_ORDER = [
    'users',
    'achievements',
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
    'user_progress',
    'signoff_requests',
    'test_attempts',
    'user_answers',
    'boss_consultant_relationships'
]

# Generate final SQL file
print("Converting JSON exports to SQL...")
with open('final_import.sql', 'w') as f:
    f.write("-- COMPLETE DATABASE IMPORT FROM OLD PRODUCTION\n")
    f.write("-- Generated automatically\n")
    f.write("-- Safe to run on new database\n\n")
    
    # Disable foreign key checks during import
    f.write("PRAGMA foreign_keys = OFF;\n\n")
    
    for table in TABLES_IN_ORDER:
        print(f"Converting {table}...")
        sql_statements = convert_table(table)
        for statement in sql_statements:
            f.write(statement + '\n')
    
    # Re-enable foreign key checks
    f.write("\nPRAGMA foreign_keys = ON;\n")

print("Conversion complete! Check final_import.sql")
