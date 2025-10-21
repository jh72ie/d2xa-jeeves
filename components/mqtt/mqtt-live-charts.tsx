"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseMQTTMessage, type FCUStatus } from "@/lib/mqtt/fcu-parser";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TimeSeriesDataPoint {
  timestamp: string;
  time: number; // Unix timestamp for sorting
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  avgSetpoint: number;
  avgHeatOutput: number;
  avgCoolOutput: number;
  totalHeating: number; // Count of units heating
  totalCooling: number; // Count of units cooling
  faultCount: number;
  totalFCUs: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const MAX_DATA_POINTS = 100; // Keep last 100 data points

function formatTimeAgo(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

export function MQTTLiveCharts() {
  const [historicalData, setHistoricalData] = useState<TimeSeriesDataPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messageCount, setMessageCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStats, setCurrentStats] = useState({
    totalFCUs: 0,
    okCount: 0,
    faultCount: 0,
    avgTemp: 0,
  });
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for "X seconds ago" display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll /api/mqtt/latest every 5 minutes (matches MQTT data arrival frequency)
  useEffect(() => {
    if (isPaused) return;

    let pollInterval: NodeJS.Timeout;

    const fetchLatestData = async () => {
      try {
        setStatus("connecting");

        const response = await fetch("/api/mqtt/latest");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setStatus("connected");

          const data = result.data;
          const parsed = parseMQTTMessage(data.payload);

          console.log("[MQTT Charts] Parsed FCU data:", {
            totalFCUs: parsed.totalCount,
            faults: parsed.faultCount,
            timestamp: parsed.timestamp,
            receivedAt: data.receivedAt,
          });

          // Calculate aggregated metrics
          const temps = parsed.fcus
            .map(f => f.Wall_Adjuster)
            .filter(t => t !== undefined && !isNaN(t)) as number[];

          const setpoints = parsed.fcus
            .map(f => f.Local_Setpoint || f.Effective_Setpoint)
            .filter(s => s !== undefined && !isNaN(s)) as number[];

          const heatOutputs = parsed.fcus
            .map(f => f.Heating_Valve_Position)
            .filter(h => h !== undefined && !isNaN(h) && h > 0) as number[];

          const coolOutputs = parsed.fcus
            .map(f => f.Cooling_Valve_Position)
            .filter(c => c !== undefined && !isNaN(c) && c > 0) as number[];

          const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
          const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
          const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;
          const avgSetpoint = setpoints.length > 0 ? setpoints.reduce((a, b) => a + b, 0) / setpoints.length : 0;
          const avgHeatOutput = heatOutputs.length > 0 ? heatOutputs.reduce((a, b) => a + b, 0) / heatOutputs.length : 0;
          const avgCoolOutput = coolOutputs.length > 0 ? coolOutputs.reduce((a, b) => a + b, 0) / coolOutputs.length : 0;

          const heatingCount = parsed.fcus.filter(f => f.heatOutput && f.heatOutput > 0).length;
          const coolingCount = parsed.fcus.filter(f => f.coolOutput && f.coolOutput > 0).length;

          // Use the ORIGINAL data timestamp from FCU
          const originalTimestamp = parsed.timestamp;

          // Only add to chart if this is a NEW timestamp
          setHistoricalData((prev) => {
            const lastDataPoint = prev[prev.length - 1];
            const newTime = new Date(originalTimestamp).getTime();

            // Skip if we already have this timestamp
            if (lastDataPoint && lastDataPoint.time === newTime) {
              return prev;
            }

            const dataPoint: TimeSeriesDataPoint = {
              timestamp: new Date(originalTimestamp).toLocaleTimeString(),
              time: newTime,
              avgTemp: Number(avgTemp.toFixed(1)),
              minTemp: Number(minTemp.toFixed(1)),
              maxTemp: Number(maxTemp.toFixed(1)),
              avgSetpoint: Number(avgSetpoint.toFixed(1)),
              avgHeatOutput: Number(avgHeatOutput.toFixed(1)),
              avgCoolOutput: Number(avgCoolOutput.toFixed(1)),
              totalHeating: heatingCount,
              totalCooling: coolingCount,
              faultCount: parsed.faultCount,
              totalFCUs: parsed.totalCount,
            };

            const updated = [...prev, dataPoint];
            return updated.slice(-MAX_DATA_POINTS);
          });

          // Update current stats
          setCurrentStats({
            totalFCUs: parsed.totalCount,
            okCount: parsed.totalCount - parsed.faultCount,
            faultCount: parsed.faultCount,
            avgTemp: avgTemp,
          });

          setLastUpdate(originalTimestamp);
          setLastReceivedAt(data.receivedAt); // When Inngest worker received it
          setMessageCount((prev) => prev + 1);
        } else {
          setStatus("error");
        }
      } catch (err: any) {
        console.error("[MQTT Charts] Failed to fetch data:", err);
        setStatus("error");
      }
    };

    // Fetch immediately
    fetchLatestData();

    // Then poll every 5 minutes (300 seconds)
    pollInterval = setInterval(fetchLatestData, 300000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isPaused]);

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const clearHistory = () => {
    setHistoricalData([]);
    setMessageCount(0);
  };

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

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${getStatusColor(status)} animate-pulse`} />
              {getStatusText(status)}
              <span className="text-xs text-muted-foreground">
                (polling every 5 min)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={togglePause}>
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button variant="outline" size="sm" onClick={clearHistory}>
                Clear History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total FCUs</div>
              <div className="text-2xl font-bold">{currentStats.totalFCUs}</div>
            </div>
            <div>
              <div className="text-muted-foreground">OK</div>
              <div className="text-2xl font-bold text-green-600">{currentStats.okCount}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Faults</div>
              <div className="text-2xl font-bold text-red-600">{currentStats.faultCount}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Temp</div>
              <div className="text-2xl font-bold">{currentStats.avgTemp.toFixed(1)}°C</div>
            </div>
            <div>
              <div className="text-muted-foreground">Data Points</div>
              <div className="text-2xl font-bold">{historicalData.length}</div>
            </div>
          </div>
          {(lastUpdate || lastReceivedAt) && (
            <div className="mt-4 text-xs space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className={`p-2 rounded border ${
                  lastReceivedAt && (currentTime - new Date(lastReceivedAt).getTime()) > 60 * 1000
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-blue-200 bg-blue-50'
                }`}>
                  <div className={`font-semibold ${
                    lastReceivedAt && (currentTime - new Date(lastReceivedAt).getTime()) > 60 * 1000
                      ? 'text-yellow-700'
                      : 'text-blue-700'
                  }`}>
                    📡 Last Received (Now)
                    {lastReceivedAt && (currentTime - new Date(lastReceivedAt).getTime()) > 60 * 1000 && (
                      <span className="ml-1">⚠️ NO NEW DATA</span>
                    )}
                  </div>
                  <div className={`mt-1 ${
                    lastReceivedAt && (currentTime - new Date(lastReceivedAt).getTime()) > 60 * 1000
                      ? 'text-yellow-900'
                      : 'text-blue-900'
                  }`}>
                    {lastReceivedAt ? (
                      <>
                        {new Date(lastReceivedAt).toLocaleString()}
                        <div className="text-[10px] opacity-70 mt-0.5">
                          {formatTimeAgo(currentTime - new Date(lastReceivedAt).getTime())}
                        </div>
                      </>
                    ) : (
                      "Waiting..."
                    )}
                  </div>
                </div>
                <div className={`p-2 rounded border ${
                  lastUpdate && (currentTime - new Date(lastUpdate).getTime()) > 5 * 60 * 1000
                    ? 'border-red-300 bg-red-50'
                    : 'border-orange-200 bg-orange-50'
                }`}>
                  <div className={`font-semibold ${
                    lastUpdate && (currentTime - new Date(lastUpdate).getTime()) > 5 * 60 * 1000
                      ? 'text-red-700'
                      : 'text-orange-700'
                  }`}>
                    🏢 FCU Data Timestamp
                    {lastUpdate && (currentTime - new Date(lastUpdate).getTime()) > 5 * 60 * 1000 && (
                      <span className="ml-1">⚠️ STALE</span>
                    )}
                  </div>
                  <div className={`mt-1 ${
                    lastUpdate && (currentTime - new Date(lastUpdate).getTime()) > 5 * 60 * 1000
                      ? 'text-red-900'
                      : 'text-orange-900'
                  }`}>
                    {lastUpdate ? (
                      <>
                        {new Date(lastUpdate).toLocaleString()}
                        <div className="text-[10px] opacity-70 mt-0.5">
                          {formatTimeAgo(currentTime - new Date(lastUpdate).getTime())}
                        </div>
                      </>
                    ) : (
                      "Waiting..."
                    )}
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold">Messages received:</span> {messageCount}
              </div>
              {lastUpdate && lastReceivedAt && (currentTime - new Date(lastUpdate).getTime()) > 5 * 60 * 1000 && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">
                  <div className="font-semibold">⚠️ Warning: FCU data is stale!</div>
                  <div className="text-xs mt-1">
                    The system is receiving MQTT messages, but the FCU device timestamps are {formatTimeAgo(currentTime - new Date(lastUpdate).getTime())}.
                    This means the FCU device itself may have stopped generating new data or is republishing old data.
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground italic">
                💡 "Last Received" shows when we got the data. "FCU Data Timestamp" shows when the device generated it.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Temperature Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Temperature Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {historicalData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isPaused ? (
                <p>Paused - Click Resume to continue</p>
              ) : status === "connecting" ? (
                <p>Connecting to MQTT broker...</p>
              ) : (
                <p>Waiting for data...</p>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 12 }}
                  label={{ value: '°C', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgTemp"
                  stroke="#8884d8"
                  name="Avg Temp"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="minTemp"
                  stroke="#82ca9d"
                  name="Min Temp"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="maxTemp"
                  stroke="#ff7300"
                  name="Max Temp"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="avgSetpoint"
                  stroke="#413ea0"
                  name="Avg Setpoint"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Heating/Cooling Output Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Heating & Cooling Output</CardTitle>
        </CardHeader>
        <CardContent>
          {historicalData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Waiting for data...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgHeatOutput"
                  stroke="#ff7300"
                  name="Avg Heat Output (%)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="avgCoolOutput"
                  stroke="#0088fe"
                  name="Avg Cool Output (%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Units Operating Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Active Units</CardTitle>
        </CardHeader>
        <CardContent>
          {historicalData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Waiting for data...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Units', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalHeating"
                  stroke="#ff7300"
                  name="Units Heating"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="totalCooling"
                  stroke="#0088fe"
                  name="Units Cooling"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="faultCount"
                  stroke="#ff0000"
                  name="Faults"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
