# Jeeves AI Butler - Technical Architecture

> **Last Updated:** 2025-10-03
> **Status:** Production
> **For:** Developers

## Overview

Jeeves is an AI-powered autonomous monitoring butler that analyzes telemetry streams, discovers insights, generates visual dashboards, and sends personalized notifications to team personas.

**Architecture Pattern:** Event-driven background processing using Inngest for reliable, scalable job execution.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Jeeves Command Center                     │
│                  (app/(chat)/jeeves/page.tsx)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Analysis Trigger                             │
│            (app/api/jeeves/analyze/route.ts)                 │
│                                                              │
│  1. Run Discovery Engine                                    │
│  2. Save discoveries to DB                                  │
│  3. Send Inngest event ────────────┐                        │
│  4. Return immediately              │                        │
└─────────────────────────────────────┼──────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │     Inngest      │
                            │  Event Queue     │
                            │ (discovery.      │
                            │  completed)      │
                            └────────┬─────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Notification Processing Job                     │
│    (lib/inngest/functions/process-notifications.ts)         │
│                                                              │
│  1. Load discovery from DB                                  │
│  2. For each recipient:                                     │
│     - Generate persona notification                         │
│     - Create dashboard (if needed)                          │
│     - Save notification to DB                               │
│  3. Mark discovery as "notified"                            │
└─────────────────────────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Discovery│  │ Persona  │  │   v0     │
   │  Engine  │  │ Notif    │  │Dashboard │
   │   LLM    │  │Generator │  │Generator │
   └──────────┘  └──────────┘  └──────────┘
