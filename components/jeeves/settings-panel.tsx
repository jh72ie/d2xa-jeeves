"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toast";
import type { JeevesState } from "@/lib/db/schema";
import { useRouter } from "next/navigation";

interface SettingsPanelProps {
  initialState: JeevesState | null;
}

export function SettingsPanel({ initialState }: SettingsPanelProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialState?.enabled || false);
  const [ingestionEnabled, setIngestionEnabled] = useState(initialState?.ingestionEnabled ?? true);
  const [interval, setInterval] = useState(initialState?.analysisInterval || "1hour");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/jeeves/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          ingestionEnabled,
          analysisInterval: interval,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      toast({
        type: "success",
        description: "Settings saved successfully"
      });
      router.refresh();
    } catch (error) {
      console.error("Settings save error:", error);
      toast({
        type: "error",
        description: "Failed to save settings"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeNow = async () => {
    if (!enabled) {
      toast({
        type: "error",
        description: "Enable Jeeves first"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      toast({
        type: "success",
        description: "Starting analysis... This may take a minute"
      });

      const response = await fetch("/api/jeeves/analyze", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const result = await response.json();

      if (result.success) {
        toast({
          type: "success",
          description: result.message || `Analysis complete! Found ${result.discoveriesCount || 0} discoveries.`
        });
      } else {
        toast({
          type: "error",
          description: result.message || "Analysis completed with errors. Check Activity Log."
        });
      }

      // Refresh page to show new discoveries
      router.refresh();
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        type: "error",
        description: "Analysis failed. Check console for details."
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>⚙️ Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <Label htmlFor="enabled" className="cursor-pointer">
            Enable Jeeves
          </Label>
          <Switch
            id="enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* FCU Data Ingestion Control */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ingestion" className="cursor-pointer">
              FCU Data Ingestion
            </Label>
            <p className="text-xs text-muted-foreground">
              Control MQTT data stream processing
            </p>
          </div>
          <Switch
            id="ingestion"
            checked={ingestionEnabled}
            onCheckedChange={setIngestionEnabled}
          />
        </div>

        {/* Analysis Interval */}
        <div className="space-y-2">
          <Label>Analysis Interval</Label>
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1hour">Every 1 hour</SelectItem>
              <SelectItem value="3hour">Every 3 hours</SelectItem>
              <SelectItem value="6hour">Every 6 hours</SelectItem>
              <SelectItem value="24hour">Once a day (24 hours)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How often Jeeves analyzes streams automatically
          </p>
        </div>

        {/* Monitored Streams Info */}
        <div className="space-y-2">
          <Label>Monitored Streams</Label>
          <div className="text-sm text-muted-foreground">
            {initialState?.monitoredStreams && Array.isArray(initialState.monitoredStreams) ? (
              <div className="flex flex-wrap gap-1">
                {initialState.monitoredStreams.map((stream: string) => (
                  <span
                    key={stream}
                    className="px-2 py-1 bg-muted rounded text-xs"
                  >
                    {stream}
                  </span>
                ))}
              </div>
            ) : (
              <p>No streams configured</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>

          <Button
            onClick={handleAnalyzeNow}
            disabled={isAnalyzing || !enabled}
            variant="secondary"
            className="flex-1"
          >
            {isAnalyzing ? "Analyzing..." : "🔍 Analyze Now"}
          </Button>
        </div>

        {!enabled && (
          <p className="text-xs text-muted-foreground text-center">
            Enable Jeeves to use manual analysis
          </p>
        )}
      </CardContent>
    </Card>
  );
}
