# External Job Queues for Long-Running AI Agents - Complete Guide

## Overview

External job queues solve the fundamental limitation of serverless functions: timeouts. For AI agents that need to:
- Run for >15 minutes
- Make 20+ LLM calls with retries
- Wait for rate limits without timing out
- Coordinate multiple AI models
- Run scheduled background tasks reliably

**The Problem:** Vercel/AWS Lambda max out at 5-15 minutes. AI agents often need hours.

**The Solution:** External job orchestration platforms that run your code with NO timeout limits.

---

## Comparison of Top 3 Solutions

| Feature | Inngest | Trigger.dev | Upstash QStash + Workflow |
|---------|---------|-------------|---------------------------|
| **Max Duration** | Unlimited | Unlimited | Unlimited |
| **Pricing (Free Tier)** | 1M steps/month | 500 task runs/month | 500 requests/day |
| **AI SDK Integration** | ✅ step.ai.wrap() | ✅ Native | ✅ Via SDK |
| **Vercel Integration** | ✅ Official | ✅ Official | ✅ Official |
| **Setup Complexity** | Low | Low | Medium |
| **Retries** | Automatic (configurable) | Automatic | Up to 3 times |
| **Observability** | Built-in dashboard | Built-in dashboard | Built-in dashboard |
| **Serverless-Friendly** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Parallelization** | ✅ step.run() | ✅ task.run() | ✅ Workflow steps |
| **Cron Support** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Local Development** | ✅ Dev server | ✅ Dev server | ✅ CLI |
| **Best For** | Multi-step workflows | Long AI tasks | Simple queues |

---

## Option 1: Inngest (RECOMMENDED FOR JEEVES)

### Why Inngest is Best for Jeeves

1. **Event-driven architecture** - Perfect for scheduled tasks (every 5 min)
2. **Built-in AI SDK support** - `step.ai.wrap()` wraps generateText() natively
3. **Step-based execution** - Each tool call runs independently
4. **Zero timeout risk** - Each step can take hours
5. **Cost-effective** - 1M steps/month free (Jeeves uses ~50-100 steps/day)

### Quick Start (5 minutes)

#### 1. Install Inngest

```bash
npm install inngest
```

#### 2. Create Inngest Client

**File:** `lib/inngest/client.ts`
```typescript
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "nextjs-ai-chatbot",
  name: "Next.js AI Chatbot"
});
```

#### 3. Create Jeeves Function

**File:** `lib/inngest/functions/jeeves-analysis.ts`
```typescript
import { inngest } from "../client";
import { generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { streamAnalysisTools } from "@/lib/ai/tools/stream-analysis";
import { getAllPersonaContexts } from "@/lib/jeeves/discovery-engine";
import { getJeevesState, saveDiscovery } from "@/lib/db/jeeves-ops";

export const jeevesDiscoveryAnalysis = inngest.createFunction(
  {
    id: "jeeves-discovery-analysis",
    name: "Jeeves Stream Analysis",
    retries: 3, // Auto-retry on failure
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ event, step }) => {
    // Step 1: Load Jeeves state (no timeout)
    const state = await step.run("load-jeeves-state", async () => {
      const jeevesState = await getJeevesState();

      if (!jeevesState.enabled) {
        throw new Error("Jeeves is disabled");
      }

      return jeevesState;
    });

    // Step 2: Load persona contexts (no timeout)
    const personaContexts = await step.run("load-persona-contexts", async () => {
      return await getAllPersonaContexts();
    });

    // Step 3: Phase 1 - Data Discovery (no timeout, with AI SDK)
    const phase1 = await step.ai.wrap("phase-1-data-discovery", generateText, {
      model: myProvider.languageModel('chat-model'),
      system: `You are Jeeves, Phase 1: Data Discovery.
Your task: List available streams and gather recent data.`,
      messages: [{
        role: 'user',
        content: buildContextMessage(state.monitoredStreams, personaContexts)
      }],
      tools: {
        listAvailableStreamsTool: streamAnalysisTools.listAvailableStreamsTool,
        getStreamRecentDataTool: streamAnalysisTools.getStreamRecentDataTool,
        getMultipleStreamsTool: streamAnalysisTools.getMultipleStreamsTool,
      },
      temperature: 0.7,
      stopWhen: stepCountIs(3),
    });

    // Step 4: Phase 2 - Statistical Analysis (cache hit!)
    const phase2 = await step.ai.wrap("phase-2-statistical-analysis", generateText, {
      model: myProvider.languageModel('chat-model'),
      system: `You are Jeeves, Phase 2: Statistical Analysis.
