import { z } from "zod";
import { tool, type UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";
import { listAvailableStreams } from "@/lib/monitoring/stream-tools";

export function listStreamsTool({
  dataStream,
}: {
  dataStream: UIMessageStreamWriter<ChatMessage>;
}) {
  return tool({
    description: `Dynamically discover ALL available real-time data streams from database with detailed metadata.

CRITICAL: Always check the dataFormat.valueType and valueRange before creating dashboards!
- valueType: 'binary' (0/1 only - use status display, NOT counters)
- valueType: 'percentage' (0-100% - use bar/gauge charts)
- valueType: 'continuous' (temperature, etc - use line charts)

NEVER treat binary occupancy (0/1) as a people counter!`,
    inputSchema: z.object({
      category: z.string().optional().describe("Optional category filter (e.g., 'temperature', 'valve', 'fan', 'occupancy')")
    }),
    execute: async ({ category }) => {
      console.log("[listStreamsTool] Called with category:", category);

      // Dynamically discover ALL streams from database
      const streamMetadata = await listAvailableStreams();
      console.log(`[listStreamsTool] Discovered ${streamMetadata.length} streams from database`);

      // Convert to SSE stream format
      const streams = streamMetadata.map(meta => {
        // Determine category from stream name
        let streamCategory = 'other';
        let description = `Real-time ${meta.sensorType} data`;

        if (meta.streamId.includes('temp') || meta.streamId.includes('setpt')) {
          streamCategory = 'temperature';
          description = `Temperature sensor: ${meta.streamId}`;
        } else if (meta.streamId.includes('heat') || meta.streamId.includes('cool')) {
          streamCategory = 'valve';
          description = `Valve position: ${meta.streamId}`;
        } else if (meta.streamId.includes('fan')) {
          streamCategory = 'fan';
          description = `BINARY fan state (0=off, 1=on): ${meta.streamId}. Show as On/Off status.`;
        } else if (meta.streamId.includes('occup')) {
          streamCategory = 'occupancy';
          description = `BINARY occupancy sensor (0=vacant, 1=occupied): ${meta.streamId}. NOT a people counter! Show as Occupied/Vacant status, not numbers.`;
        } else if (meta.streamId.includes('status') || meta.streamId.includes('parsed')) {
          streamCategory = 'status';
          description = `System status: ${meta.streamId}`;
        }

        // Determine value type and range
        let valueType = 'continuous'; // Default
        let valueRange = null;

        if (streamCategory === 'occupancy' || streamCategory === 'fan') {
          valueType = 'binary';
          valueRange = { min: 0, max: 1, values: [0, 1] };
        } else if (meta.streamId.includes('output')) {
          valueType = 'percentage';
          valueRange = { min: 0, max: 100, unit: '%' };
        } else if (streamCategory === 'temperature') {
          valueType = 'continuous';
          valueRange = { min: 15, max: 30, unit: '°C' };
        }

        return {
          id: meta.streamId,
          name: meta.streamId.replace(/-/g, ' ').replace(/fcu /i, 'FCU-').toUpperCase(),
          category: streamCategory,
          url: "/api/telemetry/stream",
          requiredParams: [],
          optionalParams: {
            streamId: meta.streamId,
            intervalMs: 5000,
            maxMs: 25000
          },
          eventType: "tick",
          dataFormat: {
            sensorId: "string",
            sensorType: meta.sensorType,
            ts: "ISO datetime string",
            value: "number",
            valueType: valueType,
            valueRange: valueRange,
            unit: meta.unit
          },
          sampleUrl: `/api/telemetry/stream?streamId=${meta.streamId}&intervalMs=5000`,
          description,
          metadata: {
            firstSeen: meta.firstSeen,
            lastSeen: meta.lastSeen,
            totalPoints: meta.totalPoints,
            samplingRate: meta.averageSamplingRate
          }
        };
      });

      // Filter by category if requested
      const filteredStreams = category
        ? streams.filter(s => s.category === category.toLowerCase())
        : streams;

      console.log(`[listStreamsTool] Returning ${filteredStreams.length} streams (category: ${category || 'all'})`);
      console.log("[listStreamsTool] Stream IDs:", filteredStreams.map(s => s.id).join(', '));

      // Send streams to client for display
      dataStream.write({
        type: "data-streamsList",
        data: {
          streams: filteredStreams,
          totalCount: filteredStreams.length,
          category: category || "all"
        },
        transient: true,
      });

      return {
        streams: filteredStreams,
        totalCount: filteredStreams.length,
        totalAvailable: streams.length,
        categories: Array.from(new Set(streams.map(s => s.category))),
        note: "Dynamically discovered from database - real FCU-01_04 data streams"
      };
    }
  });
}