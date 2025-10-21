-- Migration: Add personaDashboards field to JeevesDiscovery
-- Enables storing multiple persona-specific dashboards per discovery

ALTER TABLE "JeevesDiscovery"
ADD COLUMN IF NOT EXISTS "personaDashboards" jsonb DEFAULT '[]'::jsonb NOT NULL;

COMMENT ON COLUMN "JeevesDiscovery"."personaDashboards" IS
  'Array of persona-specific dashboards: [{ personaName, dashboardId, dashboardUrl, format, createdAt }]. Each persona gets a tailored dashboard based on their preferences.';
