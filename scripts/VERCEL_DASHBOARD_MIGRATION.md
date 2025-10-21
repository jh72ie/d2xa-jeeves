# Vercel Dashboard Migration Guide
## (No local access needed - all through web interface)

---

## Overview

This guide migrates your Jeeves data between Vercel accounts using **only the Vercel Dashboard query interface**. No local tools required.

---

## STEP 1: Create New Database

```
New Account → Storage → Create Database → Postgres
Name: jeeves-db
Region: iad1 (Washington DC)
→ Create

Copy POSTGRES_URL for later
```

---

## STEP 2: Deploy to Run Migrations

```
1. Transferred Project → Settings → Environment Variables
2. Update POSTGRES_URL to new database
3. Save
4. Deployments → Redeploy

Wait for deployment to succeed
```

---

## STEP 3: Export from Old Database

### Small Tables (Direct INSERT statements)

For small tables, we can generate INSERT statements directly.

#### Connect to OLD database:
```
Old Account → Storage → Old Database → Query
```

#### Export Users:
```sql
SELECT
  'INSERT INTO "User" (id, email, password) VALUES ' ||
  string_agg(
    format('(%L, %L, %L)', id, email, password),
    ', '
  ) || ';'
FROM "User";
```

Copy the output (the INSERT statement), you'll paste it into the new database.

#### Export JeevesState:
```sql
SELECT
  'INSERT INTO "JeevesState" (id, enabled, "ingestionEnabled", "analysisInterval", "lastAnalysisAt", "nextAnalysisAt", "lastExecutionStartedAt", "monitoredStreams", "totalDiscoveries", "createdAt", "updatedAt") VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, enabled, "ingestionEnabled", "analysisInterval", "lastAnalysisAt",
      "nextAnalysisAt", "lastExecutionStartedAt", "monitoredStreams"::text,
      "totalDiscoveries", "createdAt", "updatedAt"
    ),
    ', '
  ) || ';'
FROM "JeevesState";
```

#### Export Personas:
```sql
SELECT
  'INSERT INTO "Persona" (id, name, role, email, "phoneNumber", "notificationPreference", "createdAt") VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L)',
      id, name, role, email, "phoneNumber", "notificationPreference", "createdAt"
    ),
    ', '
  ) || ';'
FROM "Persona";
```

---

## STEP 4: Alternative - Table by Table Copy

If tables are too large for INSERT generation, use this approach:

### Export to JSON (works for medium-sized tables)

#### In OLD database query interface:

```sql
-- Get JeevesState as JSON
SELECT json_agg(row_to_json(t))
FROM (SELECT * FROM "JeevesState") t;
```

Copy the JSON output.

#### In NEW database query interface:

```sql
-- Import from JSON
INSERT INTO "JeevesState"
SELECT * FROM json_populate_recordset(NULL::"JeevesState",
'[paste JSON here]'::json);
```

---

## STEP 5: Table-by-Table Migration Commands

Use these queries in **OLD database** to generate INSERT statements, then run them in **NEW database**.

### 1. Users
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "User" VALUES ' ||
  string_agg(format('(%L, %L, %L)', id, email, password), ', ') || ';'
FROM "User";
```

### 2. Chats
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "Chat" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L)',
      id, "createdAt", title, "userId", visibility, "lastContext"::text
    ), ', '
  ) || ';'
FROM "Chat";
```

### 3. Messages
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "Message_v2" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L)',
      id, "chatId", role, parts::text, attachments::text, "createdAt"
    ), ', '
  ) || ';'
FROM "Message_v2"
LIMIT 100; -- Do in batches if too many
```

### 4. Jeeves State
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "JeevesState" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, enabled, "ingestionEnabled", "analysisInterval",
      "lastAnalysisAt", "nextAnalysisAt", "lastExecutionStartedAt",
      "monitoredStreams"::text, "totalDiscoveries", "createdAt", "updatedAt"
    ), ', '
  ) || ';'
FROM "JeevesState";
```

### 5. Jeeves Discoveries
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "JeevesDiscovery" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, "discoveredAt", title, category, severity, confidence,
      "aiReasoning", "aiEvidence"::text, "aiHypothesis",
      "aiRecommendations"::text, "dashboardId", "dashboardSlug",
      "visualReportUrl", "personaDashboards"::text, "intendedRecipients"::text
    ), ', '
  ) || ' ON CONFLICT DO NOTHING;'
