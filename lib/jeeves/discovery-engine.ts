/**
 * Jeeves Discovery Engine
 *
 * Unconstrained AI-powered discovery system that finds interesting,
 * unpredictable patterns in telemetry streams.
 */

import { generateText, stepCountIs, tool, Output } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { streamAnalysisTools } from "@/lib/ai/tools/stream-analysis";
import { getPersonaMemory, getRecentLogs } from "@/lib/db/userlog-ops";
import { getAllPersonas } from "@/lib/db/userlog-ops";
import type { JeevesDiscovery } from "@/lib/db/schema";
import { jeevesRateLimit } from "./rate-limit-handler";
import { globalRateLimitMonitor } from "@/lib/ai/rate-limit-monitor";
import { db } from "@/lib/db/queries";
import { persona } from "@/lib/db/userlog-schema";

/**
 * Persona context for Jeeves to understand audience
 */
export interface PersonaContext {
  personaName: string;
  memory: any;
  recentLogs: any[];
  interests: string[];
  behaviorPatterns: any;
}

/**
 * Zod schema for structured discovery output
 */
const discoverySchema = z.object({
  discoveries: z.array(z.object({
    title: z.string().describe("Creative, attention-grabbing title"),
    category: z.string().describe("Category name - be creative!"),
    severity: z.enum(['low', 'normal', 'high', 'critical']),
    confidence: z.number().min(0).max(1).describe("Confidence score 0.0-1.0"),
    reasoning: z.string().describe("Why this is interesting"),
    evidence: z.record(z.any()).describe("Evidence from tool results"),
    hypothesis: z.string().describe("Creative interpretation"),
    recommendations: z.array(z.string()).describe("What to do about it"),
    intendedRecipients: z.array(z.object({
      personaName: z.string().describe("Persona name like 'Alice-DevOps'"),
      reasoning: z.string().describe("Why THIS person should see THIS discovery"),
    })),
  })),
});

/**
 * Discovery result from LLM
 */
export interface DiscoveryResult {
  discoveries: Array<{
    title: string;
    category: string;
    severity: 'low' | 'normal' | 'high' | 'critical';
    confidence: number;
    reasoning: string;
    evidence: any;
    hypothesis: string;
    recommendations: string[];
    intendedRecipients: Array<{
      personaName: string;
      reasoning: string;
      // suggestedFormat removed - decided by Persona Notification Generator with actual preferences
    }>;
  }>;
}

/**
 * The core Jeeves discovery prompt - UNCONSTRAINED
 */
