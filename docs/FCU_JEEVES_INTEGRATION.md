# FCU Data Integration with Jeeves

## Overview

This integration connects real MQTT FCU (Fan Coil Unit) data to Jeeves AI for automatic discovery and analysis.

**Strategy**: Start with **ONE FCU (FCU-01_04)** and save **ALL its fields** as separate streams for deep analysis before scaling to all 49 units.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MQTT Broker (HiveMQ)                     │
│         Publishes FCU data every ~5 minutes                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Subscribe every 5 minutes
┌─────────────────────────────────────────────────────────────┐
│            Inngest Worker: fcu-data-ingestion                │
│   lib/inngest/functions/fcu-data-ingestion.ts               │
│   Runs: Every 5 minutes (cron: */5 * * * *)                  │
│                                                               │
│   1. Connect to MQTT                                          │
│   2. Get message with all 49 FCUs                            │
│   3. Extract FCU-01_04 data                                     │
│   4. Save each field as separate stream                      │
│   5. Disconnect after 50s                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Save to PostgreSQL
┌─────────────────────────────────────────────────────────────┐
│                   TelemetryTick Table                         │
│   Columns: id, sensorId, personaName, ts, value              │
│                                                               │
│   Example rows:                                               │
│   - fcu-01_04-spacetemp: 23.2                                   │
│   - fcu-01_04-heatprimary: 45.0                                 │
│   - fcu-01_04-fanspeed: 3.0                                     │
│   - fcu-01_04-occup: 1.0                                        │
│   ... (20-30 fields total)                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Query streams
┌─────────────────────────────────────────────────────────────┐
│              Jeeves Discovery Engine                          │
│   lib/jeeves/discovery-engine.ts                              │
│   Runs: Every 5 minutes (configurable)                        │
│                                                               │
│   1. listAvailableStreams (finds all fcu-01_04-* streams)       │
│   2. Load recent data for each stream                         │
│   3. Run 19 analysis tools (correlations, anomalies, etc.)    │
│   4. Generate creative discoveries                            │
│   5. Notify relevant personas                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Complete

### ✅ Created Files

**1. `lib/inngest/functions/fcu-data-ingestion.ts`**
- Connects to MQTT broker every 5 minutes
- Extracts FCU-01_04 data
- Normalizes field names: `nvoSpaceTemp` → `fcu-01_04-spacetemp`
- Filters numeric values only
- Saves ~20-30 streams per execution
- Auto-disconnects after 50s to avoid timeouts

**2. Updated `app/api/inngest/route.ts`**
- Registered `fcuDataIngestion` function with Inngest
- Runs alongside existing notification workers

**3. Updated `lib/monitoring/stream-tools.ts`**
- `listAvailableStreams()` now dynamically discovers streams from database
- Queries for distinct `sensorId` values with activity in last 24 hours
- Will automatically find all `fcu-01_04-*` streams once data starts flowing

---

## Setup Instructions

### Step 1: Install Dependencies (if not already)

```bash
pnpm install
```

### Step 2: Ensure Inngest is Running

**Local Development (Vercel Cloud):**
The worker runs automatically on Vercel - no local Inngest dev server needed!

**Check it's working:**
1. Deploy to Vercel
2. Visit Vercel logs
3. Look for: `[FCU Ingestion] Connected to MQTT broker`
4. Should see: `[FCU Ingestion] ✓ Saved X streams for fCU_01_04`

### Step 3: Wait for Data Collection

The ingestion worker runs every 5 minutes. After 2-3 cycles (~10-15 minutes), you'll have enough data for Jeeves to analyze.

**Verify data is flowing:**

```sql
-- Check if FCU-01_04 streams exist
SELECT DISTINCT "sensorId", COUNT(*) as data_points
FROM "TelemetryTick"
WHERE "sensorId" LIKE 'fcu-01_04-%'
GROUP BY "sensorId"
ORDER BY "sensorId";
```

You should see results like:
```
fcu-01_04-coolprimary       | 10
fcu-01_04-effectsetpt       | 10
fcu-01_04-fanspeed          | 10
fcu-01_04-heatprimary       | 10
fcu-01_04-parsed-spacetemp  | 10
fcu-01_04-spacetemp         | 10
... (20-30 total streams)
```

### Step 4: Configure Jeeves to Monitor FCU Streams

**Option A: Via Database (Quick)**

```sql
UPDATE "JeevesState"
SET "monitoredStreams" = to_jsonb(ARRAY[
  'fcu-01_04-spacetemp',
  'fcu-01_04-effectsetpt',
  'fcu-01_04-heatprimary',
  'fcu-01_04-coolprimary',
  'fcu-01_04-fanspeed',
  'fcu-01_04-occup',
  'fcu-01_04-parsed-spacetemp',
  'fcu-01_04-parsed-heatoutput',
  'fcu-01_04-parsed-cooloutput',
  'fcu-01_04-parsed-status'
]);
```

**Option B: Via API**

