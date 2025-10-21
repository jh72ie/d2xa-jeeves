import { and, desc, gte, lte, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const TelemetryAnomaly = pgTable("TelemetryAnomaly", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sensorId: text("sensorId").notNull(),
  personaName: text("personaName"),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  value: doublePrecision("value").notNull(),
  score: doublePrecision("score"),
  reason: text("reason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
});

export const TelemetryTick = pgTable("TelemetryTick", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sensorId: text("sensorId").notNull(),
  personaName: text("personaName"),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  value: doublePrecision("value").notNull(),
});

// Inserts
export async function insertAnomaly(a: {
  sensorId: string;
  personaName?: string;
  ts: Date;
  value: number;
  score?: number;
  reason?: string;
}) {
  const [row] = await db
    .insert(TelemetryAnomaly)
    .values({ ...a, createdAt: new Date() })
    .returning();
  return row;
}

export async function insertTick(t: {
  sensorId: string;
  personaName?: string;
  ts: Date;
  value: number;
}) {
  const [row] = await db.insert(TelemetryTick).values(t).returning();
  return row;
}

// Queries (used by model tools)
export async function getRecentAnomalies(params: {
  sensorId: string;
  since?: Date;
  limit?: number;
}) {
  const { sensorId, since, limit = 50 } = params;
  return db
    .select()
    .from(TelemetryAnomaly)
    .where(
      and(
        eq(TelemetryAnomaly.sensorId, sensorId),
        since ? gte(TelemetryAnomaly.ts, since) : undefined
      )
    )
    .orderBy(desc(TelemetryAnomaly.ts))
    .limit(limit);
}

export async function getTicksInWindow(params: {
  sensorId: string;
  from: Date;
  to: Date;
  limit?: number;
}) {
  const { sensorId, from, to, limit = 500 } = params;
  return db
    .select()
    .from(TelemetryTick)
    .where(
      and(
        eq(TelemetryTick.sensorId, sensorId),
        gte(TelemetryTick.ts, from),
        lte(TelemetryTick.ts, to)
      )
    )
    .orderBy(desc(TelemetryTick.ts))
    .limit(limit);
}

export async function getRecentDataPoints(params: {
  sensorId: string;
  count: number;
}) {
  const { sensorId, count } = params;
  return db
    .select()
    .from(TelemetryTick)
    .where(eq(TelemetryTick.sensorId, sensorId))
    .orderBy(desc(TelemetryTick.ts))
    .limit(count);
}
