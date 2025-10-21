import { db } from "@/lib/db/queries";
import { persona, userLog, personaMemory } from "./userlog-schema";
import { eq, desc } from "drizzle-orm";
import { generateUUID } from "@/lib/utils";

export async function ensurePersona(name: string) {
  const trimmed = sanitizePersonaName(name);
  const now = new Date();

  try {
    const existing = await db
      .select()
      .from(persona)
      .where(eq(persona.name, trimmed))
      .limit(1);

    if (existing.length > 0) {
      await db.update(persona).set({ updatedAt: now }).where(eq(persona.name, trimmed));
      return existing[0];
    }

    await db.insert(persona).values({
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    });

    return { name: trimmed, createdAt: now, updatedAt: now };
  } catch (error) {
    console.error("[ensurePersona] Database error:", error);
    console.error("[ensurePersona] Attempted persona name:", trimmed);
    throw error;
  }
}

export function sanitizePersonaName(name: string): string {
  const v = String(name ?? "").trim();
  if (!v) throw new Error("personaName is required.");
  if (v.length > 64) throw new Error("personaName too long.");
  // Optional: restrict characters for PoC safety
  if (!/^[\w .@+-]+$/.test(v)) throw new Error("personaName contains invalid characters.");
  return v;
}

export async function appendUserLog({
  personaName,
  kind,
  content,
  meta,
}: {
  personaName: string;
  kind: "fact" | "preference" | "interaction" | "note";
  content: string;
  meta?: Record<string, unknown>;
}) {
  const name = sanitizePersonaName(personaName);
  try {
    await db.insert(userLog).values({
      id: generateUUID(),
      personaName: name,
      kind,
      content: content.slice(0, 5000),
      meta: meta ?? {},
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[appendUserLog] Database error:", error);
    console.error("[appendUserLog] Attempted values:", { personaName: name, kind });
    throw error;
  }
}

export async function getRecentLogs(personaName: string, limit = 30) {
  const name = sanitizePersonaName(personaName);
  return db
    .select()
    .from(userLog)
    .where(eq(userLog.personaName, name))
    .orderBy(desc(userLog.createdAt))
    .limit(limit);
}

export async function getPersonaMemory(personaName: string) {
  const name = sanitizePersonaName(personaName);
  const rows = await db
    .select()
    .from(personaMemory)
    .where(eq(personaMemory.personaName, name))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertPersonaMemory({
  personaName,
  summary,
  traits,
}: {
  personaName: string;
  summary: string;
  traits?: Record<string, unknown>;
}) {
  const name = sanitizePersonaName(personaName);
  const now = new Date();
  await db
    .insert(personaMemory)
    .values({
      personaName: name,
      summary: summary.slice(0, 10000),
      traits: traits ?? {},
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: personaMemory.personaName,
      set: { summary, traits: traits ?? {}, updatedAt: now },
    });
}

export async function getAllPersonas() {
  return db.select().from(persona).orderBy(desc(persona.updatedAt));
}
