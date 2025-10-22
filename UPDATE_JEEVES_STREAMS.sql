-- Update JeevesState monitored streams to match actual MQTT payload
-- Run this to fix the monitored streams configuration

-- This updates the existing JeevesState record with correct stream IDs
UPDATE "JeevesState"
SET "monitoredStreams" = ARRAY[
  -- Direct MQTT streams (raw sensor data)
  'fcu-01_04-parsed-hoa',
  'fcu-01_04-parsed-fanfault',
  'fcu-01_04-parsed-fanstatus',
  'fcu-01_04-parsed-wallstatfitted',
  'fcu-01_04-parsed-occupationstatus',
  'fcu-01_04-parsed-fcuclgcheckfailure',
  'fcu-01_04-parsed-fcuhtgcheckfailure',
  'fcu-01_04-parsed-enablecoolingoverride',
  'fcu-01_04-parsed-enableheatingoverride',
  'fcu-01_04-walladjuster',
  'fcu-01_04-localsetpoint',
  'fcu-01_04-returnairtemp',
  'fcu-01_04-supplyairtemp',
  'fcu-01_04-coolingoverride',
  'fcu-01_04-effectivesetpoint',
  'fcu-01_04-heatingoverride',
  'fcu-01_04-coolingoverride',
  'fcu-01_04-coolingvalveposition',
  'fcu-01_04-heatingvalveposition',
],
"updatedAt" = NOW()
WHERE id IS NOT NULL;

-- Verify the update
SELECT
  id,
  "monitoredStreams",
  "updatedAt"
FROM "JeevesState";