Previous findings: ${phase1.text}`,
      messages: [{
        role: 'user',
        content: 'Analyze statistics, trends, and anomalies.'
      }],
      tools: {
        analyzeStreamStatisticsTool: streamAnalysisTools.analyzeStreamStatisticsTool,
        analyzeStreamTrendTool: streamAnalysisTools.analyzeStreamTrendTool,
        analyzeStreamAnomaliesTool: streamAnalysisTools.analyzeStreamAnomaliesTool,
      },
      temperature: 0.8,
      stopWhen: stepCountIs(3),
    });

    // Step 5: Phase 3 - Pattern Discovery (cache hit!)
    const phase3 = await step.ai.wrap("phase-3-pattern-discovery", generateText, {
      model: myProvider.languageModel('chat-model'),
      system: `You are Jeeves, Phase 3: Creative Pattern Discovery.
Previous findings: ${phase1.text}\n\n${phase2.text}`,
      messages: [{
        role: 'user',
        content: 'Find creative correlations and patterns. Be playful!'
      }],
      tools: {
        correlateTwoStreamsTool: streamAnalysisTools.correlateTwoStreamsTool,
        correlateMultipleStreamsTool: streamAnalysisTools.correlateMultipleStreamsTool,
        analyzeStreamPatternsTool: streamAnalysisTools.analyzeStreamPatternsTool,
      },
      temperature: 0.9,
      stopWhen: stepCountIs(3),
    });

    // Step 6: Combine discoveries (no timeout)
    const discoveries = await step.run("combine-discoveries", async () => {
      const all = [
        ...extractDiscoveries(phase1.text),
        ...extractDiscoveries(phase2.text),
        ...extractDiscoveries(phase3.text),
      ];

      return all;
    });

    // Step 7: Save to database (no timeout)
    await step.run("save-discoveries", async () => {
      for (const discovery of discoveries) {
        await saveDiscovery(discovery);
      }
    });

    // Step 8: Send notifications (no timeout, can run in parallel)
    await step.run("send-notifications", async () => {
      // Send personalized notifications to each persona
      const notifications = discoveries.flatMap(d =>
        d.intendedRecipients.map(r => ({
          persona: r.personaName,
          discovery: d,
          format: r.suggestedFormat
        }))
      );

      // Could send emails, Slack messages, etc.
      console.log(`Sending ${notifications.length} notifications`);
    });

    return {
      success: true,
      discoveriesCount: discoveries.length,
      executionTime: Date.now() - event.ts,
    };
  }
);

// Helper function
function buildContextMessage(streams: string[], personas: any[]) {
  return `Monitored streams: ${JSON.stringify(streams)}\n\nPersonas: ${JSON.stringify(personas)}`;
}

function extractDiscoveries(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*"discoveries"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.discoveries || [];
    } catch {
      return [];
    }
  }
  return [];
}
```

#### 4. Create API Route

**File:** `app/api/inngest/route.ts`
```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { jeevesDiscoveryAnalysis } from "@/lib/inngest/functions/jeeves-analysis";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    jeevesDiscoveryAnalysis,
  ],
});
```

#### 5. Run Development Server

```bash
npx inngest-cli@latest dev
```

This opens:
- **Local dashboard:** http://localhost:8288
- **Dev server** that receives events and runs functions

#### 6. Deploy to Production

Add to Vercel:
1. Go to Vercel dashboard
2. Integrations → Add Inngest
3. Connect your account
4. Deploy - Inngest auto-discovers your functions!

**Environment Variables:**
```bash
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
```

### Advanced Features

#### Parallel Execution

```typescript
const [stats, correlations, quality] = await Promise.all([
  step.run("analyze-statistics", async () => {
    return await analyzeStreamStatistics({ streamId: 'temp-001' });
  }),
  step.run("find-correlations", async () => {
    return await correlateTwoStreams({ streamId1: 'temp-001', streamId2: 'humid-001' });
  }),
  step.run("check-quality", async () => {
    return await assessStreamDataQuality({ streamId: 'temp-001' });
  }),
]);
```

#### Wait for Rate Limits

```typescript
// If rate limited, sleep and retry
await step.run("wait-for-rate-limit", async () => {
  const status = globalRateLimitMonitor.getCurrentLimits();

  if (status.inputTokensRemaining < 30000) {
    const waitTime = status.inputTokensReset.getTime() - Date.now();
    await step.sleep("wait-for-tokens", waitTime);
  }
});

// Now proceed with LLM call
const result = await step.ai.wrap("llm-call", generateText, { /* ... */ });
```

