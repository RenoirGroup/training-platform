#!/bin/bash

export CLOUDFLARE_API_TOKEN="dUg9UbjVi2s4kbCk0fhwRkMI_nnK_bmpVnBH54GX"
export CLOUDFLARE_ACCOUNT_ID="64eafbdb81651010ebdd24644fa3e2fd"

# Array of tables to export
TABLES=(
  "users"
  "achievements" 
  "user_achievements"
  "levels"
  "training_materials"
  "tests"
  "questions"
  "answer_options"
  "boss_level_tasks"
  "user_streaks"
  "leaderboard"
  "activity_log"
  "pathways"
  "pathway_levels"
  "pathway_enrollments"
  "cohort_groups"
  "cohort_members"
  "cohort_pathways"
  "user_progress"
  "signoff_requests"
  "test_attempts"
  "user_answers"
  "boss_consultant_relationships"
)

echo "-- COMPLETE DATABASE EXPORT FROM OLD PRODUCTION" > final_export.sql
echo "-- Generated: $(date)" >> final_export.sql
echo "" >> final_export.sql

for table in "${TABLES[@]}"; do
  echo "Exporting $table..."
  
  # Get the data as JSON
  npx wrangler d1 execute training-platform-production \
    --remote \
    --command="SELECT * FROM $table" \
    --json > "${table}_export.json" 2>/dev/null
  
  echo "-- Table: $table" >> final_export.sql
done

echo "Export complete! Now converting to SQL..."
