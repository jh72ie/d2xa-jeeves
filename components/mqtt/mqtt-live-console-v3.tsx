"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseMQTTMessage, getFCUHealthSummary, type FCUStatus } from "@/lib/mqtt/fcu-parser";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function MQTTLiveConsole() {
  const [fcuData, setFcuData] = useState<Record<string, FCUStatus>>({});
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedFCU, setSelectedFCU] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState(5000); // 5 seconds

  // Polling function
  const fetchLatestData = async () => {
    try {
      setStatus("connecting");
      const response = await fetch('/api/mqtt/latest');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch data');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Parse FCU data
        const parsed = parseMQTTMessage(result.data.payload);

        console.log("[MQTT Console] Fetched FCU data:", {
          totalFCUs: parsed.totalCount,
          faults: parsed.faultCount,
          timestamp: parsed.timestamp,
          receivedAt: result.data.receivedAt,
        });

        // Convert array to map
        const fcuMap: Record<string, FCUStatus> = {};
        for (const fcu of parsed.fcus) {
          fcuMap[fcu.id] = fcu;
        }

        setFcuData(fcuMap);
        setLastUpdate(result.data.receivedAt);
        setMessageCount((prev) => prev + 1);
        setStatus("connected");
        setError(null);
      }
    } catch (err: any) {
      console.error("[MQTT Console] Fetch error:", err);
      setStatus("error");
      setError(err.message || "Failed to fetch data");
    }
  };

  // Poll on interval
  useEffect(() => {
    if (isPaused) return;

    // Fetch immediately
    fetchLatestData();

    // Then poll on interval
    const interval = setInterval(() => {
      fetchLatestData();
    }, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [isPaused, pollInterval]);

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const fcuList = Object.values(fcuData).sort((a, b) => {
    // Sort faults first, then by ID
    if (a.status !== 'ok' && b.status === 'ok') return -1;
    if (a.status === 'ok' && b.status !== 'ok') return 1;
    return a.id.localeCompare(b.id);
  });

  const summary = getFCUHealthSummary({
    timestamp: lastUpdate || '',
    version: '',
    fcus: fcuList,
    totalCount: fcuList.length,
    faultCount: fcuList.filter(f => f.status !== 'ok').length,
  });

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  const getFCUStatusBadge = (fcu: FCUStatus) => {
    if (fcu.status === 'down') {
      return <Badge variant="destructive">DOWN</Badge>;
    } else if (fcu.status === 'fault') {
      return <Badge variant="destructive">FAULT</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-600">OK</Badge>;
    }
  };

  const getFCUModeBadge = (fcu: FCUStatus) => {
    if (fcu.heatOutput && fcu.heatOutput > 0) {
      return <Badge variant="outline" className="bg-orange-100 text-orange-800">🔥 Heating {fcu.heatOutput.toFixed(0)}%</Badge>;
    } else if (fcu.coolOutput && fcu.coolOutput > 0) {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800">❄️ Cooling {fcu.coolOutput.toFixed(0)}%</Badge>;
    } else if (fcu.fanState?.toLowerCase().includes('off')) {
      return <Badge variant="outline" className="bg-gray-100">OFF</Badge>;
    } else {
      return <Badge variant="outline">IDLE</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
              {getStatusText(status)}
              <span className="text-sm font-normal text-muted-foreground">
                (polling every {pollInterval / 1000}s)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLatestData()}
                disabled={isPaused}
              >
                Refresh Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total FCUs</div>
              <div className="text-2xl font-bold">{summary.total}</div>
            </div>
            <div>
              <div className="text-muted-foreground">OK</div>
              <div className="text-2xl font-bold text-green-600">{summary.ok}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Faults</div>
              <div className="text-2xl font-bold text-red-600">{summary.fault + summary.down}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Temp</div>
              <div className="text-2xl font-bold">{summary.avgTemp.toFixed(1)}°C</div>
            </div>
          </div>
          {lastUpdate && (
            <div className="mt-4 text-xs text-muted-foreground">
              Last MQTT message: {new Date(lastUpdate).toLocaleString()} | Polls: {messageCount}
            </div>
          )}
          {error && (
            <div className="mt-2 text-sm text-red-500">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* FCU Grid */}
      <Card>
        <CardHeader>
          <CardTitle>FCUs ({fcuList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {fcuList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isPaused ? (
                <p>Paused - Click Resume to continue</p>
              ) : status === "connecting" ? (
                <p>Fetching data...</p>
              ) : status === "error" ? (
                <div>
                  <p className="text-red-500 mb-2">Connection error</p>
                  <p className="text-xs">{error}</p>
                  <p className="text-xs mt-2">Make sure Inngest dev server is running:<br/><code>npx inngest-cli@latest dev</code></p>
                </div>
              ) : (
                <p>Waiting for data...</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {fcuList.map((fcu) => (
                <div
                  key={fcu.id}
                  className={`border rounded-lg p-3 transition-all cursor-pointer hover:shadow-md ${
                    fcu.status !== 'ok' ? 'border-red-500 bg-red-50' : 'border-border hover:border-primary'
                  } ${selectedFCU === fcu.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedFCU(fcu.id === selectedFCU ? null : fcu.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-mono font-bold text-sm">{fcu.id}</div>
                    {getFCUStatusBadge(fcu)}
                  </div>

                  <div className="space-y-1 text-sm">
                    {fcu.spaceTemp !== undefined && !isNaN(fcu.spaceTemp) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Temp:</span>
                        <span className="font-semibold">{fcu.spaceTemp.toFixed(1)}°C</span>
                      </div>
                    )}
                    {fcu.userSetpoint !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Setpoint:</span>
                        <span>{fcu.userSetpoint.toFixed(1)}°C</span>
                      </div>
                    )}
                    <div className="mt-2">
                      {getFCUModeBadge(fcu)}
                    </div>
                  </div>

                  {fcu.faultDetails && (
                    <div className="mt-2 text-xs text-red-600 border-t pt-2">
                      {fcu.faultDetails}
                    </div>
                  )}

                  {selectedFCU === fcu.id && (
                    <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                      <div className="font-semibold mb-1">Raw Data:</div>
                      {Object.entries(fcu.rawData).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground truncate max-w-[60%]">{key}:</span>
                          <span className="font-mono text-xs">{String(value)}</span>
                        </div>
                      ))}
                      {Object.keys(fcu.rawData).length > 5 && (
                        <div className="text-muted-foreground">...{Object.keys(fcu.rawData).length - 5} more</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
