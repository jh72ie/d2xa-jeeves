import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        // Main chat model
        "chat-model": anthropic("claude-sonnet-4-5-20250929"),

        // Reasoning model (middleware extracts reasoning content if present)
        "chat-model-reasoning": wrapLanguageModel({
          model: anthropic("claude-sonnet-4-5-20250929"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),

        // Title generation
        "title-model": anthropic("claude-sonnet-4-5-20250929"),

        // Artifact generation
        "artifact-model": anthropic("claude-sonnet-4-5-20250929"),
      },
    });

// Alternative configuration
export const alternativeProvider = isTestEnvironment
  ? myProvider
  : customProvider({
      languageModels: {
        "chat-model": anthropic("claude-sonnet-4-5-20250929"),
        "chat-model-reasoning": wrapLanguageModel({
          model: anthropic("claude-sonnet-4-5-20250929"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": anthropic("claude-sonnet-4-5-20250929"),
        "artifact-model": anthropic("claude-sonnet-4-5-20250929"),
      },
    });

// Configuration with a custom Anthropic client (apiKey/baseURL)
export const customAnthropicProvider = isTestEnvironment
  ? myProvider
  : (() => {
      const customAnthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL,
      });

      return customProvider({
        languageModels: {
          "chat-model": customAnthropic("claude-sonnet-4-5-20250929"),
          "chat-model-reasoning": wrapLanguageModel({
            model: customAnthropic("claude-opus-4-20250514"),
            middleware: extractReasoningMiddleware({ tagName: "think" }),
          }),
          "title-model": customAnthropic("claude-sonnet-4-5-20250929"),
          "artifact-model": customAnthropic("claude-opus-4-20250514"),
        },
      });
    })();
