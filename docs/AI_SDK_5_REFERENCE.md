# AI SDK 5 Reference Documentation

## stopWhen Feature

AI SDK 5 introduces the `stopWhen` feature for building agents, which allows you to define when a tool-calling loop is stopped.

### How stopWhen Works

With the `stopWhen` setting, you can enable multi-step calls in `generateText` and `streamText`. When `stopWhen` is set and the model generates a tool call, the AI SDK will trigger a new generation passing in the tool result until there are no further tool calls or the stopping condition is met.

The `stopWhen` parameter defines conditions for stopping the generation when the last step contains tool results. When multiple conditions are provided as an array, the generation stops if any condition is met.

### Migration from maxSteps

For core functions like `generateText` and `streamText`, the `maxSteps` parameter has been replaced with `stopWhen`, which provides more flexible control over multi-step execution.

### TypeScript Types

```typescript
import type { StepResult } from 'ai';

// The step parameter in stopWhen callback has type StepResult
stopWhen: (step: StepResult<any>) => boolean
```

### Step Object Properties

The step object contains:
- `text`: The generated text for the step
- `toolCalls`: An array of tool calls made during the step
- `toolResults`: Results from tool executions
- `finishReason`: Reason for completing the step
- `usage`: Token usage information
- `stepNumber`: The current step number (0-indexed)

### Usage Examples

**Using built-in helpers:**
```typescript
import { stepCountIs, hasToolCall } from 'ai';

// Stop at step 5 if tools were called
stopWhen: stepCountIs(5)

// Stop when specific tool is called
stopWhen: hasToolCall('finalizeTask')

// Multiple conditions (OR logic)
stopWhen: [
  stepCountIs(10), // Maximum 10 steps
  hasToolCall('submitOrder') // Or when order is submitted
]
```

**Custom conditions:**
```typescript
import type { StepResult } from 'ai';

// Custom function with proper typing
stopWhen: (step: StepResult<any>) => step.stepNumber >= maxSteps

// More complex condition
stopWhen: (step: StepResult<any>) => {
  return step.toolCalls.some(call => call.toolName === 'finalTool') ||
         step.stepNumber >= 10;
}
```

### Important Notes

- `stopWhen` conditions are only evaluated when the last step contains tool results
- The `stepType` property has been removed from step results in AI SDK 5
- When you make a request with `generateText` and `streamText`, it runs for a single step by default
- Use `prepareStep` to control settings for each step while `stopWhen` keeps your agent running

## Rate Limiting

### Error Handling

Rate limit errors from Anthropic API include:
- Error type: `tv` (token validation)
- Response headers with current usage information
- `inputTokensRemaining`: Tokens available in current window
- `resetIn`: Time in seconds until rate limit resets

### Best Practices

1. **Estimate tokens before requests** - Use `estimatedTokens` to track usage
2. **Implement retry logic** - Wait for rate limit reset when hit
3. **Monitor response headers** - Update rate limit status from headers
4. **Reduce prompt length** - When hitting limits, optimize prompts
5. **Use chunking strategically** - Break large analyses only when necessary

## Tool Calling

### Extracting Tool Calls from Steps

```typescript
const { steps } = await generateText({
  // ... configuration
});

const allToolCalls = steps.flatMap(step => step.toolCalls);
```

### onStepFinish Callback

The `onStepFinish` callback receives a step object with:
- `text`
- `toolCalls`
- `toolResults`
- `finishReason`
- `usage`

```typescript
await generateText({
  // ... other options
  onStepFinish: (step) => {
    console.log('Step finished:', {
      text: step.text,
      toolCalls: step.toolCalls.length,
      finishReason: step.finishReason,
      usage: step.usage
    });
  }
});
```

## Agent Control

- **stopWhen**: Keeps your agent running with defined stop conditions
- **prepareStep**: Allows you to control the settings for each step
- Provides precise control over execution flow in TypeScript applications

## Prompt Caching (Anthropic)

### Overview

Prompt caching enables caching frequently used context between API calls, reducing costs by up to 90% and latency by up to 85% for long prompts. **This is THE solution for reducing token usage when sending many tools to the LLM.**

