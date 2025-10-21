/**
 * Rate Limit Wrapper - Handles automatic retry with rate limit detection
 */

import { RateLimitMonitor, RateLimitEvent, globalRateLimitMonitor } from './rate-limit-monitor';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  exponentialBase?: number;
  jitterMs?: number;
}

export interface RequestContext {
  operation: string;
  estimatedTokens: number;
  retryCount?: number;
  startTime?: number;
}

export class RateLimitWrapper {
  private monitor: RateLimitMonitor;
  private defaultOptions: Required<RetryOptions> = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes max
    exponentialBase: 2,
    jitterMs: 1000
  };

  constructor(monitor?: RateLimitMonitor) {
    this.monitor = monitor || globalRateLimitMonitor;
  }

  /**
   * Execute a request with automatic rate limit handling and retry
   */
  async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    context: RequestContext,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    const retryCount = context.retryCount || 0;
    const startTime = context.startTime || Date.now();

    console.log(`[RateLimitWrapper] Executing ${context.operation} (attempt ${retryCount + 1}/${opts.maxRetries + 1})`);
    console.log(`[RateLimitWrapper] Estimated tokens: ${context.estimatedTokens}`);

    // Check rate limit before request
    if (this.monitor.checkIfNearLimit(context.estimatedTokens)) {
      console.log('[RateLimitWrapper] Near rate limit, emitting warning');
      this.monitor.emitApproachingLimit(context.operation, context.estimatedTokens);

      const waitTime = this.monitor.getWaitTime();
      console.log(`[RateLimitWrapper] Waiting ${waitTime}ms for rate limit reset`);

      await this.waitWithProgress(waitTime, context.operation);
      this.monitor.emitLimitReset(context.operation);
    }

    try {
      const result = await requestFn();

      // If we had retries, log success
      if (retryCount > 0) {
        const totalTime = Date.now() - startTime;
        console.log(`[RateLimitWrapper] Request succeeded after ${retryCount} retries in ${totalTime}ms`);
      }

      return result;

    } catch (error) {
      console.error(`[RateLimitWrapper] Request failed:`, error);

      // Check if it's a rate limit error
      if (this.monitor.isRateLimitError(error)) {
        console.log('[RateLimitWrapper] Rate limit error detected');

        // Update rate limits from error response if available
        this.updateLimitsFromError(error);

        // Emit rate limit hit event
        this.monitor.emitLimitHit(context.operation, error);

        // Check if we can retry
        if (retryCount < opts.maxRetries) {
          const waitTime = this.calculateRetryDelay(retryCount, opts, error);
          console.log(`[RateLimitWrapper] Retrying in ${waitTime}ms (attempt ${retryCount + 1}/${opts.maxRetries})`);

          await this.waitWithProgress(waitTime, context.operation);

          // Recursive retry with updated context
          return this.executeWithRetry(
            requestFn,
            {
              ...context,
              retryCount: retryCount + 1,
              startTime
            },
            options
          );
        } else {
          console.error(`[RateLimitWrapper] Max retries (${opts.maxRetries}) exceeded for ${context.operation}`);
          throw new Error(`Rate limit exceeded. Max retries (${opts.maxRetries}) reached for ${context.operation}. Please try again later.`);
        }
      } else {
        // Non-rate-limit error, don't retry
        console.error(`[RateLimitWrapper] Non-rate-limit error, not retrying:`, error);
        throw error;
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(retryCount: number, options: Required<RetryOptions>, error: any): number {
    // If we have a specific wait time from the API, use it
    const retryAfterHeader = this.extractRetryAfterHeader(error);
    if (retryAfterHeader) {
      const retryAfterMs = retryAfterHeader * 1000;
      console.log(`[RateLimitWrapper] Using Retry-After header: ${retryAfterMs}ms`);
      return Math.min(retryAfterMs, options.maxDelayMs);
    }

    // Otherwise use rate limit monitor wait time
    const rateLimitWait = this.monitor.getWaitTime();
    if (rateLimitWait > 0) {
      console.log(`[RateLimitWrapper] Using rate limit wait time: ${rateLimitWait}ms`);
      return Math.min(rateLimitWait, options.maxDelayMs);
    }

    // Fallback to exponential backoff
    const exponentialDelay = options.baseDelayMs * Math.pow(options.exponentialBase, retryCount);
    const jitter = Math.random() * options.jitterMs;
    const totalDelay = Math.min(exponentialDelay + jitter, options.maxDelayMs);

    console.log(`[RateLimitWrapper] Using exponential backoff: ${totalDelay}ms`);
    return totalDelay;
  }

  /**
   * Wait with progress updates
   */
  private async waitWithProgress(waitTimeMs: number, context: string): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + waitTimeMs;

    console.log(`[RateLimitWrapper] Waiting ${waitTimeMs}ms for ${context}`);

    // Emit progress updates every second
    const progressInterval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const progress = Math.min(100, ((waitTimeMs - remaining) / waitTimeMs) * 100);

      console.log(`[RateLimitWrapper] Wait progress: ${Math.round(progress)}% (${Math.ceil(remaining / 1000)}s remaining)`);

      if (remaining <= 0) {
        clearInterval(progressInterval);
      }
    }, 1000);

    // Wait for the specified time
    await new Promise(resolve => setTimeout(resolve, waitTimeMs));

    clearInterval(progressInterval);
    console.log(`[RateLimitWrapper] Wait completed for ${context}`);
  }

  /**
   * Extract retry-after header from error response
   */
  private extractRetryAfterHeader(error: any): number | null {
    try {
      // Check various possible locations for retry-after header
      const retryAfter =
        error.response?.headers?.['retry-after'] ||
        error.response?.headers?.['Retry-After'] ||
        error.headers?.['retry-after'] ||
        error.headers?.['Retry-After'] ||
        error.responseHeaders?.['retry-after'] ||
        error.responseHeaders?.['Retry-After'];

      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        return isNaN(seconds) ? null : seconds;
      }
    } catch (e) {
      console.warn('[RateLimitWrapper] Failed to extract retry-after header:', e);
    }

    return null;
  }

  /**
   * Update rate limits from error response
   */
  private updateLimitsFromError(error: any): void {
    try {
      const headers =
        error.response?.headers ||
        error.headers ||
        error.responseHeaders ||
        {};

      if (Object.keys(headers).length > 0) {
        console.log('[RateLimitWrapper] Updating rate limits from error response');
        this.monitor.updateFromHeaders(headers);
      }
    } catch (e) {
      console.warn('[RateLimitWrapper] Failed to update limits from error:', e);
    }
  }

  /**
   * Get current rate limit status
   */
  getCurrentLimits() {
    return this.monitor.getCurrentLimits();
  }

  /**
   * Get usage percentages for display
   */
  getUsagePercentage() {
    return this.monitor.getUsagePercentage();
  }

  /**
   * Subscribe to rate limit events
   */
  onRateLimitEvent(listener: (event: RateLimitEvent) => void) {
    return this.monitor.onRateLimitEvent(listener);
  }

  /**
   * Update rate limits from successful response headers
   */
  updateFromHeaders(headers: Record<string, string>) {
    try {
      if (headers && Object.keys(headers).length > 0) {
        console.log('[RateLimitWrapper] Updating rate limits from response headers');
        this.monitor.updateFromHeaders(headers);
      }
    } catch (e) {
      console.warn('[RateLimitWrapper] Failed to update limits from headers:', e);
    }
  }

  /**
   * Check if near rate limit
   */
  checkIfNearLimit(estimatedTokens: number, bufferTokens?: number) {
    return this.monitor.checkIfNearLimit(estimatedTokens, bufferTokens);
  }

  /**
   * Get wait time for rate limit reset
   */
  getWaitTime() {
    return this.monitor.getWaitTime();
  }
}

// Global singleton instance
export const globalRateLimitWrapper = new RateLimitWrapper();