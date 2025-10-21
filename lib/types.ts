import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  v0Card: { id: string; html: string };
  v0ScriptStart: { cardId: string; script: string };
  v0ScriptError: { cardId: string; code: string; message: string; details?: Record<string, unknown> };
  v0ScriptLog: { cardId: string; args: any[] };
  streamsList: { streams: any[]; totalCount: number; category: string };
  telemetryShow: { sensorId: string; personaName?: string };
  'reasoning-step': {
    step: number;
    totalSteps: number;
    reasoning: string;
    finishReason: string;
    toolCount: number;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    timestamp: string; // ISO string
  };
  'tool-reasoning': {
    step: number;
    toolName: string;
    toolCategory: string;
    reasoning: string;
    parameters: Record<string, any>;
    timestamp: string; // ISO string
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

