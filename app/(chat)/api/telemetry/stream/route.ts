/**
 * Real-time FCU Data Stream API
 *
 * Streams REAL FCU-01_04 data from database (not simulated!)
 * Used by dashboards for live updates
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (Vercel Pro)

import { getRecentDataPoints } from "@/lib/db/telemetry-ops";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("streamId");
  const intervalMs = Math.max(1000, Number(searchParams.get("intervalMs") ?? 5000)); // Min 1s, default 5s

  if (!streamId) {
    return new Response(
      JSON.stringify({ error: "streamId parameter required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Vercel Edge functions timeout, so limit duration
  const maxDurationMs = Math.min(25000, Number(searchParams.get("maxMs") ?? 25000)); // Max 25 seconds

  console.log(`[FCU Stream] Starting real data stream for ${streamId}`);

  let intervalId: any;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const startedAt = Date.now();

      const send = (line: string) => {
        try {
          controller.enqueue(encoder.encode(line));
        } catch (e) {
          console.error('[FCU Stream] Error sending:', e);
        }
      };

      const sendEvent = (event: string, data: any) => {
        send(`event: ${event}\n`);
        send(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Initial connection message
      send(`: Connected to FCU stream\n\n`);
      send(`retry: 5000\n\n`); // Auto-reconnect after 5s

      // Send first data point immediately
      const sendDataPoint = async () => {
        try {
          // Get the MOST RECENT data point from database
          const data = await getRecentDataPoints({
            sensorId: streamId,
            count: 1,
          });

          if (data.length > 0) {
            const point = data[0];
            const dataPoint = {
              sensorId: streamId,
              sensorType: "fcu-sensor",
              ts: point.ts.toISOString(),
              value: point.value,
              unit: "°C", // TODO: Get from metadata
            };

            sendEvent("tick", dataPoint);
          } else {
            console.warn(`[FCU Stream] No data available for ${streamId}`);
            sendEvent("error", {
              message: `No data available for stream ${streamId}`,
              streamId,
            });
          }
        } catch (error: any) {
          console.error(`[FCU Stream] Error fetching data for ${streamId}:`, error);
          sendEvent("error", {
            message: error.message,
            streamId,
          });
        }
      };

      // Send first tick immediately
      sendDataPoint();

      // Schedule periodic ticks
      intervalId = setInterval(async () => {
        // Check if we should stop
        if (Date.now() - startedAt >= maxDurationMs) {
          clearInterval(intervalId);
          send(`: Stream ending after ${maxDurationMs}ms\n\n`);
          controller.close();
          return;
        }

        // Send data point
        await sendDataPoint();
      }, intervalMs);
    },

    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
      "Access-Control-Allow-Origin": "*", // If needed for CORS
    },
  });
}
