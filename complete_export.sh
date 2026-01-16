#!/bin/bash

# Export from OLD Gmail Cloudflare Account
export CLOUDFLARE_API_TOKEN="4c3_4LBI-QhzYGIvwsn47h6QEJB8ik9fJe_qgKQM"
export CLOUDFLARE_ACCOUNT_ID="64eafbdb81651010ebdd24644fa3e2fd"
OLD_DB_ID="e11032ed-0a53-4ffb-86c4-6a0ef9b9fed3"

echo "Exporting ALL data from OLD database..."
echo "-- FULL DATABASE DUMP FROM OLD GMAIL ACCOUNT" > complete_dump.sql
echo "-- Generated: $(date)" >> complete_dump.sql
echo "" >> complete_dump.sql

# Get all table names
TABLES=$(npx wrangler d1 execute training-platform-production --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" 2>&1 | grep -v "wrangler\|Executing\|To execute\|Logs" | grep -oP '^\s*│\s*\K[^│]+' | sed 's/[[:space:]]*$//' | grep -v "^name$" | grep -v "^─" | grep -v "^┌" | grep -v "^└" | grep -v "^│")

for table in $tables; do
    echo "Exporting table: $table"
    echo "" >> complete_dump.sql
    echo "-- Table: $table" >> complete_dump.sql
    
    # Get the CREATE TABLE statement
    npx wrangler d1 execute training-platform-production --remote --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='$table'" 2>&1 | grep -v "wrangler\|Executing\|To execute\|Logs" | grep "CREATE TABLE" >> complete_dump.sql || true
    echo ";" >> complete_dump.sql
    
    # Get row count
    count=$(npx wrangler d1 execute training-platform-production --remote --command="SELECT COUNT(*) as count FROM $table" 2>&1 | grep -v "wrangler\|Executing\|To execute\|Logs" | grep -oP '\d+' | head -1)
    echo "-- Rows: $count" >> complete_dump.sql
    
    if [ "$count" -gt 0 ]; then
        # Export data as SQL INSERT statements
        npx wrangler d1 execute training-platform-production --remote --command="SELECT * FROM $table" --json > "${table}_temp.json" 2>/dev/null || true
    fi
    echo "" >> complete_dump.sql
done

echo "Export complete! File: complete_dump.sql"
