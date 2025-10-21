/**
 * MQTT Live Monitor - Real-time Charts Viewer
 *
 * Shows live MQTT data from HiveMQ broker with time-series charts
 * - FCU-201 individual field charts (from database)
 * - Live aggregate charts (from MQTT stream)
 */

import { MQTTLiveCharts } from "@/components/mqtt/mqtt-live-charts";
import { FCU201Charts } from "@/components/mqtt/fcu-201-charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MQTTMonitorPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          📡 MQTT Live Monitor
        </h1>
        <p className="text-muted-foreground mt-2">
          Real-time HVAC sensor data from Level 2 FCUs
        </p>
      </header>

      {/* Tabbed View */}
      <Tabs defaultValue="fcu-201" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fcu-201">FCU-201 Fields (Database)</TabsTrigger>
          <TabsTrigger value="aggregate">All FCUs (Live Stream)</TabsTrigger>
        </TabsList>

        <TabsContent value="fcu-201" className="mt-6">
          <FCU201Charts />
        </TabsContent>

        <TabsContent value="aggregate" className="mt-6">
          <MQTTLiveCharts />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const metadata = {
  title: "MQTT Monitor",
  description: "Live HVAC sensor data monitoring",
};
