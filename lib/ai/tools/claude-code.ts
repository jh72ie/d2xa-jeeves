import { tool } from "ai";
import { z } from "zod";

export function claudeCodeTool({ dataStream }: { dataStream: any }) {
  return tool({
    description: `Deploy the provided dashboard script to connect v0Card layout with live data streams. The script runs in a Web Worker with these API methods:

CRITICAL REQUIREMENTS:
1. MAXIMUM 2 STREAMS per dashboard (MQTT connection limit)
2. ONLY use stream IDs you verified exist with listStreams/getStreamRecentData
3. NEVER hallucinate stream names - use exact IDs from stream analysis tools

USAGE PATTERN:
1. Call api.subscribe(url) to connect to stream (MAX 2 streams!)
2. Call api.on('tick', (data) => { ... }) to receive stream data
3. Use api.replaceSlot(slotId, html) to update UI

EXAMPLE (2 streams max):
api.subscribe('/api/telemetry/stream?streamId=fcu-201-spacetemp&intervalMs=5000');
api.subscribe('/api/telemetry/stream?streamId=fcu-201-effectsetpt&intervalMs=5000');
api.on('tick', (data) => {
  const temp = data.value;
  api.replaceSlot('current-temp', temp.toFixed(1) + '°C');
});

Available methods: api.subscribe, api.on, api.postText, api.replaceSlot, api.log, api.error`,
    inputSchema: z.object({
      cardId: z.string().describe("The v0Card ID to attach script to"),
      script: z.string().describe("Complete JavaScript code for the dashboard. Must connect to streams, parse data, update slots, create visualizations, track statistics, and handle errors. Use ONLY the api object methods (no document/window access)."),
    }),
    execute: async ({ cardId, script }) => {
      console.log("[claudeCodeTool] Deploying AI-generated script");
      console.log("[claudeCodeTool] Card ID:", cardId);
      console.log("[claudeCodeTool] Script length:", script.length);
      console.log("[claudeCodeTool] Script preview:", script.substring(0, 200) + "...");
      console.log("[claudeCodeTool] Script deployment timestamp:", new Date().toISOString());

      // Validation 1: CardId
      if (!cardId || cardId.trim().length === 0) {
        const errorMsg = `Invalid cardId: ${cardId}`;
        console.error("[claudeCodeTool] Validation error:", errorMsg);
        throw new Error(errorMsg);
      }

      // Validation 2: Enforce 2-stream limit (MQTT connection limit)
      const subscribeMatches = script.match(/api\.subscribe\(/g);
      const streamCount = subscribeMatches ? subscribeMatches.length : 0;
      console.log("[claudeCodeTool] Detected", streamCount, "stream subscriptions");

      if (streamCount > 2) {
        const errorMsg = `Script exceeds maximum 2 streams (found ${streamCount}). MQTT broker has connection limits. Reduce to 2 streams max.`;
        console.error("[claudeCodeTool] Validation error:", errorMsg);
        throw new Error(errorMsg);
      }

      console.log("[claudeCodeTool] Validation passed (cardId ✓, streams ✓)");

      // Send script to client via dataStream
      dataStream.write({
        type: "data-v0ScriptStart",
        data: {
          cardId,
          script,
        },
      });

      console.log("[claudeCodeTool] Script sent to client for card:", cardId);

      return {
        type: "script",
        cardId,
        script,
        message: `Deployed dashboard script for card ${cardId}`
      };
    },
  });
}