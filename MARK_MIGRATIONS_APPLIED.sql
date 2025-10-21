-- Mark All Migrations as Applied in Drizzle Tracking Table
-- Run this in Neon Dashboard → SQL Editor AFTER running NEON_SETUP.sql
--
-- This tells Drizzle that all migrations have already been applied,
-- preventing the "column already exists" error during Vercel builds.

-- Create Drizzle's migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  "id" SERIAL PRIMARY KEY,
  "hash" TEXT NOT NULL,
  "created_at" BIGINT
);

-- First, check if any migrations are already tracked
SELECT 'Current migrations:' as status;
SELECT * FROM "__drizzle_migrations" ORDER BY "id";

-- Delete existing entries to start fresh (in case they're wrong)
DELETE FROM "__drizzle_migrations";

-- Mark migrations 0000-0007 as applied
-- Using the exact tag names from _journal.json
INSERT INTO "__drizzle_migrations" ("hash", "created_at")
VALUES
  ('0000_keen_devos', extract(epoch from now()) * 1000),
  ('0001_sparkling_blue_marvel', extract(epoch from now()) * 1000),
  ('0002_wandering_riptide', extract(epoch from now()) * 1000),
  ('0003_cloudy_glorian', extract(epoch from now()) * 1000),
  ('0004_odd_slayback', extract(epoch from now()) * 1000),
  ('0005_wooden_whistler', extract(epoch from now()) * 1000),
  ('0006_marvelous_frog_thor', extract(epoch from now()) * 1000),
  ('0007_flowery_ben_parker', extract(epoch from now()) * 1000);

-- Verify migrations are now marked as applied
SELECT 'After marking migrations:' as status;
SELECT * FROM "__drizzle_migrations" ORDER BY "id";

-- Summary
SELECT '✅ Migration tracking complete!' as "Status";
SELECT 'Drizzle should now skip migrations 0000-0007 during build' as "Result";
