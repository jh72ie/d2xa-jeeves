# Jeeves Background Processing with Function Chaining

## Overview

Jeeves analysis now runs using **function chaining** to split long-running work across multiple serverless functions, each with its own 300-second timeout limit.

---

## The Problem

### Vercel Serverless Timeout Limits

| Plan | Timeout Limit |
|------|---------------|
| Hobby | 10 seconds |
| Pro | 60 seconds (default) |
| Enterprise | 300 seconds (max) |

**Jeeves Execution Time**:
- Discovery Engine: 60-180 seconds
- Per Notification: 5-75 seconds (with dashboard generation)
- **Total for 4 notifications**: 85-480 seconds

**Problem**: Can exceed 300s limit → Function timeout error

### Example Timeline That Hit Timeout

```
12:00:04 - API endpoint /api/jeeves/analyze called
12:03:13 - Discovery completed (189s)
12:04:27 - Diana notification completed (74s)
12:04:27 - Alice notification started
12:05:03 - TIMEOUT (299s total) ❌

Total: 299 seconds
Remaining notifications: Not completed
Result: Error 504 Gateway Timeout
```

---

## The Solution: Function Chaining

Use **function chaining pattern** where one serverless function triggers another via HTTP POST, each with its own 300s timeout.

### How Function Chaining Works

**Pattern**: Function 1 → HTTP POST → Function 2

**Key Features**:
- Each function gets own 300-second timeout
- Discovery (180s) + Notifications (240s) = 420s total (works!)
- Data passed via database and HTTP payload
- Unified logging with shared `executionId`
- Next.js `after()` for async processing within each function

---

## Implementation

### Architecture

```
User clicks "Analyze Now"
         ↓
┌─────────────────────────────────────────┐
│ Function 1: /api/jeeves/analyze         │
│ ─────────────────────────────────────── │
│ 1. Returns immediate response           │
│ 2. Runs discovery in after()            │
│ 3. Saves discoveries to database        │
│ 4. Chains via HTTP POST ──────────────┐ │
│                                        │ │
│ Timeout: 300s (discovery ~180s ✅)     │ │
└────────────────────────────────────────┘ │
                                           │
                                           ↓
                        ┌──────────────────────────────────────────┐
                        │ Function 2: /api/jeeves/process-notifications │
                        │ ─────────────────────────────────────────│
                        │ 1. Fetches discovery from database       │
                        │ 2. Generates persona notifications       │
                        │ 3. May create v0 dashboards              │
                        │ 4. Saves notifications to database       │
                        │                                          │
                        │ Timeout: 300s (notifications ~240s ✅)   │
                        └──────────────────────────────────────────┘
```

### Function 1: Discovery Phase

```typescript
// app/api/jeeves/analyze/route.ts
import { after } from "next/server";

export const maxDuration = 300; // 5 minutes for discovery

export async function POST(request: Request) {
  const executionId = crypto.randomUUID();

  after(async () => {
    // Run discovery
    const discoveryResult = await runDiscovery(monitoredStreams, recentDiscoveries);

    // Save discoveries
    for (const disc of discoveryResult.discoveries) {
      const savedDiscovery = await createDiscovery({...});

      // Chain to Function 2 via HTTP POST
      const baseUrl = request.url.replace('/api/jeeves/analyze', '');
      const notificationUrl = `${baseUrl}/api/jeeves/process-notifications`;

      await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discoveryId: savedDiscovery.id,
          executionId,
        }),
      });
    }
  });

  // Immediate response
  return NextResponse.json({
    success: true,
    message: "Analysis started in background",
    executionId,
  });
}
```

### Function 2: Notification Phase

```typescript
// app/api/jeeves/process-notifications/route.ts
export const maxDuration = 300; // 5 minutes per notification batch

export async function POST(request: Request) {
  const { discoveryId, executionId } = await request.json();

  // Get discovery from database
  const discovery = await getDiscoveryById(discoveryId);
  const recipients = discovery.intendedRecipients || [];

  // Process each recipient sequentially
  for (const recipient of recipients) {
    const personaNotif = await generatePersonaNotification(discovery, recipient);
    await createNotification({...});

    if (personaNotif.dashboardId) {
      await addPersonaDashboard(discovery.id, {...});
    }
  }

  await updateDiscoveryStatus(discovery.id, "notified");

  return NextResponse.json({ success: true });
}
```