```bash
curl -X PATCH https://your-app.vercel.app/api/jeeves/state \
  -H "Content-Type: application/json" \
  -d '{
    "monitoredStreams": [
      "fcu-01_04-spacetemp",
      "fcu-01_04-effectsetpt",
      "fcu-01_04-heatprimary",
      "fcu-01_04-coolprimary",
      "fcu-01_04-fanspeed",
      "fcu-01_04-occup",
      "fcu-01_04-parsed-spacetemp",
      "fcu-01_04-parsed-heatoutput",
      "fcu-01_04-parsed-cooloutput",
      "fcu-01_04-parsed-status"
    ]
  }'
```

**Option C: Dynamic Discovery (Let Jeeves find all FCU-01_04 streams)**

```sql
-- Configure Jeeves to monitor ALL fcu-01_04 streams dynamically
UPDATE "JeevesState"
SET "monitoredStreams" = COALESCE(
  (
    SELECT to_jsonb(array_agg(DISTINCT "sensorId"))
    FROM "TelemetryTick"
    WHERE "sensorId" LIKE 'fcu-01_04-%'
      AND "ts" > NOW() - INTERVAL '1 hour'
  ),
  '[]'::jsonb
);
```

### Step 5: Enable Jeeves

1. Go to `/jeeves` page
2. Toggle "Enable Jeeves" ON
3. Set interval to "5min" (or "3min" for faster results)
4. Click "Save Settings"
5. Click "🔍 Analyze Now" to trigger immediate analysis

---

## What Jeeves Will Discover

With complete FCU-01_04 data, Jeeves can find patterns like:

### 1. **Internal FCU Dynamics**
> "Fan speed shows perfect 0.94 correlation with heat output - efficient control loop validated"

### 2. **Control Logic Patterns**
> "Setpoint adjustment always precedes mode change by 30 seconds - discovered PID controller delay"

### 3. **Occupancy Behavior**
> "Manual occupancy override happens daily at 7:15 AM - Bob arrives early pattern detected"

### 4. **Efficiency Anomalies**
> "Unit coefficient drifts 0.3% per day since March 15 - calibration needed"

### 5. **Mode Transition Timing**
> "FCU takes 4.2 minutes to stabilize after mode switch - 40% slower than spec (3min)"

### 6. **Predictive Signals**
> "Fan speed micro-oscillations (±0.5 Hz) appear 20 minutes before fault events - early warning system opportunity"

### 7. **Cross-Variable Correlations**
> "Cooling output inversely correlated with occupancy at -0.87 - suggests aggressive AC when unoccupied"

### 8. **Unexpected Patterns**
> "Heat and cool outputs both non-zero 3% of the time - simultaneous heating/cooling inefficiency"

---

## Stream Naming Convention

### Raw LonWorks Fields
Format: `fcu-{id}-{normalized-field-name}`

Examples:
- `nvoSpaceTemp` → `fcu-01_04-spacetemp`
- `nvoHeatPrimary` → `fcu-01_04-heatprimary`
- `nvoCoolPrimary` → `fcu-01_04-coolprimary`
- `nvoFanSpeed` → `fcu-01_04-fanspeed`
- `nvoOccup` → `fcu-01_04-occup`

### Parsed/Derived Metrics
Format: `fcu-{id}-parsed-{metric-name}`

Examples:
- `fcu-01_04-parsed-spacetemp` - Extracted from status string
- `fcu-01_04-parsed-heatoutput` - Heating % extracted
- `fcu-01_04-parsed-cooloutput` - Cooling % extracted
- `fcu-01_04-parsed-status` - Health: 0=ok, 1=fault, 2=down

---

## Monitoring & Debugging

### Check Ingestion Worker

**Vercel Logs:**
```
[FCU Ingestion] Starting MQTT data collection...
[FCU Ingestion] Connected to MQTT broker
[FCU Ingestion] Subscribed to: dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue
[FCU Ingestion] Received 49 FCUs, 3 faults
[FCU Ingestion] Processing fCU_201 with 25 fields
[FCU Ingestion] ✓ Saved 28 streams for fCU_201
[FCU Ingestion] Stream IDs: fcu-01_04-spacetemp, fcu-01_04-heatprimary, ...
```

### Check Stream Discovery

**Query available streams:**
```sql
SELECT "sensorId", COUNT(*) as points
FROM "TelemetryTick"
WHERE "sensorId" LIKE 'fcu-01_04-%'
  AND "ts" > NOW() - INTERVAL '1 hour'
GROUP BY "sensorId"
ORDER BY points DESC;
```

### Check Jeeves Activity

**Go to `/jeeves` page:**
- **Status Panel** - See last analysis time, next scheduled run
- **Activity Log** - Real-time logs of discoveries
- **Discoveries** - See what Jeeves found

**Jeeves Console Logs:**
```
🎩 JEEVES ON DUTY - Starting Analysis
[Jeeves] Monitored streams: 10
[Discovery Engine] Starting unconstrained discovery...
[Discovery Tool] listAvailableStreams called
[Stream Discovery] Found 28 active streams
[Discovery Engine] Step 2: Building context message...
[Discovery Engine] Step 4: Calling LLM with rate limit handling...
[Discovery Engine] ✓ Final result: 3 discoveries
```

