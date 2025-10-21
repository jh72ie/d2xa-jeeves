"use client";

import { useMemo } from "react";
import { useTelemetry } from "@/hooks/use-telemetry";

export function TelemetryPanel({
  sensorId,
  personaName,
}: {
  sensorId: string;
  personaName?: string;
}) {
  const { points, anomalies, status } = useTelemetry({
    sensorId,
    personaName,
    autoStart: true,
  });

  // Simple visualization: last 60 points + anomaly badges
  const last = useMemo(() => points.slice(-60), [points]);

  return (
    <div className="mt-3 rounded-xl border p-3 dark:border-zinc-700">
      <div className="mb-2 text-sm text-zinc-500">
        Live Telemetry {sensorId} — {status}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-sm">
          <div className="font-medium mb-1">Recent values</div>
          <div className="max-h-40 overflow-y-auto text-xs">
            {last.map((p) => (
              <div key={p.ts} className="flex justify-between">
                <span>{new Date(p.ts).toLocaleTimeString()}</span>
                <span>{p.value.toFixed(2)} °C</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-1">Anomalies</div>
          <div className="max-h-40 overflow-y-auto text-xs">
            {anomalies.slice(-30).map((a, i) => (
              <div key={`${a.ts}-${i}`} className="flex justify-between text-red-600">
                <span>{new Date(a.ts).toLocaleTimeString()}</span>
                <span>{a.value.toFixed(2)} (score {a.score?.toFixed(2) ?? "-"})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
