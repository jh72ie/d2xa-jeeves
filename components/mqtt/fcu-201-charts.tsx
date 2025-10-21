"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface StreamData {
  streamId: string;
  data: Array<{
    timestamp: string;
    value: number;
  }>;
}

interface CategorizedData {
  temperature: StreamData[];
  valves: StreamData[];
  fan: StreamData[];
  occupancy: StreamData[];
  status: StreamData[];
  other: StreamData[];
}

const COLORS = [
  '#8884d8', // blue
  '#82ca9d', // green
  '#ff7300', // orange
  '#ff0000', // red
  '#8b00ff', // purple
  '#00bfff', // cyan
  '#ffd700', // gold
];

export function FCU201Charts() {
  const [data, setData] = useState<CategorizedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/telemetry/fcu-201');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch data');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.categorized);
        setLastUpdate(result.timestamp);
      }
    } catch (err: any) {
      console.error('[FCU-201 Charts] Fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll every 5 minutes (matches MQTT data arrival frequency)
  useEffect(() => {
    if (isPaused) return;

    fetchData();
    const interval = setInterval(fetchData, 300000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const renderChart = (title: string, streams: StreamData[], unit?: string) => {
    if (!streams || streams.length === 0) {
      return null;
    }

    // Combine all streams into single dataset for multi-line chart
    // Find all unique timestamps
    const timestampSet = new Set<string>();
    streams.forEach(stream => {
      stream.data.forEach(point => {
        timestampSet.add(point.timestamp);
      });
    });

    const timestamps = Array.from(timestampSet).sort();

    // Create data points with all streams
    const chartData = timestamps.map(timestamp => {
      const point: any = {
        timestamp: new Date(timestamp).toLocaleTimeString(),
        rawTimestamp: timestamp,
      };

      streams.forEach(stream => {
        const dataPoint = stream.data.find(d => d.timestamp === timestamp);
        if (dataPoint) {
          // Use short stream name for legend
          const shortName = stream.streamId.replace('fcu-201-', '').replace('parsed-', '');
          point[shortName] = dataPoint.value;
        }
      });

      return point;
    });

    // Take last 50 points for readability
    const displayData = chartData.slice(-50);

    return (
      <Card key={title}>
        <CardHeader>
          <CardTitle>{title} ({streams.length} streams)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={unit ? { value: unit, angle: -90, position: 'insideLeft' } : undefined}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {streams.map((stream, idx) => {
                const shortName = stream.streamId.replace('fcu-201-', '').replace('parsed-', '');
                return (
                  <Line
                    key={stream.streamId}
                    type="monotone"
                    dataKey={shortName}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-muted-foreground">
            <details>
              <summary className="cursor-pointer hover:text-foreground">
                Stream IDs
              </summary>
              <ul className="mt-2 pl-4 space-y-1">
                {streams.map(s => (
                  <li key={s.streamId} className="font-mono">
                    {s.streamId} ({s.data.length} points)
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              FCU Individual Field Monitoring
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                {isLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-red-500 mb-2">
              {error}
              <p className="text-xs mt-1">
                Make sure FCU data ingestion worker is running and has collected data.
              </p>
            </div>
          )}
          {lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Last update: {new Date(lastUpdate).toLocaleString()}
              <br />
              Polling every 5 minutes
            </div>
          )}
          {data && (
            <div className="mt-2 text-sm">
              <span className="font-semibold">Total streams: </span>
              {Object.values(data).reduce((sum, arr) => sum + arr.length, 0)}
            </div>
          )}
        </CardContent>
      </Card>

      {!data && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {isLoading ? (
              <p>Loading FCU-201 data...</p>
            ) : (
              <p>Waiting for data...</p>
            )}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {renderChart('🌡️ Temperature Metrics', data.temperature, '°C')}
          {renderChart('🔥❄️ Valve Outputs', data.valves, '%')}
          {renderChart('🌀 Fan Metrics', data.fan)}
          {renderChart('👤 Occupancy', data.occupancy)}
          {renderChart('⚠️ Status', data.status)}
          {data.other.length > 0 && renderChart('📊 Other Metrics', data.other)}
        </>
      )}
    </div>
  );
}
