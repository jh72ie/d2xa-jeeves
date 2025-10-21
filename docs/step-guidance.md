# AI SDK Step Configuration Guidance

## Recommended Step Limits for Stream Analysis

### Quick Analysis Scenarios
```typescript
// Quick health check (4 tools + synthesis)
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Check system health',
  tools: { /* stream analysis tools */ },
  stopWhen: stepCountIs(8)
});
```

### Standard Analysis Scenarios
```typescript
// Anomaly investigation (6-8 tools + follow-up)
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Investigate anomalies in temperature data',
  tools: { /* stream analysis tools */ },
  stopWhen: stepCountIs(12)
});

// Performance analysis (5-7 tools + patterns)
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Analyze performance trends',
  tools: { /* stream analysis tools */ },
  stopWhen: stepCountIs(10)
});
```

### Complex Analysis Scenarios
```typescript
// Multi-stream correlation (8-12 tools + relationships)
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Analyze relationships between all streams',
  tools: { /* stream analysis tools */ },
  stopWhen: stepCountIs(15)
});

// Root cause analysis (12-15 tools + deep investigation)
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Find root cause of system issues',
  tools: { /* stream analysis tools */ },
  stopWhen: stepCountIs(20)
});
```

### Alternative: While Loop Approach
```typescript
const maxSteps = 15;  // Adjust based on analysis complexity
let step = 0;

while (step < maxSteps) {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    tools: { /* your stream analysis tools */ },
  });

  messages.push(...result.response.messages);
  if (result.text) break; // Stop when model generates final text
  step++;
}
```

## Step Count Recommendations by Scenario

| Analysis Type | Recommended Steps | Typical Tool Count | Buffer |
|---------------|------------------|-------------------|---------|
| Quick Health Check | 8 | 4-5 tools | 3-4 steps |
| Data Exploration | 12 | 6-8 tools | 4-6 steps |
| Anomaly Investigation | 12 | 7-9 tools | 3-5 steps |
| Performance Analysis | 10 | 5-7 tools | 3-5 steps |
| System Correlation | 15 | 8-12 tools | 3-7 steps |
| Root Cause Analysis | 20 | 12-15 tools | 5-8 steps |

## Why These Limits?

### Typical Analysis Flow:
1. **Discovery** (1-2 steps): `listAvailableStreamsTool`, `getStreamInfoTool`
2. **Data Retrieval** (1-3 steps): `getStreamRecentDataTool`, `getMultipleStreamsTool`
3. **Core Analysis** (3-8 steps): Statistics, trends, anomalies, patterns
4. **Advanced Analysis** (2-5 steps): Correlations, causality, quality assessment
5. **Synthesis & Follow-up** (2-4 steps): Additional investigation based on findings

### Buffer Calculation:
- **30% buffer** added to account for:
  - Follow-up questions based on initial findings
  - Error recovery and retries
  - Deeper investigation of interesting patterns
  - Multiple hypothesis testing

## Usage with Tool Discovery

The `discoverToolsTool` now provides step guidance:

```typescript
const discovery = await discoverToolsTool.execute({
  analysisGoal: 'anomaly-investigation',
  availableDataPoints: 500,
  numberOfStreams: 2
});

// Use the recommended step limit
const stepLimit = discovery.stepGuidance.recommendedStepLimit; // 12

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Investigate anomalies',
  tools: { /* tools */ },
  stopWhen: stepCountIs(stepLimit)
});
```

## Best Practices

1. **Start Conservative**: Begin with recommended limits, increase if needed
2. **Monitor Usage**: Track actual steps used vs. limit
3. **Adjust by Complexity**: Complex multi-stream analysis needs more steps
4. **Consider Data Size**: Larger datasets may require more investigation steps
5. **Account for Errors**: Add buffer for tool failures and retries

This ensures the LLM has sufficient steps to complete thorough analysis without hitting artificial limits.