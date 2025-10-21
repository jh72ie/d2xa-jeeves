import { geolocation, waitUntil } from "@vercel/functions";

// Configure maximum duration for Fluid Compute
export const maxDuration = 300; // 5 minutes
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { rateLimitStreamText, checkRateLimitBeforeRequest } from "@/lib/ai/rate-limit-stream-text";
import { globalRateLimitMonitor } from "@/lib/ai/rate-limit-monitor";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
// Resumable streams currently disabled
// import {
//   createResumableStreamContext,
//   type ResumableStreamContext,
// } from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { v0CardTool } from "@/lib/ai/tools/v0-card";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

// Persona/logging imports
import { ensurePersona, appendUserLog } from "@/lib/db/userlog-ops";
import { buildPersonalizedSystem, updatePersonaMemory } from "@/lib/ai/personalized-system";
import { appendUserLogTool } from "@/lib/ai/tools/append-user-log";
import { updatePersonaMemoryTool } from "@/lib/ai/tools/update-persona-memory";
import { startTelemetryTool } from "@/lib/ai/tools/start-telemetry";
import { getRecentAnomaliesTool, getTicksTool } from "@/lib/ai/tools/telemetry-query";
import { listStreamsTool } from "@/lib/ai/tools/list-streams";
import { claudeCodeTool } from "@/lib/ai/tools/claude-code";
import { publishDashboardTool } from "@/lib/ai/tools/publish-dashboard";

// Analysis transparency imports
import { getToolCategory, getToolPurpose, extractResultSummary, estimateRemainingTime, sanitizeParameters } from "@/lib/ai/analysis-helpers";

// Import comprehensive stream analysis tools (69 total)
import { streamAnalysisTools, streamAnalysisToolNames } from "@/lib/ai/tools/stream-analysis";
import { mathematicalFunctionTools, mathematicalFunctionToolNames } from "@/lib/ai/tools/mathematical-functions";
import { toolDiscoveryTools, toolDiscoveryToolNames } from "@/lib/ai/tools/tool-discovery";
import { workflowOrchestrationTools, workflowOrchestrationToolNames } from "@/lib/ai/tools/workflow-orchestration";

// Resumable streams currently disabled
// let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

