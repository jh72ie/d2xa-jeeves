-- Migration: Update Jeeves Analysis Interval Options
-- Description: Change from minute-based (1min, 2min, 3min, 5min) to hour-based (1hour, 3hour, 6hour, 24hour) intervals
-- Date: 2025-10-13

-- Drop the old check constraint
ALTER TABLE "JeevesState"
  DROP CONSTRAINT IF EXISTS "JeevesState_analysisInterval_check";

-- Add new check constraint with hour-based intervals
ALTER TABLE "JeevesState"
  ADD CONSTRAINT "JeevesState_analysisInterval_check"
  CHECK ("analysisInterval" IN ('1hour', '3hour', '6hour', '24hour'));

-- Update the column type to accommodate longer values like "24hour"
ALTER TABLE "JeevesState"
  ALTER COLUMN "analysisInterval" TYPE VARCHAR(20);

-- Update existing rows to use hour-based format (convert old values to 1hour)
UPDATE "JeevesState"
  SET "analysisInterval" = '1hour'
  WHERE "analysisInterval" IN ('1min', '2min', '3min', '5min');

-- Update the default value
ALTER TABLE "JeevesState"
  ALTER COLUMN "analysisInterval" SET DEFAULT '1hour';