```

---

## Core Components

### 1. Analysis Trigger (`app/api/jeeves/analyze/route.ts`)

**Purpose:** Initiates discovery phase and queues background notification processing.

**Execution Flow:**
```typescript
export async function POST(request: Request)
```

**Steps:**
1. Generate execution ID
2. Start background job using `after()` (Next.js 15)
3. Load Jeeves state from database
4. Check if enabled (skip if disabled)
5. Get monitored streams list
6. Load recent discoveries (last 24h, limit 3)
7. **Run Discovery Engine** → finds interesting patterns
8. For each discovery:
   - Save discovery to database
   - **Trigger Inngest event** → `discovery.completed`
   - Queue notification processing (no wait)
9. Update next analysis time
10. Return immediately

**Why Inngest Events?**
- **Problem:** Direct notification processing hit 300s Vercel timeout
- **Solution:** Queue notifications as background jobs
- **Benefits:**
  - No timeout limits (can run for hours)
  - Automatic retries on failure
  - Parallel processing of multiple discoveries
  - Better observability and debugging

**Activity Logging:**
- Logs every major step to `JeevesActivityLog` table
- Visible in UI Activity Log panel
- Includes: execution ID, level (info/success/error), message, metadata

**Error Handling:**
- Catches errors at each step
- Logs errors to activity log
- Continues processing other discoveries if one fails
- Inngest handles notification job failures separately

---

### 2. Discovery Engine (`lib/jeeves/discovery-engine.ts`)

**Purpose:** AI-powered pattern discovery in telemetry streams.

**Main Function:**
```typescript
export async function runDiscovery(
  monitoredStreams: string[],
  recentDiscoveries: any[]
): Promise<DiscoveryResult>
```

**Process:**

1. **Load Persona Contexts**
   ```typescript
   const personaContexts = await getAllPersonaContexts();
   ```
   - Fetches all personas from database
   - Loads memory and recent logs for each
   - Extracts interests (top 3) and behavior patterns

2. **Build LLM Context**
   - Monitored streams list
   - Current timestamp
   - Recent discoveries count
   - Persona names and interests (compact format)
   - Task: "Discover ANYTHING interesting"

3. **Call LLM with Tools**
   ```typescript
   const result = await jeevesRateLimit.executeWithRetry(
     async () => generateText({
       model: myProvider.languageModel('chat-model'),
       system: JEEVES_DISCOVERY_PROMPT,
       messages: [{ role: 'user', content: contextMessage }],
       tools: streamAnalysisTools, // 19 analysis tools
       temperature: 0.8,
       stopWhen: stepCountIs(10), // Max 10 tool calls
     }),
     {
       maxRetries: 5,
       estimatedTokens: 5000,
       onRetry: (attempt, wait) => console.log(...)
     }
   );
   ```

4. **Parse Response**
   - Looks for JSON with `discoveries` array
   - Each discovery includes:
     - title, category, severity, confidence
     - reasoning, evidence, hypothesis
     - recommendations
     - intendedRecipients[] (which personas to notify)
   - Captures tool usage trail for UI display

5. **Fallback Handling**
   - If no JSON found: creates "Analysis Complete" discovery
   - If parse error: creates "Unstructured" discovery
   - Never fails completely

**Tool Usage:**
- LLM has access to 19 stream analysis tools
- Can call up to 10 tools per discovery
- Tool results embedded in evidence

**Rate Limiting:**
- Wrapped in `jeevesRateLimit.executeWithRetry()`
- Auto-waits if rate limit hit
- Retries up to 5 times with exponential backoff

---

### 3. Inngest Notification Processor (`lib/inngest/functions/process-notifications.ts`)

**Purpose:** Background job that generates and saves notifications for a discovery.

**Trigger:** `discovery.completed` event

**Event Data:**
```typescript
{
  discoveryId: string,
  executionId: string
}
```

**Execution Flow:**
```typescript
export const processNotifications = inngest.createFunction(
  { id: "process-notifications" },
  { event: "discovery.completed" },
  async ({ event, step }) => { ... }
)
```

**Steps:**

1. **Load Discovery** (step: `load-discovery`)
   ```typescript
   const discovery = await getDiscoveryById(discoveryId);
   ```

2. **Process Each Recipient** (step: `notify-{personaName}`)
   - Generate persona notification using LLM
   - Create dashboard if needed (v0 generation)
   - Save notification to database
   - Track dashboard URL for embedding
   - Handle errors per recipient (don't fail entire job)

3. **Mark Discovery as Notified** (step: `mark-notified`)
   - Update discovery status to "notified"
   - Log completion statistics

**Benefits of Step Functions:**
- Each step is individually retried on failure
- Progress is saved between steps
- Can resume from last successful step
- Better error isolation

**Observability:**
- Logs to `JeevesActivityLog` table
- Visible in Inngest dashboard
- Per-step execution tracking

---

### 4. Inngest Client & API Route

**Client Configuration** (`lib/inngest/client.ts`)
```typescript
export const inngest = new Inngest({
  id: "jeeves",
  name: "Jeeves AI Butler"
});
```

**API Route** (`app/api/inngest/route.ts`)
```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processNotifications]
});
```

**How It Works:**
1. Your code sends events: `inngest.send({ name: "discovery.completed", data: {...} })`
2. Inngest receives event and calls your `/api/inngest` endpoint
3. Function executes on Vercel with your environment variables
4. All code runs on your infrastructure (not Inngest servers)

**Environment Variables (Auto-Set by Vercel Integration):**
- `INNGEST_SIGNING_KEY` - Validates requests from Inngest
- `INNGEST_EVENT_KEY` - Authenticates event sending

---

### 5. Persona Notification Generator (`lib/jeeves/persona-notification-generator.ts`)

**Purpose:** Generate personalized notification content for each persona, including optional dashboards.

**Main Function:**
```typescript
export async function generatePersonaNotification(
  discovery,
  recipient
): Promise<PersonaNotification>
```

**Process:**

1. **Load Persona Context**
   - Get persona memory and recent logs
   - Extract communication preferences
   - Determine preferred notification format

2. **Generate Dashboard (if needed)**
   - Create v0 dashboard for discovery
   - Publish to database with unique slug
   - Get dashboard URL for embedding

3. **Call LLM for Personalization**
   - System prompt: act as Jeeves butler
   - User prompt: discovery + recipient context
   - Requests: subject, summary, body (HTML + text)
   - Temperature: 0.7 (balanced creativity)

4. **Parse Response**
   - Extracts subject, summaryOneLiner, body
   - Falls back to discovery title if parse fails

**Output:**
```typescript
{
  personaName: string,
  format: string,
  subject: string,
  summaryOneLiner: string,
  bodyHtml: string,
  bodyText: string,
  dashboardId?: string,
  dashboardUrl?: string
}
```

---

### 6. Rate Limit Handler (`lib/jeeves/rate-limit-handler.ts`)

**Purpose:** Manage Anthropic API rate limits with automatic retry.

**Class:**
```typescript
class JeevesRateLimitHandler {
  private state: RateLimitState;

