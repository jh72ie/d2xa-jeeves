# MQTT Monitor with Inngest - Setup Guide

## Problem Solved

**Original Issue**: SSE connection dropped after ~10 seconds due to Vercel serverless function timeout

**Solution**: Use Inngest background worker to maintain long-running MQTT connection

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MQTT Broker                          │
│                  (HiveMQ Cloud - Always On)                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓ MQTT messages every ~30s
┌────────────────────────────────────────────────────────────┐
│              Inngest Background Worker                       │
│           (Runs continuously, restarts every 25s)            │
│                                                              │
│  - Connects to MQTT broker                                   │
│  - Subscribes to dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue         │
│  - Receives FCU data                                         │
│  - Stores in Redis                                           │
└────────────────────────────┬───────────────────────────────┘
                             │
                             ↓ Store latest snapshot
┌────────────────────────────────────────────────────────────┐
│                      Redis Cache                            │
│               Key: mqtt:fcu:latest                           │
│               TTL: 5 minutes                                 │
└────────────────────────────┬───────────────────────────────┘
                             │
                             ↓ Poll every 5s
┌────────────────────────────────────────────────────────────┐
│              Next.js API: /api/mqtt/latest                  │
│             (Reads from Redis, returns JSON)                 │
└────────────────────────────┬───────────────────────────────┘
                             │
                             ↓ HTTP polling
┌────────────────────────────────────────────────────────────┐
│                    Browser Client                            │
│              (Polls every 5s, displays FCU grid)             │
└────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Step 1: Install Inngest CLI

```bash
npm install -g inngest-cli@latest
```

Or use npx (no install):
```bash
npx inngest-cli@latest --version
```

### Step 2: Start Inngest Dev Server

In a **separate terminal** (keep it running):

```bash
npx inngest-cli@latest dev
```

You should see:
```
✓ Inngest Dev Server running on http://localhost:8288
✓ Event stream available at http://localhost:8288/stream
✓ Dashboard: http://localhost:8288
```

**Keep this terminal open!** The Inngest dev server must run alongside your Next.js app.

### Step 3: Start Next.js Dev Server

In your **main terminal**:

```bash
npm run dev
```

### Step 4: Access the Monitor

Navigate to: `http://localhost:3000/mqtt-monitor`

### Step 5: Verify

1. **Check Inngest Dashboard**: `http://localhost:8288`
   - Go to "Functions" → Should see `mqtt-fcu-listener`
   - Go to "Runs" → Should see executions every 30 seconds

2. **Check Browser Console**:
   - Should see: `[MQTT Console] Fetched FCU data:`
   - With: `totalFCUs: 49, faults: 3`

3. **Check UI**:
   - Status badge: Green "Connected"
   - Summary: Total FCUs, OK count, Faults
   - FCU Grid: 49 cards with live data
   - Updates every 5 seconds

---

## How It Works

### Inngest Worker (`lib/inngest/functions/mqtt-listener.ts`)

**Execution Flow**:
1. **Triggered**: Every 30 seconds via cron (`*/30 * * * * *`)
2. **Connect**: Establishes MQTT connection to HiveMQ
3. **Subscribe**: Listens to `dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue`
4. **Receive**: Gets FCU data (usually 1 message per 30s cycle)
5. **Store**: Saves to Redis with key `mqtt:fcu:latest`
6. **Disconnect**: Closes connection after 25 seconds
7. **Repeat**: Cron triggers next execution

**Why 25s runtime + 30s cron?**
- Ensures overlap (no data gaps)
- Prevents Vercel timeout (60s limit even on Pro)
- Automatic reconnection every 30s

### API Endpoint (`app/api/mqtt/latest/route.ts`)

**Simple Design**:
```typescript
GET /api/mqtt/latest
→ Read from Redis
→ Return JSON
→ No long-running connection
→ < 100ms response time
```

### UI Component (v3 - Polling)

**Changes from v2 (SSE)**:
- ❌ No EventSource (SSE)
- ✅ HTTP polling with `fetch()` every 5 seconds
- ✅ Manual "Refresh Now" button
- ✅ Works indefinitely (no timeouts)

---

## Files Created/Modified

### Created:
1. `lib/inngest/functions/mqtt-listener.ts` - MQTT worker
2. `app/api/mqtt/latest/route.ts` - Polling endpoint
3. `components/mqtt/mqtt-live-console-v3.tsx` - Polling UI

### Modified:
1. `app/api/inngest/route.ts` - Registered `mqttListener` function
2. `app/(chat)/mqtt-monitor/page.tsx` - Use v3 component

---

## Troubleshooting

### Issue: "No data available"

**Cause**: Inngest worker not running

**Solutions**:
1. Check Inngest dev server is running: `npx inngest-cli@latest dev`
2. Check http://localhost:8288 → Functions → `mqtt-fcu-listener`
3. Manually trigger: Click "Test Function" in Inngest dashboard
4. Check server console for MQTT connection logs