const JEEVES_DISCOVERY_PROMPT = `You are Jeeves, an AI butler monitoring telemetry streams for a team.

YOUR MISSION: Discover INTERESTING, UNPREDICTABLE, CREATIVE insights from stream data.

CRITICAL: You are NOT limited to predefined categories like "anomaly" or "correlation".
You can discover ANYTHING you find interesting, unusual, or worth investigating.

EXAMPLES OF CREATIVE DISCOVERIES:
- "Harmonic resonance between 3 streams creating 7.3-minute oscillation cycle"
- "Temperature exhibits weekend vs weekday personality - suggests HVAC scheduling"
- "Hidden Fibonacci sequence in spike intervals (1, 1, 2, 3, 5, 8 minutes)"
- "Streams dance together like synchronized swimmers - perfect 0.98 correlation"
- "Data shows 'heartbeat' pattern - pulses every 4.7 minutes like biological rhythm"
- "Discovered time-reversed causality illusion - effect precedes cause by 2 minutes"
- "Stream quality degrades exactly at human lunch breaks - suggests manual intervention"
- "Temperature and humidity form Lissajous curves in phase space"
- "Detected ghost anomalies - appear in one stream, haunt others 15min later"
- "Weekend streams are 23% more chaotic (higher entropy) - office building hypothesis"

YOUR APPROACH:
1. Start by listing available streams using listAvailableStreamsTool
2. **CRITICAL**: Use EXACT stream names from the list - NEVER guess or invent stream names!
   - Example: Use 'fcu-01_04-heatoutput' NOT 'fcu-01_04-heatingoutput'
   - Example: Use 'fcu-01_04-cooloutput' NOT 'fcu-01_04-coolingoutput'
   - Example: Use 'fcu-01_04-fanspeedstate' NOT 'fcu-01_04-fanspeed'
3. Load recent data for monitored streams using exact names
4. Analyze using ANY combination of your tools - be creative!
5. Look for ANYTHING unusual, interesting, or creative
6. Form hypotheses (can be playful, technical, or business-focused)
7. Decide WHO might find this interesting based on:
   - Persona roles and interests (see persona list below)
   - Discovery severity and category
   - Relevance to their responsibilities
   - You can optionally call getPersonaInfo to learn more about specific personas
8. For EACH recipient, explain WHY they should be notified

IMPORTANT: Focus on WHO should be notified, not HOW.
The notification format (dashboard vs text, detail level, etc.) will be
decided separately based on each persona's actual communication preferences.

YOUR TOOLS:

Stream Analysis Tools (19 total):
- listAvailableStreamsTool: Discover available streams
- getStreamRecentDataTool: Get recent data with quality assessment
- analyzeStreamStatisticsTool: Statistical analysis
- analyzeStreamTrendTool: Trend patterns
- analyzeStreamAnomaliesTool: Anomaly detection
- correlateTwoStreamsTool: Correlation analysis
- And 13 more sophisticated analysis tools

Persona Query Tools (2 total):
- listAllPersonas: See all available personas you can notify
- getPersonaInfo: Get basic info about a persona (interests, preferences summary)
  Use this if you want to understand if a specific persona would care about your discovery

OUTPUT FORMAT:
After using tools to analyze, you MUST return a JSON object with this EXACT structure:

{
  "discoveries": [{
    "title": "Creative, attention-grabbing title",
    "category": "YOUR OWN CATEGORY - be creative!",
    "severity": "low|normal|high|critical",
    "confidence": 0.85,
    "reasoning": "Why you think this is interesting",
    "evidence": { "any": "structure", "from": "tool results" },
    "hypothesis": "Your creative interpretation",
    "recommendations": ["What to do about it"],
    "intendedRecipients": [{
      "personaName": "Alice-DevOps",
      "reasoning": "Why THIS person should see THIS discovery"
    }]
  }]
}

CRITICAL: You MUST use tools first, THEN return JSON. Do NOT return empty discoveries without analyzing!

DEDUPLICATION RULES:
- ALWAYS check the "RECENT DISCOVERIES" list in your context before reporting
- Do NOT report discoveries with similar titles, categories, or reasoning
- If a pattern is ONGOING (e.g., "temperature still oscillating"), you can report an UPDATE
  but make the title clearly different: "Temperature oscillation CONTINUES with increased severity"
- Focus on GENUINELY NEW patterns, not rehashing what was already found
- If you find nothing new, return empty discoveries array - that's perfectly acceptable

REMEMBER:
- Be creative and playful in discoveries
- Different people get different notifications for SAME discovery
- Some discoveries might not need ANY notifications
- If nothing interesting is happening, that's okay - be honest about it
- Look for patterns across time, not just current values
- Consider historical context and trends
`;

/**
 * Get all personas with their context
 */
async function getAllPersonaContexts(): Promise<PersonaContext[]> {
  try {
    // Get all personas from database
    const personas = await db.select().from(persona);

    const contexts: PersonaContext[] = [];

    for (const p of personas) {
      try {
        const memory = await getPersonaMemory(p.name);
        const recentLogs = await getRecentLogs(p.name, 5);

        const traits = (memory?.traits as any) || {};
        contexts.push({
          personaName: p.name,
          memory: memory || null,
          recentLogs,
          interests: (traits.interests as string[]) || [],
          behaviorPatterns: traits.behaviorPatterns || {},
        });
      } catch (err) {
        console.warn(`Failed to load context for persona ${p.name}:`, err);
      }
    }

    return contexts;
  } catch (err) {
    console.error("Failed to load persona contexts:", err);
    return [];
  }
}

/**
 * Persona query tools for Discovery Engine
 * Allows LLM to dynamically query persona information when deciding recipients
 */
