-- Update JeevesState monitored streams to match actual MQTT payload
-- Run this to fix the monitored streams configuration

-- This updates the existing JeevesState record with correct stream IDs
UPDATE "JeevesState"
SET "monitoredStreams" = ARRAY[
  -- Direct MQTT streams (raw sensor data)
  'fcu-01_04-h_o_a',
  'fcu-01_04-fan_fault',
  'fcu-01_04-fan_status',
  'fcu-01_04-wall_adjuster',
  'fcu-01_04-local_setpoint',
  'fcu-01_04-return_air_temp',
  'fcu-01_04-supply_air_temp',
  'fcu-01_04-wall_stat_fitted',
  'fcu-01_04-occupation_status',
  'fcu-01_04-cooling_override_%',
  'fcu-01_04-effective_setpoint',
  'fcu-01_04-heating_override_%',
  'fcu-01_04-fcu_clg_check_failure',
  'fcu-01_04-fcu_htg_check_failure',
  'fcu-01_04-cooling_valve_position',
  'fcu-01_04-heating_valve_position',
  'fcu-01_04-enable_cooling_override',
  'fcu-01_04-enable_heating_override',
  'fcu-01_04-fcu_clg_exercise_failure',
  'fcu-01_04-fcu_htg_exercise_failure',
  -- Parsed streams (processed by ingestion worker)
  'fcu-01_04-parsed-h_o_a',
  'fcu-01_04-parsed-fan_fault',
  'fcu-01_04-parsed-fan_status',
  'fcu-01_04-parsed-wall_adjuster',
  'fcu-01_04-parsed-local_setpoint',
  'fcu-01_04-parsed-return_air_temp',
  'fcu-01_04-parsed-supply_air_temp',
  'fcu-01_04-parsed-wall_stat_fitted',
  'fcu-01_04-parsed-occupation_status',
  'fcu-01_04-parsed-cooling_override_%',
  'fcu-01_04-parsed-effective_setpoint',
  'fcu-01_04-parsed-heating_override_%',
  'fcu-01_04-parsed-fcu_clg_check_failure',
  'fcu-01_04-parsed-fcu_htg_check_failure',
  'fcu-01_04-parsed-cooling_valve_position',
  'fcu-01_04-parsed-heating_valve_position',
  'fcu-01_04-parsed-enable_cooling_override',
  'fcu-01_04-parsed-enable_heating_override',
  'fcu-01_04-parsed-fcu_clg_exercise_failure',
  'fcu-01_04-parsed-fcu_htg_exercise_failure',
],
"updatedAt" = NOW()
WHERE id IS NOT NULL;

-- Verify the update
SELECT
  id,
  "monitoredStreams",
  "updatedAt"
FROM "JeevesState";
