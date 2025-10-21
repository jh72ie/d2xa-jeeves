export type ScriptTarget = { slotId?: string; selector?: string };

export type ScriptSubscribeArgs = {
  id: string;        // subscription key (unique within the script)
  url: string;       // SSE URL, e.g., /api/telemetry/stream?streamId=fcu-201-spacetemp
  event?: string;    // SSE event name, default "tick"
};

export type ScriptAPI = {
  // Render helpers
  postText(target: ScriptTarget, text: string): void;
  replaceSlot(target: ScriptTarget, html: string): void;
  setAttrs(target: ScriptTarget, attrs: Record<string, string | number | null | undefined>): void;
  setCSSVars(vars: Record<string, string | number>): void;

  // Streaming
  subscribe(args: ScriptSubscribeArgs): void;
  unsubscribe(id: string): void;

  // Event handling registration inside the worker
  on(id: string, handler: (payload: any) => void): void;
  off(id: string): void;

  // Logging
  log(...args: any[]): void;
  error(message: string, details?: Record<string, any>): void;
};

// The script must default-export a function that receives the API and returns optional cleanup.
export type DashboardScriptEntry = (api: ScriptAPI) => void | (() => void);