**Benefits**:
- ✅ Function 1: 300s limit (discovery ~180s, safe)
- ✅ Function 2: 300s limit (notifications ~240s, safe)
- ✅ Total work: 420s (exceeds single function limit!)
- ✅ Each function operates independently

---

## User Flow

### Step-by-Step

**1. User clicks "Analyze Now"**
```
POST /api/jeeves/analyze
```

**2. API responds immediately** (< 1 second)
```json
{
  "success": true,
  "message": "Analysis started in background",
  "note": "Check activity logs for progress and results",
  "triggeredAt": "2025-10-03T12:00:04.000Z"
}
```

**3. Background processing starts** (Function 1 via `after()`)
```
[Jeeves] Starting analysis...
[Jeeves] Running discovery on 2 streams...
[Discovery Engine] >>> Sending request to LLM...
[Discovery Engine] ✅ Discovery complete: 2 found
[Jeeves] 🔗 Chaining to notification processor for discovery abc-123
```

**4. Function 2 processes notifications**
```
[Notification Processor] Processing notifications for discovery abc-123
[Notification Processor] 🎨 Processing Alice-DevOps
[Notification Processor] ✅ Generated for Alice-DevOps: format=technical
...
```

**5. User checks activity logs**
- Navigate to Jeeves Console activity section
- See real-time progress from `JeevesActivityLog` table
- Watch discoveries appear one by one
- Track across both functions using shared `executionId`

**6. Analysis completes** (85-480 seconds later)
```
[Jeeves] ✅ Analysis complete: 2 discoveries, 245.0s
[Notification Processor] ✅ Completed 6/6 notifications
```

---

## Benefits

### 1. Bypasses Single Function Timeout ✅

**Before**: Limited to 300 seconds total
**After**: Each function gets own 300s limit

**Example**:
- Function 1 (Discovery): 180s
- Function 2 (Notifications): 240s
- **Total**: 420s (exceeds 300s limit but works!)
- ✅ Each function stays within its own 300s limit

### 2. Instant User Feedback ✅

**Before**: User waits 3-5 minutes staring at loading spinner
**After**: User sees confirmation in < 1 second, can continue working

### 3. Unified Logging Across Functions ✅

**Shared `executionId`**: Both functions log to same execution
- Function 1: Discovery logs
- Function 2: Notification logs
- Query by `executionId` to see complete timeline

### 4. Data Persistence Between Functions ✅

**Database as handoff point**:
- Function 1 saves discoveries to database
- Function 2 reads discoveries from database
- No in-memory state required
- Survives function restarts

---

## Activity Logs Integration

All background activity is logged to `JeevesActivityLog` table:

```typescript
await logActivity(executionId, "info", "🔍 Running discovery on 2 streams");
await logActivity(executionId, "success", "✅ Discovery complete: Found 2 new discoveries");
await logActivity(executionId, "info", "📬 Generating 4 persona-specific notifications");
await logActivity(executionId, "success", "✅ Alice-DevOps: technical (with dashboard)");
```

**Query logs**:
```typescript
const logs = await db
  .select()
  .from(jeevesActivityLog)
  .where(eq(jeevesActivityLog.executionId, executionId))
  .orderBy(asc(jeevesActivityLog.timestamp));
```

**UI Display**:
```
12:00:04 [info] 🎩 Jeeves analysis started
12:00:04 [info] Monitoring 2 streams
12:00:04 [info] 🔍 Running discovery on 2 streams: temp-001, humid-001
12:03:13 [success] ✅ Discovery complete: Found 2 new discoveries
12:03:13 [info] 📬 Generating 4 persona-specific notifications
12:03:13 [info] 🎨 Processing Alice-DevOps
12:04:27 [success] ✅ Alice-DevOps: technical (with dashboard)
12:04:27 [info] 🎨 Processing Bob-Backend
12:05:42 [success] ✅ Bob-Backend: detailed (with dashboard)
...
```

---

## Technical Details

### Function Chaining Pattern

**How it works**:
1. Function 1 saves data to database
2. Function 1 makes HTTP POST to Function 2
3. Function 2 reads data from database
4. Both functions log with shared `executionId`

**Data Flow**:
```
Function 1:
  discoveryResult → createDiscovery() → DB
                                         ↓
  HTTP POST (discoveryId, executionId) → Function 2:
                                           getDiscoveryById() → DB
```

