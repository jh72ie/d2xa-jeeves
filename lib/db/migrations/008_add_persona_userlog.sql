-- Persona
CREATE TABLE IF NOT EXISTS "Persona" (
  "name" text PRIMARY KEY NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "persona_name_idx" ON "Persona" ("name");

-- UserLog
CREATE TABLE IF NOT EXISTS "UserLog" (
  "id" uuid PRIMARY KEY NOT NULL,
  "personaName" text NOT NULL,
  "kind" text NOT NULL,
  "content" text NOT NULL,
  "meta" jsonb,
  "createdAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "userlog_persona_idx" ON "UserLog" ("personaName");
CREATE INDEX IF NOT EXISTS "userlog_created_idx" ON "UserLog" ("createdAt");

-- PersonaMemory
CREATE TABLE IF NOT EXISTS "PersonaMemory" (
  "personaName" text PRIMARY KEY NOT NULL,
  "summary" text,
  "traits" jsonb,
  "updatedAt" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "persona_mem_idx" ON "PersonaMemory" ("personaName");
