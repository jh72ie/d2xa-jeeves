# Jeeves Discovery Engine - Detailed Logging

## Overview

The Discovery Engine now provides **comprehensive step-by-step logging** of the LLM execution process using AI SDK 5's `onStepFinish` callback. This gives complete visibility into:
- Every tool call made by the LLM
- Tool execution results
- Token usage per step
- Total execution time
- Cache hit rates

---

## Log Output Format

### Step Logging (During Execution)

```
[Discovery Engine] >>> Sending request to LLM...
[Discovery Engine] Max steps: 15, Temperature: 0.8

[Discovery Engine] ┌─ Step 1 Complete ─────────────────────────
[Discovery Engine] │ Type: initial
[Discovery Engine] │ Finish Reason: tool-calls
[Discovery Engine] │ Token Usage: input=28543, output=156, total=28699
[Discovery Engine] │ Tool Calls: 2
[Discovery Engine] │   1. listAvailableStreamsTool({"_unused":false}...)
[Discovery Engine] │   2. getStreamRecentDataTool({"streamId":"stream-001","limit":100}...)
[Discovery Engine] │ Tool Results: None
[Discovery Engine] └────────────────────────────────────────────────

[Discovery Engine] ┌─ Step 2 Complete ─────────────────────────
[Discovery Engine] │ Type: tool-result
[Discovery Engine] │ Finish Reason: tool-calls
[Discovery Engine] │ Token Usage: input=3542, output=203, total=3745
[Discovery Engine] │ Tool Calls: 1
[Discovery Engine] │   1. analyzeStreamAnomaliesTool({"streamId":"stream-001"}...)
[Discovery Engine] │ Tool Results: 2
[Discovery Engine] │   1. listAvailableStreamsTool: {"count":3,"streams":[{"id":"stream-001","name":"Temperature",...
[Discovery Engine] │   2. getStreamRecentDataTool: {"streamId":"stream-001","dataPoints":100,"values":[23.5,23.7,...
[Discovery Engine] └────────────────────────────────────────────────

[Discovery Engine] ┌─ Step 3 Complete ─────────────────────────
[Discovery Engine] │ Type: tool-result
[Discovery Engine] │ Finish Reason: stop
[Discovery Engine] │ Token Usage: input=4123, output=487, total=4610
[Discovery Engine] │ Tool Calls: None
[Discovery Engine] │ Tool Results: 1
[Discovery Engine] │   1. analyzeStreamAnomaliesTool: {"anomalies":[{"timestamp":"2025-10-03T14:23:00Z","value":...
[Discovery Engine] │ Text Output: "Based on my analysis, I discovered an interesting pattern: Temperature shows a harmonic..."
[Discovery Engine] └────────────────────────────────────────────────

[Discovery Engine] ═══════════════════════════════════════════════
[Discovery Engine] CACHE STATISTICS:
[Discovery Engine] Cache Creation Tokens: 26543
[Discovery Engine] Cache Read Tokens: 0
[Discovery Engine] Regular Input Tokens: 1200
[Discovery Engine] Cache Hit Rate: 0% (cache miss - first run)
[Discovery Engine] ═══════════════════════════════════════════════

[Discovery Engine] <<< Received response from LLM
[Discovery Engine] Total Steps: 3
[Discovery Engine] Total Execution Time: 87.34s
```

---

## What Each Field Means

### Step Information

**`Type`**: Step classification
- `initial` - First step of the conversation
- `tool-result` - Continuation after tool execution
- `continue` - Continuation without tools (e.g., thinking, text generation)

**`Finish Reason`**: Why the step ended
- `tool-calls` - LLM wants to call tools (more steps coming)
- `stop` - LLM finished (final step)
- `length` - Hit max token limit
- `content-filter` - Content policy violation
- `error` - Error occurred

