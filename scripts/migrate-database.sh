#!/bin/bash
# Database Migration Script: Export all data EXCEPT telemetry

set -e  # Exit on error

echo "🗄️  Database Migration: Old Account → New Account (Excluding Telemetry)"
echo "=========================================================================="

# Check for required environment variables
if [ -z "$OLD_POSTGRES_URL" ]; then
    echo "❌ Error: OLD_POSTGRES_URL not set"
    echo "Usage: OLD_POSTGRES_URL=postgres://... NEW_POSTGRES_URL=postgres://... ./migrate-database.sh"
    exit 1
fi

if [ -z "$NEW_POSTGRES_URL" ]; then
    echo "❌ Error: NEW_POSTGRES_URL not set"
    exit 1
fi

echo "📊 Step 1: Checking old database tables..."
psql "$OLD_POSTGRES_URL" -c "\dt" | grep -E "User|Chat|Jeeves|Persona|Dashboard"

echo ""
echo "📊 Step 2: Checking telemetry table sizes (these will be SKIPPED)..."
psql "$OLD_POSTGRES_URL" -c "
SELECT
  'TelemetryTick' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('\"TelemetryTick\"')) as size
UNION ALL
SELECT
  'TelemetryAnomaly',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('\"TelemetryAnomaly\"'));
"

echo ""
echo "🚀 Step 3: Exporting non-telemetry tables..."

# Define tables to export (ALL except telemetry)
TABLES=(
    "User"
    "Chat"
    "Message_v2"
    "Vote_v2"
    "Document"
    "Suggestion"
    "Stream"
    "PublishedDashboard"
    "PublishedDashboardAccess"
    "JeevesState"
    "JeevesDiscovery"
    "JeevesNotification"
    "JeevesLearning"
    "JeevesActivityLog"
    "Persona"
    "UserLog"
    "PersonaMemory"
)

# Export schema and data for selected tables
for table in "${TABLES[@]}"; do
    echo "  → Exporting: $table"
    pg_dump "$OLD_POSTGRES_URL" \
        --data-only \
        --table="\"$table\"" \
        --file="/tmp/${table}.sql" \
        --no-owner \
        --no-privileges
done

echo ""
echo "✅ Export complete!"
echo ""
echo "📥 Step 4: Importing to new database..."

for table in "${TABLES[@]}"; do
    if [ -f "/tmp/${table}.sql" ]; then
        echo "  → Importing: $table"
        psql "$NEW_POSTGRES_URL" -f "/tmp/${table}.sql" 2>&1 | grep -v "ERROR.*already exists" || true
    fi
done

echo ""
echo "🧹 Step 5: Cleaning up temporary files..."
rm -f /tmp/*.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Verification:"
psql "$NEW_POSTGRES_URL" -c "
SELECT
  'User' as table_name, COUNT(*) as row_count
FROM \"User\"
UNION ALL
SELECT 'Chat', COUNT(*) FROM \"Chat\"
UNION ALL
SELECT 'JeevesState', COUNT(*) FROM \"JeevesState\"
UNION ALL
SELECT 'JeevesDiscovery', COUNT(*) FROM \"JeevesDiscovery\"
UNION ALL
SELECT 'Persona', COUNT(*) FROM \"Persona\"
UNION ALL
SELECT 'TelemetryTick (should be 0)', COUNT(*) FROM \"TelemetryTick\"
UNION ALL
SELECT 'TelemetryAnomaly (should be 0)', COUNT(*) FROM \"TelemetryAnomaly\";
"

echo ""
echo "✅ Done! Update your Vercel environment variables:"
echo "   POSTGRES_URL=$NEW_POSTGRES_URL"
