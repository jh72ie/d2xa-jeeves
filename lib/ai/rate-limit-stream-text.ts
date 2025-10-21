/**
 * Rate Limit Enhanced StreamText - Drop-in replacement for AI SDK streamText with rate limiting
 */

import { streamText as originalStreamText, StreamTextResult } from 'ai';
import { globalRateLimitWrapper } from './rate-limit-wrapper';
import { globalTokenEstimator } from './token-estimator';

export interface RateLimitStreamTextOptions {
  // All original streamText options
  model: any;
  messages: any[];
  tools?: any;
  stopWhen?: any;  // Use stepCountIs(n) to control multiple tool call rounds
  experimental_activeTools?: string[];
  experimental_transform?: any;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  onStepFinish?: (params: {
    toolCalls: any[];
    toolResults: any[];
    text: string;
    usage: any;
    finishReason: string;
  }) => Promise<void>;
  experimental_telemetry?: {
    isEnabled: boolean;
    functionId: string;
  };
  onFinish?: (params: {
    usage: any;
    finishReason: string;
    response: any;
    toolCalls: any[];
    toolResults: any[];
  }) => Promise<void>;

  // Rate limiting specific options
  rateLimitOptions?: {
    maxRetries?: number;
    enableAutoRetry?: boolean;
    estimatedTokens?: number;
    context?: string;
  };
}

/**
 * Enhanced streamText with automatic rate limit handling
 */
export async function rateLimitStreamText(
  options: RateLimitStreamTextOptions
): Promise<StreamTextResult<any, any>> {
  const {
    rateLimitOptions = {},
    ...streamTextOptions
  } = options;

  const {
    maxRetries = 3,
    enableAutoRetry = true,
    estimatedTokens,
    context = 'AI Analysis'
  } = rateLimitOptions;

  // Estimate tokens if not provided
  const tokenEstimate = estimatedTokens || globalTokenEstimator.estimateRequestTokens(
    options.messages,
    options.experimental_activeTools || [],
    {}
  ).estimatedTokens;

  console.log(`[RateLimitStreamText] Starting ${context} with estimated ${tokenEstimate} tokens`);

  // Use rate limit wrapper for automatic retry
  return globalRateLimitWrapper.executeWithRetry(
    async () => {
      console.log(`[RateLimitStreamText] Executing streamText for ${context}`);

      const result = await originalStreamText(streamTextOptions);

      // Extract rate limit headers from the response if available
      try {
        const response = await result.response;
        if (response?.headers) {
          console.log('[RateLimitStreamText] Updating rate limits from response headers');
          globalRateLimitWrapper.updateFromHeaders(response.headers);
        }
      } catch (error) {
        console.warn('[RateLimitStreamText] Failed to extract headers:', error);
      }

      return result;
    },
    {
      operation: context,
      estimatedTokens: tokenEstimate
    },
    {
      maxRetries: enableAutoRetry ? maxRetries : 0
    }
  );
}

/**
 * Create a rate-limit aware version of streamText with preset context
 */
export function createRateLimitStreamText(defaultContext: string) {
  return (options: RateLimitStreamTextOptions) => {
    return rateLimitStreamText({
      ...options,
      rateLimitOptions: {
        context: defaultContext,
        ...options.rateLimitOptions
      }
    });
  };
}

/**
 * Utility to check if a request would exceed rate limits before execution
 */
export function checkRateLimitBeforeRequest(
  messages: any[],
  tools: string[] = [],
  bufferTokens = 500
): {
  canProceed: boolean;
  estimatedTokens: number;
  currentRemaining: number;
  waitTime?: number;
  recommendation: string;
} {
  const estimate = globalTokenEstimator.estimateRequestTokens(messages, tools, {});
  const currentLimits = globalRateLimitWrapper.getCurrentLimits();
  const canProceed = !globalRateLimitWrapper.checkIfNearLimit(estimate.estimatedTokens, bufferTokens);

  let recommendation = 'proceed';
  let waitTime: number | undefined;

  if (!canProceed) {
    waitTime = globalRateLimitWrapper.getWaitTime();

    if (estimate.estimatedTokens > currentLimits.inputTokensRemaining) {
      recommendation = 'wait_for_reset';
    } else {
      recommendation = 'reduce_scope';
    }
  }

  return {
    canProceed,
    estimatedTokens: estimate.estimatedTokens,
    currentRemaining: currentLimits.inputTokensRemaining,
    waitTime,
    recommendation
  };
}