### Supported Models (2025)

Available for: Claude Opus 4.1, Claude Opus 4, Claude Sonnet 4.5, Claude Sonnet 4, Claude Sonnet 3.7, Claude Sonnet 3.5, Claude Haiku 3.5, Claude Haiku 3, and Claude Opus 3.

### Key Benefits

- **90% cost reduction** on cached content
- **85% latency reduction** for long prompts
- Pay only 25% premium on first cache write
- Pay only 10% of input tokens on cache hits
- Perfect for tool-heavy agents (e.g., 19 tools = ~25k tokens cached!)

### Cache Duration Options

1. **Standard**: 5-minute TTL (free)
2. **Extended**: 1-hour TTL (additional cost, 12x improvement)

### Supported Anthropic Models

Prompt caching requires minimum token counts:
- **1024 tokens minimum** for most models
- **2048 tokens minimum** for some models
- Shorter prompts cannot be cached even if marked

### Tool Caching Implementation

**Critical Understanding:** Anthropic's caching works on a **"cache point" system**. When you mark something as cacheable, **everything before it in the request gets cached too**.

**Cache Order Hierarchy:**
1. Tools (cached first)
2. System messages (cached second)
3. Messages (cached third)

**Best Practice:** Mark only the LAST tool with cacheControl to cache all tools + system prompt.

```typescript
import { tool } from 'ai';

// Define tools - only mark the LAST one for caching
const tools = {
  tool1: tool({
    description: "First tool",
    inputSchema: z.object({ /* ... */ }),
    execute: async (params) => { /* ... */ }
  }),

  tool2: tool({
    description: "Second tool",
    inputSchema: z.object({ /* ... */ }),
    execute: async (params) => { /* ... */ }
  }),

  // ONLY cache the last tool - this caches ALL tools + system
  tool3: tool({
    description: "Third tool",
    inputSchema: z.object({ /* ... */ }),
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' }
        // Optional: ttl: '1h' for extended caching
      }
    },
    execute: async (params) => { /* ... */ }
  })
};

const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  system: 'Your system prompt...',
  messages: [{ role: 'user', content: 'Query...' }],
  tools: tools
});
```

### System Message Caching

You can also cache system messages directly:

```typescript
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [
    {
      role: 'system',
      content: 'Long system prompt with lots of context...',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    },
    {
      role: 'user',
      content: 'User query...'
    }
  ]
});
```

### Accessing Cache Metadata

```typescript
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  // ... other options
});

// Check cache usage
const cacheMetadata = result.providerMetadata?.anthropic;
console.log('Cache creation tokens:', cacheMetadata?.cacheCreationInputTokens);
console.log('Cache read tokens:', cacheMetadata?.cacheReadInputTokens);
```

### For Streaming (streamText)

```typescript
const result = await streamText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  // ... other options
  onFinish: (event) => {
    const cacheMetadata = event.providerMetadata?.anthropic;
    console.log('Cache metadata:', cacheMetadata);
  }
});
```

### Token-Efficient Tool Use (2025)

Claude 3.7 Sonnet supports token-efficient tool calling, reducing output tokens by up to 70%:

```typescript
const result = await generateText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  experimental_providerMetadata: {
    anthropic: {
      beta: ['token-efficient-tools-2025-02-19']
    }
  },
  // ... rest of config
});
```

### Real-World Example: Jeeves with 19 Tools

**Problem:** 19 stream analysis tools = ~25,000-28,000 tokens per request
**Solution:** Cache all tools by marking the last one

```typescript
import { streamAnalysisTools } from '@/lib/ai/tools/stream-analysis';

// Get all tool entries
const toolEntries = Object.entries(streamAnalysisTools);

// Mark the LAST tool for caching
const cachedTools = Object.fromEntries(
  toolEntries.map(([name, toolDef], index) => {
    if (index === toolEntries.length - 1) {
      // Last tool - add caching
      return [name, {
        ...toolDef,
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
            ttl: '1h' // Extended cache for long-running agents
          }
        }
      }];
    }
    return [name, toolDef];
  })
);

const result = await generateText({
  model: anthropic('claude-sonnet-4-5-20250514'),
  system: JEEVES_DISCOVERY_PROMPT,
  messages: [{ role: 'user', content: contextMessage }],
  tools: cachedTools,
  temperature: 0.8,
  stopWhen: stepCountIs(10)
});
```

