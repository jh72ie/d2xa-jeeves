-- ============================================================================
-- FCU-201 Monitoring Setup
--
-- This script:
-- 1. Configures Jeeves to monitor FCU-201 streams
-- 2. Creates index for faster queries
-- 3. Sets up automatic 48-hour data cleanup
-- ============================================================================

-- Step 1: Configure Jeeves to monitor all FCU-201 streams
-- Note: Run this AFTER the ingestion worker has created some data
-- This version handles the case where no data exists yet (returns empty array)

UPDATE "JeevesState"
SET "monitoredStreams" = COALESCE(
  (
    SELECT to_jsonb(array_agg(DISTINCT "sensorId"))
    FROM "TelemetryTick"
    WHERE "sensorId" LIKE 'fcu-201-%'
      AND "ts" > NOW() - INTERVAL '1 hour'
  ),
  '[]'::jsonb  -- Return empty array if no streams found
);

-- Verify monitored streams
SELECT "monitoredStreams" FROM "JeevesState";

-- Check how many streams were configured
SELECT jsonb_array_length("monitoredStreams") as stream_count
FROM "JeevesState";

-- Step 2: Create index for faster FCU-201 queries
CREATE INDEX IF NOT EXISTS idx_telemetry_fcu201_ts
ON "TelemetryTick" ("sensorId", "ts" DESC)
WHERE "sensorId" LIKE 'fcu-201-%';

-- Step 3: Create index for timestamp-based cleanup
CREATE INDEX IF NOT EXISTS idx_telemetry_ts_cleanup
ON "TelemetryTick" ("ts")
WHERE "ts" < NOW() - INTERVAL '48 hours';

-- ============================================================================
-- CLEANUP QUERIES (Run manually or via cron)
-- ============================================================================

-- Preview: How many rows would be deleted?
SELECT COUNT(*) as rows_to_delete
FROM "TelemetryTick"
WHERE "ts" < NOW() - INTERVAL '48 hours';

-- Cleanup: Delete data older than 48 hours
-- CAUTION: This permanently deletes data!
DELETE FROM "TelemetryTick"
WHERE "ts" < NOW() - INTERVAL '48 hours';

-- Cleanup: Delete old anomalies too (optional)
DELETE FROM "TelemetryAnomaly"
WHERE "ts" < NOW() - INTERVAL '48 hours';

-- ============================================================================
-- USEFUL QUERIES
-- ============================================================================

-- Check FCU-201 streams and data points
SELECT
  "sensorId",
  COUNT(*) as data_points,
  MIN("ts") as oldest,
  MAX("ts") as newest,
  MAX("ts") - MIN("ts") as time_span
FROM "TelemetryTick"
WHERE "sensorId" LIKE 'fcu-201-%'
GROUP BY "sensorId"
ORDER BY "sensorId";

-- Check total database size
SELECT
  COUNT(*) as total_rows,
  COUNT(DISTINCT "sensorId") as unique_streams,
  pg_size_pretty(pg_total_relation_size('"TelemetryTick"')) as table_size
FROM "TelemetryTick";

-- Check data age distribution
SELECT
  CASE
    WHEN "ts" > NOW() - INTERVAL '1 hour' THEN '< 1 hour'
    WHEN "ts" > NOW() - INTERVAL '6 hours' THEN '1-6 hours'
    WHEN "ts" > NOW() - INTERVAL '24 hours' THEN '6-24 hours'
    WHEN "ts" > NOW() - INTERVAL '48 hours' THEN '24-48 hours'
    ELSE '> 48 hours'
  END as age_bucket,
  COUNT(*) as row_count
FROM "TelemetryTick"
GROUP BY age_bucket
ORDER BY age_bucket;

-- Get latest values for all FCU-201 streams
SELECT DISTINCT ON ("sensorId")
  "sensorId",
  "value",
  "ts"
FROM "TelemetryTick"
WHERE "sensorId" LIKE 'fcu-201-%'
ORDER BY "sensorId", "ts" DESC;

-- ============================================================================
-- REPLACEMENT OF FAKE STREAMS
-- ============================================================================

-- Optional: Remove old fake stream data to clean up
DELETE FROM "TelemetryTick"
WHERE "sensorId" IN ('temp-001', 'humid-001');

DELETE FROM "TelemetryAnomaly"
WHERE "sensorId" IN ('temp-001', 'humid-001');
