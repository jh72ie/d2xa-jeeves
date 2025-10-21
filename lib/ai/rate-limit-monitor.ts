/**
 * Rate Limit Monitor - Tracks Claude API rate limits and manages retry logic
 */

export interface RateLimitInfo {
  inputTokensRemaining: number;
  inputTokensLimit: number;
  inputTokensReset: Date | null;
  outputTokensRemaining: number;
  outputTokensLimit: number;
  outputTokensReset: Date | null;
  requestsRemaining: number;
  requestsLimit: number;
  requestsReset: Date | null;
  totalTokensRemaining: number;
  totalTokensLimit: number;
  totalTokensReset: Date | null;
}

export interface RateLimitEvent {
  type: 'approaching_limit' | 'limit_hit' | 'limit_reset';
  context: string;
  waitTime?: number;
  estimatedWait?: number;
  currentLimits: RateLimitInfo;
}

export class RateLimitMonitor {
  private currentLimits: RateLimitInfo = {
    inputTokensRemaining: 400000,
    inputTokensLimit: 400000,
    inputTokensReset: null,
    outputTokensRemaining: 80000,
    outputTokensLimit: 80000,
    outputTokensReset: null,
    requestsRemaining: 2000,
    requestsLimit: 2000,
    requestsReset: null,
    totalTokensRemaining: 480000,
    totalTokensLimit: 480000,
    totalTokensReset: null,
  };

  private listeners: ((event: RateLimitEvent) => void)[] = [];
  private lastUpdated: Date = new Date();

  /**
   * Update rate limits from API response headers
   */
  updateFromHeaders(headers: Record<string, string>): void {
    const getHeader = (key: string): string => headers[key] || headers[key.toLowerCase()] || '';

    this.currentLimits = {
      inputTokensRemaining: parseInt(getHeader('anthropic-ratelimit-input-tokens-remaining')) || 0,
      inputTokensLimit: parseInt(getHeader('anthropic-ratelimit-input-tokens-limit')) || 400000,
      inputTokensReset: this.parseResetTime(getHeader('anthropic-ratelimit-input-tokens-reset')),

      outputTokensRemaining: parseInt(getHeader('anthropic-ratelimit-output-tokens-remaining')) || 0,
      outputTokensLimit: parseInt(getHeader('anthropic-ratelimit-output-tokens-limit')) || 80000,
      outputTokensReset: this.parseResetTime(getHeader('anthropic-ratelimit-output-tokens-reset')),

      requestsRemaining: parseInt(getHeader('anthropic-ratelimit-requests-remaining')) || 0,
      requestsLimit: parseInt(getHeader('anthropic-ratelimit-requests-limit')) || 2000,
      requestsReset: this.parseResetTime(getHeader('anthropic-ratelimit-requests-reset')),

      totalTokensRemaining: parseInt(getHeader('anthropic-ratelimit-tokens-remaining')) || 0,
      totalTokensLimit: parseInt(getHeader('anthropic-ratelimit-tokens-limit')) || 480000,
      totalTokensReset: this.parseResetTime(getHeader('anthropic-ratelimit-tokens-reset')),
    };

    this.lastUpdated = new Date();

    console.log('[RateLimitMonitor] Updated limits:', {
      inputTokensRemaining: this.currentLimits.inputTokensRemaining,
      totalTokensRemaining: this.currentLimits.totalTokensRemaining,
      requestsRemaining: this.currentLimits.requestsRemaining,
    });
  }

  /**
   * Check if we're near any rate limit
   */
  checkIfNearLimit(estimatedTokens: number, bufferTokens: number = 500): boolean {
    const inputNearLimit = this.currentLimits.inputTokensRemaining < (estimatedTokens + bufferTokens);
    const totalNearLimit = this.currentLimits.totalTokensRemaining < (estimatedTokens + bufferTokens);
    const requestsNearLimit = this.currentLimits.requestsRemaining < 2;

    if (inputNearLimit || totalNearLimit || requestsNearLimit) {
      console.log('[RateLimitMonitor] Near limit detected:', {
        estimatedTokens,
        bufferTokens,
        inputTokensRemaining: this.currentLimits.inputTokensRemaining,
        totalTokensRemaining: this.currentLimits.totalTokensRemaining,
        requestsRemaining: this.currentLimits.requestsRemaining,
        inputNearLimit,
        totalNearLimit,
        requestsNearLimit
      });
      return true;
    }

    return false;
  }

