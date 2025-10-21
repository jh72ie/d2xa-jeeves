-- Jeeves Activity Log
-- Stores execution logs for visibility in the UI

CREATE TABLE IF NOT EXISTS "JeevesActivityLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "executionId" UUID NOT NULL,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  level VARCHAR(20) NOT NULL DEFAULT 'info', -- info, success, warning, error
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast queries by execution
CREATE INDEX IF NOT EXISTS "idx_jeeves_activity_executionId" ON "JeevesActivityLog"("executionId");

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS "idx_jeeves_activity_timestamp" ON "JeevesActivityLog"("timestamp" DESC);

-- Auto-cleanup old logs (keep last 7 days)
-- Run this periodically or set up a cron job
-- DELETE FROM "JeevesActivityLog" WHERE "timestamp" < NOW() - INTERVAL '7 days';
