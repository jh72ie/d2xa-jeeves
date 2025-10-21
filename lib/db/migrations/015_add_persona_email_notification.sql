-- Add email and sendNotification columns to Persona table
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "sendNotification" boolean NOT NULL DEFAULT false;
