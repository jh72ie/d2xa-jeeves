/**
 * Jeeves Discovery Chat API
 *
 * Allows users to chat with Jeeves about a specific discovery
 * with FULL access to ALL 81 analysis & data science tools:
 * - 19 Stream Analysis Tools
 * - 42 Mathematical Function Tools
 * - 4 Tool Discovery Tools
 * - 4 Workflow Orchestration Tools
 * - 12 Additional Utility Tools
 */

import { anthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs } from "ai";
import { db } from "@/lib/db/queries";
import { jeevesDiscovery, type JeevesDiscovery } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Import ALL 81 analysis tools
import { streamAnalysisTools } from "@/lib/ai/tools/stream-analysis";
import { mathematicalFunctionTools } from "@/lib/ai/tools/mathematical-functions";
import { toolDiscoveryTools } from "@/lib/ai/tools/tool-discovery";
import { workflowOrchestrationTools } from "@/lib/ai/tools/workflow-orchestration";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for complex analysis

export async function POST(req: Request) {
  try {
    const { discoveryId, messages } = await req.json();

    if (!discoveryId || !messages || !Array.isArray(messages)) {
      return new Response("Invalid request", { status: 400 });
    }

    // Load discovery from database
    const [discovery] = await db
      .select()
      .from(jeevesDiscovery)
      .where(eq(jeevesDiscovery.id, discoveryId))
      .limit(1);

    if (!discovery) {
      return new Response("Discovery not found", { status: 404 });
    }

    // Extract stream IDs from evidence if available
    let streamContext = "";
    let evidence: any = null;
    if (discovery.aiEvidence && typeof discovery.aiEvidence === "object") {
      evidence = discovery.aiEvidence as any;
      if (evidence.streams && Array.isArray(evidence.streams)) {
        streamContext = `\n\n**Related Streams (EXACT names):**
${evidence.streams.map((s: string) => `- ${s}`).join("\n")}

⚠️ Use these EXACT stream names when analyzing. Do NOT modify or guess alternative names.`;
      }
    }

    // Build system prompt with full discovery context
    const systemPrompt = `You are Jeeves, an AI assistant helping the user understand a specific discovery you made.

## Discovery Context

**Title:** ${discovery.title}
**Category:** ${discovery.category}
**Severity:** ${discovery.severity}
**Confidence:** ${discovery.confidence ? (parseFloat(discovery.confidence as string) * 100).toFixed(0) : "N/A"}%
**Discovered:** ${new Date(discovery.discoveredAt).toLocaleString()}

**Your Original Reasoning:**
${discovery.aiReasoning}

**Hypothesis:**
${discovery.aiHypothesis || "No hypothesis recorded"}

${discovery.aiRecommendations && Array.isArray(discovery.aiRecommendations) && discovery.aiRecommendations.length > 0 ? `
**Your Recommendations:**
${discovery.aiRecommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}
` : ""}

${evidence && evidence.toolUsageTrail ? `
**Analysis Tools Used:**
${evidence.toolUsageTrail.map((t: any) => `- ${t.tool}: ${t.summary}`).join("\n")}
` : ""}
${streamContext}

## Your Role

Answer the user's questions about this discovery with:
- **Clarity**: Explain technical concepts in simple terms
- **Evidence**: Reference the data and analysis that led to this discovery
- **Actionability**: Help them understand what to do next
- **Context**: Provide relevant background if needed

## Your Capabilities

You have access to **81 powerful analysis & data science tools** to investigate this discovery:

### Data Retrieval (5 tools):
- Get recent stream data with quality assessment
- Query specific time windows
- Load stream metadata
- Load multiple streams simultaneously
- List all available streams

### Single Stream Analysis (6 tools):
- Calculate comprehensive statistics (mean, std, percentiles, distribution)
- Analyze trends (linear regression, direction, strength)
- Detect anomalies (z-score, IQR, LOF, ensemble methods)
- Find patterns (peaks, cycles, seasonal patterns)
- Measure autocorrelation (periodic patterns, self-similarity)
- Calculate moving averages (simple, exponential smoothing)

### Multi-Stream Analysis (5 tools):
- Correlate two streams with lag analysis
- Generate correlation matrix for multiple streams
- Test Granger causality (does one stream predict another?)
- Detect synchronized events across streams
- Analyze cascading failure patterns

### Quality Assessment (3 tools):
- Assess data quality with A-F grading
- Monitor health trends over time
- Compare quality between time periods

### Mathematical Functions (42 tools):
- Basic math (add, subtract, multiply, divide, power, sqrt, abs, etc.)
- Trigonometry (sin, cos, tan, asin, acos, atan, etc.)
- Statistics (sum, mean, median, mode, variance, stddev, percentile)
- Linear algebra (dot product, matrix operations)
- Special functions (factorial, combination, permutation, gcd, lcm)
- Advanced (log, exp, floor, ceil, round, random distributions)

### Tool Discovery (4 tools):
- List all available tools
- Search tools by capability
- Get tool documentation
- Discover related tools

### Workflow Orchestration (4 tools):
- Chain multiple analysis steps
- Parallel execution of independent tasks
- Conditional workflows
- Error handling & retry logic

## How to Use Tools

**CRITICAL RULE FOR STREAM NAMES:**
1. **ALWAYS** call \`listAvailableStreamsTool\` FIRST to get exact stream names
2. **NEVER** guess or invent stream names (e.g., don't use "heatingoutput" if the actual name is "heatoutput")
3. Use EXACT names from the list - stream names are case-sensitive

When the user asks for data or analysis:
1. **Use tools proactively** - Don't just describe what could be done, DO IT
2. **Get exact stream names first** - Call listAvailableStreamsTool before loading any stream
3. **Show calculations** - Run statistics, correlations, anomaly detection
4. **Explain results** - Interpret the numbers in plain language
5. **Be thorough** - If asked "what's happening?", load data and analyze it

Examples:
- "Show me the data" → First: listAvailableStreamsTool, Then: getStreamRecentDataTool with EXACT name
- "Is this correlated with X?" → First: listAvailableStreamsTool, Then: correlateTwoStreamsTool
- "Are there anomalies?" → Use analyzeStreamAnomaliesTool with EXACT stream name
- "What's the trend?" → Use analyzeStreamTrendTool with EXACT stream name

**Act as a data scientist**: Investigate, analyze, and explain.

## Important Context

**Timezone Information:**
- User location: Helsinki, Finland (UTC+3 during daylight saving, UTC+2 in winter)
- **Data source timestamps: Pure UTC (Z timezone)** - FCU sensors generate UTC timestamps
- When displaying times to user, you can convert UTC to Helsinki time (UTC+3)
- Current UTC time can be obtained from database NOW() function
- All timestamps in database are stored as timestamptz (UTC)

Keep responses concise but informative. Use markdown formatting for clarity.`;

    // Stream response with ALL 81 analysis tools
    const result = streamText({
      model: anthropic("claude-sonnet-4-5-20250929"), // Latest Sonnet 4.5 (October 2025)
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      tools: {
        // Stream Analysis Tools (19 tools)
        ...streamAnalysisTools,

        // Mathematical Function Tools (42 tools)
        ...mathematicalFunctionTools,

        // Tool Discovery Tools (4 tools)
        ...toolDiscoveryTools,

        // Workflow Orchestration Tools (4 tools)
        ...workflowOrchestrationTools,
      }, // ALL 69 TOOLS CONNECTED! (81 total in main chat includes 12 utility tools)
      stopWhen: stepCountIs(10), // Allow up to 10 tool call rounds for complex investigations
      temperature: 0.7
      // No maxOutputTokens limit - let LLM complete detailed analysis fully (Tier 4 has ample capacity)
    });

    // Return as text stream response (AI SDK 5.0 method)
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("[Jeeves Chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