**Result:**
- First call: Pay 25% premium on 25k tokens = ~6,250 tokens charged
- Subsequent calls (within 1 hour): Pay 10% on cache hit = ~2,500 tokens
- **Savings: 90% reduction on repeated calls!**

### Important Gotchas

1. **Minimum token requirement**: Content must be ≥1024 tokens to cache
2. **Cache point system**: Marking one item caches everything before it
3. **Order matters**: Tools → System → Messages (cache hierarchy)
4. **generateObject limitation**: Dynamic schemas break caching
5. **Tool position**: Put cached tool LAST in the tools object

### Best Practices

1. **Use for tool-heavy agents** - Perfect for 5+ tools
2. **Cache long system prompts** - Save tokens on repeated context
3. **Use 1-hour TTL for agents** - Reduces costs for long-running workflows
4. **Monitor cache metrics** - Check providerMetadata to verify caching
5. **Combine with token-efficient tools** - Stack both optimizations

## Long-Running AI Agents & Serverless Timeouts

### The Challenge

Traditional serverless functions have short timeouts (10-60 seconds), but AI agents with tool calling can take minutes to complete, especially when:
- Making multiple LLM calls (tool calling loops)
- Processing large datasets
- Waiting for rate limits
- Analyzing complex patterns

### Solution 1: Vercel Fluid Compute (Recommended)

**What It Is:**
- Hybrid serverless model combining serverless scalability with server flexibility
- Handles multiple invocations in a single function instance (optimized concurrency)
- Extends timeout limits significantly
- Reduces cold starts and improves resource efficiency

**Timeout Limits:**

| Plan | Standard CPU | Performance CPU |
|------|--------------|-----------------|
| Hobby | 300s (5 min) | N/A |
| Pro | 300s (5 min) | 800s (13.3 min) |
| Enterprise | 300s (5 min) | 800s (13.3 min) |

**Enabling Fluid Compute:**

1. **Via Dashboard:**
   - Go to Project Settings → Functions
   - Toggle "Fluid Compute"
   - Redeploy project

2. **Via vercel.json:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "fluid": true,
  "functions": {
    "app/api/jeeves/analyze/route.ts": {
      "maxDuration": 300
    }
  }
}
```

3. **Via Route Config:**
```typescript
// app/api/jeeves/analyze/route.ts
export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs'; // Fluid Compute supports Node.js & Python
```

**Cost Savings:**
- Active CPU pricing: Pay only when code is actively computing
- Up to 90% savings for AI workloads with idle time (waiting for LLM responses)
- Perfect for multi-step agents with tool calling

### Solution 2: Background Processing with `waitUntil`

For tasks that don't need immediate response:

```typescript
import { waitUntil } from '@vercel/functions';

export async function POST(request: Request) {
  // Return immediate response
  const response = { status: 'Analysis started' };

  // Continue processing in background (survives beyond response)
  waitUntil(
    (async () => {
      const discoveries = await runJeevesAnalysis();
      await saveDiscoveriesToDatabase(discoveries);
      await sendNotifications(discoveries);
    })()
  );

  return Response.json(response);
}
```

**Key Features:**
- Function continues after response sent
- Max duration still applies (300s or 800s with Fluid)
- No additional timeout errors for user
- Perfect for: notifications, logging, cleanup tasks

### Solution 3: Multi-Step Continuation Pattern

Break long agent workflows into multiple requests:

```typescript
// Step 1: Initial analysis
const step1 = await generateText({
  model: anthropic('claude-sonnet-4-5'),
  system: 'Analyze these streams...',
  messages: [{ role: 'user', content: context }],
  tools: essentialTools,
  stopWhen: stepCountIs(3), // Limit steps per request
});

