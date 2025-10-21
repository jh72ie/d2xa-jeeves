-- Setup Personas and Initialize Jeeves
-- Run this in Neon Dashboard → SQL Editor

-- Step 1: Create/Update Personas for notifications
-- TODO: Replace email addresses with actual customer emails!

INSERT INTO "Persona" (name, email, "sendNotification", "createdAt", "updatedAt")
VALUES
  ('Mark', 'mark@customer-company.com', true, NOW(), NOW()),
  ('Facilities Manager', 'facilities@customer-company.com', true, NOW(), NOW()),
  ('Building Operations', 'operations@customer-company.com', true, NOW(), NOW()),
  ('Maintenance Team', 'maintenance@customer-company.com', false, NOW(), NOW())
ON CONFLICT (name)
DO UPDATE SET
  email = EXCLUDED.email,
  "sendNotification" = EXCLUDED."sendNotification",
  "updatedAt" = NOW();

-- Step 2: Initialize/Update JeevesState
-- Ensures ingestion is disabled by default (to save bandwidth)

INSERT INTO "JeevesState" (
  enabled,
  "ingestionEnabled",
  "analysisInterval",
  "monitoredStreams",
  "totalDiscoveries",
  "createdAt",
  "updatedAt"
)
VALUES (
  false,
  false,
  '5min',
  '[]'::jsonb,
  '0',
  NOW(),
  NOW()
)
ON CONFLICT (id)
DO UPDATE SET
  "ingestionEnabled" = false,
  "updatedAt" = NOW();

-- Step 3: Verify setup
SELECT 'Setup complete!' as status;

-- Display created personas
SELECT
  name,
  email,
  CASE WHEN "sendNotification" = true THEN '🔔 Notifications ON' ELSE '🔕 Notifications OFF' END as notifications,
  "createdAt"
FROM "Persona"
ORDER BY name;

-- Display JeevesState
SELECT
  enabled as "Jeeves Enabled",
  "ingestionEnabled" as "Data Ingestion",
  "analysisInterval" as "Analysis Interval",
  "totalDiscoveries" as "Total Discoveries",
  "lastAnalysisAt" as "Last Analysis"
FROM "JeevesState";
