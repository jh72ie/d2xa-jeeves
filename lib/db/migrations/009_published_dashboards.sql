-- Migration: Published Dashboards System
-- Description: Add tables for publishing and sharing dashboards via unique URLs
-- Date: 2025-09-30

-- Published Dashboard table
CREATE TABLE "PublishedDashboard" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "chatId" UUID REFERENCES "Chat"(id) ON DELETE SET NULL,

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  html TEXT NOT NULL,
  script TEXT NOT NULL,
  "cardId" VARCHAR NOT NULL,

  -- Publishing
  slug VARCHAR UNIQUE NOT NULL,
  "accessToken" VARCHAR UNIQUE NOT NULL,

  -- Access Control
  password VARCHAR,
  "expiresAt" TIMESTAMP,
  "maxViews" INTEGER,
  "currentViews" INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  streams JSONB,
  config JSONB,

  -- Status
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),

  -- Timestamps
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastAccessedAt" TIMESTAMP
);

-- Indexes for PublishedDashboard
CREATE INDEX "idx_published_slug" ON "PublishedDashboard"(slug);
CREATE INDEX "idx_published_token" ON "PublishedDashboard"("accessToken");
CREATE INDEX "idx_published_user" ON "PublishedDashboard"("userId");
CREATE INDEX "idx_published_status" ON "PublishedDashboard"(status);
CREATE INDEX "idx_published_expires" ON "PublishedDashboard"("expiresAt");

-- Published Dashboard Access tracking table
CREATE TABLE "PublishedDashboardAccess" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "dashboardId" UUID NOT NULL REFERENCES "PublishedDashboard"(id) ON DELETE CASCADE,

  -- Access details
  "accessedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "ipAddress" VARCHAR(45),
  "userAgent" TEXT,
  referer TEXT,
  country VARCHAR(2),
  city VARCHAR(100),

  -- Session tracking
  "sessionId" VARCHAR,
  "durationSeconds" INTEGER
);

-- Indexes for PublishedDashboardAccess
CREATE INDEX "idx_access_dashboard" ON "PublishedDashboardAccess"("dashboardId");
CREATE INDEX "idx_access_time" ON "PublishedDashboardAccess"("accessedAt");
CREATE INDEX "idx_access_ip" ON "PublishedDashboardAccess"("ipAddress");

-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_published_dashboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updatedAt
CREATE TRIGGER trigger_update_published_dashboard_updated_at
  BEFORE UPDATE ON "PublishedDashboard"
  FOR EACH ROW
  EXECUTE FUNCTION update_published_dashboard_updated_at();

-- Function to auto-expire dashboards
CREATE OR REPLACE FUNCTION expire_published_dashboards()
RETURNS void AS $$
BEGIN
  UPDATE "PublishedDashboard"
  SET status = 'expired'
  WHERE status = 'active'
    AND "expiresAt" IS NOT NULL
    AND "expiresAt" < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE "PublishedDashboard" IS 'Stores published dashboards with access controls';
COMMENT ON COLUMN "PublishedDashboard".slug IS 'URL-friendly unique identifier (e.g., temp-anomaly-xk9j2m)';
COMMENT ON COLUMN "PublishedDashboard"."accessToken" IS 'Cryptographic token for internal tracking';
COMMENT ON COLUMN "PublishedDashboard".password IS 'Bcrypt hashed password for optional protection';
COMMENT ON COLUMN "PublishedDashboard".streams IS 'JSON array of stream configurations used in dashboard';
COMMENT ON COLUMN "PublishedDashboard".config IS 'JSON configuration for dashboard (refreshRate, theme, etc)';

COMMENT ON TABLE "PublishedDashboardAccess" IS 'Tracks every access to published dashboards for analytics';
COMMENT ON COLUMN "PublishedDashboardAccess"."durationSeconds" IS 'How long the user viewed the dashboard';