#### Manual Triggers (for testing)

```typescript
// app/api/jeeves/trigger/route.ts
import { inngest } from "@/lib/inngest/client";

export async function POST() {
  await inngest.send({
    name: "jeeves/analyze",
    data: { manual: true }
  });

  return Response.json({ status: "Analysis triggered" });
}
```

### Pricing

**Free Tier:**
- 1,000,000 steps/month
- Unlimited functions
- Unlimited events

**Jeeves Usage Estimate:**
- Runs every 5 minutes = 288 runs/day
- Each run = ~10 steps (8 from example above)
- Daily: 288 × 10 = 2,880 steps
- Monthly: ~86,400 steps
- **Well within free tier!**

**Paid Tiers:**
- Starts at $20/month for 5M steps
- Enterprise pricing available

---

## Option 2: Trigger.dev

### Why Trigger.dev

1. **Absolutely no timeouts** - Longest task recorded: 24+ hours
2. **Built for AI** - Optimized for LLM calls with automatic retrying
3. **Beautiful DX** - Best developer experience, great UI
4. **Free tier** - 500 task runs/month

### Quick Start

#### 1. Install

```bash
npm install @trigger.dev/sdk
npx trigger.dev@latest init
```

#### 2. Create Task

**File:** `trigger/jeeves-analysis.ts`
```typescript
import { task } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";

export const jeevesAnalysis = task({
  id: "jeeves-discovery-analysis",
  run: async (payload: { streams: string[] }) => {
    // NO TIMEOUT - can run for hours!

    const phase1 = await generateText({
      model: myProvider.languageModel('chat-model'),
      system: "Jeeves Phase 1...",
      // ... full config
    });

    const phase2 = await generateText({
      model: myProvider.languageModel('chat-model'),
      system: "Jeeves Phase 2...",
      messages: [
        { role: 'assistant', content: phase1.text },
        { role: 'user', content: 'Continue...' }
      ],
    });

    // Combine and return
    return {
      discoveries: extractDiscoveries(phase1.text, phase2.text)
    };
  },
});
```

#### 3. Trigger from Code

```typescript
import { tasks } from "@trigger.dev/sdk/v3";
import type { jeevesAnalysis } from "@/trigger/jeeves-analysis";

// Trigger the task
const handle = await tasks.trigger<typeof jeevesAnalysis>(
  "jeeves-discovery-analysis",
  { streams: ['temp-001', 'humid-001'] }
);

// Check status
const status = await handle.status();
```

#### 4. Schedule with Cron

```typescript
import { schedules } from "@trigger.dev/sdk/v3";

export const jeevesSchedule = schedules.task({
  id: "jeeves-every-5-minutes",
  cron: "*/5 * * * *",
  run: async (payload) => {
    const state = await getJeevesState();

    if (state.enabled) {
      await tasks.trigger("jeeves-discovery-analysis", {
        streams: state.monitoredStreams
      });
    }
  },
});
```

### Key Features

- **Automatic retries** - Failed AI calls retry automatically
- **Realtime logs** - See LLM calls in real-time
- **Telemetry** - Token usage, latency, costs tracked automatically
- **No infrastructure** - Fully managed

### Pricing

**Free Tier:**
- 500 task runs/month
- 100 hours compute time

**Jeeves Usage:**
- 288 runs/day × 30 days = 8,640 runs/month
- **Exceeds free tier** - would need paid plan

**Paid:**
- Starts at $20/month for 3,000 runs

---

## Option 3: Upstash QStash + Workflow

### Why Upstash

1. **Serverless-native** - Built specifically for Vercel/serverless
2. **Simple API** - Easiest to get started
3. **Redis integration** - If you use Upstash Redis already
4. **Generous free tier** - 500 requests/day

### Quick Start

#### 1. Install

```bash
npm install @upstash/workflow
```

#### 2. Get API Keys

- Sign up at https://console.upstash.com
- Create QStash instance
- Copy `QSTASH_TOKEN`

#### 3. Create Workflow

**File:** `app/api/jeeves/workflow/route.ts`
```typescript
import { serve } from "@upstash/workflow/nextjs";
import { generateText } from "ai";

export const { POST } = serve(async (context) => {
  // Step 1: Load data
  const state = await context.run("load-state", async () => {
    return await getJeevesState();
  });

  // Step 2: Phase 1
  const phase1 = await context.run("phase-1", async () => {
    return await generateText({
      model: myProvider.languageModel('chat-model'),
      // ... config
    });
  });

  // Step 3: Phase 2 (if rate limited, automatically retries)
  const phase2 = await context.run("phase-2", async () => {
    return await generateText({
      model: myProvider.languageModel('chat-model'),
      // ... config
    });
  });

  return { success: true };
});
```