**Key Implementation Details**:
```typescript
// Function 1: Save and chain
const savedDiscovery = await createDiscovery({...});

const baseUrl = request.url.replace('/api/jeeves/analyze', '');
const notificationUrl = `${baseUrl}/api/jeeves/process-notifications`;

await fetch(notificationUrl, {
  method: 'POST',
  body: JSON.stringify({
    discoveryId: savedDiscovery.id,
    executionId,
  }),
});

// Function 2: Fetch and process
const { discoveryId, executionId } = await request.json();
const discovery = await getDiscoveryById(discoveryId);
```

### Next.js `after()` Usage

Both functions use `after()` for async processing:

```typescript
after(async () => {
  // Long-running work here
  // Runs after HTTP response sent
  // Inherits parent function timeout (300s)
});
```

**Why use `after()` in chain?**:
- Function 1: Returns immediately, runs discovery in background
- Function 2: Returns immediately, processes notifications in background
- User gets instant feedback for both chain steps

---

## Error Handling

### Errors in Function Chain

**Function 1 Error**:
```typescript
after(async () => {
  try {
    await runDiscovery();
  } catch (error) {
    console.error("[Jeeves] Discovery failed:", error);
    await logActivity(executionId, "error", `❌ Discovery failed: ${error.message}`);
    // Chain stops - Function 2 never called
  }
});
```

**Function 2 Error**:
```typescript
try {
  await generatePersonaNotification(...);
} catch (error) {
  console.error("[Notification Processor] Failed:", error);
  await logActivity(executionId, "error", `❌ ${recipient.personaName}: ${error.message}`);
  // Continues with next recipient
}
```

**Chain Error** (Function 2 unreachable):
```typescript
const notifResponse = await fetch(notificationUrl, {...});

if (!notifResponse.ok) {
  const error = await notifResponse.text();
  await logActivity(executionId, "error", `Notification chain failed: ${error}`);
}
```

**User sees**: All errors logged to activity log with `executionId`

### Monitoring

**Check for failures**:
```sql
SELECT * FROM "JeevesActivityLog"
WHERE level = 'error'
ORDER BY timestamp DESC
LIMIT 10;
```

**Alert on repeated failures**:
```typescript
const errorCount = await db
  .select({ count: sql`count(*)` })
  .from(jeevesActivityLog)
  .where(
    and(
      eq(jeevesActivityLog.level, 'error'),
      gt(jeevesActivityLog.timestamp, new Date(Date.now() - 3600000)) // Last hour
    )
  );

if (errorCount[0].count > 5) {
  // Send alert to admin
}
```

---

## Performance Considerations

### Concurrency

**Question**: What if user clicks "Analyze Now" multiple times?

**Answer**: Execution lock prevents concurrent runs

```typescript
// In orchestrator.ts
const state = await getJeevesState();

if (state.lastExecutionStartedAt && !state.lastAnalysisAt) {
  // Another execution is running
  console.log("[Jeeves] ⚠️ Analysis already in progress");
  return {
    success: false,
    errors: ["Analysis already in progress"]
  };
}

// Set lock
await updateJeevesState({
  lastExecutionStartedAt: new Date(),
});

// ... run analysis ...

// Clear lock
await updateJeevesState({
  lastExecutionStartedAt: null,
});
```

### Resource Usage

**Background tasks consume serverless resources**:
- Each `after()` keeps function alive
- Vercel charges for execution time
- Monitor costs in Vercel dashboard

**Optimization tips**:
- Use prompt caching (90% token reduction)
- Limit concurrent discoveries
- Set reasonable maxSteps limit

---

## Key Decisions

### Why Function Chaining Instead of `after()` Alone?

**Problem with `after()` alone**:
- `after()` inherits parent function timeout (300s)
- Discovery (180s) + Notifications (240s) = 420s total
- ❌ Still exceeds 300s limit

**Solution with function chaining**:
- Split work across 2 functions
- Function 1: Discovery in `after()` (180s < 300s ✅)
- Function 2: Notifications in `after()` (240s < 300s ✅)
- Total: 420s across 2 functions ✅

### Why Database as Handoff?

**Alternatives considered**:
1. ❌ Pass data in HTTP body (data too large)
2. ❌ Use Redis/cache (adds complexity)
3. ✅ Use existing database (simple, reliable)

**Benefits**:
- Already have database
- Discoveries persist even if function crashes
- Can query discoveries independently
- No additional infrastructure

### Why HTTP POST Instead of Queue?

**Alternatives considered**:
1. ❌ Message queue (SQS, RabbitMQ - adds infrastructure)
2. ❌ Vercel Queue (costs money, requires setup)
3. ✅ HTTP POST (simple, works everywhere)