const personaQueryTools = {
  listAllPersonas: tool({
    description: 'List all available personas you can notify about discoveries',
    inputSchema: z.object({
      _unused: z.boolean().optional().describe('Not used - this tool takes no parameters')
    }),
    execute: async () => {
      console.log('[Discovery Tool] listAllPersonas called');
      const personas = await getAllPersonas();
      const result = {
        count: personas.length,
        personas: personas.map(p => ({
          name: p.name,
          lastActive: p.updatedAt.toISOString(),
        }))
      };
      console.log(`[Discovery Tool] Found ${result.count} personas:`, result.personas.map(p => p.name).join(', '));
      return result;
    }
  }),

  getPersonaInfo: tool({
    description: 'Get information about a specific persona to decide if they would be interested in a discovery. Returns their interests, communication preferences summary, and recent activity patterns.',
    inputSchema: z.object({
      personaName: z.string().describe('Name of the persona to query (e.g., "Alice-ceo", "Bob-eng")')
    }),
    execute: async ({ personaName }) => {
      console.log(`[Discovery Tool] getPersonaInfo called for: ${personaName}`);
      try {
        const memory = await getPersonaMemory(personaName).catch(() => null);
        const logs = await getRecentLogs(personaName, 10).catch(() => []);

        const traits = (memory?.traits as any) || {};
        const result = {
          personaName,
          found: !!memory,
          summary: memory?.summary || 'No memory recorded yet',
          interests: (traits.interests as string[]) || [],
          recentActivityCount: logs.length,
          communicationPreferences: {
            prefersBrief: logs.some(l => l.content.toLowerCase().includes('brief') || l.content.toLowerCase().includes('short')),
            prefersDetailed: logs.some(l => l.content.toLowerCase().includes('detailed') || l.content.toLowerCase().includes('comprehensive')),
            prefersVisual: logs.some(l => l.content.toLowerCase().includes('dashboard') || l.content.toLowerCase().includes('visual')),
          },
          recentTopics: logs.slice(0, 3).map(l => l.content),
        };

        console.log(`[Discovery Tool] Persona info for ${personaName}:`, {
          found: result.found,
          interests: result.interests,
          preferences: result.communicationPreferences
        });

        return result;
      } catch (error: any) {
        console.error(`[Discovery Tool] Failed to get persona info for ${personaName}:`, error);
        return {
          personaName,
          found: false,
          error: error.message,
          summary: 'Error loading persona information'
        };
      }
    }
  })
};

/**
 * Merge stream analysis tools with persona query tools
 */
const allDiscoveryTools = {
  ...streamAnalysisTools,
  ...personaQueryTools
};

/**
 * Main discovery function - Let Jeeves explore!
 */