#### 4. Schedule with QStash

```typescript
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// Schedule every 5 minutes
await qstash.schedules.create({
  destination: "https://your-app.vercel.app/api/jeeves/workflow",
  cron: "*/5 * * * *",
});
```

### Pricing

**Free Tier:**
- 500 requests/day
- 100 schedules

**Jeeves Usage:**
- 288 requests/day
- **Fits in free tier!**

**Paid:**
- Pay-as-you-go: $1 per 100k requests

---

## Detailed Comparison

### Inngest vs Trigger.dev vs Upstash

#### For Jeeves Specifically

**Inngest Wins Because:**
1. ✅ Free tier covers our usage (1M steps vs 86k needed)
2. ✅ Native AI SDK support with `step.ai.wrap()`
3. ✅ Event-driven model perfect for scheduled tasks
4. ✅ Excellent observability
5. ✅ Can scale to 100+ tools easily

**Trigger.dev is Better If:**
- You need the absolute best developer experience
- You're okay paying $20/month immediately
- You want built-in AI-specific features (token tracking, etc.)
- You need 24+ hour tasks regularly

**Upstash is Better If:**
- You want the simplest possible API
- You already use Upstash Redis
- You prefer pay-as-you-go pricing
- You don't need complex orchestration

### Feature Comparison Details

| Feature | Inngest | Trigger.dev | Upstash |
|---------|---------|-------------|---------|
| **Event replay** | ✅ Yes | ✅ Yes | ❌ No |
| **Local dev UI** | ✅ Beautiful | ✅ Beautiful | ⚠️ Basic |
| **Debugging** | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| **Typed events** | ✅ Yes | ✅ Yes | ❌ No |
| **SDK quality** | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| **Documentation** | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| **Community** | ✅ Active | ✅ Active | ⚠️ Growing |

---

## Migration Path for Jeeves

### Phase 1: Proof of Concept (1 hour)
1. Install Inngest
2. Create simple function with 1 LLM call
3. Test locally with `inngest dev`
4. Verify it works

### Phase 2: Full Migration (2-3 hours)
1. Move all discovery logic to Inngest function
2. Break into steps (phases 1-3)
3. Add database saves as steps
4. Add notification sending as steps

### Phase 3: Production (1 hour)
1. Deploy to Vercel
2. Add Inngest integration
3. Configure cron schedule
4. Monitor in Inngest dashboard

### Phase 4: Optimize (ongoing)
1. Add more steps for granular control
2. Implement parallel analysis
3. Add human-in-the-loop approvals
4. Expand to more streams/tools

---

## Code Comparison: Current vs Inngest

### Current (Serverless with Timeout Risk)

```typescript
// Times out after 300s, rate limits kill it
export async function runJeevesAnalysis() {
  const discoveries = await runDiscovery(); // 🚨 Can timeout
  await saveDiscoveries(discoveries); // 🚨 Never reached if timeout
  await sendNotifications(discoveries); // 🚨 Never reached
}
```

### With Inngest (Bulletproof)

```typescript
export const jeevesAnalysis = inngest.createFunction(
  { id: "jeeves-analysis" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // Each step independent - no cascade failures!
    const discoveries = await step.run("discover", async () => {
      return await runDiscovery(); // ✅ Can take hours
    });

    await step.run("save", async () => {
      return await saveDiscoveries(discoveries); // ✅ Always runs
    });

    await step.run("notify", async () => {
      return await sendNotifications(discoveries); // ✅ Always runs
    });
  }
);
```

---

## Final Recommendation

### For Jeeves: Use Inngest

**Reasons:**
1. Free tier covers usage completely
2. Perfect for scheduled background tasks
3. Native AI SDK integration
4. Best balance of features vs complexity
5. Room to grow (can add 100+ more tools)

**Implementation Time:**
- Setup: 30 minutes
- Migration: 2-3 hours
- Testing: 1 hour
- **Total: ~4 hours**

**Immediate Benefits:**
- ✅ No more timeouts ever
- ✅ No more rate limit failures killing analysis
- ✅ Automatic retries on any failure
- ✅ Full observability dashboard
- ✅ Can expand Jeeves infinitely

**Next Steps:**
1. Review the Inngest example code above
2. Decide if you want to proceed
3. I can help implement it step-by-step

