#!/bin/bash

# Export from OLD Gmail Cloudflare Account
export CLOUDFLARE_API_TOKEN="4c3_4LBI-QhzYGIvwsn47h6QEJB8ik9fJe_qgKQM"
export CLOUDFLARE_ACCOUNT_ID="64eafbdb81651010ebdd24644fa3e2fd"

echo "Exporting ALL data from OLD Gmail account database..."

# Make sure we're using the old config
cp wrangler.toml.old wrangler.toml

# Export each table
tables="users achievements user_achievements levels training_materials tests questions answer_options boss_level_tasks user_streaks leaderboard activity_log pathways pathway_levels pathway_enrollments cohort_groups cohort_members cohort_pathways user_progress signoff_requests test_attempts user_answers boss_consultant_relationships"

for table in $tables; do
    echo "Exporting $table..."
    npx wrangler d1 execute training-platform-production --remote --command="SELECT * FROM $table" --json > "export_${table}.json" 2>&1
done

echo "Export complete!"
ls -lh export_*.json
