import { z } from "zod";
import { tool } from "ai";
import { updatePersonaMemory } from "@/lib/ai/personalized-system";
import { sanitizePersonaName } from "@/lib/db/userlog-ops";

export function updatePersonaMemoryTool({ personaName }: { personaName?: string }) {
  const safePersona = personaName ? sanitizePersonaName(personaName) : undefined;

  return tool({
    description:
      "Update persona memory by summarizing recent user logs. Use when you notice significant new patterns or preferences that should be remembered long-term.",
    inputSchema: z.object({
      personaName: z.string().optional().describe("Override persona name (rare)."),
      force: z.boolean().optional().default(false).describe("Force update even if not enough data."),
    }),
    execute: async ({ personaName: overridePersona, force }) => {
      const name = sanitizePersonaName(overridePersona ?? safePersona ?? "");

      try {
        await updatePersonaMemory(name);
        return "Persona memory updated successfully.";
      } catch (error) {
        console.warn("updatePersonaMemoryTool failed:", error);
        return "Failed to update persona memory.";
      }
    },
  });
}