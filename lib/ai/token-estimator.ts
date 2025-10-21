/**
 * Token Estimator - Estimates token usage for API requests
 */

export interface TokenEstimate {
  estimatedTokens: number;
  confidence: 'low' | 'medium' | 'high';
  breakdown: {
    messages: number;
    tools: number;
    systemPrompt: number;
    overhead: number;
  };
}

export class TokenEstimator {
  // Base token costs for different tool types
  private toolTokenCosts: Record<string, number> = {
    // Stream analysis tools
    'listAvailableStreamsTool': 500,
    'getStreamRecentDataTool': 800,
    'analyzeStreamStatisticsTool': 2000,
    'analyzeStreamTrendTool': 1500,
    'analyzeStreamPatternsTool': 3000,
    'analyzeStreamAnomaliesTool': 2500,
    'analyzeStreamAutocorrelationTool': 3500,
    'detectChangePointsTool': 4000,
    'findPeaksTool': 2000,
    'analyzePeakFrequencyTool': 1800,

    // Mathematical tools
    'correlateTwoStreamsTool': 2200,
    'calculateDerivativeTool': 1500,
    'smoothDataTool': 1200,
    'normalizeDataTool': 1000,

    // Dashboard tools
    'publishDashboard': 1500,
    'claudeCodeTool': 3000,

    // General analysis
    'default': 1000
  };

  // System prompt approximate token count
  private systemPromptTokens = 2000;

  // API overhead (tool definitions, etc.)
  private apiOverhead = 3000;

  /**
   * Estimate tokens for a complete chat request
   */
  estimateRequestTokens(
    messages: any[],
    tools: string[] = [],
    toolParameters: Record<string, any> = {}
  ): TokenEstimate {
    const messageTokens = this.estimateMessageTokens(messages);
    const toolTokens = this.estimateToolTokens(tools, toolParameters);
    const systemTokens = this.systemPromptTokens;
    const overhead = this.apiOverhead;

    const total = messageTokens + toolTokens + systemTokens + overhead;

    // Determine confidence based on complexity
    let confidence: 'low' | 'medium' | 'high' = 'medium';
    if (tools.length === 0 && messages.length <= 5) {
      confidence = 'high';
    } else if (tools.length > 5 || messages.length > 20) {
      confidence = 'low';
    }

    return {
      estimatedTokens: Math.ceil(total * 1.1), // Add 10% safety margin
      confidence,
      breakdown: {
        messages: messageTokens,
        tools: toolTokens,
        systemPrompt: systemTokens,
        overhead
      }
    };
  }

  /**
   * Estimate tokens for messages
   */
  private estimateMessageTokens(messages: any[]): number {
    return messages.reduce((total, message) => {
      const content = message.content || '';
      const role = message.role || '';

      // Rough estimation: ~4 characters per token
      const contentTokens = content.length / 4;
      const roleTokens = role.length / 4;

      return total + contentTokens + roleTokens + 10; // 10 token overhead per message
    }, 0);
  }

  /**
   * Estimate tokens for tool calls
   */
  private estimateToolTokens(tools: string[], parameters: Record<string, any> = {}): number {
    return tools.reduce((total, toolName) => {
      const baseTokens = this.toolTokenCosts[toolName] || this.toolTokenCosts.default;
      const paramTokens = this.estimateParameterTokens(parameters[toolName] || {});

      return total + baseTokens + paramTokens;
    }, 0);
  }

  /**
   * Estimate tokens for tool parameters
   */
  private estimateParameterTokens(parameters: any): number {
    try {
      const paramString = JSON.stringify(parameters);
      return paramString.length / 4; // ~4 characters per token
    } catch {
      return 100; // Default if parameters can't be stringified
    }
  }

  /**
   * Estimate tokens for a specific tool call
   */
  estimateToolCallTokens(toolName: string, parameters: any = {}): number {
    const baseTokens = this.toolTokenCosts[toolName] || this.toolTokenCosts.default;
    const paramTokens = this.estimateParameterTokens(parameters);

    // Add complexity multiplier based on parameters
    const complexityMultiplier = this.getComplexityMultiplier(toolName, parameters);

    return Math.ceil((baseTokens + paramTokens) * complexityMultiplier);
  }

