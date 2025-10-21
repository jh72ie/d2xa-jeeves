-- Update JeevesState monitored streams to match actual MQTT payload
-- Run this to fix the monitored streams configuration

-- This updates the existing JeevesState record with correct stream IDs
UPDATE "JeevesState"
SET "monitoredStreams" = ARRAY[
  -- Direct MQTT streams (raw sensor data)
  'fcu-01_04-effectsetpt',      -- Effective setpoint temperature
  'fcu-01_04-spacetemp',         -- Current space temperature
  'fcu-01_04-heatoutput',        -- Heat valve output %
  'fcu-01_04-cooloutput',        -- Cool valve output %
  'fcu-01_04-setpoint',          -- User setpoint
  'fcu-01_04-effectoccup',       -- Occupancy state (enum converted to numeric)
  'fcu-01_04-fanspeedstate',     -- Fan state (enum converted to numeric)
  -- Parsed streams (processed by ingestion worker)
  'fcu-01_04-parsed-spacetemp',
  'fcu-01_04-parsed-effectsetpoint',
  'fcu-01_04-parsed-usersetpoint',
  'fcu-01_04-parsed-heatoutput',
  'fcu-01_04-parsed-cooloutput',
  'fcu-01_04-parsed-status'
],
"updatedAt" = NOW()
WHERE id IS NOT NULL;

-- Verify the update
SELECT
  id,
  "monitoredStreams",
  "updatedAt"
FROM "JeevesState";
