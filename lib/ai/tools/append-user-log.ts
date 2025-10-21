import { z } from "zod";
import { tool } from "ai";
import { appendUserLog, sanitizePersonaName } from "@/lib/db/userlog-ops";

export function appendUserLogTool({ personaName }: { personaName?: string }) {
  const safePersona = personaName ? sanitizePersonaName(personaName) : undefined;

  return tool({
    description:
      "Append a structured line to the user's log for future personalization. Use for stable facts, preferences, or habits. Keep entries concise and factual.",
    inputSchema: z.object({
      entry: z.string().min(4).max(2000).describe("Concise log line about the user."),
      kind: z
        .enum(["fact", "preference", "interaction", "note"])
        .default("note")
        .describe("What type of entry this is."),
      meta: z.record(z.any()).optional(),
      personaName: z.string().optional().describe("Override persona name (rare)."),
    }),
    execute: async ({ entry, kind, meta, personaName }) => {
      const name = sanitizePersonaName(personaName ?? safePersona ?? "");
      await appendUserLog({ personaName: name, content: entry, kind, meta });
      return "Logged.";
    },
  });
}
