"use client";

import { useEffect, useRef, useState } from "react";

export type TelemetryPoint = { ts: string; value: number };
export type AnomalyPoint = TelemetryPoint & { score?: number };

export function useTelemetry(params: {
  sensorId: string;
  personaName?: string;
  autoStart?: boolean;
}) {
  const { sensorId, personaName, autoStart = true } = params;
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "streaming">(
    "idle"
  );

  const workerRef = useRef<Worker | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!autoStart) return;
    stoppedRef.current = false;
    setStatus("connecting");

    const open = () => {
      // clear any previous ES
      if (esRef.current) {
        try {
          esRef.current.close();
        } catch {}
      }

      const url = `/api/telemetry/stream?sensorId=${encodeURIComponent(
        sensorId
      )}`;
      const es = new EventSource(url);
      esRef.current = es;

      // Init worker once
      if (!workerRef.current) {
        const w = new Worker("/workers/river-anomaly.worker.js");
        workerRef.current = w;
        w.postMessage({ type: "init" });
        w.onmessage = (e) => {
          const m = e.data;
          if (m?.type === "result") {
            if (m.anomaly) {
              setAnomalies((prev) => [
                ...prev.slice(-999),
                { ts: m.ts, value: m.value, score: m.score },
              ]);
              // fire-and-forget persist
              fetch("/api/telemetry/anomaly", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  sensorId,
                  personaName,
                  ts: m.ts,
                  value: m.value,
                  score: m.score,
                  reason: "river|zscore",
                }),
              }).catch(() => {});
            }
          }
        };
      }

      es.addEventListener("tick", (evt: MessageEvent) => {
        try {
          const data = JSON.parse((evt as any).data);
          setStatus("streaming");
          setPoints((prev) => [...prev.slice(-999), data]);
          workerRef.current?.postMessage({ type: "tick", ...data });
        } catch {}
      });

      es.addEventListener("status", (evt: MessageEvent) => {
        try {
          const data = JSON.parse((evt as any).data);
          if (data.status === "connected") {
            setStatus("streaming");
            reconnectAttemptRef.current = 0;
          }
        } catch {}
      });

      es.onopen = () => {
        setStatus("connecting");
        reconnectAttemptRef.current = 0;
      };

      es.onerror = () => {
        // The server ends the stream periodically; trigger a reconnect.
        setStatus("idle");
        es.close();

        if (stoppedRef.current) return;

        const attempt = (reconnectAttemptRef.current ||= 0);
        reconnectAttemptRef.current = attempt + 1;
        const backoffMs = Math.min(30_000, 500 + attempt * 1000);

        setTimeout(() => {
          if (!stoppedRef.current) open();
        }, backoffMs);
      };
    };

    open();

    return () => {
      stoppedRef.current = true;
      try {
        esRef.current?.close();
      } catch {}
      try {
        workerRef.current?.terminate();
      } catch {}
      esRef.current = null;
      workerRef.current = null;
      setStatus("idle");
    };
  }, [autoStart, personaName, sensorId]);

  return { points, anomalies, status };
}
