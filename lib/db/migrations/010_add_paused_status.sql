-- Migration: Add 'paused' status to PublishedDashboard
-- Description: Update status enum to include 'paused' option
-- Date: 2025-10-01

-- Drop the existing check constraint
ALTER TABLE "PublishedDashboard" DROP CONSTRAINT IF EXISTS "PublishedDashboard_status_check";

-- Add the new check constraint with 'paused' included
ALTER TABLE "PublishedDashboard" ADD CONSTRAINT "PublishedDashboard_status_check"
CHECK (status IN ('active', 'expired', 'revoked', 'paused'));