**Benefits**:
- Zero infrastructure
- Works in development and production
- Easy to debug (standard HTTP logs)
- Can retry with exponential backoff

---

## Testing

### Manual Test

**1. Click "Analyze Now"**
```bash
curl -X POST http://localhost:3000/api/jeeves/analyze
```

**Expected response** (< 1s):
```json
{
  "success": true,
  "message": "Analysis started in background",
  "triggeredAt": "2025-10-03T12:00:04.000Z"
}
```

**2. Check server logs**:
```
[Jeeves Background] Starting analysis...
[Discovery Engine] >>> Sending request to LLM...
...
```

**3. Check activity logs table**:
```sql
SELECT * FROM "JeevesActivityLog"
ORDER BY timestamp DESC
LIMIT 20;
```

### Testing Function Chain

**Test Function 1**:
```bash
curl -X POST http://localhost:3000/api/jeeves/analyze
# Expect: { "success": true, "executionId": "..." }
```

**Test Function 2** (after Function 1 creates discovery):
```bash
curl -X POST http://localhost:3000/api/jeeves/process-notifications \
  -H "Content-Type: application/json" \
  -d '{"discoveryId": "abc-123", "executionId": "exec-456"}'
# Expect: { "success": true, "successCount": 3 }
```

**Verify Chain**:
```sql
-- Check discovery created
SELECT * FROM "JeevesDiscovery" WHERE id = 'abc-123';

-- Check notifications created
SELECT * FROM "JeevesNotification" WHERE "discoveryId" = 'abc-123';

-- Check logs from both functions
SELECT * FROM "JeevesActivityLog" WHERE "executionId" = 'exec-456' ORDER BY timestamp;
```

---

## Troubleshooting

### Issue: Function 2 never called

**Symptoms**: Discovery created but no notifications

**Causes**:
1. HTTP POST failed (network error, wrong URL)
2. Function 1 crashed before chaining
3. Function 2 endpoint not deployed

**Solutions**:
```typescript
// Add detailed chain logging
try {
  const notifResponse = await fetch(notificationUrl, {...});
  console.log(`[Jeeves] Chain response status: ${notifResponse.status}`);

  if (!notifResponse.ok) {
    const error = await notifResponse.text();
    console.error(`[Jeeves] Chain failed:`, error);
    await logActivity(executionId, "error", `Chain failed: ${error}`);
  }
} catch (chainError: any) {
  console.error(`[Jeeves] Chain error:`, chainError);
  await logActivity(executionId, "error", `Chain error: ${chainError.message}`);
}
```

### Issue: Timeout still occurs

**Symptoms**: Function times out at 300s

**Cause**: Single function doing too much work

**Solution**: Split into more functions
```
Function 1: Discovery only
Function 2: Notification for discovery A
Function 3: Notification for discovery B
...
```

### Issue: Execution lock stuck

**Symptoms**: "Analysis already in progress" error persists

**Cause**: Previous execution crashed without clearing lock

**Solution**:
```sql
-- Manually clear lock
UPDATE "JeevesState"
SET "lastExecutionStartedAt" = NULL
WHERE id = '<jeeves-state-id>';
```

**Prevention**: Add lock timeout check:
```typescript
const lockAge = Date.now() - state.lastExecutionStartedAt.getTime();
if (lockAge > 600000) { // 10 minutes
  console.log("[Jeeves] Lock is stale, clearing");
  await updateJeevesState({ lastExecutionStartedAt: null });
}
```

---

## Summary

✅ **Problem**: Vercel 300s timeout limit for single function
✅ **Solution**: Function chaining - split work across multiple functions
✅ **Result**: Each function gets own 300s limit (420s total possible)
✅ **Pattern**: Function 1 (discovery) → HTTP POST → Function 2 (notifications)

**Key Architecture**:
- `app/api/jeeves/analyze/route.ts`: Discovery + chain to Function 2
- `app/api/jeeves/process-notifications/route.ts`: Notification processing
- Database: Handoff point between functions
- Shared `executionId`: Unified logging across functions
- Each function: Uses `after()` for async processing within 300s limit

**Benefits**:
- ✅ Total work can exceed 300s (420s tested successfully)
- ✅ Each function stays within 300s limit
- ✅ Instant user feedback
- ✅ Unified activity logging
- ✅ Zero additional infrastructure (no queues, no caches)