// Step 2: Continue from previous output
const step2 = await generateText({
  model: anthropic('claude-sonnet-4-5'),
  system: 'Continue analysis...',
  messages: [
    { role: 'user', content: context },
    { role: 'assistant', content: step1.text },
    { role: 'user', content: 'Continue with deeper analysis...' }
  ],
  tools: essentialTools,
  stopWhen: stepCountIs(3),
});

// Combine results
const finalResult = {
  discoveries: [
    ...parseDiscoveries(step1.text),
    ...parseDiscoveries(step2.text)
  ]
};
```

**Benefits:**
- Each request stays under timeout
- Can run on multiple serverless instances
- Progressive results
- Cache benefits compound across steps

### Solution 4: External Job Queue (For Very Long Tasks)

For tasks exceeding even Fluid Compute limits (>13 minutes):

**Option A: Inngest (Recommended)**
```typescript
import { inngest } from './inngest/client';

export const jeevesAnalysis = inngest.createFunction(
  { id: 'jeeves-discovery-analysis' },
  { event: 'jeeves/analyze' },
  async ({ event, step }) => {
    // Each step runs independently, no timeout cascade
    const streams = await step.run('fetch-streams', async () => {
      return await listAvailableStreams();
    });

    const stats = await step.run('analyze-statistics', async () => {
      return await analyzeMultipleStreams(streams);
    });

    const correlations = await step.run('find-correlations', async () => {
      return await correlateTwoStreams(streams[0], streams[1]);
    });

    const discoveries = await step.run('generate-insights', async () => {
      return await generateDiscoveries(stats, correlations);
    });

    return discoveries;
  }
);
```

**Option B: Upstash QStash**
- Queue-based background jobs
- Automatic retries
- Serverless-friendly

**Option C: Trigger.dev**
- Long-running tasks up to hours
- Built-in observability
- Elastic scaling

### Recommendations by Use Case

| Use Case | Recommended Solution | Reasoning |
|----------|---------------------|-----------|
| Jeeves 5-min analysis | Fluid Compute (300s) | Fits within limits, best cost/performance |
| Jeeves with rate limit waits | Multi-step continuation | Handles >5min gracefully |
| Very complex analysis (>13 min) | Inngest/QStash | Breaks serverless limits |
| Fire-and-forget tasks | `waitUntil()` | No user-facing timeout |
| Scheduled background jobs | Inngest + Cron | Professional queue management |

### Best Practices

1. **Always set maxDuration:**
```typescript
export const maxDuration = 300; // Be explicit
```

2. **Monitor execution time:**
```typescript
const startTime = Date.now();
// ... work ...
console.log('Execution time:', Date.now() - startTime);
```

3. **Use cache to reduce time:**
- Cached tools reduce LLM response time by 85%
- Less time = less timeout risk

4. **Handle timeouts gracefully:**
```typescript
try {
  const result = await runAnalysis();
} catch (error) {
  if (error.message.includes('timeout')) {
    // Save partial results
    // Schedule continuation
    // Notify user
  }
}
```

5. **Progressive disclosure:**
- Return early results while continuing
- Stream updates if possible
- Use `waitUntil` for non-critical tasks

## Resources

- [AI SDK 5 Blog Post](https://vercel.com/blog/ai-sdk-5)
- [AI SDK Documentation](https://ai-sdk.dev/docs/introduction)
- [AI SDK Caching Documentation](https://ai-sdk.dev/docs/advanced/caching)
- [Anthropic Provider Documentation](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Anthropic Prompt Caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)
- [Tool Caching Blog Post](https://www.braingrid.ai/blog/anthropic-tool-caching-ai-sdk-v5)
- [Tool Calling Documentation](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Migration Guide 5.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0)
- [GitHub Repository](https://github.com/vercel/ai)
- [Token-Saving Updates (2025)](https://www.anthropic.com/news/token-saving-updates)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Vercel Fluid Compute Blog](https://vercel.com/blog/fluid-compute-evolving-serverless-for-ai-workloads)
- [Vercel AI Agents Guide](https://vercel.com/guides/ai-agents)
- [Inngest Documentation](https://www.inngest.com/)
- [Inngest + Vercel Guide](https://www.inngest.com/blog/vercel-long-running-background-functions)
