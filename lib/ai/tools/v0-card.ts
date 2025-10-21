import { z } from "zod";
import { tool, type UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";
import { generateHtmlWithV0 } from "@/lib/v0/client";

export function v0CardTool({
  dataStream,
}: {
  dataStream: UIMessageStreamWriter<ChatMessage>;
}) {
  return tool({
    description: `Generate a self-contained HTML card with v0 and stream it to the client.

CRITICAL WORKFLOW:
1. FIRST use listStreams or getStreamRecentData to verify what data EXISTS
2. THEN call v0Card to create layout with accurate data-slot-id attributes
3. FINALLY call claudeCode to connect streams to the layout

NEVER create dashboards for data you haven't verified exists!`,
    inputSchema: z.object({
      prompt: z.string().describe("Describe the card style and content for v0. Include data-slot-id attributes for dynamic content."),
      data: z
        .record(z.any())
        .optional()
        .describe("Optional structured data to include."),
    }),
    execute: async ({ prompt, data }) => {
      try {
        console.log("[v0CardTool] Calling v0 with prompt:", prompt);
        const { html } = await generateHtmlWithV0({ prompt, data });

        console.log("[v0CardTool] Received HTML length:", html.length);
        console.log("[v0CardTool] HTML preview:", html.substring(0, 200) + (html.length > 200 ? "..." : ""));

        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);

        // Typed UI event: 'data-' + keyof CustomUIDataTypes => 'data-v0Card'
        dataStream.write({
          type: "data-v0Card",
          data: { id, html },
          transient: true,
        });

        return { html, id };
      } catch (err) {
        console.error("V0 card generation failed", {
          error:
            err instanceof Error
              ? { name: err.name, message: err.message, stack: err.stack }
              : String(err),
        });
        throw err;
      }
    },
  });
}
