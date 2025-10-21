import { z } from "zod";
import { tool, type UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";

export function startTelemetryTool({
  dataStream,
  defaultSensorId,
  personaName,
}: {
  dataStream: UIMessageStreamWriter<ChatMessage>;
  defaultSensorId?: string;
  personaName?: string;
}) {
  return tool({
    description: "Request the UI to display the TelemetryPanel for a given sensor.",
    inputSchema: z.object({
      sensorId: z.string().optional(),
    }),
    execute: async ({ sensorId }) => {
      const sid = sensorId || defaultSensorId || "fcu-01_04-spacetemp";

      // Emit the custom, strongly-typed UI event
      dataStream.write({
        type: "data-telemetryShow",
        data: {
          sensorId: sid,
          personaName,
        },
        transient: true,
      });

      return { sensorId: sid, personaName };
    },
  });
}
