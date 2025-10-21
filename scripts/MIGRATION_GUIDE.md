# Database Migration Guide: Old Account → New Account (Skip Telemetry)

## Overview

This guide helps you migrate all your Jeeves data to a fresh database in the new account, **excluding telemetry data** which is causing quota issues.

---

## What Gets Migrated ✅

```
✅ User accounts and authentication
✅ Chat history and messages
✅ Published dashboards
✅ Jeeves configuration (enabled, intervals, etc.)
✅ All Jeeves discoveries
✅ All notifications sent
✅ Persona data and memory
✅ User logs and learning data
✅ Activity logs
```

## What Gets Left Behind ❌

```
❌ TelemetryTick (raw sensor readings) - Main storage hog
❌ TelemetryAnomaly (detected anomalies)
```

Fresh telemetry will start collecting once you enable ingestion in new database.

---

## STEP 1: Create New Database in New Account

1. **In new Vercel account dashboard:**
   ```
   Storage → Create Database → Postgres

   Name: jeeves-db
   Region: Washington, D.C., USA (iad1)

   → Create Database
   ```

2. **Copy connection strings:**
   ```
   Click on database → .env.local tab

   Copy:
   POSTGRES_URL="postgres://default:xxx@xxx-pooler.us-east-1.postgres.vercel-storage.com/verceldb"
   POSTGRES_URL_NON_POOLING="postgres://default:xxx@xxx.us-east-1.postgres.vercel-storage.com/verceldb"
   ```

3. **Save for later:**
   ```
   NEW_POSTGRES_URL = [the URL you just copied]
   ```

---

## STEP 2: Run Migrations on New Database

```bash
# Update .env.local with NEW database
POSTGRES_URL="postgres://default:xxx@NEW-DATABASE-URL"

# Run migrations to create tables
pnpm db:migrate

# Or if that doesn't work:
npx tsx lib/db/migrate.ts
```

**Verify tables created:**
```bash
vercel postgres -- psql

# In psql:
\dt

# Should see all tables:
# User, Chat, Message_v2, JeevesState, JeevesDiscovery,
# TelemetryTick (empty), TelemetryAnomaly (empty), etc.

\q
```

---

## STEP 3: Export Data from Old Database

### Option A: Automated Script (Linux/Mac/WSL)

```bash
# Set both database URLs
export OLD_POSTGRES_URL="postgres://default:xxx@OLD-DATABASE-URL"
export NEW_POSTGRES_URL="postgres://default:xxx@NEW-DATABASE-URL"

# Make script executable
chmod +x scripts/migrate-database.sh

# Run migration
./scripts/migrate-database.sh
```

### Option B: Manual Export (Windows/All Platforms)

```bash
# Connect to OLD database
psql "$OLD_POSTGRES_URL"
```

Then run these commands one by one:

```sql
-- Export Users
\copy "User" TO 'C:/temp/User.csv' CSV HEADER;

-- Export Chats
\copy "Chat" TO 'C:/temp/Chat.csv' CSV HEADER;
\copy "Message_v2" TO 'C:/temp/Message_v2.csv' CSV HEADER;
\copy "Vote_v2" TO 'C:/temp/Vote_v2.csv' CSV HEADER;
\copy "Document" TO 'C:/temp/Document.csv' CSV HEADER;
\copy "Suggestion" TO 'C:/temp/Suggestion.csv' CSV HEADER;
\copy "Stream" TO 'C:/temp/Stream.csv' CSV HEADER;

-- Export Dashboards
\copy "PublishedDashboard" TO 'C:/temp/PublishedDashboard.csv' CSV HEADER;
\copy "PublishedDashboardAccess" TO 'C:/temp/PublishedDashboardAccess.csv' CSV HEADER;

-- Export Jeeves Data
\copy "JeevesState" TO 'C:/temp/JeevesState.csv' CSV HEADER;
\copy "JeevesDiscovery" TO 'C:/temp/JeevesDiscovery.csv' CSV HEADER;
\copy "JeevesNotification" TO 'C:/temp/JeevesNotification.csv' CSV HEADER;
\copy "JeevesLearning" TO 'C:/temp/JeevesLearning.csv' CSV HEADER;
\copy "JeevesActivityLog" TO 'C:/temp/JeevesActivityLog.csv' CSV HEADER;

-- Export Personas
\copy "Persona" TO 'C:/temp/Persona.csv' CSV HEADER;
\copy "UserLog" TO 'C:/temp/UserLog.csv' CSV HEADER;
\copy "PersonaMemory" TO 'C:/temp/PersonaMemory.csv' CSV HEADER;

-- Exit
\q
```

---

## STEP 4: Import Data to New Database

```bash
# Connect to NEW database
psql "$NEW_POSTGRES_URL"
```

