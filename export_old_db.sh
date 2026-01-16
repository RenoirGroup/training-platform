#!/bin/bash
# Export all data from OLD Gmail Cloudflare account

export CLOUDFLARE_API_TOKEN="4c3_4LBI-QhzYGIvwsn47h6QEJB8ik9fJe_qgKQM"
export CLOUDFLARE_ACCOUNT_ID="64eafbdb81651010ebdd24644fa3e2fd"

cd /home/user/webapp

echo "-- DATA EXPORT FROM OLD PRODUCTION DATABASE" > full_export.sql
echo "-- Exported on $(date)" >> full_export.sql
echo "" >> full_export.sql

# List of tables to export (in dependency order)
TABLES="users achievements user_achievements levels training_materials tests questions answer_options boss_level_tasks user_streaks leaderboard activity_log pathways pathway_levels pathway_enrollments cohort_groups cohort_members cohort_pathways user_progress signoff_requests test_attempts user_answers boss_consultant_relationships"

for table in $TABLES; do
    echo "Exporting $table..."
    echo "-- Table: $table" >> full_export.sql
    npx wrangler d1 execute training-platform-production --remote --command="SELECT * FROM $table" --config=wrangler.old.toml --json >> "${table}_raw.json" 2>&1
done

echo "Export complete!"
