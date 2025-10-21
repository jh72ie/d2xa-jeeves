"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseMQTTMessage, getFCUHealthSummary, type FCUStatus } from "@/lib/mqtt/fcu-parser";

interface MQTTMessage {
  id: string;
  topic: string;
  payload: any;
  timestamp: string;
  receivedAt: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function MQTTLiveConsole() {
  const [fcuData, setFcuData] = useState<Record<string, FCUStatus>>({});
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedFCU, setSelectedFCU] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE stream with auto-reconnect
  useEffect(() => {
    if (isPaused) return;

    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      setStatus("connecting");
      setError(null);

      console.log(`[MQTT Console] Connecting (attempt ${reconnectCount + 1})...`);

      const eventSource = new EventSource("/api/mqtt/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[MQTT Console] Connected to stream");
        setStatus("connected");
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "message") {
            // Parse FCU data
            const parsed = parseMQTTMessage(data.payload);

            console.log("[MQTT Console] Parsed FCU data:", {
              totalFCUs: parsed.totalCount,
              faults: parsed.faultCount,
              timestamp: parsed.timestamp,
            });

            // Convert array to map
            const fcuMap: Record<string, FCUStatus> = {};
            for (const fcu of parsed.fcus) {
              fcuMap[fcu.id] = fcu;
            }

            setFcuData(fcuMap);
            setLastUpdate(data.timestamp);
            setMessageCount((prev) => prev + 1);
            setStatus("connected");
          } else if (data.type === "status") {
            console.log("[MQTT Console] Status update:", data);
          } else if (data.type === "ping") {
            // Keep-alive received
            console.log("[MQTT Console] Keep-alive ping");
          }
        } catch (err: any) {
          console.error("[MQTT Console] Failed to parse message:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("[MQTT Console] Stream error, will reconnect in 2s");
        eventSource.close();

        // Don't show error immediately - reconnect first
        setStatus("connecting");

        // Auto-reconnect after 2 seconds
        reconnectTimeout = setTimeout(() => {
          setReconnectCount((prev) => prev + 1);
          connect();
        }, 2000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [isPaused, reconnectCount]);

  const togglePause = () => {
    if (!isPaused && eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsPaused(!isPaused);
    if (isPaused) {
      // Reset reconnect count when resuming
      setReconnectCount((prev) => prev + 1);
    }
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
              <span className={`w-3 h-3 rounded-full ${getStatusColor(status)} animate-pulse`} />
              {getStatusText(status)}
              {reconnectCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  (reconnects: {reconnectCount})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
              >
                {isPaused ? "Resume" : "Pause"}
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
              Last update: {new Date(lastUpdate).toLocaleString()} | Messages: {messageCount}
              <br />
              <span className="text-orange-500">Note: Connection auto-reconnects every ~60s (Vercel timeout)</span>
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
                <p>Connecting to MQTT broker...</p>
              ) : status === "error" ? (
                <p className="text-red-500">Connection error - check console</p>
              ) : (
                <p>Waiting for messages...</p>
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
