-- Migration: Jeeves On Duty - AI Butler System
-- Description: Add tables for autonomous AI discovery, visual reports, and personalized notifications
-- Date: 2025-10-02

-- ============================================================================
-- Jeeves Global State
-- ============================================================================
CREATE TABLE "JeevesState" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Configuration
  enabled BOOLEAN NOT NULL DEFAULT false,
  "analysisInterval" VARCHAR(10) NOT NULL DEFAULT '5min' CHECK ("analysisInterval" IN ('1min', '2min', '3min', '5min')),

  -- Scheduling
  "lastAnalysisAt" TIMESTAMP,
  "nextAnalysisAt" TIMESTAMP,

  -- Monitoring
  "monitoredStreams" JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Stats
  "totalDiscoveries" INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Initialize with single row
INSERT INTO "JeevesState" (enabled, "analysisInterval", "monitoredStreams")
VALUES (false, '5min', '["temp-001", "humid-001"]'::jsonb);

COMMENT ON TABLE "JeevesState" IS 'Global configuration for Jeeves AI butler system';
COMMENT ON COLUMN "JeevesState"."monitoredStreams" IS 'JSON array of stream IDs that Jeeves monitors';

-- ============================================================================
-- Jeeves Discoveries (Unconstrained - LLM defines structure)
-- ============================================================================
CREATE TABLE "JeevesDiscovery" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "discoveredAt" TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Core discovery info (LLM-generated)
  title TEXT NOT NULL,
  category TEXT, -- LLM chooses category (not enum!)
  severity VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),

  -- AI reasoning (unconstrained)
  "aiReasoning" TEXT NOT NULL,
  "aiEvidence" JSONB NOT NULL,
  "aiHypothesis" TEXT,
  "aiRecommendations" JSONB,

  -- Visual report (auto-generated dashboard)
  "dashboardId" UUID REFERENCES "PublishedDashboard"(id) ON DELETE SET NULL,
  "dashboardSlug" VARCHAR(255),
  "visualReportUrl" TEXT,

  -- Who should see this (LLM decides)
  "intendedRecipients" JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'notified', 'acknowledged', 'archived')),

  -- Additional metadata
  metadata JSONB
);

CREATE INDEX "idx_jeeves_discovery_time" ON "JeevesDiscovery"("discoveredAt" DESC);
CREATE INDEX "idx_jeeves_discovery_status" ON "JeevesDiscovery"(status);
CREATE INDEX "idx_jeeves_discovery_severity" ON "JeevesDiscovery"(severity);
CREATE INDEX "idx_jeeves_discovery_dashboard" ON "JeevesDiscovery"("dashboardId");

COMMENT ON TABLE "JeevesDiscovery" IS 'Unconstrained AI discoveries - LLM defines what is interesting';
COMMENT ON COLUMN "JeevesDiscovery".category IS 'LLM-chosen category (not predefined enum!)';
COMMENT ON COLUMN "JeevesDiscovery"."aiReasoning" IS 'Why Jeeves thinks this is interesting';
COMMENT ON COLUMN "JeevesDiscovery"."aiEvidence" IS 'Supporting data in any structure LLM wants';
COMMENT ON COLUMN "JeevesDiscovery"."intendedRecipients" IS 'Array of {personaName, reasoning, format}';

-- ============================================================================
-- Jeeves Notifications (Personalized per persona)
-- ============================================================================
CREATE TABLE "JeevesNotification" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "discoveryId" UUID NOT NULL REFERENCES "JeevesDiscovery"(id) ON DELETE CASCADE,
  "personaName" TEXT NOT NULL,

  -- LLM-generated personalized content
  format TEXT,
  subject TEXT,
  "bodyHtml" TEXT NOT NULL,
  "bodyText" TEXT,
  "summaryOneLiner" TEXT,

  -- Embedded visuals
  "embedDashboardUrl" TEXT,
  "embedChartImages" JSONB,
  "embedDataTable" JSONB,

  -- Tracking
  "sentAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "viewedAt" TIMESTAMP,
  "acknowledgedAt" TIMESTAMP,

  -- Feedback
  feedback JSONB,

  CONSTRAINT "jeeves_notification_persona_fk"
    FOREIGN KEY ("personaName") REFERENCES "Persona"(name) ON DELETE CASCADE
);

CREATE INDEX "idx_jeeves_notif_persona" ON "JeevesNotification"("personaName", "sentAt" DESC);
CREATE INDEX "idx_jeeves_notif_discovery" ON "JeevesNotification"("discoveryId");
CREATE INDEX "idx_jeeves_notif_unread" ON "JeevesNotification"("personaName", "viewedAt")
  WHERE "viewedAt" IS NULL;

COMMENT ON TABLE "JeevesNotification" IS 'Personalized notifications for each persona';
COMMENT ON COLUMN "JeevesNotification".format IS 'LLM-described format (not enum!)';
COMMENT ON COLUMN "JeevesNotification"."bodyHtml" IS 'Rich HTML with embedded dashboard iframe';

-- ============================================================================
-- Jeeves Learning (Feedback tracking)
-- ============================================================================
CREATE TABLE "JeevesLearning" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "discoveryId" UUID REFERENCES "JeevesDiscovery"(id) ON DELETE CASCADE,
  "notificationId" UUID REFERENCES "JeevesNotification"(id) ON DELETE CASCADE,
  "personaName" TEXT,

  -- What happened
  "actionTaken" TEXT,
  outcome TEXT,
  "feedbackScore" INTEGER CHECK ("feedbackScore" >= -1 AND "feedbackScore" <= 1),
  "learnedPattern" TEXT,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_jeeves_learning_persona" ON "JeevesLearning"("personaName");
CREATE INDEX "idx_jeeves_learning_discovery" ON "JeevesLearning"("discoveryId");

COMMENT ON TABLE "JeevesLearning" IS 'Tracks feedback to improve future decisions';
COMMENT ON COLUMN "JeevesLearning"."feedbackScore" IS '-1 = not helpful, 0 = neutral, +1 = helpful';

-- ============================================================================
-- Update triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_jeeves_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_jeeves_state_updated_at
  BEFORE UPDATE ON "JeevesState"
  FOR EACH ROW
  EXECUTE FUNCTION update_jeeves_state_updated_at();