### Issue: Inngest dev server not starting

**Error**: `Port 8288 already in use`

**Solution**:
```bash
# Kill process on port 8288
# Windows:
netstat -ano | findstr :8288
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8288 | xargs kill -9

# Then restart:
npx inngest-cli@latest dev
```

### Issue: Redis connection error

**Error**: `ECONNREFUSED` or `Redis URL not defined`

**Solution**:
1. Check `.env.local` has `REDIS_URL`
2. If using Vercel KV, get URL from: https://vercel.com/dashboard → Storage → Redis
3. Format: `redis://default:<password>@<host>:<port>`

### Issue: MQTT connection fails in worker

**Error**: `MQTT connection error` in Inngest logs

**Solutions**:
1. Check broker credentials in `mqtt-listener.ts`
2. Verify HiveMQ broker is online: https://console.hivemq.cloud/
3. Test connection manually:
   ```bash
   npm install -g mqtt
   mqtt sub -h 4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud -p 8883 -u Beringar -P Winter2025! -t "dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue" --protocol mqtts
   ```

### Issue: UI shows stale data

**Symptom**: Last update timestamp is > 1 minute old

**Debug**:
1. Check Inngest dashboard → "Runs" → Recent executions
2. If no runs → Check cron syntax: `*/30 * * * * *`
3. If runs failing → Check error logs in Inngest dashboard
4. If runs succeeding but no data → Check Redis key exists:
   ```bash
   redis-cli
   > GET mqtt:fcu:latest
   ```

---

## Production Deployment (Vercel)

### Environment Variables

Add to Vercel project settings:

```bash
REDIS_URL=redis://...                    # Vercel KV or Upstash
INNGEST_EVENT_KEY=<from_inngest>         # Inngest Cloud API key
INNGEST_SIGNING_KEY=<from_inngest>       # For webhook verification
```

### Inngest Cloud Setup

1. Sign up: https://www.inngest.com/
2. Create project
3. Copy Event Key & Signing Key
4. Add webhook URL: `https://your-app.vercel.app/api/inngest`

### Deploy

```bash
vercel --prod
```

### Verify

1. Check Inngest Cloud dashboard → Functions
2. Should see `mqtt-fcu-listener` running every 30s
3. Check app: https://your-app.vercel.app/mqtt-monitor

---

## Performance & Cost

### Redis Storage

- **Key**: `mqtt:fcu:latest`
- **Size**: ~50KB per message (50 FCUs × 1KB each)
- **TTL**: 5 minutes
- **Writes**: ~120/hour (every 30s)
- **Reads**: ~720/hour (5s polling × users)

**Cost**: Free tier covers this easily

### Inngest

**Free Tier**:
- 1,000 steps/day
- 1 concurrent function

**Usage**:
- 1 execution every 30s = 2,880/day
- **Exceeds free tier** → Need Pro ($20/month)

**Alternative**: Use cron every 60s instead of 30s → 1,440/day (fits free tier)

To change interval:
```typescript
// In mqtt-listener.ts
{ cron: '*/60 * * * * *' }, // Every 60 seconds instead of 30
```

### Vercel

- API route (`/api/mqtt/latest`) is fast (<100ms)
- No long-running functions
- Fits within free tier limits

**Total Cost**: $0 - $20/month depending on Inngest plan

---

## Next Steps

### Phase 1: Current ✅
- ✅ Inngest MQTT worker
- ✅ Redis caching
- ✅ Polling UI
- ✅ Continuous updates (no timeouts)

### Phase 2: Persistence
- 📊 Store FCU snapshots in PostgreSQL
- 📊 TimescaleDB for time-series
- 📊 Historical trends & charts

### Phase 3: Real-time (Optional)
- 🔄 Add WebSocket server (if needed)
- 🔄 Push updates instead of polling
- 🔄 Sub-second latency

### Phase 4: Intelligence
- 🎩 Jeeves AI on real FCU data
- 🎩 Anomaly detection
- 🎩 Predictive maintenance

---

## Summary

**Before (SSE)**:
- ❌ Timeout after 10-60 seconds
- ❌ Connection drops
- ❌ Can't run in production on Vercel

**After (Inngest + Polling)**:
- ✅ Runs indefinitely
- ✅ Automatic reconnection
- ✅ Works in production
- ✅ Scales to multiple users
- ✅ 5-second update latency (acceptable)

**Trade-off**: 5-second delay instead of real-time (but reliable!)

---

## Quick Start Commands

```bash
# Terminal 1: Inngest dev server
npx inngest-cli@latest dev

# Terminal 2: Next.js dev server
npm run dev

# Browser: Open monitor
http://localhost:3000/mqtt-monitor

# Inngest dashboard: Check worker
http://localhost:8288
```

🎯 **That's it! Your MQTT monitor should now run continuously without timeouts.** 🎉
