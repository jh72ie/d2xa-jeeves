"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JeevesState } from "@/lib/db/schema";

interface StatusPanelProps {
  state: JeevesState | null;
}

export function StatusPanel({ state }: StatusPanelProps) {
  if (!state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⚠️ Jeeves Not Initialized</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Jeeves state not found in database
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  const getStatusColor = () => {
    if (!state.enabled) return "text-muted-foreground";
    return "text-green-600 dark:text-green-400";
  };

  const getStatusIcon = () => {
    if (!state.enabled) return "⏸️";
    return "▶️";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🎩 Jeeves Status</span>
          <Badge variant={state.enabled ? "default" : "secondary"}>
            {state.enabled ? "Active" : "Disabled"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Status</div>
            <div className={`font-medium flex items-center gap-2 ${getStatusColor()}`}>
              <span>{getStatusIcon()}</span>
              <span>{state.enabled ? "On Duty" : "Off Duty"}</span>
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Analysis Interval</div>
            <div className="font-medium">Every {state.analysisInterval}</div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Monitored Streams</div>
            <div className="font-medium">
              {Array.isArray(state.monitoredStreams)
                ? state.monitoredStreams.length
                : 0} streams
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Total Discoveries</div>
            <div className="font-medium">{state.totalDiscoveries}</div>
          </div>
        </div>

        <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Last Analysis:</span>
            <span>{formatDate(state.lastAnalysisAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Next Scheduled:</span>
            <span>{formatDate(state.nextAnalysisAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
