import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

export const persona = pgTable(
  "Persona",
  {
    // Keyed by an arbitrary user-provided name (PoC; not identity)
    name: text("name").notNull().primaryKey(),
    email: text("email"),
    sendNotification: boolean("sendNotification").notNull().default(false),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
  },
  (t) => ({
    name_idx: uniqueIndex("persona_name_idx").on(t.name),
  })
);

export const userLog = pgTable(
  "UserLog",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    personaName: text("personaName").notNull(),
    kind: text("kind").notNull(), // "fact" | "preference" | "interaction" | "note"
    content: text("content").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("createdAt").notNull(),
  },
  (t) => ({
    persona_idx: index("userlog_persona_idx").on(t.personaName),
    created_idx: index("userlog_created_idx").on(t.createdAt),
  })
);

export const personaMemory = pgTable(
  "PersonaMemory",
  {
    personaName: text("personaName").notNull().primaryKey(),
    summary: text("summary"), // concise NL summary used for personalization
    traits: jsonb("traits"),  // optional structured preferences
    updatedAt: timestamp("updatedAt").notNull(),
  },
  (t) => ({
    persona_mem_idx: uniqueIndex("persona_mem_idx").on(t.personaName),
  })
);
