#!/bin/bash
#
# Reset MSE database - Drop all tables and recreate
#
# ⚠️  WARNING: THIS WILL DELETE ALL DATA
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/reset-db.sh
#

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is required"
  exit 1
fi

echo "⚠️  WARNING: This will DELETE ALL MSE data!"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🗑️  Dropping all MSE tables..."

psql "$DATABASE_URL" <<SQL
-- Drop all MSE tables in reverse dependency order
DROP TABLE IF EXISTS mse_ism_scores CASCADE;
DROP TABLE IF EXISTS mse_sophistication_history CASCADE;
DROP TABLE IF EXISTS mse_sophistication_scores CASCADE;
DROP TABLE IF EXISTS mse_self_model_predictions CASCADE;
DROP TABLE IF EXISTS mse_rating_history CASCADE;
DROP TABLE IF EXISTS mse_moral_ratings CASCADE;
DROP TABLE IF EXISTS mse_population_stats CASCADE;
DROP TABLE IF EXISTS mse_consistency_scores CASCADE;
DROP TABLE IF EXISTS mse_coherence_scores CASCADE;
DROP TABLE IF EXISTS mse_capacity_scores CASCADE;
DROP TABLE IF EXISTS mse_gaming_scores CASCADE;
DROP TABLE IF EXISTS mse_consistency_group_items CASCADE;
DROP TABLE IF EXISTS mse_consistency_groups CASCADE;
DROP TABLE IF EXISTS mse_axis_scores CASCADE;
DROP TABLE IF EXISTS mse_exam_snapshots CASCADE;
DROP TABLE IF EXISTS mse_agent_profiles CASCADE;
DROP TABLE IF EXISTS mse_responses CASCADE;
DROP TABLE IF EXISTS mse_evaluation_runs CASCADE;
DROP TABLE IF EXISTS mse_version_items CASCADE;
DROP TABLE IF EXISTS mse_items CASCADE;
DROP TABLE IF EXISTS mse_dilemma_families CASCADE;
DROP TABLE IF EXISTS mse_exam_versions CASCADE;
DROP TABLE IF EXISTS mse_axes CASCADE;

-- Drop enums
DROP TYPE IF EXISTS mse_axis_category CASCADE;
DROP TYPE IF EXISTS mse_dilemma_type CASCADE;
DROP TYPE IF EXISTS mse_variant_type CASCADE;
DROP TYPE IF EXISTS mse_run_status CASCADE;
DROP TYPE IF EXISTS mse_alignment_type CASCADE;
DROP TYPE IF EXISTS mse_meta_ethical_type CASCADE;
DROP TYPE IF EXISTS mse_exam_version_status CASCADE;

SQL

echo "✅ All MSE tables dropped"
echo ""
echo "Running setup..."
echo ""

# Run setup
./scripts/setup-db.sh
