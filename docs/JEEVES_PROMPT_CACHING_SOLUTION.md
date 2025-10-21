# Jeeves Prompt Caching Solution

## Problem

Jeeves Discovery Engine was hitting rate limits with 19 stream analysis tools:

```
Rate limit error: 30,000 input tokens per minute exceeded
```

**Token Breakdown (Without Caching):**
- System prompt (Jeeves instructions): ~650 tokens
- User message (persona contexts): ~900 tokens
- **19 tool schemas: ~25,000-28,000 tokens** ← THE PROBLEM
- **Total: ~30,000 tokens per request**

This meant Jeeves could only make **1 analysis per minute** on Tier 1.

## Why Tool Schemas Are So Large

Each AI SDK tool definition is converted to JSON Schema and includes:
- Tool name and description
- Full Zod schema → JSON Schema conversion
- Parameter descriptions and types
- Nested object structures
- Enums, optional fields, defaults, constraints

Example: A single tool with 5 parameters can be 1,000-1,500 tokens!

## Solution: Anthropic Prompt Caching

### What It Does

Prompt caching caches the tool definitions (and system prompt) on Anthropic's servers for reuse across multiple requests.

**Key Benefits:**
- ✅ **90% cost reduction** on cached content
- ✅ **85% latency reduction** for long prompts
- ✅ First call: Pay 25% premium on cache write
- ✅ Subsequent calls: Pay only 10% on cache hits
- ✅ Cache duration: 5 minutes (standard) or 1 hour (extended)

### How It Works

Anthropic uses a **"cache point" system**:
- When you mark something as cacheable, **everything before it gets cached too**
- Cache hierarchy: Tools → System → Messages
- **Best practice:** Mark only the LAST tool to cache all tools + system

### Implementation

```typescript
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
  tools: cachedTools, // ← Use cached tools
  temperature: 0.8,
  stopWhen: stepCountIs(10)
});

// Check cache usage
const cacheMetadata = result.providerMetadata?.anthropic;
console.log('Cache creation tokens:', cacheMetadata?.cacheCreationInputTokens);
console.log('Cache read tokens:', cacheMetadata?.cacheReadInputTokens);
```

## Results

### Before Caching
- **Every call:** 30,000 tokens
- **Rate limit:** 1 call per minute (Tier 1)
- **Cost:** High (full token count each time)

### After Caching

**First Call (Cache Write):**
- Input tokens: ~30,000
- Cache creation tokens: ~25,000 (tools + system)
- Charged tokens: ~30,000 + 25% premium = ~37,500 tokens
- **Cache is created for 1 hour**

**Subsequent Calls (Cache Hit):**
- Input tokens: ~30,000 total
- Cache hit tokens: ~25,000 (read from cache)
- New tokens: ~900 (just the user message)
- Charged tokens: ~900 + (25,000 × 10%) = ~3,400 tokens
- **90% reduction!**

### Jeeves Can Now:
- ✅ Make **~9 analyses per minute** instead of 1 (with Tier 1 limits)
- ✅ Save 90% on token costs for repeated analyses
- ✅ Run faster with 85% latency reduction
- ✅ Keep all 19 creative analysis tools available
- ✅ Scale better when on Tier 2

## Why This Is Better Than Reducing Tools

**Alternative (Bad) Solution:** Only provide 6 tools instead of 19
- ❌ Limits Jeeves creativity
- ❌ Reduces analysis capabilities
- ❌ Only saves ~15k tokens (~50% reduction)
- ❌ Doesn't help on subsequent calls

**Caching Solution:**
- ✅ Keeps all 19 tools for maximum creativity
- ✅ 90% reduction on repeated calls (vs 50% one-time)
- ✅ Cumulative savings over time
- ✅ Works even better on Tier 2

## Monitoring Cache Performance

Watch for these log messages:

```
[Discovery Engine] Enabling cache for last tool: compareStreamQualityPeriodsTool
[Discovery Engine] Cache stats: {
  cacheCreationTokens: 25123,  // First call
  cacheReadTokens: 0
}

[Discovery Engine] Cache stats: {
  cacheCreationTokens: 0,
  cacheReadTokens: 25123  // Subsequent calls - HIT!
}
```

## Important Notes

1. **Minimum 1024 tokens required** - Tool schemas are well above this
2. **Cache duration** - 1 hour means Jeeves benefits for all analyses in that window
3. **Works across different user messages** - Tools cached, messages vary
4. **Compatible with all features** - Works with temperature, stopWhen, etc.
5. **Tier 2 ready** - When you upgrade, caching makes it even more cost-effective

## Future Optimizations

When you move to Tier 2 (higher limits), you can also add:

```typescript
experimental_providerMetadata: {
  anthropic: {
    beta: ['token-efficient-tools-2025-02-19']
  }
}
```

This reduces **output tokens** by up to 70% (separate from input token caching).

**Combined savings:**
- Input tokens: 90% reduction (caching)
- Output tokens: 70% reduction (token-efficient tools)
- Total: Massive cost and speed improvements!

## References

See `docs/AI_SDK_5_REFERENCE.md` for complete documentation on:
- Prompt caching implementation
- Cache metadata access
- Tool-efficient tool use
- Best practices and gotchas
