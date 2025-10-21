# Jeeves Project Transfer Checklist

## 📝 Pre-Transfer Documentation

### Current Environment Variables
Record these from your current Vercel project settings:

- [ ] `AUTH_SECRET`
- [ ] `AI_GATEWAY_API_KEY` (if set)
- [ ] `BLOB_READ_WRITE_TOKEN` ⚠️ CRITICAL - Will need NEW token
- [ ] `POSTGRES_URL` ⚠️ May need updating
- [ ] `REDIS_REDIS_URL` ⚠️ Check if Vercel KV or external
- [ ] `INNGEST_SIGNING_KEY`
- [ ] `INNGEST_EVENT_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `RESEND_API_KEY` (if configured)
- [ ] `EMAIL_FROM` (if configured)

### Current Storage Resources

#### Vercel Postgres
- [ ] Database name: _______________
- [ ] Connection string saved: _______________
- [ ] Backup created: _______________

#### Vercel Blob
- [ ] Store name: _______________
- [ ] Files count: _______________
- [ ] Total size: _______________
- [ ] Backup plan: _______________

#### Redis
- [ ] Is it Vercel KV? Yes / No
- [ ] If external, connection string: _______________

### Domain Configuration
- [ ] Custom domain(s): _______________
- [ ] SSL certificates: Auto-managed by Vercel

### Inngest Configuration
- [ ] App ID from client.ts: `nextjs-ai-chatbot`
- [ ] Current webhook URL: _______________
- [ ] Active functions count: _______________

---

## 🚀 Transfer Steps

### Before Transfer
1. [ ] Create database backup
2. [ ] Export Blob storage files (if any)
3. [ ] Document all environment variables
4. [ ] Note Inngest webhook URL
5. [ ] Screenshot current settings

### During Transfer
6. [ ] Follow Vercel transfer wizard
7. [ ] Verify environment variables copied
8. [ ] Check domain configuration

### After Transfer
9. [ ] Create new Vercel Blob store
10. [ ] Update BLOB_READ_WRITE_TOKEN
11. [ ] Reconnect Inngest integration
12. [ ] Update database connection (if needed)
13. [ ] Recreate Redis/KV (if Vercel KV)
14. [ ] Test deployment
15. [ ] Verify all workers running

---

## ⚠️ Critical Post-Transfer Tasks

### 1. Vercel Blob Storage (PRIORITY)
```bash
# In new team, create new Blob store:
# Dashboard → Storage → Create Database → Blob

# Update environment variable:
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx_new_token
```

### 2. Inngest Integration
```bash
# Visit: https://vercel.com/integrations/inngest
# Or manually configure webhook:
# Inngest Dashboard → Apps → nextjs-ai-chatbot →
#   Event Key → Configure → Webhook URL:
#   https://your-new-domain.vercel.app/api/inngest
```

### 3. Verify Database Connection
```bash
# Check if POSTGRES_URL still works
# If using Vercel Postgres, connection should transfer
# Test with:
pnpm db:check
```

### 4. Test All Workers
Visit after deployment:
- https://your-domain.vercel.app/api/inngest
- Verify these functions show up:
  - fcu-data-ingestion
  - jeeves-auto-scheduler
  - telemetry-cleanup
  - process-notifications

---

## 🧪 Post-Transfer Verification

### Test Checklist
- [ ] Homepage loads
- [ ] Login works
- [ ] Chat interface functional
- [ ] MQTT live charts updating
- [ ] Jeeves console accessible
- [ ] Database queries working
- [ ] File uploads working (Blob)
- [ ] Inngest workers running
- [ ] Email notifications sending (if configured)

### Monitor for 24 Hours
- [ ] Check Inngest dashboard for successful runs
- [ ] Verify MQTT data ingestion logs
- [ ] Check Vercel function logs
- [ ] Monitor error rates
- [ ] Verify telemetry cleanup runs

---

## 📞 Rollback Plan

If issues occur:
1. Original project remains in source account (hidden)
2. Contact Vercel support to restore if needed
3. Keep backup database dump
4. Document all issues encountered
