-- Migration: Add execution lock field to JeevesState
-- Prevents concurrent analysis runs in serverless environment

ALTER TABLE "JeevesState"
ADD COLUMN "lastExecutionStartedAt" TIMESTAMP;

-- Add comment
COMMENT ON COLUMN "JeevesState"."lastExecutionStartedAt" IS 'Lock timestamp - set when analysis starts, cleared when finished. Used to prevent concurrent runs.';
