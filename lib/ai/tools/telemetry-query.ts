import { z } from "zod";
import { tool } from "ai";
import { getRecentAnomalies, getTicksInWindow } from "@/lib/db/telemetry-ops";

export const getRecentAnomaliesTool = tool({
  description: "Get recent anomalies for a sensor.",
  inputSchema: z.object({
    sensorId: z.string(),
    sinceMinutes: z.number().optional().default(60),
    limit: z.number().optional().default(50),
  }),
  execute: async ({ sensorId, sinceMinutes, limit }) => {
    const since = new Date(Date.now() - sinceMinutes * 60_000);
    const rows = await getRecentAnomalies({ sensorId, since, limit });
    return rows;
  },
});

export const getTicksTool = tool({
  description: "Get ticks in a time window for a sensor (sampled history).",
  inputSchema: z.object({
    sensorId: z.string(),
    fromMinutesAgo: z.number().default(60),
    toMinutesAgo: z.number().default(0),
    limit: z.number().optional().default(300),
  }),
  execute: async ({ sensorId, fromMinutesAgo, toMinutesAgo, limit }) => {
    const to = new Date(Date.now() - toMinutesAgo * 60_000);
    const from = new Date(Date.now() - fromMinutesAgo * 60_000);
    const rows = await getTicksInWindow({ sensorId, from, to, limit });
    return rows;
  },
});