  /**
   * Get wait time until rate limit resets
   */
  getWaitTime(): number {
    const now = new Date();
    const waitTimes: number[] = [];

    // Check all reset times and find the soonest
    if (this.currentLimits.inputTokensReset) {
      waitTimes.push(this.currentLimits.inputTokensReset.getTime() - now.getTime());
    }
    if (this.currentLimits.totalTokensReset) {
      waitTimes.push(this.currentLimits.totalTokensReset.getTime() - now.getTime());
    }
    if (this.currentLimits.requestsReset) {
      waitTimes.push(this.currentLimits.requestsReset.getTime() - now.getTime());
    }

    // Return the minimum positive wait time, or 60 seconds default
    const minWaitTime = Math.min(...waitTimes.filter(t => t > 0));
    return isFinite(minWaitTime) ? Math.max(minWaitTime, 1000) : 60000; // At least 1 second, default 60 seconds
  }

  /**
   * Get current rate limit status
   */
  getCurrentLimits(): RateLimitInfo {
    return { ...this.currentLimits };
  }

  /**
   * Subscribe to rate limit events
   */
  onRateLimitEvent(listener: (event: RateLimitEvent) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit rate limit event to all listeners
   */
  private emitEvent(event: RateLimitEvent): void {
    console.log('[RateLimitMonitor] Emitting event:', event.type, event.context);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[RateLimitMonitor] Listener error:', error);
      }
    });
  }

  /**
   * Trigger approaching limit warning
   */
  emitApproachingLimit(context: string, estimatedTokens: number): void {
    this.emitEvent({
      type: 'approaching_limit',
      context,
      waitTime: this.getWaitTime(),
      estimatedWait: Math.ceil(this.getWaitTime() / 1000),
      currentLimits: this.getCurrentLimits()
    });
  }

  /**
   * Trigger limit hit event
   */
  emitLimitHit(context: string, error?: any): void {
    const waitTime = this.getWaitTime();
    this.emitEvent({
      type: 'limit_hit',
      context,
      waitTime,
      estimatedWait: Math.ceil(waitTime / 1000),
      currentLimits: this.getCurrentLimits()
    });
  }

  /**
   * Trigger limit reset event
   */
  emitLimitReset(context: string): void {
    this.emitEvent({
      type: 'limit_reset',
      context,
      currentLimits: this.getCurrentLimits()
    });
  }

  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(error: any): boolean {
    if (!error) return false;

    // Check error message
    const message = error.message || error.toString() || '';
    if (message.includes('rate limit') || message.includes('rate_limit_error')) {
      return true;
    }

    // Check status code
    const statusCode = error.statusCode || error.status || (error.response?.status);
    if (statusCode === 429) {
      return true;
    }

    // Check error type
    const errorType = error.type || error.error?.type;
    if (errorType === 'rate_limit_error') {
      return true;
    }

    return false;
  }

  /**
   * Get usage percentage for display
   */
  getUsagePercentage(): {
    inputTokens: number;
    totalTokens: number;
    requests: number;
  } {
    return {
      inputTokens: Math.round(((this.currentLimits.inputTokensLimit - this.currentLimits.inputTokensRemaining) / this.currentLimits.inputTokensLimit) * 100),
      totalTokens: Math.round(((this.currentLimits.totalTokensLimit - this.currentLimits.totalTokensRemaining) / this.currentLimits.totalTokensLimit) * 100),
      requests: Math.round(((this.currentLimits.requestsLimit - this.currentLimits.requestsRemaining) / this.currentLimits.requestsLimit) * 100)
    };
  }

  /**
   * Parse reset time from header string
   */
  private parseResetTime(resetTimeString: string): Date | null {
    if (!resetTimeString) return null;

    try {
      const resetTime = new Date(resetTimeString);
      return isNaN(resetTime.getTime()) ? null : resetTime;
    } catch {
      return null;
    }
  }

  /**
   * Get time since last update (for debugging)
   */
  getTimeSinceLastUpdate(): number {
    return Date.now() - this.lastUpdated.getTime();
  }
}

// Global singleton instance
export const globalRateLimitMonitor = new RateLimitMonitor();