  /**
   * Get complexity multiplier based on tool and parameters
   */
  private getComplexityMultiplier(toolName: string, parameters: any): number {
    // Analysis tools with large datasets use more tokens
    if (toolName.includes('analyze') || toolName.includes('detect')) {
      const count = parameters.count || parameters.limit || 100;
      if (count > 1000) return 1.5;
      if (count > 500) return 1.3;
      if (count > 100) return 1.1;
    }

    // Stream analysis with multiple streams
    if (toolName.includes('Stream') && parameters.streamIds?.length > 1) {
      return 1 + (parameters.streamIds.length * 0.2);
    }

    return 1.0;
  }

  /**
   * Estimate tokens for different analysis depths
   */
  estimateAnalysisDepth(depth: 'quick' | 'standard' | 'deep' | 'comprehensive', streamCount: number = 1): TokenEstimate {
    const baseMultiplier = streamCount > 1 ? (1 + streamCount * 0.3) : 1;

    switch (depth) {
      case 'quick':
        return {
          estimatedTokens: Math.ceil(3000 * baseMultiplier),
          confidence: 'high',
          breakdown: {
            messages: 500,
            tools: 2000 * baseMultiplier,
            systemPrompt: this.systemPromptTokens,
            overhead: 500
          }
        };

      case 'standard':
        return {
          estimatedTokens: Math.ceil(8000 * baseMultiplier),
          confidence: 'medium',
          breakdown: {
            messages: 800,
            tools: 5500 * baseMultiplier,
            systemPrompt: this.systemPromptTokens,
            overhead: 700
          }
        };

      case 'deep':
        return {
          estimatedTokens: Math.ceil(25000 * baseMultiplier),
          confidence: 'medium',
          breakdown: {
            messages: 1500,
            tools: 20000 * baseMultiplier,
            systemPrompt: this.systemPromptTokens,
            overhead: 1500
          }
        };

      case 'comprehensive':
        return {
          estimatedTokens: Math.ceil(45000 * baseMultiplier),
          confidence: 'low',
          breakdown: {
            messages: 2500,
            tools: 38000 * baseMultiplier,
            systemPrompt: this.systemPromptTokens,
            overhead: 2500
          }
        };

      default:
        return this.estimateAnalysisDepth('standard', streamCount);
    }
  }

  /**
   * Check if request would likely hit rate limits
   */
  wouldExceedRateLimit(estimatedTokens: number, currentRemaining: number, bufferTokens: number = 500): {
    wouldExceed: boolean;
    availableTokens: number;
    requiredTokens: number;
    recommendedAction: string;
  } {
    const requiredTokens = estimatedTokens + bufferTokens;
    const wouldExceed = requiredTokens > currentRemaining;

    let recommendedAction = 'proceed';
    if (wouldExceed) {
      if (estimatedTokens > currentRemaining) {
        recommendedAction = 'wait_for_reset';
      } else {
        recommendedAction = 'reduce_complexity';
      }
    }

    return {
      wouldExceed,
      availableTokens: currentRemaining,
      requiredTokens,
      recommendedAction
    };
  }

  /**
   * Get token usage forecast for multiple operations
   */
  forecastTokenUsage(operations: Array<{ name: string; estimatedTokens: number }>): {
    totalTokens: number;
    wouldExceedLimit: boolean;
    suggestedBatches: Array<{ operations: string[]; totalTokens: number }>;
  } {
    const totalTokens = operations.reduce((sum, op) => sum + op.estimatedTokens, 0);
    const limit = 400000; // Tier 4 rate limit
    const wouldExceedLimit = totalTokens > limit;

    // Create suggested batches if exceeding limit
    const suggestedBatches: Array<{ operations: string[]; totalTokens: number }> = [];
    if (wouldExceedLimit) {
      let currentBatch: string[] = [];
      let currentBatchTokens = 0;

      for (const op of operations) {
        if (currentBatchTokens + op.estimatedTokens > limit * 0.8) { // 80% of limit per batch
          if (currentBatch.length > 0) {
            suggestedBatches.push({
              operations: [...currentBatch],
              totalTokens: currentBatchTokens
            });
          }
          currentBatch = [op.name];
          currentBatchTokens = op.estimatedTokens;
        } else {
          currentBatch.push(op.name);
          currentBatchTokens += op.estimatedTokens;
        }
      }

      if (currentBatch.length > 0) {
        suggestedBatches.push({
          operations: [...currentBatch],
          totalTokens: currentBatchTokens
        });
      }
    }

    return {
      totalTokens,
      wouldExceedLimit,
      suggestedBatches
    };
  }
}

// Global singleton instance
export const globalTokenEstimator = new TokenEstimator();