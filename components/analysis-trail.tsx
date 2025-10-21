'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  formatToolName,
  getCategoryIcon,
  getCategoryColor,
  formatDuration
} from '@/lib/ai/analysis-helpers';
import type { AnalysisStepData } from '@/lib/ai/analysis-events';

export interface AnalysisTrailProps {
  steps: AnalysisStepData[];
  className?: string;
}

export function AnalysisTrail({ steps, className }: AnalysisTrailProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (step: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedSteps(newExpanded);
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2 p-4 bg-muted/30 rounded-lg border border-border/50", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Analysis Trail</span>
        <span className="text-xs text-muted-foreground">
          {steps.length} step{steps.length !== 1 ? 's' : ''} executed
        </span>
      </div>

      <div className="space-y-2">
        {steps.map((step, idx) => (
          <AnalysisStepCard
            key={idx}
            step={step}
            expanded={expandedSteps.has(step.step)}
            onToggle={() => toggleStep(step.step)}
          />
        ))}
      </div>
    </div>
  );
}

interface AnalysisStepCardProps {
  step: AnalysisStepData;
  expanded: boolean;
  onToggle: () => void;
}

function AnalysisStepCard({ step, expanded, onToggle }: AnalysisStepCardProps) {
  const hasResult = !!step.result;
  const hasError = step.result?.error;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer",
        "hover:bg-muted/50 hover:border-border",
        expanded && "bg-muted/50 border-border",
        hasError && "border-red-500/30 bg-red-500/5"
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className="flex-shrink-0">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-lg border",
            getCategoryColor(step.toolCategory)
          )}>
            {getCategoryIcon(step.toolCategory)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              [{step.step}]
            </span>
            <span className="text-sm font-medium truncate">
              {formatToolName(step.toolName)}
            </span>
            {hasResult && step.result?.duration && step.result.duration > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(step.result.duration)}
              </span>
            )}
          </div>

          {/* Result Summary */}
          {hasResult && step.result?.summary && Object.keys(step.result.summary).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(step.result.summary).map(([key, value]) => (
                <ResultBadge key={key} label={key} value={value} />
              ))}
            </div>
          )}

          {/* Error Message */}
          {hasError && step.result?.error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
              Error: {step.result.error}
            </div>
          )}

          {/* Expanded Parameters */}
          {expanded && Object.keys(step.parameters).length > 0 && (
            <div className="mt-3 p-2 bg-background rounded border border-border">
              <div className="text-xs font-medium text-muted-foreground mb-2">Parameters:</div>
              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(step.parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Status Icon */}
        <div className="flex-shrink-0">
          {hasResult ? (
            hasError ? (
              <span className="text-red-500 text-lg">✗</span>
            ) : (
              <span className="text-green-500 text-lg">✓</span>
            )
          ) : (
            <span className="text-yellow-500 text-lg animate-pulse">⏳</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultBadgeProps {
  label: string;
  value: any;
}

function ResultBadge({ label, value }: ResultBadgeProps) {
  const formatValue = (val: any): string => {
    if (typeof val === 'number') {
      // Format numbers nicely
      if (val % 1 === 0) return val.toString();
      return val.toFixed(2);
    }
    if (typeof val === 'boolean') {
      return val ? 'yes' : 'no';
    }
    return String(val);
  };

  const formatLabel = (lbl: string): string => {
    return lbl
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
      .replace(/^./, str => str.toUpperCase());
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded-md text-xs">
      <span className="text-muted-foreground">{formatLabel(label)}:</span>
      <span className="font-medium">{formatValue(value)}</span>
    </span>
  );
}