#!/bin/bash
#
# Setup MSE database - Run all migrations and seed data
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/setup-db.sh
#

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is required"
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/../migrations"

echo "🚀 Setting up MSE database..."
echo ""

# Run core migrations
echo "📦 Running core migrations..."
for file in "$MIGRATIONS_DIR"/00*.sql; do
  if [ -f "$file" ]; then
    echo "   → $(basename "$file")"
    psql "$DATABASE_URL" -f "$file"
  fi
done

echo ""
echo "🌱 Loading seed data..."
for file in "$MIGRATIONS_DIR"/seed/*.sql; do
  if [ -f "$file" ]; then
    echo "   → $(basename "$file")"
    psql "$DATABASE_URL" -f "$file"
  fi
done

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo '  1. Verify tables: psql "$DATABASE_URL" -c '"'"'\\dt mse_*'"'"
echo '  2. Check axes: psql "$DATABASE_URL" -c '"'"'SELECT COUNT(*) FROM mse_axes'"'"
echo '  3. Check items: psql "$DATABASE_URL" -c '"'"'SELECT COUNT(*) FROM mse_items'"'"
