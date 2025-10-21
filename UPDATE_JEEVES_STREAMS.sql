-- Update JeevesState monitored streams to match actual MQTT payload
-- Run this to fix the monitored streams configuration

-- This updates the existing JeevesState record with correct stream IDs
UPDATE "JeevesState"
SET "monitoredStreams" = ARRAY[
  -- Direct MQTT streams (raw sensor data)
  'fcu-201-effectsetpt',      -- Effective setpoint temperature
  'fcu-201-spacetemp',         -- Current space temperature
  'fcu-201-heatoutput',        -- Heat valve output %
  'fcu-201-cooloutput',        -- Cool valve output %
  'fcu-201-setpoint',          -- User setpoint
  'fcu-201-effectoccup',       -- Occupancy state (enum converted to numeric)
  'fcu-201-fanspeedstate',     -- Fan state (enum converted to numeric)
  -- Parsed streams (processed by ingestion worker)
  'fcu-201-parsed-spacetemp',
  'fcu-201-parsed-effectsetpoint',
  'fcu-201-parsed-usersetpoint',
  'fcu-201-parsed-heatoutput',
  'fcu-201-parsed-cooloutput',
  'fcu-201-parsed-status'
],
"updatedAt" = NOW()
WHERE id IS NOT NULL;

-- Verify the update
SELECT
  id,
  "monitoredStreams",
  "updatedAt"
FROM "JeevesState";
