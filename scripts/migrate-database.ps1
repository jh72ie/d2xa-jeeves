# Database Migration Script for Windows (PowerShell)
# Export all data EXCEPT telemetry from old DB to new DB

param(
    [Parameter(Mandatory=$true)]
    [string]$OldPostgresUrl,

    [Parameter(Mandatory=$true)]
    [string]$NewPostgresUrl
)

Write-Host "🗄️  Database Migration: Old Account → New Account (Excluding Telemetry)" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# Tables to migrate (all except TelemetryTick and TelemetryAnomaly)
$tables = @(
    "User",
    "Chat",
    "Message_v2",
    "Vote_v2",
    "Document",
    "Suggestion",
    "Stream",
    "PublishedDashboard",
    "PublishedDashboardAccess",
    "JeevesState",
    "JeevesDiscovery",
    "JeevesNotification",
    "JeevesLearning",
    "JeevesActivityLog",
    "Persona",
    "UserLog",
    "PersonaMemory"
)

$tempDir = "$env:TEMP\jeeves_migration"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host "📊 Step 1: Exporting data from old database..." -ForegroundColor Yellow
Write-Host ""

foreach ($table in $tables) {
    Write-Host "  → Exporting: $table" -ForegroundColor Gray

    $csvPath = "$tempDir\$table.csv"
    $exportCmd = "\copy `"$table`" TO '$csvPath' CSV HEADER;"

    # Export from old database
    $exportCmd | psql $OldPostgresUrl 2>&1 | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ⚠️  Warning: Could not export $table (might be empty)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Export complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📥 Step 2: Importing to new database..." -ForegroundColor Yellow
Write-Host ""

foreach ($table in $tables) {
    $csvPath = "$tempDir\$table.csv"

    if (Test-Path $csvPath) {
        Write-Host "  → Importing: $table" -ForegroundColor Gray

        $importCmd = "\copy `"$table`" FROM '$csvPath' CSV HEADER;"
        $importCmd | psql $NewPostgresUrl 2>&1 | Out-Null

        if ($LASTEXITCODE -ne 0) {
            Write-Host "    ⚠️  Warning: Could not import $table" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "🧹 Step 3: Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "✅ Migration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Verification:" -ForegroundColor Cyan

$verifyQuery = @"
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
"@

$verifyQuery | psql $NewPostgresUrl

Write-Host ""
Write-Host "✅ Done! Update your Vercel environment variables:" -ForegroundColor Green
Write-Host "   POSTGRES_URL=$NewPostgresUrl" -ForegroundColor Cyan
