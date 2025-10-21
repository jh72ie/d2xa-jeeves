import { getPersonaMemory, getRecentLogs, upsertPersonaMemory } from "@/lib/db/userlog-ops";

export async function buildPersonalizedSystem({
  baseSystem,
  personaName,
}: {
  baseSystem: string;
  personaName?: string;
}) {
  if (!personaName) return baseSystem;

  // Pull compact memory and a small tail of logs
  const [mem, logs] = await Promise.all([
    getPersonaMemory(personaName).catch(() => null),
    getRecentLogs(personaName, 12).catch(() => []),
  ]);

  const memoryText = mem?.summary ? `User memory:\n${mem.summary}\n\n` : "";
  const recentLines = logs
    .map((l) => `- [${l.kind}] ${l.content}`)
    .reverse() // oldest first for readability
    .join("\n");

  const logBlock = recentLines
    ? `Recent user log (most relevant lines):\n${recentLines}\n\n`
    : "";

  const guidance = [
    "Personalization guidelines:",
    "- Use memory and logs to adjust tone, detail, and examples.",
    "- Treat logs as hints—never as ground truth about identity.",
    "- Summarize new stable preferences as they emerge and call the appendUserLog tool to record them.",
  ].join("\n");

  return [baseSystem, "", memoryText, logBlock, guidance].join("\n");
}

/**
 * Summarizes recent user logs into persona memory when enough new interactions have occurred.
 * This should be called periodically (e.g., after every 10-20 interactions).
 */
export async function updatePersonaMemory(personaName: string) {
  if (!personaName) return;

  try {
    // Get recent logs (more than what we use for system prompt)
    const logs = await getRecentLogs(personaName, 50);

    if (logs.length < 5) {
      // Not enough data to build meaningful memory
      return;
    }

    // Filter out just interactions - focus on meaningful content
    const meaningfulLogs = logs.filter(log =>
      log.kind === 'fact' || log.kind === 'preference' || log.kind === 'note'
    );

    const interactionLogs = logs.filter(log => log.kind === 'interaction');

    if (meaningfulLogs.length === 0 && interactionLogs.length < 10) {
      // Not enough meaningful content yet
      return;
    }

    // Create a summary of user patterns
    const factEntries = meaningfulLogs.filter(l => l.kind === 'fact').map(l => l.content);
    const preferenceEntries = meaningfulLogs.filter(l => l.kind === 'preference').map(l => l.content);
    const noteEntries = meaningfulLogs.filter(l => l.kind === 'note').map(l => l.content);

    const interactionCount = interactionLogs.length;
    const recentInteractions = interactionLogs.slice(0, 5);

    // Build summary text
    const summaryParts: string[] = [];

    if (factEntries.length > 0) {
      summaryParts.push(`Facts: ${factEntries.slice(-5).join('; ')}`);
    }

    if (preferenceEntries.length > 0) {
      summaryParts.push(`Preferences: ${preferenceEntries.slice(-5).join('; ')}`);
    }

    if (noteEntries.length > 0) {
      summaryParts.push(`Notes: ${noteEntries.slice(-3).join('; ')}`);
    }

    summaryParts.push(`Total interactions: ${interactionCount}`);

    if (recentInteractions.length > 0) {
      const recentMeta = recentInteractions.map(i => i.meta).filter(Boolean);
      if (recentMeta.length > 0) {
        summaryParts.push(`Recent activity: ${recentMeta.length} messages`);
      }
    }

    const summary = summaryParts.join('\n');

    // Build traits object with structured data
    const traits = {
      factCount: factEntries.length,
      preferenceCount: preferenceEntries.length,
      interactionCount,
      lastFacts: factEntries.slice(-3),
      lastPreferences: preferenceEntries.slice(-3),
      updatedAt: new Date().toISOString(),
    };

    // Save the summarized memory
    await upsertPersonaMemory({
      personaName,
      summary,
      traits,
    });

    console.log(`[PersonaMemory] Updated memory for ${personaName}: ${summary.length} chars`);
    console.log(`[PersonaMemory] Summary content:`, summary);
    console.log(`[PersonaMemory] Traits:`, traits);
  } catch (error) {
    console.warn(`[PersonaMemory] Failed to update memory for ${personaName}:`, error);
  }
}
