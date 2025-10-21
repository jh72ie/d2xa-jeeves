"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { PublishedDashboardCard } from "./published-dashboard-card";
import { DashboardCardWithPublish } from "./dashboard-card-with-publish";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";
import { V0Card } from "@/components/v0-card";
import { V0CardScriptRunner } from "@/components/v0card-script-runner";
import { TelemetryPanel } from "@/components/telemetry-panel";
import { LiveDashboard } from "@/components/live-dashboard";
import { useAnalysisStream } from "@/hooks/use-analysis-stream";

type Card = { id: string; html: string };
type Start = { cardId: string; script: string };
type Err = { cardId: string; code: string; message: string; details?: Record<string, unknown> };
type Log = { cardId: string; args: any[] };

type TelemetryConfig = { sensorId: string; personaName?: string } | null;

export function V0ScriptDashboards({ uiParts }: { uiParts: Array<any> }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [starts, setStarts] = useState<Record<string, Start>>({});
  const [errors, setErrors] = useState<Err[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [streamsData, setStreamsData] = useState<any>(null);
  const [publishedDashboards, setPublishedDashboards] = useState<any[]>([]);

  useEffect(() => {
    for (const p of uiParts) {
      if (p.type === "data-v0Card") setCards((prev) => [...prev, p.data]);
      if (p.type === "data-v0ScriptStart") setStarts((prev) => ({ ...prev, [p.data.cardId]: p.data }));
      if (p.type === "data-v0ScriptError") setErrors((prev) => [...prev, p.data]);
      if (p.type === "data-v0ScriptLog") setLogs((prev) => [...prev, p.data]);
      if (p.type === "data-streamsList") setStreamsData(p.data);
      if (p.type === "data-dashboard-published") setPublishedDashboards((prev) => [...prev, p.data]);
    }
  }, [uiParts]);

  return (
    <div className="mx-auto w-full max-w-4xl px-2 md:px-4">
      {errors.map((e, i) => (
        <div key={i} className="mb-2 rounded border border-red-700 bg-red-950/40 p-2 text-sm text-red-300">
          [{e.code}] {e.message}
        </div>
      ))}

      {streamsData && (
        <div className="mb-3 rounded border border-blue-700 bg-blue-950/40 p-3 text-sm text-blue-300">
          <h3 className="font-medium text-blue-200">📡 Available Streams ({streamsData.totalCount})</h3>
          {streamsData.streams.map((stream: any, i: number) => (
            <div key={i} className="mt-2 pl-4 border-l-2 border-blue-800">
              <div className="font-medium text-blue-100">{stream.name}</div>
              <div className="text-xs text-blue-400">
                {stream.sampleUrl} • Event: {stream.eventType}
              </div>
              <div className="text-xs text-blue-500">{stream.description}</div>
            </div>
          ))}
        </div>
      )}

      {publishedDashboards.map((dashboard: any, i: number) => (
        <div key={i} className="mb-3">
          <PublishedDashboardCard
            url={dashboard.url}
            slug={dashboard.slug}
            title={dashboard.title}
            expiresAt={dashboard.expiresAt}
            maxViews={dashboard.maxViews}
            hasPassword={dashboard.hasPassword}
          />
        </div>
      ))}

      {cards.map((c) => (
        <DashboardCardWithPublish
          key={c.id}
          cardId={c.id}
          html={c.html}
          script={starts[c.id]?.script || ''}
          onPublish={async (options) => {
            try {
              const response = await fetch('/api/dashboards/publish', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ...options,
                  streams: [], // TODO: Extract from script
                }),
              });

              if (!response.ok) {
                throw new Error('Failed to publish dashboard');
              }

              const result = await response.json();

              // Copy URL to clipboard
              await navigator.clipboard.writeText(result.url);

              // Show success message
              toast({
                type: 'success',
                description: `✅ Dashboard published! Link copied to clipboard: ${result.url}`,
              });
            } catch (error) {
              console.error('Failed to publish:', error);
              toast({
                type: 'error',
                description: `❌ Failed to publish: ${error instanceof Error ? error.message : 'Unknown error'}`,
              });
            }
          }}
        />
      ))}
      {logs.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-zinc-400">Script logs</summary>
          <pre className="mt-2 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-200">
            {logs.map((l, i) => `[${l.cardId}] ${JSON.stringify(l.args)}\n`)}
          </pre>
        </details>
      )}
    </div>
  );
}

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  const { addReasoningStep, addToolReasoning } = useAnalysisStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const [v0Cards, setV0Cards] = useState<Array<{ id: string; html: string }>>([]);
  const [v0Scripts, setV0Scripts] = useState<Map<string, string>>(new Map());
  const [telemetryConfig, setTelemetryConfig] = useState<TelemetryConfig>(null);
  const currentModelIdRef = useRef(currentModelId);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // Persona support (optional). Seed from URL (?persona=Alex).
  const searchParams = useSearchParams();
  const personaFromUrl = searchParams.get("persona") ?? undefined;
  const [personaName, setPersonaName] = useState<string | undefined>(personaFromUrl);
  const personaRef = useRef<string | undefined>(personaName);
  useEffect(() => {
    personaRef.current = personaName;
  }, [personaName]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            // Send persona to server for personalization/logging
            personaName: personaRef.current,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      // Preserve your existing accumulation if present
      setDataStream((ds) => (ds ? [...ds, dataPart] : [dataPart]));

      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }

      if (dataPart.type === "data-v0Card") {
        setV0Cards((prev) => [...prev, dataPart.data]);
      }

      // CRITICAL: Handle script start events
      if (dataPart.type === 'data-v0ScriptStart' && dataPart.data) {
        const { cardId, script } = dataPart.data;
        console.log('[Chat] Deploying script for card:', cardId);

        // Update the v0Scripts state for rendering
        setV0Scripts((prev) => new Map(prev).set(cardId, script));
      }

      if (dataPart.type === "data-telemetryShow") {
        setTelemetryConfig({
          sensorId: dataPart.data.sensorId,
          personaName: dataPart.data.personaName,
        });
      }

      // Handle reasoning step events
      if (dataPart.type === "data-reasoning-step") {
        addReasoningStep(dataPart.data);
      }

      // Handle tool reasoning events
      if (dataPart.type === "data-tool-reasoning") {
        addToolReasoning(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        if (error.message?.includes("AI Gateway requires a valid credit card")) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const query = searchParams.get("query");
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const onV0CardEvent = useCallback(
    (evt: { id: string; type: string; detail: Record<string, any> }) => {
      const text = [
        "ui_event:v0card",
        `id:${evt.id}`,
        `type:${evt.type}`,
        `payload:${JSON.stringify(evt.detail)}`,
      ].join(" ");
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text }],
      });
    },
    [sendMessage]
  );

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        {/* Main scrollable content area */}
        <div className="flex-1 overflow-y-auto pb-20"> {/* Added pb-20 for input area */}
          {/* Inline persona input (optional) */}
          <div className="mx-auto mb-2 w-full max-w-4xl px-2 md:px-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Persona (for personalization/logs; optional):
              </span>
              <input
                value={personaName ?? ""}
                onChange={(e) => setPersonaName(e.target.value.trim() || undefined)}
                placeholder="e.g., Alex"
                className="h-8 w-48 rounded border bg-background px-2"
                maxLength={64}
              />
            </div>
          </div>

          <Messages
            chatId={id}
            isArtifactVisible={isArtifactVisible}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={initialChatModel}
            setMessages={setMessages}
            status={status}
            votes={votes}
          />

          {/* V0CARDS WITH SCRIPTS - CRITICAL SECTION */}
          {v0Cards.length > 0 && (
            <div className="mx-auto w-full max-w-4xl px-2 md:px-4 pb-4">
              <div className="space-y-4">
                {v0Cards.map((c) => (
                  <div key={c.id} className="relative z-0"> {/* Added z-0 */}
                    <V0Card
                      id={c.id}
                      html={c.html}
                      // onEvent={onV0CardEvent} // Uncomment if needed
                    />
                    {/* RENDER SCRIPT RUNNER FOR LIVE DATA */}
                    {v0Scripts.has(c.id) && (
                      <V0CardScriptRunner
                        cardId={c.id}
                        script={v0Scripts.get(c.id)!}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Telemetry Panel if configured */}
          {telemetryConfig && (
            <div className="mx-auto w-full max-w-4xl px-2 md:px-4 pb-4">
              <TelemetryPanel
                sensorId={telemetryConfig.sensorId}
                personaName={telemetryConfig.personaName}
              />
            </div>
          )}
        </div>

        {/* Input area - sticky at bottom */}
        {!isReadonly && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-background border-t">
            <div className="mx-auto w-full max-w-4xl px-2 pb-3 pt-2 md:px-4 md:pb-4">
              <MultimodalInput
                attachments={attachments}
                chatId={id}
                input={input}
                messages={messages}
                onModelChange={setCurrentModelId}
                selectedModelId={currentModelId}
                selectedVisibilityType={visibilityType}
                sendMessage={sendMessage}
                setAttachments={setAttachments}
                setInput={setInput}
                setMessages={setMessages}
                status={status}
                stop={stop}
                usage={usage}
              />
            </div>
          </div>
        )}
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}