---

## Troubleshooting

### No Data in Database

**Problem:** `SELECT * FROM "TelemetryTick" WHERE "sensorId" LIKE 'fcu-01_04-%'` returns 0 rows

**Solutions:**
1. Check Inngest worker is registered:
   ```bash
   # Verify fcuDataIngestion is exported in route.ts
   grep "fcuDataIngestion" app/api/inngest/route.ts
   ```

2. Check Inngest logs for errors
3. Verify MQTT credentials are correct (should connect successfully)
4. Check if FCU-01_04 exists in MQTT messages (maybe it's a different ID?)

### Jeeves Not Finding Streams

**Problem:** Jeeves says "No data found for stream fcu-01_04-spacetemp"

**Solutions:**
1. Verify streams exist in database (see query above)
2. Check stream names match exactly (case-sensitive)
3. Ensure data is recent (< 24 hours old)
4. Run `listAvailableStreams()` manually to see what Jeeves can find

### Worker Timing Out

**Problem:** `[FCU Ingestion] status: 'timeout'`

**Cause:** No MQTT message received in 50 seconds

**Solutions:**
1. MQTT broker might be slow or down - check HiveMQ Cloud status
2. Topic might be wrong - verify with MQTT client:
   ```bash
   mqtt sub -h 4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud -p 8883 \
     -u Beringar -P Winter2025! -t "dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue" --protocol mqtts
   ```
3. Increase timeout in `fcu-data-ingestion.ts` (currently 50s)

---

## Scaling to More FCUs

Once FCU-01_04 analysis is working, you can easily scale:

### Option 1: Add Specific FCUs

```typescript
// In fcu-data-ingestion.ts
const TARGET_FCUS = ['fCU_01_04', 'fCU_01_05', 'fCU_01_07']; // Add faulty units

for (const targetFCU of TARGET_FCUS) {
  const fcu = parsed.fcus.find(f => f.id === targetFCU);
  // ... save all fields
}
```

### Option 2: Save All FCUs

```typescript
// Save ALL FCUs, ALL fields (~1,200 streams)
for (const fcu of parsed.fcus) {
  // ... save all fields for each FCU
}
```

**Warning:** This creates ~1,200 streams. Jeeves can handle it, but analysis will be slower and use more tokens.

### Option 3: Save Aggregated Metrics

```typescript
// Save building-wide averages
const avgTemp = parsed.fcus.reduce((sum, f) => sum + f.spaceTemp, 0) / parsed.fcus.length;
await insertTick({
  sensorId: 'building-avg-temp',
  ts: new Date(data.timestamp),
  value: avgTemp,
});
```

---

## Cost Implications

### Storage (PostgreSQL)
- **1 FCU**: ~28 rows every 5 min = **336 rows/hour** = **8k rows/day**
- **49 FCUs**: ~1,400 rows every 5 min = **16.8k rows/hour** = **400k rows/day**

**Recommendation:** Start with 1 FCU, monitor for a week, then scale.

### Jeeves LLM Usage
- **First run**: ~30k tokens (cache write)
- **Subsequent runs**: ~3k tokens (cache hit - 90% savings!)
- **28 streams**: Jeeves can analyze in single run

**Cost:** Tier 2 (150k tokens/min) handles this easily.

---

## Next Steps

1. ✅ **Deploy** - Push to Vercel, verify worker runs
2. ✅ **Wait** - Give it 5-10 minutes to collect data
3. ✅ **Configure** - Update monitored streams in database
4. ✅ **Enable** - Turn on Jeeves in `/jeeves` page
5. ✅ **Analyze** - Click "🔍 Analyze Now"
6. ✅ **Review** - Check discoveries and activity log

---

## Success Criteria

You'll know it's working when:
- ✅ Ingestion worker logs show "✓ Saved X streams for fCU_01_04"
- ✅ Database has 20-30 `fcu-01_04-*` streams with growing data
- ✅ Jeeves finds streams: `[Stream Discovery] Found 28 active streams`
- ✅ Jeeves generates discoveries about FCU-01_04 internal dynamics
- ✅ Personas receive notifications about interesting patterns

---

## FAQ

**Q: Why only FCU-01_04?**
A: Deep analysis of ONE unit validates the approach before scaling. Cheaper, faster, easier to debug.

**Q: Can Jeeves handle all 49 FCUs?**
A: Yes, but start small. 49 FCUs × 30 fields = 1,470 streams. Analysis will be slower and costlier.

**Q: What if FCU-01_04 is boring?**
A: Pick a different FCU! Change `TARGET_FCU = 'fCU_206'` (a faulty unit is more interesting).

**Q: How do I see raw MQTT messages?**
A: Go to `/mqtt-monitor` - live charts show temperature, heating, cooling for all 49 FCUs.

**Q: Can I analyze multiple FCUs without saving all of them?**
A: Yes! Save 3-5 "interesting" FCUs (normal + faulty ones) for comparative analysis.

---

🎩 **Jeeves is ready to discover patterns in your HVAC system!**