**`Token Usage`**: Tokens consumed in this step
- `input` - Input tokens (prompt + context)
- `output` - Output tokens (LLM's response)
- `total` - Sum of input + output

### Tool Calls

Shows which tools the LLM requested to execute:
```
[Discovery Engine] │ Tool Calls: 2
[Discovery Engine] │   1. listAvailableStreamsTool({"_unused":false}...)
[Discovery Engine] │   2. getStreamRecentDataTool({"streamId":"stream-001","limit":100}...)
```

**Format**: `toolName(arguments...)`
- Arguments are shown up to 100 characters
- Helps track what the LLM is trying to do

### Tool Results

Shows the results from executed tools:
```
[Discovery Engine] │ Tool Results: 2
[Discovery Engine] │   1. listAvailableStreamsTool: {"count":3,"streams":[...
[Discovery Engine] │   2. getStreamRecentDataTool: {"streamId":"stream-001",...
```

**Format**: `toolName: resultPreview...`
- Results are shown up to 100 characters
- Helps verify tools are returning expected data

### Text Output

Shows any text the LLM generated (not tool calls):
```
[Discovery Engine] │ Text Output: "Based on my analysis, I discovered an interesting pattern..."
```

**When it appears**:
- Final step (when LLM finishes thinking)
- Intermediate reasoning steps
- Error messages or explanations

---

## Cache Statistics

Shown after all steps complete:

```
[Discovery Engine] ═══════════════════════════════════════════════
[Discovery Engine] CACHE STATISTICS:
[Discovery Engine] Cache Creation Tokens: 26543
[Discovery Engine] Cache Read Tokens: 0
[Discovery Engine] Regular Input Tokens: 1200
[Discovery Engine] Cache Hit Rate: 0% (cache miss - first run)
[Discovery Engine] ═══════════════════════════════════════════════
```

**Fields**:
- **Cache Creation Tokens**: Tokens written to cache (first run only)
- **Cache Read Tokens**: Tokens read from cache (subsequent runs)
- **Regular Input Tokens**: Non-cached tokens
- **Cache Hit Rate**: Percentage of tokens served from cache

**Typical Pattern**:
- **First Run**: 0% cache hit (all tokens written to cache)
- **Subsequent Runs**: 90%+ cache hit (tool definitions + system prompt cached)

**Token Savings**:
```
First run:  26,543 cached + 1,200 regular = 27,743 total
Second run:       0 cached + 1,200 regular + 26,543 cache read = 1,200 billable (90% savings!)
```

---

## Example Execution Flow

### Scenario: Discovery with 3 Tools

**Step 1 (Initial)**:
- LLM receives task: "Analyze monitored streams"
- Decides to list available streams first
- Calls: `listAvailableStreamsTool()`
- Finish Reason: `tool-calls` (waiting for result)

**Step 2 (Tool Result)**:
- Receives tool result: `{"count": 3, "streams": [...]}`
- Decides to get data for stream-001
- Calls: `getStreamRecentDataTool(streamId: "stream-001")`
- Finish Reason: `tool-calls` (waiting for result)

**Step 3 (Tool Result)**:
- Receives data: `{"dataPoints": 100, "values": [...]}`
- Decides to analyze for anomalies
- Calls: `analyzeStreamAnomaliesTool(streamId: "stream-001")`
- Finish Reason: `tool-calls` (waiting for result)

**Step 4 (Final)**:
- Receives anomaly results
- Generates discovery report
- Outputs text with findings
- Finish Reason: `stop` (done!)

---

## Debugging Common Issues

### Issue: No Tool Calls in Step 1

```
[Discovery Engine] ┌─ Step 1 Complete ─────────────────────────
[Discovery Engine] │ Tool Calls: None
[Discovery Engine] │ Text Output: "I don't have access to stream data"
```

**Problem**: LLM doesn't understand it has tools
**Solution**: Check system prompt includes tool descriptions

### Issue: Repeated Tool Calls

```
[Discovery Engine] ┌─ Step 5 Complete ─────────────────────────
[Discovery Engine] │ Tool Calls: 1
[Discovery Engine] │   1. getStreamRecentDataTool({"streamId":"stream-001"}...)

[Discovery Engine] ┌─ Step 6 Complete ─────────────────────────
[Discovery Engine] │ Tool Calls: 1
[Discovery Engine] │   1. getStreamRecentDataTool({"streamId":"stream-001"}...)
```

**Problem**: LLM is stuck in a loop
**Solution**:
- Check tool results are returning valid data
- Verify tool result format matches expected schema
- May need to adjust system prompt to be more directive

### Issue: High Token Usage

```
[Discovery Engine] │ Token Usage: input=45000, output=2000, total=47000
```

**Problem**: Exceeding expected token budget
**Solution**:
- Check if caching is working (should be ~3k input on subsequent runs)
- Reduce context message length
- Limit number of recent discoveries shown

### Issue: Cache Miss on Second Run

```
[Discovery Engine] Cache Hit Rate: 0% (cache miss - first run)
[Discovery Engine] Cache Hit Rate: 0% (cache miss - first run)  // Second run!
```

**Problem**: Cache not persisting between runs
**Solution**:
- Verify cache TTL is set (currently 1 hour)
- Check Anthropic API key has caching enabled
- Ensure exact same system prompt and tools used

---

## Performance Metrics

### Typical Execution Times

**Simple Discovery (2-3 tool calls)**:
- 30-60 seconds
- 2-3 steps
- 5,000-10,000 total tokens

**Complex Discovery (5-8 tool calls)**:
- 90-150 seconds
- 5-8 steps
- 15,000-25,000 total tokens

**Maximum (15 steps)**:
- 180-240 seconds
- 15 steps (hits stopWhen limit)
- 35,000-50,000 total tokens

### Token Breakdown

**First Run (Cache Write)**:
```
Step 1: 26,543 input (tools + system prompt) + 1,200 regular + 156 output = 27,899 total
Step 2:  3,542 input + 203 output = 3,745 total
Step 3:  4,123 input + 487 output = 4,610 total
Total: ~36,000 tokens
```

**Second Run (Cache Hit)**:
```
Step 1: 0 cached + 26,543 cache read + 1,200 regular + 156 output = ~1,400 billable
Step 2: 3,542 input + 203 output = 3,745 total
Step 3: 4,123 input + 487 output = 4,610 total
Total: ~10,000 tokens (73% savings!)
```

---

## Implementation Details

### Code Location

**File**: `lib/jeeves/discovery-engine.ts:385-422`

### onStepFinish Callback

```typescript
onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage, stepType }) => {
  currentStep++;
  console.log(`\n[Discovery Engine] ┌─ Step ${currentStep} Complete ─────────────────────────`);
  console.log(`[Discovery Engine] │ Type: ${stepType}`);
  console.log(`[Discovery Engine] │ Finish Reason: ${finishReason}`);
  console.log(`[Discovery Engine] │ Token Usage: input=${usage.promptTokens}, output=${usage.completionTokens}, total=${usage.totalTokens}`);

  // Log tool calls
  if (toolCalls && toolCalls.length > 0) {
    console.log(`[Discovery Engine] │ Tool Calls: ${toolCalls.length}`);
    toolCalls.forEach((call, idx) => {
      console.log(`[Discovery Engine] │   ${idx + 1}. ${call.toolName}(${JSON.stringify(call.args).substring(0, 100)}...)`);
    });
  } else {
    console.log(`[Discovery Engine] │ Tool Calls: None`);
  }

  // Log tool results
  if (toolResults && toolResults.length > 0) {
    console.log(`[Discovery Engine] │ Tool Results: ${toolResults.length}`);
    toolResults.forEach((result, idx) => {
      const resultPreview = typeof result.result === 'string'
        ? result.result.substring(0, 100)
        : JSON.stringify(result.result).substring(0, 100);
      console.log(`[Discovery Engine] │   ${idx + 1}. ${result.toolName}: ${resultPreview}...`);
    });
  } else {
    console.log(`[Discovery Engine] │ Tool Results: None`);
  }

  // Log text output (if any)
  if (text && text.trim().length > 0) {
    const textPreview = text.substring(0, 150).replace(/\n/g, ' ');
    console.log(`[Discovery Engine] │ Text Output: "${textPreview}${text.length > 150 ? '...' : ''}"`);
  }

  console.log(`[Discovery Engine] └────────────────────────────────────────────────\n`);
}
```

### Key Features

✅ **Step Counter**: Tracks current step number across all executions
✅ **Tool Call Details**: Shows exact tool names and arguments
✅ **Tool Result Preview**: Shows first 100 chars of results
✅ **Token Tracking**: Per-step token usage breakdown
✅ **Box Drawing**: Unicode box characters for clear visual separation
✅ **Text Truncation**: Long outputs truncated to prevent log spam

---

## Configuration

### Adjust Logging Verbosity

**Show Full Tool Arguments** (instead of 100 char limit):
```typescript
console.log(`[Discovery Engine] │   ${idx + 1}. ${call.toolName}(${JSON.stringify(call.args)})`);
```

**Show Full Tool Results**:
```typescript
console.log(`[Discovery Engine] │   ${idx + 1}. ${result.toolName}: ${JSON.stringify(result.result, null, 2)}`);
```

**Disable Step Logging** (only show summary):
```typescript
// Comment out or remove the onStepFinish callback
```

---

## Summary

✅ **Visibility**: See exactly what the LLM is doing at each step
✅ **Debugging**: Quickly identify stuck loops or failed tool calls
✅ **Performance**: Track token usage and execution time per step
✅ **Caching**: Monitor cache effectiveness across runs
✅ **Production Ready**: Detailed logs help diagnose issues in production

The enhanced logging uses AI SDK 5's `onStepFinish` callback to provide complete transparency into the Discovery Engine's LLM execution flow.
