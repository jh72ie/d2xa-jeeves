'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { formatDuration } from '@/lib/ai/analysis-helpers';
import { Clock, AlertTriangle } from 'lucide-react';

export interface AnalysisProgressProps {
  currentStep: number;
  totalSteps: number;
  elapsedTime: number;
  estimatedRemaining: number;
  status: 'idle' | 'analyzing' | 'complete' | 'error' | 'rate_limited';
  toolsExecuted?: number;
  toolsInProgress?: Set<string>;
  totalToolsEstimated?: number;
  rateLimitInfo?: {
    isWaiting: boolean;
    waitTime: number;
    reason: string;
  };
  tokensUsed?: number;
  estimatedTokens?: number;
}

export function AnalysisProgress({
  currentStep,
  totalSteps,
  elapsedTime,
  estimatedRemaining,
  status,
  toolsExecuted = 0,
  toolsInProgress = new Set(),
  totalToolsEstimated = 10,
  rateLimitInfo,
  tokensUsed,
  estimatedTokens
}: AnalysisProgressProps) {
  const [countdown, setCountdown] = useState(0);

  // Handle rate limit countdown
  useEffect(() => {
    if (!rateLimitInfo?.isWaiting || !rateLimitInfo.waitTime) return;

    setCountdown(Math.ceil(rateLimitInfo.waitTime / 1000));

    const timer = setInterval(() => {
      setCountdown(prev => {
        const newCount = Math.max(0, prev - 1);
        if (newCount <= 0) {
          clearInterval(timer);
        }
        return newCount;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitInfo?.isWaiting, rateLimitInfo?.waitTime]);
  // Use tool-based progress instead of step-based
  const progress = totalToolsEstimated > 0 ? (toolsExecuted / totalToolsEstimated) * 100 : 0;

  // Get the current tool being executed
  const currentToolName = toolsInProgress.size > 0 ? Array.from(toolsInProgress)[0] : null;

  const getStatusIcon = () => {
    switch (status) {
      case 'analyzing':
        return <span className="animate-spin">⚙️</span>;
      case 'rate_limited':
        return <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />;
      case 'complete':
        return <span>✅</span>;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <span>⏸️</span>;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'analyzing':
        return 'Analyzing...';
      case 'rate_limited':
        return `Rate Limited - Waiting ${countdown}s`;
      case 'complete':
        return 'Analysis Complete';
      case 'error':
        return 'Analysis Failed';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'analyzing':
        return 'bg-blue-50 border-blue-200';
      case 'rate_limited':
        return 'bg-yellow-50 border-yellow-200';
      case 'complete':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`space-y-2 p-3 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>

        <div className="text-xs text-muted-foreground">
          {toolsExecuted}/{totalToolsEstimated} tools
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>⏱️ {formatDuration(elapsedTime)}</span>

        {/* Token Usage */}
        {(tokensUsed || estimatedTokens) && (
          <span className="text-gray-400">
            {tokensUsed ? `${tokensUsed.toLocaleString()} tokens used` :
             estimatedTokens ? `~${estimatedTokens.toLocaleString()} tokens estimated` : ''}
          </span>
        )}

        {status === 'analyzing' && estimatedRemaining > 0 && (
          <span>~{formatDuration(estimatedRemaining)} remaining</span>
        )}
        {status === 'complete' && (
          <span>Completed in {formatDuration(elapsedTime)}</span>
        )}
      </div>

      {/* Show currently executing tool */}
      {status === 'analyzing' && currentToolName && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
          <span className="animate-pulse">⏳</span>
          <span className="truncate">
            Running: {currentToolName.replace(/Tool$/, '').replace(/([A-Z])/g, ' $1').trim()}
          </span>
        </div>
      )}

      {/* Rate limit specific information */}
      {status === 'rate_limited' && rateLimitInfo && (
        <div className="flex items-center gap-2 text-xs text-yellow-700 pt-1 border-t border-yellow-200">
          <Clock className="h-3 w-3" />
          <span>
            {rateLimitInfo.reason}. Analysis will resume automatically in {countdown}s.
          </span>
        </div>
      )}
    </div>
  );
}