Then import:

```sql
-- Import Users
\copy "User" FROM 'C:/temp/User.csv' CSV HEADER;

-- Import Chats
\copy "Chat" FROM 'C:/temp/Chat.csv' CSV HEADER;
\copy "Message_v2" FROM 'C:/temp/Message_v2.csv' CSV HEADER;
\copy "Vote_v2" FROM 'C:/temp/Vote_v2.csv' CSV HEADER;
\copy "Document" FROM 'C:/temp/Document.csv' CSV HEADER;
\copy "Suggestion" FROM 'C:/temp/Suggestion.csv' CSV HEADER;
\copy "Stream" FROM 'C:/temp/Stream.csv' CSV HEADER;

-- Import Dashboards
\copy "PublishedDashboard" FROM 'C:/temp/PublishedDashboard.csv' CSV HEADER;
\copy "PublishedDashboardAccess" FROM 'C:/temp/PublishedDashboardAccess.csv' CSV HEADER;

-- Import Jeeves Data
\copy "JeevesState" FROM 'C:/temp/JeevesState.csv' CSV HEADER;
\copy "JeevesDiscovery" FROM 'C:/temp/JeevesDiscovery.csv' CSV HEADER;
\copy "JeevesNotification" FROM 'C:/temp/JeevesNotification.csv' CSV HEADER;
\copy "JeevesLearning" FROM 'C:/temp/JeevesLearning.csv' CSV HEADER;
\copy "JeevesActivityLog" FROM 'C:/temp/JeevesActivityLog.csv' CSV HEADER;

-- Import Personas
\copy "Persona" FROM 'C:/temp/Persona.csv' CSV HEADER;
\copy "UserLog" FROM 'C:/temp/UserLog.csv' CSV HEADER;
\copy "PersonaMemory" FROM 'C:/temp/PersonaMemory.csv' CSV HEADER;

-- Verify migration
SELECT
  'User' as table_name, COUNT(*) as row_count
FROM "User"
UNION ALL
SELECT 'Chat', COUNT(*) FROM "Chat"
UNION ALL
SELECT 'JeevesState', COUNT(*) FROM "JeevesState"
UNION ALL
SELECT 'JeevesDiscovery', COUNT(*) FROM "JeevesDiscovery"
UNION ALL
SELECT 'Persona', COUNT(*) FROM "Persona"
UNION ALL
SELECT 'TelemetryTick (should be 0)', COUNT(*) FROM "TelemetryTick"
UNION ALL
SELECT 'TelemetryAnomaly (should be 0)', COUNT(*) FROM "TelemetryAnomaly";

\q
```

---

## STEP 5: Update Vercel Environment Variables

```bash
# In new Vercel project:
Settings → Environment Variables

# Update POSTGRES_URL:
POSTGRES_URL = [NEW database URL]

# Update POSTGRES_URL_NON_POOLING:
POSTGRES_URL_NON_POOLING = [NEW database URL non-pooling]
```

---

## STEP 6: Deploy & Verify

```bash
# Trigger new deployment
Vercel Dashboard → Deployments → Redeploy

# Once deployed, test:
1. ✅ Login works
2. ✅ Chat history shows up
3. ✅ /jeeves console loads with your configuration
4. ✅ Published dashboards still work
5. ✅ Persona data intact
```

---

## STEP 7: Enable Ingestion (When Ready)

```
Visit: https://your-domain.vercel.app/jeeves

Configuration Panel:
→ Toggle ON "FCU Data Ingestion"
→ Save Settings

Fresh telemetry will start collecting every 5 minutes
24h retention keeps database lean
```

---

## Verification Queries

**Check what was migrated:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT COUNT(*) FROM "User") as user_count,
  (SELECT COUNT(*) FROM "Chat") as chat_count,
  (SELECT COUNT(*) FROM "JeevesState") as jeeves_state_count,
  (SELECT COUNT(*) FROM "TelemetryTick") as telemetry_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Check database size:**
```sql
SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
```

---

## Troubleshooting

### "relation does not exist"
**Solution:** Run migrations first (`pnpm db:migrate`)

### "duplicate key value violates unique constraint"
**Solution:** Tables already have data, truncate first or skip import

### "permission denied"
**Solution:** Use correct connection string with write permissions

### Import fails with errors
**Solution:** Check CSV file paths are correct, use absolute paths on Windows

---

## Rollback Plan

If something goes wrong:
1. Old database in old account is untouched
2. Simply update POSTGRES_URL back to old database
3. Redeploy
4. Try migration again

---

## Summary

After migration:
- ✅ Fresh database in new account
- ✅ All important data migrated
- ❌ Old telemetry data left behind
- ✅ Ready to start fresh with reduced quota usage
- ✅ Ingestion toggle gives you control
