/**
 * Jeeves Rate Limit Handler
 *
 * Manages API rate limits with exponential backoff and token counting
 */

interface RateLimitState {
  inputTokensRemaining: number;
  inputTokensReset: Date;
  requestsRemaining: number;
  requestsReset: Date;
  lastRequestTime: number;
}

class JeevesRateLimitHandler {
  private state: RateLimitState = {
    inputTokensRemaining: 400000, // Tier 4: 400k tokens/minute (Claude Sonnet 4.x)
    inputTokensReset: new Date(),
    requestsRemaining: 2000,
    requestsReset: new Date(),
    lastRequestTime: 0,
  };

  /**
   * Update state from API response headers
   */
  updateFromHeaders(headers: Record<string, string>) {
    if (headers['anthropic-ratelimit-input-tokens-remaining']) {
      this.state.inputTokensRemaining = parseInt(headers['anthropic-ratelimit-input-tokens-remaining']);
    }
    if (headers['anthropic-ratelimit-input-tokens-reset']) {
      this.state.inputTokensReset = new Date(headers['anthropic-ratelimit-input-tokens-reset']);
    }
    if (headers['anthropic-ratelimit-requests-remaining']) {
      this.state.requestsRemaining = parseInt(headers['anthropic-ratelimit-requests-remaining']);
    }
    if (headers['anthropic-ratelimit-requests-reset']) {
      this.state.requestsReset = new Date(headers['anthropic-ratelimit-requests-reset']);
    }

    console.log('[RateLimit] Updated:', {
      inputTokensRemaining: this.state.inputTokensRemaining,
      resetIn: Math.round((this.state.inputTokensReset.getTime() - Date.now()) / 1000) + 's'
    });
  }

  /**
   * Calculate wait time needed before next request
   */
  getWaitTime(estimatedTokens = 10000): number {
    const now = Date.now();

    // Minimum time between requests (500ms to be safe)
    const timeSinceLastRequest = now - this.state.lastRequestTime;
    const minInterval = 500;
    if (timeSinceLastRequest < minInterval) {
      return minInterval - timeSinceLastRequest;
    }

    // Check if we need to wait for rate limit reset
    if (this.state.inputTokensRemaining < estimatedTokens) {
      const resetTime = this.state.inputTokensReset.getTime();
      const waitTime = Math.max(0, resetTime - now);
      console.log(`[RateLimit] Need to wait ${Math.round(waitTime / 1000)}s for token reset`);
      return waitTime;
    }

    // Check requests remaining
    if (this.state.requestsRemaining < 1) {
      const resetTime = this.state.requestsReset.getTime();
      const waitTime = Math.max(0, resetTime - now);
      console.log(`[RateLimit] Need to wait ${Math.round(waitTime / 1000)}s for request reset`);
      return waitTime;
    }

    return 0;
  }

  /**
   * Wait if necessary before making request
   */
  async waitIfNeeded(estimatedTokens = 10000): Promise<void> {
    const waitTime = this.getWaitTime(estimatedTokens);

    if (waitTime > 0) {
      console.log(`[RateLimit] ⏳ Waiting ${Math.round(waitTime / 1000)}s before request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.state.lastRequestTime = Date.now();
  }

  /**
   * Execute function with automatic retry on rate limit
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      estimatedTokens?: number;
      onRetry?: (attempt: number, waitTime: number) => void;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, estimatedTokens = 10000, onRetry } = options;

    console.log(`[RateLimit] executeWithRetry - maxRetries: ${maxRetries}, estimatedTokens: ${estimatedTokens}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[RateLimit] Attempt ${attempt}/${maxRetries}`);

      try {
        // Wait if needed before attempt
        await this.waitIfNeeded(estimatedTokens);

        // Execute function
        console.log(`[RateLimit] Executing function...`);
        const result = await fn();
        console.log(`[RateLimit] ✓ Function executed successfully`);
        return result;

      } catch (error: any) {
        console.error(`[RateLimit] ❌ Error on attempt ${attempt}/${maxRetries}`);
        console.error(`[RateLimit] Error type:`, error.constructor?.name);
        console.error(`[RateLimit] Error message:`, error.message);

        const isRateLimitError =
          error?.statusCode === 429 ||
          error?.message?.includes('rate limit') ||
          error?.lastError?.statusCode === 429;

        console.log(`[RateLimit] Is rate limit error:`, isRateLimitError);

        if (!isRateLimitError || attempt === maxRetries) {
          console.error(`[RateLimit] Throwing error (isRateLimit: ${isRateLimitError}, finalAttempt: ${attempt === maxRetries})`);
          throw error;
        }

        // Extract wait time from error
        let waitTime = 60000; // Default 60 seconds

        if (error?.responseHeaders || error?.lastError?.responseHeaders) {
          const headers = error.responseHeaders || error.lastError.responseHeaders;
          this.updateFromHeaders(headers);
          waitTime = this.getWaitTime(estimatedTokens);
        }

        console.log(`[RateLimit] ⚠️ Rate limit hit. Attempt ${attempt}/${maxRetries}`);

        // IMPORTANT: For Jeeves on Vercel with 300s timeout, don't wait too long
        // If wait > 60s, better to fail and retry in next scheduled run (5 min)
        // This prevents timeout cascades: 60s + 60s + 60s = 180s still leaves time for LLM call
        const MAX_WAIT_TIME = 60000; // 1 minute max

        if (waitTime > MAX_WAIT_TIME) {
          console.log(`[RateLimit] ⚠️ Wait time ${Math.round(waitTime / 1000)}s exceeds max ${Math.round(MAX_WAIT_TIME / 1000)}s`);
          console.log(`[RateLimit] Failing fast - will retry in next scheduled run (5 min)`);
          throw new Error(`Rate limit wait time (${Math.round(waitTime / 1000)}s) would exceed timeout. Retry in next cycle.`);
        }

        // Add small exponential backoff (but don't exceed max)
        const backoff = Math.min(waitTime + (attempt * 5000), MAX_WAIT_TIME);

        console.log(`[RateLimit] Waiting ${Math.round(backoff / 1000)}s before retry...`);

        if (onRetry) {
          onRetry(attempt, backoff);
        }

        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    throw new Error('Should not reach here');
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    return {
      inputTokensRemaining: this.state.inputTokensRemaining,
      inputTokensResetIn: Math.max(0, this.state.inputTokensReset.getTime() - Date.now()),
      requestsRemaining: this.state.requestsRemaining,
      requestsResetIn: Math.max(0, this.state.requestsReset.getTime() - Date.now()),
    };
  }
}

// Singleton instance
export const jeevesRateLimit = new JeevesRateLimitHandler();