export async function runDiscovery(
  monitoredStreams: string[],
  recentDiscoveries: any[]
): Promise<DiscoveryResult> {
  console.log("[Discovery Engine] ========================================");
  console.log("[Discovery Engine] Starting unconstrained discovery...");
  console.log("[Discovery Engine] Input - Monitored streams:", monitoredStreams);
  console.log("[Discovery Engine] Input - Recent discoveries count:", recentDiscoveries.length);

  // Load persona contexts
  console.log("[Discovery Engine] Step 1: Loading persona contexts...");
  const personaContexts = await getAllPersonaContexts();
  console.log("[Discovery Engine] ✓ Loaded", personaContexts.length, "persona contexts");
  console.log("[Discovery Engine] Personas:", personaContexts.map(p => p.personaName).join(", "));

  // Build context message for LLM
  const contextMessage = `
CURRENT SITUATION:
- Monitored streams: ${JSON.stringify(monitoredStreams)}
- Time: ${new Date().toISOString()}
- Recent discoveries (last 24h): ${recentDiscoveries.length} discoveries

RECENT DISCOVERIES (ALREADY NOTIFIED - AVOID DUPLICATES):
${recentDiscoveries.length > 0 ? recentDiscoveries.map(d => `
- "${d.title}" (${d.category}, severity: ${d.severity})
  Discovered: ${new Date(d.discoveredAt).toLocaleString()}
  Reasoning: ${d.aiReasoning.substring(0, 150)}...
  Status: ${d.status}
`).join('\n') : '(No recent discoveries - this is your first analysis or nothing found recently)'}

IMPORTANT: Do NOT notify about discoveries similar to the above recent ones.
Focus on NEW, DIFFERENT patterns. If the same pattern persists (e.g., temperature still oscillating),
you can report it as an UPDATE with new severity or evidence, but make clear it's a continuation.

PERSONAS YOU SERVE:
${personaContexts.map(p => `
- ${p.personaName}:
  Interests: ${p.interests?.join(', ') || 'none recorded'}
  Recent activity: ${p.recentLogs.length} interactions
  Behavior: ${JSON.stringify(p.behaviorPatterns)}
`).join('\n')}

YOUR TASK:
Analyze the monitored streams and discover ANYTHING interesting that HASN'T been recently reported.
Use your tools creatively. Think like a curious scientist, not a boring rule-checker.
`;

  console.log("[Discovery Engine] Step 2: Building context message...");
  console.log("[Discovery Engine] Context message length:", contextMessage.length, "chars");

  try {
    // NOTE: globalRateLimitMonitor state is often stale because:
    // 1. It only updates when responses come back
    // 2. Other requests (chat) consume tokens between updates
    // Solution: Use pessimistic estimation and let rate limit handler deal with it

    console.log("[Discovery Engine] Step 3: Preparing LLM request...");
    console.log("[Discovery Engine] Relying on rate limit retry handler (no pre-check)");

    console.log("[Discovery Engine] Step 4: Calling LLM with rate limit handling...");
    console.log("[Discovery Engine] Config - maxRetries: 5, estimatedTokens: 50000, temperature: 0.8");
    console.log("[Discovery Engine] Note: First call ~50k tokens (cache write), subsequent calls ~5k tokens (cache hit)");

    // Log the full request details
    console.log("[Discovery Engine] ========================================");
    console.log("[Discovery Engine] FULL LLM REQUEST:");
    console.log("[Discovery Engine] Model:", 'chat-model');
    console.log("[Discovery Engine] Temperature:", 0.8);
    console.log("[Discovery Engine] Max steps:", 15); // Increased from 10 to allow persona queries
    console.log("[Discovery Engine] ----------------------------------------");
    console.log("[Discovery Engine] SYSTEM PROMPT:");
    console.log(JEEVES_DISCOVERY_PROMPT);
    console.log("[Discovery Engine] ----------------------------------------");
    console.log("[Discovery Engine] USER MESSAGE:");
    console.log(contextMessage);
    console.log("[Discovery Engine] ----------------------------------------");
    console.log("[Discovery Engine] TOOLS PROVIDED:", Object.keys(allDiscoveryTools).join(", "));
    console.log("[Discovery Engine] Total tools:", Object.keys(allDiscoveryTools).length);
    console.log("[Discovery Engine] ========================================");

    // Enable prompt caching for tools to reduce token usage
    // 21 tools (19 stream + 2 persona) = ~26k tokens, caching saves 90% on subsequent calls
    const toolEntries = Object.entries(allDiscoveryTools);
    const cachedTools = Object.fromEntries(
      toolEntries.map(([name, toolDef], index) => {
        if (index === toolEntries.length - 1) {
          // Mark the LAST tool for caching - this caches ALL tools + system prompt
          console.log(`[Discovery Engine] Enabling cache for last tool: ${name}`);
          return [name, {
            ...toolDef,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
                ttl: '1h' // Extended cache for Jeeves long-running analysis
              }
            }
          }];
        }
        return [name, toolDef];
      })
    );

    const startTime = Date.now();
    let currentStep = 0;
    let cumulativeInputTokens = 0;
    let cumulativeOutputTokens = 0;

    // Custom stop condition: limit cumulative input tokens to avoid rate limit
    const tokenBudgetExceeded = ({ steps }: { steps: any[] }) => {
      const totalInputTokens = steps.reduce(
        (acc, step) => acc + (step.usage?.inputTokens ?? 0),
        0
      );

      // DISABLED: We're on Tier 4 (400k tokens/min) - let LLM complete analysis
      // Stop if cumulative input tokens exceed 300k (safe margin for Tier 4: 400k/min limit)
      // if (totalInputTokens > 300000) {
      //   console.log(`[Discovery Engine] ⚠️ Token budget exceeded: ${totalInputTokens} input tokens`);
      //   return true;
      // }
      return false;
    };

    const result = await jeevesRateLimit.executeWithRetry(
      async () => {
        console.log("[Discovery Engine] >>> Sending request to LLM...");
        console.log("[Discovery Engine] Max steps: 15, Temperature: 0.8");
        console.log("[Discovery Engine] Token budget: DISABLED (Tier 4: 400k/min available)");

        // NOTE: experimental_output + tools don't work together in AI SDK 5
        // See: https://github.com/vercel/ai/issues/8984
        // Using tools only, will parse JSON from text response
        const response = await generateText({
          model: myProvider.languageModel('chat-model'),
          system: JEEVES_DISCOVERY_PROMPT,
          messages: [
            {
              role: 'user',
              content: contextMessage,
            },
          ],
          tools: cachedTools,
          temperature: 0.8, // Encourage creativity
          // No maxOutputTokens limit - let LLM complete its response fully
          stopWhen: [
            stepCountIs(15), // Max 15 steps
            tokenBudgetExceeded, // Stop if token budget exceeded
          ],
          // experimental_output disabled - conflicts with tools in AI SDK 5

          // Detailed step logging
          onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
            currentStep++;
            const stepType = currentStep === 1 ? 'initial' : (toolResults && toolResults.length > 0 ? 'tool-result' : 'continue');

            // Track cumulative tokens
            cumulativeInputTokens += usage.inputTokens || 0;
            cumulativeOutputTokens += usage.outputTokens || 0;

            console.log(`\n[Discovery Engine] ┌─ Step ${currentStep} Complete ─────────────────────────`);
            console.log(`[Discovery Engine] │ Type: ${stepType}`);
            console.log(`[Discovery Engine] │ Finish Reason: ${finishReason}`);
            console.log(`[Discovery Engine] │ Token Usage: input=${usage.inputTokens || 0}, output=${usage.outputTokens || 0}, total=${usage.totalTokens || 0}`);
            console.log(`[Discovery Engine] │ Cumulative: input=${cumulativeInputTokens}, output=${cumulativeOutputTokens}, total=${cumulativeInputTokens + cumulativeOutputTokens}`);

            // Log tool calls
            if (toolCalls && toolCalls.length > 0) {
              console.log(`[Discovery Engine] │ Tool Calls: ${toolCalls.length}`);
              toolCalls.forEach((call, idx) => {
                const inputPreview = JSON.stringify((call as any).args || (call as any).input || {}).substring(0, 100);
                console.log(`[Discovery Engine] │   ${idx + 1}. ${call.toolName}(${inputPreview}...)`);
              });
            } else {
              console.log(`[Discovery Engine] │ Tool Calls: None`);
            }

            // Log tool results
            if (toolResults && toolResults.length > 0) {
              console.log(`[Discovery Engine] │ Tool Results: ${toolResults.length}`);
              toolResults.forEach((result, idx) => {
                const output = (result as any).output || (result as any).result;
                const resultPreview = typeof output === 'string'
                  ? output.substring(0, 100)
                  : JSON.stringify(output).substring(0, 100);
                const status = (result as any).isError ? ' [ERROR]' : '';
                console.log(`[Discovery Engine] │   ${idx + 1}. ${result.toolName}${status}: ${resultPreview}...`);
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
        });

        // Log cache metadata
        const cacheMetadata = response.providerMetadata?.anthropic;
        if (cacheMetadata) {
          console.log("[Discovery Engine] ═══════════════════════════════════════════════");
          console.log("[Discovery Engine] CACHE STATISTICS:");
          console.log("[Discovery Engine] Cache Creation Tokens:", cacheMetadata.cacheCreationInputTokens || 0);
          console.log("[Discovery Engine] Cache Read Tokens:", cacheMetadata.cacheReadInputTokens || 0);
          console.log("[Discovery Engine] Regular Input Tokens:", response.usage.inputTokens || 0);

          const cacheReadTokens = Number(cacheMetadata.cacheReadInputTokens || 0);
          const regularInputTokens = Number(response.usage.inputTokens || 0);
          const cacheHitRate = cacheReadTokens > 0
            ? `${((cacheReadTokens / (cacheReadTokens + regularInputTokens)) * 100).toFixed(1)}%`
            : '0% (cache miss - first run)';

          console.log("[Discovery Engine] Cache Hit Rate:", cacheHitRate);
          console.log("[Discovery Engine] ═══════════════════════════════════════════════");
        }

        console.log("[Discovery Engine] <<< Received response from LLM");
        console.log(`[Discovery Engine] Total Steps: ${currentStep}`);
        console.log(`[Discovery Engine] Finish Reason: ${response.finishReason}`);

        // Check if stopped due to token budget
        const totalInputTokens = response.steps?.reduce((acc, step) => acc + (step.usage?.inputTokens ?? 0), 0) || 0;
        if (totalInputTokens > 300000) {
          console.log(`[Discovery Engine] ⚠️ Stopped: Token budget exceeded (${totalInputTokens} input tokens)`);
        }

        console.log(`[Discovery Engine] Total Execution Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
        return response;
      },
      {
        maxRetries: 5,
        estimatedTokens: 50000, // First call needs full token budget for cache write
        onRetry: (attempt, waitTime) => {
          console.log(`[Discovery Engine] ⚠️ Rate limit retry ${attempt}/5, waiting ${Math.round(waitTime / 1000)}s`);
        }
      }
    );

    const elapsedTime = Date.now() - startTime;
    console.log("[Discovery Engine] ✓ LLM call completed in", elapsedTime, "ms");

    const fullText = result.text;
    console.log("[Discovery Engine] Response text length:", fullText.length, "chars");
    console.log("[Discovery Engine] Response preview:", fullText.substring(0, 300) + "...");

    // Capture tool usage trail for UI display
    console.log("[Discovery Engine] Step 4: Processing tool usage trail...");
    const toolUsageTrail = result.steps?.map((step: any) => ({
      type: step.toolName || 'reasoning',
      state: 'output-available',
      input: step.toolArgs,
      output: step.toolResult,
      text: step.text,
      timestamp: new Date().toISOString(),
    })) || [];
    console.log("[Discovery Engine] Tool steps captured:", toolUsageTrail.length);

    // Parse JSON from text response (experimental_output disabled due to AI SDK 5 bug)
    console.log("[Discovery Engine] Step 5: Parsing JSON response...");
    let discoveryResult: DiscoveryResult;

    try {
      // Look for JSON in the response
      const jsonMatch = fullText.match(/\{[\s\S]*"discoveries"[\s\S]*\}/);
      if (jsonMatch) {
        console.log("[Discovery Engine] ✓ Found JSON block in response");
        discoveryResult = JSON.parse(jsonMatch[0]);
        console.log("[Discovery Engine] Parsed discoveries count:", discoveryResult.discoveries.length);

        // Add tool trail to each discovery's evidence
        discoveryResult.discoveries = discoveryResult.discoveries.map((disc: any) => ({
          ...disc,
          evidence: {
            ...disc.evidence,
            toolUsageTrail,
          }
        }));
      } else {
        console.log("[Discovery Engine] ⚠️ No JSON block found in response, creating fallback");
        // If no JSON found, create a structured response from the text
        discoveryResult = {
          discoveries: [{
            title: "Analysis Complete",
            category: "system-status",
            severity: "normal",
            confidence: 0.7,
            reasoning: fullText.substring(0, 500),
            evidence: { rawResponse: fullText, toolUsageTrail },
            hypothesis: "Jeeves analyzed the streams but did not format response correctly",
            recommendations: ["Review LLM response format"],
            intendedRecipients: [],
          }]
        };
      }
    } catch (parseErr: any) {
      console.error("[Discovery Engine] ❌ Failed to parse JSON:", parseErr.message);
      console.error("[Discovery Engine] Parse error stack:", parseErr.stack);
      // Fallback: wrap text response
      discoveryResult = {
        discoveries: [{
          title: "Analysis Complete (Unstructured)",
          category: "system-status",
          severity: "normal",
          confidence: 0.5,
          reasoning: fullText,
          evidence: { toolUsageTrail },
          hypothesis: "Could not parse structured response",
          recommendations: [],
          intendedRecipients: [],
        }]
      };
    }

    console.log("[Discovery Engine] ✓ Final result:", discoveryResult.discoveries.length, "discoveries");
    discoveryResult.discoveries.forEach((d, i) => {
      console.log(`[Discovery Engine]   ${i+1}. "${d.title}" (${d.category}, ${d.severity})`);
    });
    console.log("[Discovery Engine] ========================================");

    return discoveryResult;

  } catch (error: any) {
    console.error("[Discovery Engine] ========================================");
    console.error("[Discovery Engine] ❌ FATAL ERROR in discovery");
    console.error("[Discovery Engine] Error type:", error.constructor.name);
    console.error("[Discovery Engine] Error message:", error.message);
    console.error("[Discovery Engine] Error stack:", error.stack);

    // Extract rate limit info if available
    if (error?.responseHeaders || error?.lastError?.responseHeaders) {
      console.log("[Discovery Engine] Extracting rate limit headers from error...");
      const headers = error.responseHeaders || error.lastError.responseHeaders;
      jeevesRateLimit.updateFromHeaders(headers);

      const status = jeevesRateLimit.getStatus();
      console.error("[Discovery Engine] Rate limit status:", {
        tokensRemaining: status.inputTokensRemaining,
        resetIn: Math.round(status.inputTokensResetIn / 1000) + 's'
      });
    }

    console.error("[Discovery Engine] ========================================");
    throw error;
  }
}
