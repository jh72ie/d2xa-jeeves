"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "success" | "error" | "warning";
  message: string;
}

export function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/jeeves/activity-logs");
      if (response.ok) {
        const data = await response.json();
        const fetchedLogs = data.logs || [];
        setLogs(fetchedLogs);

        // Detect if Jeeves is currently processing
        // Look for "started" message without a corresponding "complete" message
        const hasStarted = fetchedLogs.some((log: LogEntry) =>
          log.message.includes("Jeeves analysis started")
        );
        const hasCompleted = fetchedLogs.some((log: LogEntry) =>
          log.message.includes("Complete:") // Matches both "🎩 Complete:" and "⏹️ Complete:" and "Analysis complete:"
        );

        setIsProcessing(hasStarted && !hasCompleted);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Refresh more frequently when processing (every 2 seconds), otherwise every 5 seconds
    const refreshInterval = isProcessing ? 2000 : 5000;
    const interval = (isExpanded || isProcessing) ? setInterval(fetchLogs, refreshInterval) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExpanded, isProcessing]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success": return "default";
      case "error": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            📋 Activity Log
            {isProcessing && (
              <span className="flex items-center gap-1 text-sm font-normal text-amber-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            )}
          </span>
          <Badge variant="outline">{logs.length} entries</Badge>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activity yet. Click "Analyze Now" to see logs.
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 text-sm border-b pb-2 last:border-0"
                >
                  <span className="text-xs text-muted-foreground min-w-[80px]" suppressHydrationWarning>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge variant={getLevelColor(log.level)} className="text-xs">
                    {log.level}
                  </Badge>
                  <span className="flex-1 font-mono text-xs break-all">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