// Resumable streams currently disabled
// export function getStreamContext() {
//   if (!globalStreamContext) {
//     try {
//       globalStreamContext = createResumableStreamContext({
//         waitUntil: after,
//       });
//     } catch (error: any) {
//       if (error.message.includes("REDIS_REDIS_URL")) {
//         console.log(
//           " > Resumable streams are disabled due to missing REDIS_REDIS_URL"
//         );
//       } else {
//         console.error(error);
//       }
//     }
//   }
//
//   return globalStreamContext;
// }

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error("[Chat API] Request validation failed:", error);
    if (error instanceof Error) {
      console.error("[Chat API] Error details:", error.message);
    }
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    // Gentle fix: remove overly strict inline typing to avoid mismatch
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      personaName,
    } = requestBody;

    // Guard to ensure message exists
    if (!message) {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    // Persona PoC: ensure persona record if provided (no cookies/auth coupling)
    if (personaName) {
      try {
        await ensurePersona(personaName);
      } catch (e) {
        console.warn("ensurePersona failed:", e);
      }
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();

    // Move non-critical operations to background to reduce response time
    waitUntil(
      Promise.all([
        // Optional: record an interaction line into persona logs (non-blocking)
        personaName ? appendUserLog({
          personaName,
          kind: "interaction",
          content: "User submitted a message.",
          meta: {
            chatId: id,
            model: selectedChatModel,
            parts: message.parts?.length ?? 0,
          },
        }).catch((e) => console.warn("appendUserLog(message) failed:", e)) : Promise.resolve(),

        // Create stream ID in background
        createStreamId({ streamId, chatId: id }).catch((e) => console.warn("createStreamId failed:", e))
      ])
    );

    // Build base system + persona memory/logs for personalization
    const baseSystem = systemPrompt({ selectedChatModel, requestHints });
    const system = await buildPersonalizedSystem({
      baseSystem,
      personaName,
    });

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // Move initial console logging to background for better performance
        waitUntil(
          Promise.resolve().then(() => {
            console.log("[CHAT ROUTE] Starting streamText execution");
            console.log("[CHAT ROUTE] Selected model:", selectedChatModel);
            console.log("[CHAT ROUTE] Message count:", uiMessages.length);
          })
        );

        // Analysis transparency tracking
        let stepCount = 0;
        const analysisStartTime = Date.now();

        // Determine analysis type based on user message
        const userMessage = uiMessages[uiMessages.length - 1]?.parts?.[0]?.text || '';
        const isDeepAnalysis = userMessage.toLowerCase().includes('deep') ||
                              userMessage.toLowerCase().includes('comprehensive') ||
                              userMessage.toLowerCase().includes('detailed');

        // Check if this would exceed rate limits
        const rateLimitCheck = checkRateLimitBeforeRequest(
          convertToModelMessages(uiMessages),
          [],
          500
        );

        console.log(`[CHAT ROUTE] Rate limit check:`, rateLimitCheck);

        let totalSteps = 20;

        // If rate limits are an issue, use chunked analysis
        if (!rateLimitCheck.canProceed || isDeepAnalysis) {
          console.log(`[CHAT ROUTE] Using chunked analysis approach`);
          totalSteps = 10; // More realistic for chunked approach
        }

        // Send analysis start event
        dataStream.write({
          type: "data-analysis-start",
          data: {
            timestamp: new Date().toISOString(),
            estimatedSteps: totalSteps
          }
        });

        // Set up rate limit event monitoring for this stream
        const rateLimitUnsubscribe = globalRateLimitMonitor.onRateLimitEvent((event) => {
          dataStream.write({
            type: "data-rate-limit-event",
            data: {
              type: event.type,
              context: event.context,
              waitTime: event.waitTime,
              estimatedWait: event.estimatedWait,
              currentLimits: event.currentLimits,
              timestamp: new Date().toISOString()
            }
          });
        });

        // Smart step limiting based on rate limits
        const maxSteps = !rateLimitCheck.canProceed ? 5 : totalSteps; // Reduce steps if rate limited

        if (!rateLimitCheck.canProceed) {
          console.log(`[CHAT ROUTE] Reducing analysis scope due to rate limits: ${maxSteps} steps max`);

          // Notify user of reduced scope
          dataStream.write({
            type: "data-analysis-notice",
            data: {
              type: 'rate_limit_reduction',
              message: 'Analysis scope reduced to ensure completion within rate limits',
              maxSteps: maxSteps,
              timestamp: new Date().toISOString()
            }
          });
        }

        const result = await rateLimitStreamText({
          model: myProvider.languageModel(selectedChatModel),
          system: !rateLimitCheck.canProceed
            ? system + "\n\nIMPORTANT: Due to rate limits, focus on the most essential analysis. Provide clear, actionable insights with the available tools."
            : system,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(maxSteps),
          rateLimitOptions: {
            context: !rateLimitCheck.canProceed ? 'Essential Analysis' : 'Deep AI Analysis',
            enableAutoRetry: true,
            maxRetries: 3
          },
          experimental_activeTools:
            selectedChatModel === "chat-model-reasoning"
              ? []
              : [
                  // Original tools
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                  "v0Card",
                  "appendUserLog",
                  "updatePersonaMemory",
                  "getRecentAnomalies",
                  "getTicks",
                  "listStreams",
                  "claudeCode",
                  "publishDashboard",

                  // Stream Analysis Tools (19 tools)
                  ...streamAnalysisToolNames,

                  // Mathematical Function Tools (42 tools)
                  ...mathematicalFunctionToolNames,

                  // Tool Discovery Tools (4 tools)
                  ...toolDiscoveryToolNames,

                  // Workflow Orchestration Tools (4 tools)
                  ...workflowOrchestrationToolNames,
                ] as any,
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            // Existing tools
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            v0Card: v0CardTool({ dataStream }),
            appendUserLog: appendUserLogTool({ personaName }),
            updatePersonaMemory: updatePersonaMemoryTool({ personaName }),
            //startTelemetry: startTelemetryTool({ dataStream, defaultSensorId: "temp-001", personaName }),
            getRecentAnomalies: getRecentAnomaliesTool,
            getTicks: getTicksTool,
            listStreams: listStreamsTool({ dataStream }),
            claudeCode: claudeCodeTool({ dataStream }),
            publishDashboard: publishDashboardTool({ dataStream }),

            // Stream Analysis Tools (19 high-level tools)
            ...streamAnalysisTools,

            // Mathematical Function Tools (42 functions)
            ...mathematicalFunctionTools,

            // Tool Discovery Tools (4 tools)
            ...toolDiscoveryTools,

            // Workflow Orchestration Tools (4 tools)
            ...workflowOrchestrationTools,
          },
          onStepFinish: async ({ toolCalls, toolResults, text, usage, finishReason }) => {
            stepCount++;

            // Move console logging to background for better performance
            waitUntil(
              Promise.resolve().then(() => {
                console.log(`[STEP FINISH] 🎯 Step ${stepCount}/${totalSteps} completed with finish reason: ${finishReason}`);
              })
            );

            // Send reasoning step event
            dataStream.write({
              type: "data-reasoning-step",
              data: {
                step: stepCount,
                totalSteps,
                reasoning: text || '',
                finishReason,
                toolCount: toolCalls?.length || 0,
                usage: usage ? {
                  inputTokens: usage.promptTokens || 0,
                  outputTokens: usage.completionTokens || 0,
                  totalTokens: usage.totalTokens || 0
                } : null,
                timestamp: new Date().toISOString()
              }
            });

            // Send tool call events
            if (toolCalls && toolCalls.length > 0) {
              for (const toolCall of toolCalls) {
                // Move tool call logging to background
                waitUntil(
                  Promise.resolve().then(() => {
                    console.log(`[STEP FINISH] 🔧 Tool called: ${toolCall.toolName}`);
                  })
                );

                // Send tool start event
                dataStream.write({
                  type: "data-analysis-tool-start",
                  data: {
                    step: stepCount,
                    toolName: toolCall.toolName,
                    toolCategory: getToolCategory(toolCall.toolName),
                    timestamp: new Date().toISOString()
                  }
                });

                // Send tool choice reasoning event
                dataStream.write({
                  type: "data-tool-reasoning",
                  data: {
                    step: stepCount,
                    toolName: toolCall.toolName,
                    toolCategory: getToolCategory(toolCall.toolName),
                    reasoning: `Selected ${toolCall.toolName} to ${getToolPurpose(toolCall.toolName)}`,
                    parameters: sanitizeParameters((toolCall as any).args || {}),
                    timestamp: new Date().toISOString()
                  }
                });

                // Send tool call event (for parameter tracking)
                dataStream.write({
                  type: "data-analysis-tool-call",
                  data: {
                    step: stepCount,
                    totalSteps,
                    toolName: toolCall.toolName,
                    toolCategory: getToolCategory(toolCall.toolName),
                    parameters: sanitizeParameters((toolCall as any).args || {}),
                    timestamp: new Date().toISOString()
                  }
                });
              }
            }

            // Send tool result events
            if (toolResults && toolResults.length > 0) {
              console.log(`[STEP FINISH] ✅ ${toolResults.length} tool results received`);

              for (const toolResult of toolResults) {
                const resultSummary = extractResultSummary(toolResult);
                const toolResultAny = toolResult as any;

                dataStream.write({
                  type: "data-analysis-tool-result",
                  data: {
                    step: stepCount,
                    toolName: toolResult.toolName,
                    duration: 0, // AI SDK doesn't provide execution time
                    success: !toolResultAny.error,
                    resultSummary,
                    error: toolResultAny.error ? String(toolResultAny.error) : undefined
                  }
                });

                // Handle claudeCode tool special case
                if (toolResult.toolName === "claudeCode" && toolResult.output) {
                  const result = toolResult.output as any;
                  dataStream.write({
                    type: "data-v0ScriptStart",
                    data: {
                      cardId: result.cardId,
                      script: result.script,
                    },
                  });
                  console.log(`[claudeCode] Script deployed for card: ${result.cardId}`);
                }
              }
            }

            // Send progress update
            const elapsedTime = Date.now() - analysisStartTime;
            const estimatedRemaining = estimateRemainingTime(stepCount, totalSteps, analysisStartTime);

            dataStream.write({
              type: "data-analysis-progress",
              data: {
                step: stepCount,
                totalSteps,
                elapsedTime,
                estimatedRemaining,
                percentComplete: Math.round((stepCount / totalSteps) * 100)
              }
            });

            // Move remaining console logging to background
            waitUntil(
              Promise.resolve().then(() => {
                if (text) {
                  console.log(`[STEP FINISH] 📝 Text generated: ${text.substring(0, 100)}...`);
                }

                if (usage) {
                  console.log(`[STEP FINISH] 📊 Tokens used: ${usage.totalTokens}`);
                }
              })
            );
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage, finishReason, response, toolCalls, toolResults }) => {
            const totalDuration = Date.now() - analysisStartTime;

            // Move console logging to background to reduce execution time
            waitUntil(
              Promise.resolve().then(() => {
                console.log(`[STREAM FINISH] 🏁 Finish reason: ${finishReason}`);
                console.log(`[STREAM FINISH] 📊 Token usage:`, usage);
                console.log(`[STREAM FINISH] 📝 Response available: ${response ? 'Yes' : 'No'}`);
                console.log(`[STREAM FINISH] ⏰ Completed at: ${new Date().toISOString()}`);
                console.log(`[STREAM FINISH] ⏱️ Total duration: ${totalDuration}ms`);
              })
            );

            // Send analysis complete event
            const toolsUsed = toolCalls?.map(call => call.toolName) || [];
            dataStream.write({
              type: "data-analysis-complete",
              data: {
                totalSteps: stepCount,
                totalDuration,
                success: finishReason !== 'error',
                toolsUsed: Array.from(new Set(toolsUsed)) // unique tool names
              }
            });

            // Move tool call logging to background
            waitUntil(
              Promise.resolve().then(() => {
                if (toolCalls && toolCalls.length > 0) {
                  console.log(`[STREAM FINISH] 🔧 Total tool calls made: ${toolCalls.length}`);
                  const toolSummary = toolCalls.reduce((acc: any, call) => {
                    acc[call.toolName] = (acc[call.toolName] || 0) + 1;
                    return acc;
                  }, {});
                  console.log(`[STREAM FINISH] 📈 Tool call summary:`, toolSummary);
                }
              })
            );

            // Original onFinish logic
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId || !providers) {
                finalMergedUsage = usage;
                dataStream.write({ type: "data-usage", data: finalMergedUsage });
              } else {
                const summary = getUsage({ modelId, usage, providers });
                finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
                dataStream.write({ type: "data-usage", data: finalMergedUsage });
              }
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }

            // Move non-critical operations to background
            waitUntil(
              Promise.all([
                // Optional: record assistant finished interaction (non-blocking)
                personaName ? appendUserLog({
                  personaName,
                  kind: "interaction",
                  content: "Assistant finished streaming a response.",
                  meta: { chatId: id, model: selectedChatModel },
                }).catch((e) =>
                  console.warn("appendUserLog(assistant_finished) failed:", e)
                ) : Promise.resolve(),

                // Periodically update persona memory (every ~10 interactions)
                // Use random chance to avoid overwhelming the system
                (personaName && Math.random() < 0.1) ? updatePersonaMemory(personaName).catch((e) =>
                  console.warn("updatePersonaMemory failed:", e)
                ) : Promise.resolve()
              ])
            );

            // Clean up rate limit event subscription
            try {
              rateLimitUnsubscribe();
            } catch (error) {
              console.warn('[Chat API] Failed to unsubscribe from rate limit events:', error);
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    // Get current rate limit status for headers
    const currentLimits = globalRateLimitMonitor.getCurrentLimits();

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
      headers: {
        'X-Rate-Limit-Input-Remaining': currentLimits.inputTokensRemaining.toString(),
        'X-Rate-Limit-Input-Limit': currentLimits.inputTokensLimit.toString(),
        'X-Rate-Limit-Requests-Remaining': currentLimits.requestsRemaining.toString(),
        'X-Rate-Limit-Requests-Limit': currentLimits.requestsLimit.toString(),
        'X-Rate-Limit-Last-Updated': new Date().toISOString(),
      }
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
