'use client';

import { useState } from 'react';
import { useAnalysisStream } from '@/hooks/use-analysis-stream';
import { AnalysisProgress } from './analysis-progress';
import { AnalysisTrail } from './analysis-trail';
import { ReasoningChain } from './reasoning-chain';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AnalysisDisplay() {
  const {
    isAnalyzing,
    currentStep,
    totalSteps,
    elapsedTime,
    estimatedRemaining,
    steps,
    toolsExecuted,
    toolsInProgress,
    totalToolsEstimated,
    reasoningSteps,
    toolReasonings,
  } = useAnalysisStream();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isReasoningVisible, setIsReasoningVisible] = useState(false);

  // Don't show anything if there's no analysis happening and no steps
  if (!isAnalyzing && steps.length === 0) {
    return null;
  }

  const getStatus = () => {
    if (isAnalyzing) return 'analyzing';
    if (steps.length > 0) return 'complete';
    return 'idle';
  };

  return (
    <div className="w-full mb-4">
      {/* Progress Bar */}
      <AnalysisProgress
        currentStep={currentStep}
        totalSteps={totalSteps}
        elapsedTime={elapsedTime}
        estimatedRemaining={estimatedRemaining}
        status={getStatus()}
        toolsExecuted={toolsExecuted}
        toolsInProgress={toolsInProgress}
        totalToolsEstimated={totalToolsEstimated}
      />

      {/* Analysis Trail - Collapsible */}
      {steps.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors",
              "text-sm font-medium"
            )}
          >
            <span>
              Analysis Details {!isExpanded && `(${steps.length} steps)`}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="mt-2">
              <AnalysisTrail steps={steps} />
            </div>
          )}
        </div>
      )}

      {/* Reasoning Chain - Collapsible */}
      {reasoningSteps && reasoningSteps.length > 0 && (
        <div className="mt-2">
          <ReasoningChain
            reasoningSteps={reasoningSteps || []}
            toolReasonings={toolReasonings || []}
            isVisible={isReasoningVisible}
            onToggle={() => setIsReasoningVisible(!isReasoningVisible)}
          />
        </div>
      )}
    </div>
  );
}