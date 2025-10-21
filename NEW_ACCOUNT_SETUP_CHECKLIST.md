# New Account Setup Checklist

After transferring project to new Vercel account, follow these steps:

---

## ✅ Storage Resources (Must Recreate)

### 1. Vercel Blob (REQUIRED)
```
☐ Storage → Create Database → Blob
  Name: jeeves-blob
  Region: iad1

☐ Copy token: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

☐ Settings → Environment Variables → BLOB_READ_WRITE_TOKEN
  → Edit → Paste new token → Save
```

### 2. Vercel Postgres (REQUIRED)
```
☐ Storage → Create Database → Postgres
  Name: jeeves-db
  Region: iad1

☐ Copy both URLs:
  POSTGRES_URL=postgres://...pooler...
  POSTGRES_URL_NON_POOLING=postgres://...

☐ Settings → Environment Variables
  → POSTGRES_URL → Edit → Paste pooling URL
  → POSTGRES_URL_NON_POOLING → Edit → Paste non-pooling URL
  → Save
```

### 3. Redis/Vercel KV (OPTIONAL but Recommended)
```
☐ Storage → Create Database → KV (or use external Redis)
  Name: jeeves-redis
  Region: iad1

☐ Copy: REDIS_REDIS_URL=redis://...

☐ Settings → Environment Variables → REDIS_REDIS_URL
  → Edit → Paste new URL → Save

Note: Without Redis, deduplication is disabled (workers will log warnings but still work)
```

---

## ✅ Environment Variables to Update

### Storage (New values needed)
- ☐ `BLOB_READ_WRITE_TOKEN` - New Blob store token
- ☐ `POSTGRES_URL` - New database pooling URL
- ☐ `POSTGRES_URL_NON_POOLING` - New database non-pooling URL
- ☐ `REDIS_REDIS_URL` - New Redis/KV URL (optional)

### APIs (Should transfer automatically, verify)
- ☐ `ANTHROPIC_API_KEY` - AI provider
- ☐ `AUTH_SECRET` - NextAuth secret
- ☐ `AI_GATEWAY_API_KEY` - Vercel AI Gateway (if used)

### Inngest (May need reconnection)
- ☐ `INNGEST_SIGNING_KEY` - From Inngest dashboard
- ☐ `INNGEST_EVENT_KEY` - From Inngest dashboard

### Email (If configured)
- ☐ `RESEND_API_KEY` - Should transfer
- ☐ `EMAIL_FROM` - Should transfer

---

## ✅ Integrations to Reconnect

### Inngest (CRITICAL)

**Option 1 - Vercel Integration (Easiest):**
```
☐ Visit: https://vercel.com/integrations/inngest
☐ Click "Add Integration"
☐ Select your transferred project
☐ Auto-configures webhook and env vars
```

**Option 2 - Manual Configuration:**
```
☐ Inngest Dashboard → Apps → nextjs-ai-chatbot
☐ Update webhook URL: https://YOUR-NEW-DOMAIN.vercel.app/api/inngest
☐ Copy signing keys to Vercel env vars
```

---

## ✅ Code Changes

### Enable Migrations (for initial deployment)
```
☐ Edit package.json:
  "build": "tsx lib/db/migrate && next build"

☐ Commit and push:
  git add package.json
  git commit -m "Enable migrations for new database"
  git push
```

### Disable Ingestion (keep quota low initially)
After successful deployment:
```
☐ Visit: https://YOUR-DOMAIN.vercel.app/jeeves
☐ Configuration panel → Toggle OFF "FCU Data Ingestion"
☐ Save Settings
```

---

## ✅ Deployment & Verification

### Initial Deployment
```
☐ Vercel will auto-deploy after git push
☐ Watch build logs for migration success
☐ Wait for deployment to complete
```

### Verify Deployment
```
☐ Visit homepage: https://YOUR-DOMAIN.vercel.app
☐ Login works
☐ Chat interface loads
☐ /jeeves console loads
☐ /mqtt-monitor loads
```

### Verify Inngest Workers
```
☐ Visit: https://YOUR-DOMAIN.vercel.app/api/inngest
☐ Should show: "Inngest functions registered: 6"

☐ Inngest Dashboard → Functions
☐ Verify all 6 functions listed:
  - fcu-data-ingestion
  - jeeves-auto-scheduler
  - jeeves-background-analysis
  - process-notifications
  - send-notification-email
  - telemetry-cleanup
```

### Verify Storage
```
☐ Try uploading a file (tests Blob)
☐ Create a chat (tests Postgres)
☐ Check function logs (tests Redis deduplication if configured)
```

---

## ✅ Data Migration (Optional)

If you want to migrate old data (excluding telemetry):

### Option 1: Backup/Restore
```
☐ Old Account → Database → Backups → Create & Download
☐ New Account → Database → Import → Upload backup
☐ Delete telemetry:
  TRUNCATE TABLE "TelemetryTick" CASCADE;
  TRUNCATE TABLE "TelemetryAnomaly" CASCADE;
```

### Option 2: Manual SQL Copy
```
☐ Follow: scripts/VERCEL_DASHBOARD_MIGRATION.md
☐ Copy tables one by one via Query interface
```

---

## ✅ Enable Ingestion (When Ready)

```
☐ Visit: /jeeves
☐ Toggle ON "FCU Data Ingestion"
☐ Save Settings
☐ Monitor Inngest dashboard for successful runs
☐ Check /mqtt-monitor for data flow
```

---

## ✅ Post-Transfer Monitoring (First 24 Hours)

### Check Quota Usage
```
☐ Vercel → Analytics → Check bandwidth usage
☐ Storage → Postgres → Check database size
☐ Should be much lower with:
  - 5-minute polling (not 10s)
  - 24-hour retention (not 48h)
  - Cleanup every 6 hours (not daily)
```

### Check Workers
```
☐ Inngest Dashboard → Runs
☐ Verify successful runs every 5 minutes
☐ Check for errors
```

### Check Database Growth
```
New Database → Query:

SELECT
  pg_size_pretty(pg_database_size(current_database())) as total_size,
  (SELECT COUNT(*) FROM "TelemetryTick") as telemetry_count,
  (SELECT COUNT(*) FROM "JeevesDiscovery") as discoveries;
```

---

## 🎯 Success Criteria

- ✅ All 3 storage resources created (Blob, Postgres, Redis)
- ✅ All environment variables updated
- ✅ Inngest integration reconnected
- ✅ Build succeeds with migrations
- ✅ All 6 Inngest functions registered
- ✅ App loads and works
- ✅ Ingestion toggle available in /jeeves
- ✅ No quota warnings in first 24 hours

---

## ⚠️ Troubleshooting

### "BLOB_READ_WRITE_TOKEN is not set"
→ Create new Blob store, update env var, redeploy

### "relation does not exist"
→ Migrations didn't run, check build logs

### Inngest functions not showing
→ Check webhook URL, verify INNGEST_SIGNING_KEY

### "Your project has exceeded quota"
→ Old database URL still set, update to new database

### Workers not running
→ Check Inngest dashboard, verify env vars, check function logs

---

## 📞 Support

- Vercel: support@vercel.com
- Inngest: https://www.inngest.com/discord
- Check logs: Vercel → Deployments → Latest → Functions → Logs
