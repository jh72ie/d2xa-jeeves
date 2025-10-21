-- Complete Database Setup for Neon
-- Run this in Neon Dashboard → SQL Editor
-- This creates all tables needed for Jeeves

-- Step 1: Create base tables (from migration 0000)
CREATE TABLE IF NOT EXISTS "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"password" varchar(64)
);

CREATE TABLE IF NOT EXISTS "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"lastContext" jsonb
);

CREATE TABLE IF NOT EXISTS "Message_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "Vote_v2" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	PRIMARY KEY("chatId", "messageId")
);

CREATE TABLE IF NOT EXISTS "Document" (
	"id" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"kind" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL,
	PRIMARY KEY("id", "createdAt")
);

CREATE TABLE IF NOT EXISTS "Suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "Stream" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);

-- Step 2: Create Persona tables
CREATE TABLE IF NOT EXISTS "Persona" (
	"name" text PRIMARY KEY NOT NULL,
	"email" text,
	"sendNotification" boolean NOT NULL DEFAULT false,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "persona_name_idx" ON "Persona" ("name");

CREATE TABLE IF NOT EXISTS "UserLog" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"personaName" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb,
	"createdAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "userlog_persona_idx" ON "UserLog" ("personaName");
CREATE INDEX IF NOT EXISTS "userlog_created_idx" ON "UserLog" ("createdAt");

CREATE TABLE IF NOT EXISTS "PersonaMemory" (
	"personaName" text PRIMARY KEY NOT NULL,
	"summary" text,
	"traits" jsonb,
	"updatedAt" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "persona_mem_idx" ON "PersonaMemory" ("personaName");

-- Step 3: Create Published Dashboard tables
CREATE TABLE IF NOT EXISTS "PublishedDashboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid,
	"title" text NOT NULL,
	"description" text,
	"html" text NOT NULL,
	"script" text NOT NULL,
	"cardId" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL UNIQUE,
	"accessToken" varchar(255) NOT NULL UNIQUE,
	"password" varchar(255),
	"expiresAt" timestamp,
	"maxViews" text,
	"currentViews" text DEFAULT '0' NOT NULL,
	"streams" jsonb,
	"config" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT NOW() NOT NULL,
	"updatedAt" timestamp DEFAULT NOW() NOT NULL,
	"lastAccessedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "PublishedDashboardAccess" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboardId" uuid NOT NULL,
	"accessedAt" timestamp DEFAULT NOW() NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"referer" text,
	"country" varchar(2),
	"city" varchar(100),
	"sessionId" varchar(255),
	"durationSeconds" text
);

-- Step 4: Create Jeeves tables
CREATE TABLE IF NOT EXISTS "JeevesState" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"ingestionEnabled" boolean DEFAULT true NOT NULL,
	"analysisInterval" varchar(20) DEFAULT '1hour' NOT NULL,
	"lastAnalysisAt" timestamp,
	"nextAnalysisAt" timestamp,
	"lastExecutionStartedAt" timestamp,
	"monitoredStreams" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totalDiscoveries" text DEFAULT '0' NOT NULL,
	"createdAt" timestamp DEFAULT NOW() NOT NULL,
	"updatedAt" timestamp DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "JeevesDiscovery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discoveredAt" timestamp DEFAULT NOW() NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"severity" varchar(20) DEFAULT 'normal' NOT NULL,
	"confidence" text,
	"aiReasoning" text NOT NULL,
	"aiEvidence" jsonb NOT NULL,
	"aiHypothesis" text,
	"aiRecommendations" jsonb,
	"dashboardId" uuid,
	"dashboardSlug" varchar(255),
	"visualReportUrl" text,
	"personaDashboards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intendedRecipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "JeevesNotification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discoveryId" uuid NOT NULL,
	"personaName" text NOT NULL,
	"format" text,
	"subject" text,
	"bodyHtml" text NOT NULL,
	"bodyText" text,
	"summaryOneLiner" text,
	"embedDashboardUrl" text,
	"embedChartImages" jsonb,
	"embedDataTable" jsonb,
	"sentAt" timestamp DEFAULT NOW() NOT NULL,
	"viewedAt" timestamp,
	"acknowledgedAt" timestamp,
	"feedback" jsonb
);

CREATE TABLE IF NOT EXISTS "JeevesLearning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discoveryId" uuid,
	"notificationId" uuid,
	"personaName" text,
	"actionTaken" text,
	"outcome" text,
	"feedbackScore" text,
	"learnedPattern" text,
	"createdAt" timestamp DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "JeevesActivityLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executionId" uuid NOT NULL,
	"timestamp" timestamp DEFAULT NOW() NOT NULL,
	"level" varchar(20) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- Step 5: Create Telemetry tables
CREATE TABLE IF NOT EXISTS "TelemetryTick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sensorId" text NOT NULL,
	"personaName" text,
	"ts" timestamp with time zone NOT NULL,
	"value" double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS "TelemetryAnomaly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sensorId" text NOT NULL,
	"personaName" text,
	"ts" timestamp with time zone NOT NULL,
	"value" double precision NOT NULL,
	"score" double precision,
	"reason" text,
	"createdAt" timestamp with time zone NOT NULL
);

-- Step 6: Add Foreign Keys
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "PublishedDashboard" ADD CONSTRAINT "PublishedDashboard_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "PublishedDashboard" ADD CONSTRAINT "PublishedDashboard_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "PublishedDashboardAccess" ADD CONSTRAINT "PublishedDashboardAccess_dashboardId_PublishedDashboard_id_fk" FOREIGN KEY ("dashboardId") REFERENCES "public"."PublishedDashboard"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "JeevesNotification" ADD CONSTRAINT "JeevesNotification_discoveryId_JeevesDiscovery_id_fk" FOREIGN KEY ("discoveryId") REFERENCES "public"."JeevesDiscovery"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "JeevesLearning" ADD CONSTRAINT "JeevesLearning_discoveryId_JeevesDiscovery_id_fk" FOREIGN KEY ("discoveryId") REFERENCES "public"."JeevesDiscovery"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "JeevesLearning" ADD CONSTRAINT "JeevesLearning_notificationId_JeevesNotification_id_fk" FOREIGN KEY ("notificationId") REFERENCES "public"."JeevesNotification"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Done! All tables created
SELECT 'Database setup complete!' as status;
