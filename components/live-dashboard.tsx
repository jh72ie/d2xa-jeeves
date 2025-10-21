"use client";

import { useState, useEffect } from "react";
import { V0Card } from "@/components/v0-card";
import { V0CardScriptRunner } from "@/components/v0card-script-runner";

interface LiveDashboardProps {
  html: string;
  script: string;
  onError?: (error: string) => void;
  onLog?: (message: string) => void;
}

export function LiveDashboard({ html, script, onError, onLog }: LiveDashboardProps) {
  const [cardId] = useState(() => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    console.log("[LiveDashboard] Generated cardId:", id);
    return id;
  });

  const [isScriptValid, setIsScriptValid] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[LiveDashboard] Initializing with:");
    console.log("[LiveDashboard] - HTML length:", html.length);
    console.log("[LiveDashboard] - Script length:", script.length);
    console.log("[LiveDashboard] - CardId:", cardId);

    // Validate script
    const hasExport = script.includes("export default") || script.includes("module.exports");
    const hasApiUsage = script.includes("api.subscribe") || script.includes("api.on");

    console.log("[LiveDashboard] Script validation:");
    console.log("[LiveDashboard] - Has export:", hasExport);
    console.log("[LiveDashboard] - Has API usage:", hasApiUsage);

    if (!hasExport) {
      const error = "Script missing export default function";
      console.error("[LiveDashboard] Validation error:", error);
      setValidationError(error);
      onError?.(error);
      return;
    }

    if (!hasApiUsage) {
      const error = "Script missing API usage (subscribe/on)";
      console.error("[LiveDashboard] Validation error:", error);
      setValidationError(error);
      onError?.(error);
      return;
    }

    console.log("[LiveDashboard] Script validation passed");
    setIsScriptValid(true);
    setValidationError(null);
    onLog?.(`Dashboard initialized with cardId: ${cardId}`);
  }, [html, script, cardId, onError, onLog]);

  useEffect(() => {
    // Listen for script errors and logs from the runner
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "data-v0ScriptError" && event.data?.data?.cardId === cardId) {
        const error = `[${event.data.data.code}] ${event.data.data.message}`;
        console.error("[LiveDashboard] Script error:", event.data.data);
        onError?.(error);
      }

      if (event.data?.type === "data-v0ScriptLog" && event.data?.data?.cardId === cardId) {
        const logMessage = event.data.data.args.join(" ");
        console.log("[LiveDashboard] Script log:", logMessage);
        onLog?.(logMessage);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [cardId, onError, onLog]);

  if (validationError) {
    return (
      <div className="dashboard-error border border-red-500 bg-red-50 p-4 rounded-md">
        <h3 className="text-red-700 font-medium">Dashboard Error</h3>
        <p className="text-red-600 text-sm mt-1">{validationError}</p>
        <details className="mt-2">
          <summary className="text-red-600 text-xs cursor-pointer">Script Preview</summary>
          <pre className="text-xs bg-red-100 p-2 mt-1 rounded overflow-x-auto">
            {script.substring(0, 500)}...
          </pre>
        </details>
      </div>
    );
  }

  if (!isScriptValid) {
    return (
      <div className="dashboard-loading border border-blue-500 bg-blue-50 p-4 rounded-md">
        <p className="text-blue-700">Validating dashboard script...</p>
      </div>
    );
  }

  console.log("[LiveDashboard] Rendering dashboard components");

  return (
    <div className="live-dashboard border border-green-500 bg-green-50 p-4 rounded-md">
      <div className="dashboard-header mb-2">
        <h3 className="text-green-700 font-medium text-sm">
          Live Dashboard (ID: {cardId.substring(0, 8)}...)
        </h3>
        <p className="text-green-600 text-xs">
          Status: Active • Script: {script.length} chars • HTML: {html.length} chars
        </p>
      </div>

      <div className="dashboard-content">
        <V0Card id={cardId} html={html} />
        <V0CardScriptRunner cardId={cardId} script={script} />
      </div>

      <div className="dashboard-debug mt-2 pt-2 border-t border-green-200">
        <details>
          <summary className="text-green-600 text-xs cursor-pointer">Debug Info</summary>
          <div className="mt-1 space-y-1">
            <div className="text-xs">
              <strong>Card ID:</strong> {cardId}
            </div>
            <div className="text-xs">
              <strong>Script Preview:</strong>
              <pre className="bg-green-100 p-2 mt-1 rounded overflow-x-auto text-xs">
                {script.substring(0, 300)}...
              </pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}