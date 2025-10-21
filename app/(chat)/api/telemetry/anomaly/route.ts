import { NextRequest } from "next/server";
import { insertAnomaly } from "@/lib/db/telemetry-ops";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sensorId, personaName, ts, value, score, reason } = body;
    if (!sensorId || !ts || typeof value !== "number") {
      return Response.json({ message: "bad request" }, { status: 400 });
    }
    const row = await insertAnomaly({
      sensorId,
      personaName,
      ts: new Date(ts),
      value,
      score,
      reason,
    });
    return Response.json({ id: row.id }, { status: 201 });
  } catch (e) {
    return Response.json({ message: "error" }, { status: 500 });
  }
}