  updateFromHeaders(headers): void
  getWaitTime(estimatedTokens): number
  waitIfNeeded(estimatedTokens): Promise<void>
  executeWithRetry<T>(fn, options): Promise<T>
  getStatus(): RateLimitStatus
}
```

**Features:**

1. **State Tracking**
   - inputTokensRemaining (starts at 30,000)
   - inputTokensReset (timestamp)
   - requestsRemaining (starts at 50)
   - requestsReset (timestamp)
   - lastRequestTime

2. **Header Parsing**
   - Extracts rate limit info from API responses
   - Updates state with remaining tokens and reset times

3. **Wait Calculation**
   - Minimum 500ms between requests
   - Checks token budget before request
   - Calculates wait time until reset if needed

4. **Retry Logic**
   ```typescript
   for (let attempt = 1; attempt <= maxRetries; attempt++) {
     await this.waitIfNeeded(estimatedTokens);
     try {
       return await fn();
     } catch (error) {
       if (isRateLimitError && attempt < maxRetries) {
         const waitTime = calculateBackoff(attempt);
         await sleep(waitTime);
       } else throw error;
     }
   }
   ```

5. **Exponential Backoff**
   - Base wait time from API headers
   - Add (attempt × 10 seconds)
   - Max 120 seconds per retry

**Singleton Instance:**
```typescript
export const jeevesRateLimit = new JeevesRateLimitHandler();
```

---

## Database Schema

### Tables

**1. JeevesState**
```sql
CREATE TABLE "JeevesState" (
  id UUID PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  "analysisInterval" VARCHAR(20) DEFAULT '5min',
  "monitoredStreams" JSONB DEFAULT '[]'::jsonb,
  "lastAnalysisAt" TIMESTAMP,
  "nextAnalysisAt" TIMESTAMP
);
```

**2. JeevesDiscovery**
```sql
CREATE TABLE "JeevesDiscovery" (
  id UUID PRIMARY KEY,
  "discoveredAt" TIMESTAMP DEFAULT NOW(),
  title TEXT NOT NULL,
  category VARCHAR(100),
  severity VARCHAR(20), -- low/normal/high/critical
  confidence VARCHAR(10), -- stored as string (e.g., "0.85")
  "aiReasoning" TEXT,
  "aiEvidence" JSONB, -- includes toolUsageTrail
  "aiHypothesis" TEXT,
  "aiRecommendations" JSONB,
  "dashboardId" UUID REFERENCES "PublishedDashboard"(id),
  "dashboardSlug" VARCHAR(255),
  "visualReportUrl" TEXT,
  "intendedRecipients" JSONB, -- array of recipient objects
  status VARCHAR(20), -- new/notified/archived
  metadata JSONB
);
```

**3. JeevesNotification**
```sql
CREATE TABLE "JeevesNotification" (
  id UUID PRIMARY KEY,
  "discoveryId" UUID REFERENCES "JeevesDiscovery"(id),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "personaName" VARCHAR(255),
  format VARCHAR(50), -- email/slack/dashboard
  subject TEXT,
  "summaryOneLiner" TEXT,
  "bodyHtml" TEXT,
  "bodyText" TEXT,
  "embedDashboardUrl" TEXT,
  "embedChartImages" JSONB,
  "embedDataTable" JSONB,
  "viewedAt" TIMESTAMP,
  "acknowledgedAt" TIMESTAMP,
  feedback JSONB
);
```

**4. JeevesActivityLog**
```sql
CREATE TABLE "JeevesActivityLog" (
  id UUID PRIMARY KEY,
  "executionId" UUID NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  level VARCHAR(20), -- info/success/warning/error
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_jeeves_activity_executionId ON "JeevesActivityLog"("executionId");
CREATE INDEX idx_jeeves_activity_timestamp ON "JeevesActivityLog"(timestamp DESC);
```

---

## API Routes

### 1. POST `/api/jeeves/analyze`
Trigger immediate analysis (manual "Analyze Now" button).

**Request:** Empty POST

**Response:**
```typescript
{
  success: boolean,
  message: string,
  executionId: string,
  triggeredAt: string,
  note: "Check activity logs for progress"
}
```

**Implementation:**
- Uses Next.js 15 `after()` for background processing
- Runs discovery engine
- Triggers Inngest events for notification processing
- Returns immediately (no waiting for notifications)
- Discovery completes within 300s limit
- Notifications run in background (no timeout)

---

### 2. GET `/api/jeeves/state`
Get current Jeeves configuration.

**Response:**
```typescript
{
  id, enabled, analysisInterval, monitoredStreams,
  lastAnalysisAt, nextAnalysisAt
}
```

---

### 3. PATCH `/api/jeeves/state`
Update Jeeves configuration.

**Request:**
```typescript
{
  enabled?: boolean,
  analysisInterval?: '1min' | '2min' | '3min' | '5min',
  monitoredStreams?: string[]
}
```

---

### 4. GET `/api/jeeves/discoveries`
Get recent discoveries.

**Query Params:**
- `hours` (default: 24): time range
- `limit` (default: 20): max results
- `status`: filter by status

**Response:**
```typescript
{
  discoveries: JeevesDiscovery[],
  count: number,
  hours: number
}
```

---

### 5. GET `/api/jeeves/notifications`
Get notifications for all personas.

**Query Params:**
- `limit` (default: 50)

---

### 6. GET `/api/jeeves/activity-logs`
Get recent activity log entries.

**Response:**
```typescript
{
  logs: ActivityLog[],
  count: number,
  warning?: string // if table doesn't exist
}
```

**Graceful Degradation:**
- Returns empty array if table not created yet
- No 500 errors

---

### 7. POST/GET/PUT `/api/inngest`
Inngest webhook endpoint for executing background functions.

**Purpose:**
- Receives function execution requests from Inngest
- Validates requests using `INNGEST_SIGNING_KEY`
- Executes registered functions (e.g., `processNotifications`)
- Returns execution results to Inngest

**Security:**
- Auto-configured by Vercel integration
- Uses OIDC authentication
- All code runs on your Vercel infrastructure

**Functions Registered:**
- `process-notifications` - Handles `discovery.completed` events

---

### 8. GET `/api/jeeves/dashboard-data/[slug]`
Get dashboard HTML/script for embedding.

**Purpose:** Used by DiscoveryCard to embed dashboards using V0Card (srcDoc) instead of iframe src.

**Response:**
```typescript
{
  html: string,
  script: string,
  cardId: string
}
```

**Security:**
- Checks if dashboard is revoked or expired
- Public endpoint (no auth required)

---

## UI Components

### 1. Jeeves Command Center (`app/(chat)/jeeves/page.tsx`)

**Purpose:** Main dashboard for Jeeves system.

**Server-Side Data Loading:**
```typescript
const [state, discoveries, notifications, personas] = await Promise.all([
  ensureJeevesState(),
  getRecentDiscoveries(24, 20),
  getAllNotifications(50),
  loadPersonas()
]);
```

**Sections:**
- Status Panel (current state)
- Settings Panel (enable/disable, interval, analyze button)
- Activity Log (real-time execution logs)
- Persona Cards (team members with unread counts)
- Recent Discoveries (with embedded dashboards)
- Notification Feed (all notifications)

**Auto-Refresh:**
```typescript
export const revalidate = 30; // seconds
```

---

### 2. DiscoveryCard (`components/jeeves/discovery-card.tsx`)

**Purpose:** Display individual discovery with embedded dashboard.

**Key Features:**

1. **Metadata Display**
   - Title, category, severity badge
   - Confidence percentage
   - Discovery timestamp

2. **Analysis Trail**
   - Shows tool usage (if available)
   - Collapsible cards for each tool call
   - Input/output display

3. **Dashboard Embedding**
   ```typescript
   useEffect(() => {
     if (discovery.dashboardSlug) {
       fetch(`/api/jeeves/dashboard-data/${discovery.dashboardSlug}`)
         .then(res => res.json())
         .then(data => setDashboardData(data));
     }
   }, [discovery.dashboardSlug]);
   ```

   **Renders using V0Card:**
   ```tsx
   {dashboardData && (
     <>
       <V0Card id={dashboardData.cardId} html={dashboardData.html} />
       <V0CardScriptRunner cardId={dashboardData.cardId} script={dashboardData.script} />
     </>
   )}
   ```

   **Why srcDoc instead of src:**
   - No authentication issues
   - No X-Frame-Options blocking
   - No cross-origin problems
   - Same approach as chat dashboard rendering

4. **Recipients Display**
   - Lists notified personas
   - Shows format (email/slack/dashboard)

---

### 3. ActivityLog (`components/jeeves/activity-log.tsx`)

**Purpose:** Real-time execution progress display.

**Features:**
- Fetches `/api/jeeves/activity-logs`
- Auto-refreshes every 5 seconds when expanded
- Color-coded badges (info/success/warning/error)
- Timestamp display (locale-specific)

**Client Component:**
```tsx
useEffect(() => {
  fetchLogs();
  const interval = isExpanded ? setInterval(fetchLogs, 5000) : null;
  return () => { if (interval) clearInterval(interval); };
}, [isExpanded]);
```

---

### 4. SettingsPanel (`components/jeeves/settings-panel.tsx`)

**Purpose:** Configure Jeeves and trigger manual analysis.

**Controls:**
1. Enable/Disable toggle
2. Analysis interval select (1/2/3/5 min)
3. Save Settings button
4. **Analyze Now button**

**Analyze Now Handler:**
```typescript
const handleAnalyzeNow = async () => {
  setIsAnalyzing(true);
  const response = await fetch('/api/jeeves/analyze', { method: 'POST' });
  const result = await response.json();

  toast({
    type: result.success ? "success" : "error",
    description: result.message
  });

  router.refresh(); // Show new discoveries
  setIsAnalyzing(false);
};
```

---

## Key Design Decisions

### 1. Why srcDoc Instead of iframe src?

**Problem:** Dashboards in discoveries were failing to load via `<iframe src="https://.../d/slug">`:
- 401 authentication errors
- X-Frame-Options blocking
- Cross-origin issues

**Solution:** Use `srcDoc` (inline HTML) like chat dashboards:
```tsx
// Instead of:
<iframe src={visualReportUrl} />

// Use:
<V0Card id={cardId} html={html} />
<V0CardScriptRunner cardId={cardId} script={script} />
```

**Benefits:**
- No authentication required
- No HTTP requests for dashboard content
- No frame restrictions
- Same security sandbox
- Identical to chat implementation

---

### 2. Why Activity Logging?

**User Problem:** "What is Jeeves doing? Is it stuck?"

**Solution:** Database-backed activity log visible in UI.

**Implementation:**
```typescript
const executionId = crypto.randomUUID();
await logActivity(executionId, "info", "🎩 Analysis started");
await logActivity(executionId, "info", "🔍 Running discovery on 2 streams");
await logActivity(executionId, "success", "✅ Found 3 discoveries");
```

**Benefits:**
- Real-time progress visibility
- Debugging aid for developers
- Historical audit trail
- User confidence ("it's working!")

---

### 3. Why Inngest for Background Jobs?

**Problem 1:** Direct HTTP chaining hit 405 errors
- `/api/jeeves/analyze` → POST → `/api/jeeves/process-notifications`
- Vercel bypass token issues
- Method not allowed errors

**Problem 2:** 300s Vercel timeout
- Discovery + notifications took too long
- Complex notification generation with LLM
- Dashboard generation per persona
- Multiple recipients per discovery

**Solution:** Event-driven architecture with Inngest

**Implementation:**
```typescript
// Trigger analysis
await inngest.send({
  name: "discovery.completed",
  data: { discoveryId, executionId }
});

// Process in background
export const processNotifications = inngest.createFunction(
  { event: "discovery.completed" },
  async ({ event, step }) => { ... }
);
```

**Benefits:**
- ✅ No timeout limits (can run for hours)
- ✅ Automatic retries with exponential backoff
- ✅ Step-by-step progress tracking
- ✅ Individual step retries on failure
- ✅ Parallel processing of multiple discoveries
- ✅ Better observability in Inngest dashboard
- ✅ No HTTP 405 or auth issues
- ✅ Free tier: 100K executions/month
- ✅ All code runs on your Vercel infrastructure

---

### 4. Why Next.js 15 `after()` for Discovery?

**Purpose:** Allow discovery phase to complete without blocking response.

**Implementation:**
```typescript
export async function POST(request: Request) {
  const executionId = crypto.randomUUID();

  // Return immediately
  after(async () => {
    // Discovery runs in background
    const discoveries = await runDiscovery(...);

    // Trigger Inngest for notifications
    for (const disc of discoveries) {
      await inngest.send({ name: "discovery.completed", ... });
    }
  });

  return NextResponse.json({ success: true, executionId });
}
```

**Benefits:**
- User gets immediate feedback
- Discovery completes reliably
- Activity logs show progress
- Still respects 300s limit (but rarely hits it)

**Why Not Use Inngest for Discovery Too?**
- Discovery is fast (30-60s typically)
- Benefits from immediate feedback
- Activity logs stream to UI in real-time
- Keeps UI responsive during analysis

---

### 5. Why Rate Limit Handler?

**Problem:** Anthropic API has rate limits (150,000 tokens/minute on Tier 2).

**Symptoms:**
- 429 errors during heavy usage
- "Failed after 3 attempts" errors
- Lost work

**Solution:** Singleton rate limit manager with retry.

**Features:**
- Tracks remaining tokens from headers
- Calculates wait times automatically
- Exponential backoff
- Up to 5 retries
- Waits for rate limit reset

**Current Tier (Tier 2):**
- 150,000 tokens/minute
- 50 requests/minute
- Sufficient for ~30 analyses/minute
- Rarely hit in normal operation

**Usage:**
```typescript
await jeevesRateLimit.executeWithRetry(
  async () => generateText(...),
  { maxRetries: 5, estimatedTokens: 5000 }
);
```

---

## Token Optimization

### Current Usage (per analysis):

**System Prompt:** ~800 tokens
- Jeeves discovery prompt
- Output format instructions

**User Message:** ~500 tokens
- Monitored streams: ~50
- Recent discoveries: ~100
- Personas (optimized): ~150
- Task description: ~200

**Tools:** ~2,850 tokens
- 19 stream analysis tools
- Schema definitions

**Tool Calls:** ~2,000-5,000 tokens (variable)
- Depends on tool usage
- Up to 10 tool calls

**Total Estimate:** ~5,000-10,000 tokens per request

### Optimizations Applied:

1. **Reduced Persona Context** (saved ~2,000 tokens)
   - Was: Full memory + logs + behavior for each
   - Now: Just names + top 3 interests

2. **Reduced Discovery History** (saved ~1,500 tokens)
   - Was: 10 recent discoveries
   - Now: 3 recent discoveries

3. **Reduced Persona Logs** (saved ~1,500 tokens)
   - Was: 20 logs per persona
   - Now: 5 logs per persona

4. **Compact Prompt Format** (saved ~500 tokens)
   - Single-line persona list
   - No JSON formatting overhead

**Total Savings:** ~5,500 tokens (52% reduction)

**Rate Limit Impact (Tier 2: 150k tokens/minute):**
- Can handle ~30 discovery requests per minute
- ~300 persona notifications per minute (LLM calls)
- Optimization ensures efficient token usage

### Future Optimizations:

1. **Prompt Caching (AI SDK 3.5+)**
   - Cache system prompt (800 tokens)
   - Cache tool definitions (2,850 tokens)
   - Save 90%+ on subsequent requests

2. **Reduce Tool Count**
   - Provide only relevant tools per discovery type
   - E.g., 5 tools instead of 19

3. **Streaming Responses**
   - Use `streamText` instead of `generateText`
   - Start processing before full response

---

## Debugging Guide

### Common Issues

**1. "Analyze Now" Does Nothing**

**Check:**
```bash
# View logs
vercel logs --follow

# Look for:
[Discovery Engine] ========================================
[Discovery Engine] Starting unconstrained discovery...
```

**Common Causes:**
- Import order wrong (imports at bottom of file)
- Async function not awaited
- Error caught and swallowed
- Rate limit hit (check for "⚠️ Rate limit retry")

---

**2. Rate Limit Errors**

**Symptoms:**
```
Error: This request would exceed the rate limit
anthropic-ratelimit-input-tokens-remaining: 0
```

**Solutions:**
- Wait 60 seconds for reset
- Check if hitting 150k tokens/minute (Tier 2 limit)
- Rate limit handler auto-retries
- Use prompt caching (future optimization)

---

**3. Dashboard Won't Embed**

**Check:**
1. Is `dashboardSlug` in database?
2. Does `/api/jeeves/dashboard-data/[slug]` return data?
3. Is `V0Card` component rendering?
4. Browser console for errors

**Fix:**
```tsx
// Verify data is fetched
console.log('[DiscoveryCard] Dashboard data:', dashboardData);

// Verify API returns data
fetch('/api/jeeves/dashboard-data/SLUG').then(r => r.json()).then(console.log);
```

---

**4. Activity Log Empty**

**Check:**
1. Is `JeevesActivityLog` table created?
   ```sql
   SELECT * FROM "JeevesActivityLog" ORDER BY timestamp DESC LIMIT 10;
   ```

2. Is `logActivity()` being called?
   ```typescript
   // Should see logs like:
   await logActivity(executionId, "info", "🎩 Analysis started");
   ```

3. Is API route working?
   ```bash
   curl https://your-app.vercel.app/api/jeeves/activity-logs
   ```

---

## Performance Characteristics

### Analysis Duration

**Normal (no rate limit):**
- Discovery: 30-60s
- Visual report: 5-10s per discovery
- Notifications: 3-5s per recipient
- **Total:** 1-3 minutes for 3 discoveries

**Rate Limited:**
- First request fails: ~5s
- Wait for reset: 60-120s
- Retry succeeds: 30-60s
- **Total:** 2-4 minutes

**Timeout Risk:**
- Vercel Pro limit: 300s (5 minutes)
- If heavily rate limited: may timeout
- Activity log shows progress even if timeout

### Database Queries

**Per Analysis:**
- 1× Load Jeeves state
- 1× Load recent discoveries
- 10× Load persona contexts
- N× Create discoveries
- M× Create notifications
- ~50× Activity log inserts

**Optimization Opportunities:**
- Batch persona loads
- Cache persona contexts
- Reduce activity log writes

---

## Testing Checklist

### Manual Testing

1. **Enable Jeeves**
   - Toggle switch
   - Save settings
   - Verify database updated

2. **Click "Analyze Now"**
   - Button shows "Analyzing..."
   - Activity log populates
   - No errors in console
   - Success toast appears
   - Page refreshes with new discoveries

3. **View Discovery**
   - Dashboard embeds correctly
   - Analysis trail expands
   - Recipients list shows
   - Severity badge correct color

4. **Check Notifications**
   - Notification feed shows entries
   - Persona name correct
   - Dashboard URL works
   - HTML/text content present

### Automated Testing

**Rate Limit Handler:**
```typescript
// Test retry logic
const handler = new JeevesRateLimitHandler();
const result = await handler.executeWithRetry(
  async () => simulateRateLimitError(),
  { maxRetries: 3 }
);
```

**Discovery Parsing:**
```typescript
// Test JSON extraction
const text = `Some text { "discoveries": [...] } more text`;
const match = text.match(/\{[\s\S]*"discoveries"[\s\S]*\}/);
const result = JSON.parse(match[0]);
```

---

## Deployment

### Environment Variables Required

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Database
POSTGRES_URL=postgres://...

# App URL
NEXT_PUBLIC_URL=https://your-app.vercel.app

# Inngest (Auto-set by Vercel integration)
INNGEST_SIGNING_KEY=signkey-...
INNGEST_EVENT_KEY=...
```

### Database Migrations

Run in order:
```sql
-- 1. Jeeves tables
migrations/012_jeeves_activity_log.sql

-- 2. System user (for dashboards)
POPULATE_PERSONAS.sql -- includes system user creation
```

### Vercel Configuration

```typescript
// app/api/jeeves/analyze/route.ts
export const maxDuration = 300; // 5 minutes (Pro plan) - for discovery only
```

### Inngest Setup

1. **Install Inngest on Vercel:**
   - Visit: https://vercel.com/integrations/inngest
   - Click "Add Integration"
   - Select your Vercel project
   - Environment variables auto-configured

2. **Verify Integration:**
   - Deploy to Vercel
   - Visit Inngest dashboard: https://app.inngest.com
   - Your functions should appear automatically

3. **Monitor Executions:**
   - View function runs in Inngest dashboard
   - See step-by-step execution
   - Retry failed jobs manually if needed

### Next.js Configuration

```typescript
// next.config.ts
export default {
  async headers() {
    return [{
      source: '/d/:slug',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
      ]
    }];
  }
};
```

```typescript
// middleware.ts
export const config = {
  matcher: [
    // Exclude /d/ routes from auth
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|d/).*)"
  ]
};
```

---

## File Structure

```
lib/jeeves/
├── discovery-engine.ts              # AI pattern discovery
├── persona-notification-generator.ts # Personalized messages
└── rate-limit-handler.ts            # API rate limit manager

lib/inngest/
├── client.ts                        # Inngest client config
└── functions/
    └── process-notifications.ts     # Background notification job

app/api/jeeves/
├── analyze/route.ts                 # Manual trigger (discovery only)
├── state/route.ts                   # GET/PATCH config
├── discoveries/route.ts             # GET discoveries
├── notifications/route.ts           # GET notifications
├── activity-logs/route.ts           # GET execution logs
├── dashboard-data/[slug]/           # GET dashboard HTML/script
└── process-notifications/route.ts   # DEPRECATED (replaced by Inngest)

app/api/inngest/
└── route.ts                         # Inngest webhook endpoint

app/(chat)/jeeves/
└── page.tsx                         # Command center

components/jeeves/
├── status-panel.tsx                 # State display
├── settings-panel.tsx               # Config + analyze button
├── activity-log.tsx                 # Real-time progress
├── persona-cards.tsx                # Team grid
├── discovery-card.tsx               # Discovery + dashboard
├── notification-card.tsx            # Notification display
└── analysis-trail.tsx               # Tool usage display

lib/db/
├── schema.ts                        # Jeeves tables
└── jeeves-queries.ts                # Database operations
```

---

## Troubleshooting

### Logs Show "Starting analysis" Then Nothing

**Cause:** Import order issue - `db` and `persona` imported at bottom of file.

**Fix:** Move imports to top of `discovery-engine.ts`.

---

### Discovery Shows "Jeeves analyzed but did not format response correctly"

**Cause:** LLM didn't return JSON in expected format.

**Fix:**
1. Check LLM response in logs
2. Verify prompt clarity
3. Check if tool calls are working
4. May need to adjust prompt or parsing

---

### Dashboard Shows 401/403 Errors

**Cause:** Auth middleware intercepting `/d/` routes OR X-Frame-Options blocking.

**Fix:**
1. Verify middleware excludes `/d/` routes
2. Verify X-Frame-Options set to SAMEORIGIN
3. Use V0Card (srcDoc) instead of iframe src

---

### Rate Limit Never Resets

**Cause:** Not updating rate limit state from API headers.

**Fix:** Check `jeevesRateLimit.updateFromHeaders()` is called in error handler.

---

## Future Enhancements

### High Priority

1. **Prompt Caching**
   - Cache system prompt + tools
   - Save 90%+ tokens on retries
   - Requires AI SDK 3.5+

2. **Scheduled Analysis**
   - Cron job or Vercel Cron
   - Runs every 1/2/3/5 minutes based on setting
   - No manual trigger needed

3. **Background Jobs (Next.js 15 `after()`)**
   - Use `after()` for long-running analysis
   - No timeout limits
   - Better user experience

### Medium Priority

4. **Discovery Deduplication**
   - Compare with recent discoveries
   - Avoid repeat alerts
   - Similarity scoring

5. **Notification Delivery**
   - Actually send emails/Slack messages
   - Integration with communication platforms
   - Delivery status tracking

6. **Persona Feedback Loop**
   - Track which discoveries personas like
   - Adjust discovery targeting
   - Learn interests over time

### Low Priority

7. **Discovery Search**
   - Full-text search
   - Filter by category/severity
   - Date range queries

8. **Export/Archive**
   - Export discoveries as PDF/JSON
   - Archive old discoveries
   - Retention policies

---

## Known Limitations

1. **Discovery Timeout:** 300s max (5 min) on Pro plan for discovery phase
   - May timeout if heavily rate limited
   - Notifications run separately via Inngest (no timeout)

2. **Rate Limit:** 150,000 tokens/minute (Anthropic Tier 2)
   - ~30 analyses per minute maximum
   - Rarely hit in normal operation
   - Affects discovery phase only

3. **No Real Delivery:** Notifications saved to DB but not sent
   - Would need email/Slack integration
   - Placeholder for future feature

4. **Single Discovery Instance:** Discovery runs on one serverless function
   - Can't parallelize within discovery phase
   - Notifications are parallelized via Inngest

5. **Inngest Free Tier:** 100K executions/month
   - ~3,300 executions per day
   - Each notification = 1 execution
   - Should be sufficient for most use cases

---

## Version History

- **v2.0** (2025-10-03): Inngest integration
  - Event-driven architecture for notifications
  - Eliminated 300s timeout issues
  - Fixed 405 HTTP chaining errors
  - Automatic retries with step functions
  - Better observability in Inngest dashboard
  - Parallel notification processing

- **v1.0** (2025-10-02): Initial production release
  - Core discovery, visual reports, notifications
  - Activity logging
  - Rate limit handling
  - Dashboard embedding via srcDoc

---

## Contact

For questions or issues, check:
1. Backend logs (`vercel logs --follow`)
2. Activity Log in UI
3. Browser console
4. This documentation

**Remember:** Imports must be at the top of files, not the bottom!