FROM "JeevesDiscovery"
LIMIT 50; -- Do in batches
```

### 6. Jeeves Notifications
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "JeevesNotification" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, "discoveryId", "personaName", format, subject,
      "bodyHtml", "bodyText", "summaryOneLiner", "embedDashboardUrl",
      "embedChartImages"::text, "embedDataTable"::text, "sentAt", "viewedAt"
    ), ', '
  ) || ' ON CONFLICT DO NOTHING;'
FROM "JeevesNotification"
LIMIT 50; -- Do in batches
```

### 7. Personas
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "Persona" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L)',
      id, name, role, email, "phoneNumber", "notificationPreference", "createdAt"
    ), ', '
  ) || ' ON CONFLICT DO NOTHING;'
FROM "Persona";
```

### 8. Published Dashboards
```sql
-- OLD DB: Generate INSERT
SELECT 'INSERT INTO "PublishedDashboard" VALUES ' ||
  string_agg(
    format('(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, "userId", "chatId", title, description, html, script,
      "cardId", slug, "accessToken", password, "expiresAt", "maxViews",
      "currentViews", streams::text, config::text, status,
      "createdAt", "updatedAt", "lastAccessedAt"
    ), ', '
  ) || ' ON CONFLICT DO NOTHING;'
FROM "PublishedDashboard"
LIMIT 20; -- Do in batches
```

---

## STEP 6: Simpler Approach - pg_dump Alternative

If the above is too complex, here's the SIMPLEST approach:

### Use Vercel's built-in backup feature:

#### In OLD database:
```
Storage → Old Database → Backups → Create Backup

Wait for backup to complete
Download backup file
```

#### In NEW database:
```
Storage → New Database → Settings → Import
Upload the backup file
Wait for import to complete
```

#### Then delete telemetry:
```sql
TRUNCATE TABLE "TelemetryTick" CASCADE;
TRUNCATE TABLE "TelemetryAnomaly" CASCADE;
```

---

## STEP 7: Verify Migration

### In NEW database, run:

```sql
-- Check row counts
SELECT
  'User' as table_name, COUNT(*) as rows FROM "User"
UNION ALL SELECT 'Chat', COUNT(*) FROM "Chat"
UNION ALL SELECT 'Message_v2', COUNT(*) FROM "Message_v2"
UNION ALL SELECT 'JeevesState', COUNT(*) FROM "JeevesState"
UNION ALL SELECT 'JeevesDiscovery', COUNT(*) FROM "JeevesDiscovery"
UNION ALL SELECT 'JeevesNotification', COUNT(*) FROM "JeevesNotification"
UNION ALL SELECT 'Persona', COUNT(*) FROM "Persona"
UNION ALL SELECT 'PublishedDashboard', COUNT(*) FROM "PublishedDashboard"
UNION ALL SELECT 'TelemetryTick (should be 0)', COUNT(*) FROM "TelemetryTick";

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database())) as total_size;
```

---

## STEP 8: Enable Ingestion

```
Visit: https://your-domain.vercel.app/jeeves

Configuration Panel:
→ Toggle ON "FCU Data Ingestion"
→ Save Settings
```

---

## Quick Reference: Tables to Migrate

Priority order (migrate in this sequence):

1. ✅ **User** - User accounts
2. ✅ **Persona** - Team members
3. ✅ **JeevesState** - Jeeves configuration
4. ✅ **Chat** - Chat history
5. ✅ **Message_v2** - Chat messages
6. ✅ **JeevesDiscovery** - Discoveries
7. ✅ **JeevesNotification** - Notifications
8. ✅ **PublishedDashboard** - Dashboards
9. ✅ **UserLog** - Activity logs
10. ✅ **PersonaMemory** - Persona preferences

Skip:
- ❌ **TelemetryTick** - Raw sensor data (storage hog)
- ❌ **TelemetryAnomaly** - Old anomalies

---

## Troubleshooting

### "Too many rows" error
**Solution:** Add `LIMIT 50` to queries, run multiple times with `OFFSET`

### JSON too long
**Solution:** Split into batches using `LIMIT` and `OFFSET`

### Can't paste large INSERT
**Solution:** Use the backup/restore approach instead

### Foreign key errors
**Solution:** Migrate parent tables first (User, Chat before Message)

---

## Time Estimate

- Small dataset (<100 chats): 15 minutes
- Medium dataset (<1000 chats): 30 minutes
- Large dataset: Use backup/restore (fastest)
