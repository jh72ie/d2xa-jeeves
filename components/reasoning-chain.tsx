'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, Lightbulb, Cog } from 'lucide-react';
import { formatDuration, getCategoryIcon, getCategoryColor } from '@/lib/ai/analysis-helpers';

export interface ReasoningStep {
  step: number;
  totalSteps: number;
  reasoning: string;
  finishReason: string;
  toolCount: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  timestamp: string; // ISO string
}

export interface ToolReasoning {
  step: number;
  toolName: string;
  toolCategory: string;
  reasoning: string;
  parameters: Record<string, any>;
  timestamp: string; // ISO string
}

export interface ReasoningChainProps {
  reasoningSteps: ReasoningStep[];
  toolReasonings: ToolReasoning[];
  isVisible: boolean;
  onToggle: () => void;
}

export function ReasoningChain({
  reasoningSteps,
  toolReasonings,
  isVisible,
  onToggle
}: ReasoningChainProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Validate props and provide defaults
  const safeReasoningSteps = reasoningSteps || [];
  const safeToolReasonings = toolReasonings || [];

  const toggleStep = (stepNumber: number) => {
    try {
      const newExpanded = new Set(expandedSteps);
      if (newExpanded.has(stepNumber)) {
        newExpanded.delete(stepNumber);
      } else {
        newExpanded.add(stepNumber);
      }
      setExpandedSteps(newExpanded);
    } catch (error) {
      console.error('Error toggling step:', error);
    }
  };

  const getStepToolReasonings = (stepNumber: number) => {
    try {
      return safeToolReasonings.filter(tr => tr?.step === stepNumber) || [];
    } catch (error) {
      console.warn('Error filtering tool reasonings:', error);
      return [];
    }
  };

  if (safeReasoningSteps.length === 0) {
    return null;
  }

  try {

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-gray-900">
            AI Reasoning Chain ({reasoningSteps.length} steps)
          </span>
        </div>
        {isVisible ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {isVisible && (
        <div className="border-t bg-gray-50/50">
          <div className="p-4 space-y-4">
            {safeReasoningSteps.map((step, index) => {
              if (!step || typeof step.step !== 'number') {
                console.warn('Invalid step data:', step);
                return null;
              }

              const stepToolReasonings = getStepToolReasonings(step.step);
              const isExpanded = expandedSteps.has(step.step);

              return (
                <div key={step.step} className="bg-white rounded-lg border">
                  <button
                    onClick={() => toggleStep(step.step)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                        {step.step}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">
                          Step {step.step} of {step.totalSteps}
                        </div>
                        <div className="text-sm text-gray-500">
                          {stepToolReasonings.length} tools • {step.finishReason}
                          {step.usage && ` • ${step.usage.totalTokens} tokens`}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t p-4 space-y-4">
                      {/* Step reasoning */}
                      {step.reasoning && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-900">AI Thinking</span>
                          </div>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {step.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Tool reasonings */}
                      {stepToolReasonings.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Cog className="h-4 w-4 text-gray-600" />
                            <span className="font-medium text-gray-900">Tool Selections</span>
                          </div>
                          {stepToolReasonings.map((toolReasoning, toolIndex) => {
                            if (!toolReasoning || !toolReasoning.toolName) {
                              console.warn('Invalid tool reasoning data:', toolReasoning);
                              return null;
                            }

                            const safeCategory = toolReasoning.toolCategory || 'other';
                            const safeName = toolReasoning.toolName || 'Unknown Tool';
                            const safeReasoning = toolReasoning.reasoning || 'No reasoning provided';
                            const safeParameters = toolReasoning.parameters || {};

                            return (
                              <div
                                key={toolIndex}
                                className={`rounded-lg p-3 border ${getCategoryColor(safeCategory)}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">
                                    {getCategoryIcon(safeCategory)}
                                  </span>
                                  <span className="font-medium">
                                    {safeName.replace(/Tool$/, '')}
                                  </span>
                                  <span className="text-xs px-2 py-1 bg-white/50 rounded-full">
                                    {safeCategory}
                                  </span>
                                </div>
                                <p className="text-sm mb-2">
                                  {safeReasoning}
                                </p>
                                {Object.keys(safeParameters).length > 0 && (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                                      Parameters ({Object.keys(safeParameters).length})
                                    </summary>
                                    <pre className="mt-2 p-2 bg-white/50 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(safeParameters, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Step metadata */}
                      <div className="text-xs text-gray-500 flex items-center justify-between pt-2 border-t">
                        <span>Finished: {step.finishReason || 'Unknown'}</span>
                        <span>
                          {(() => {
                            try {
                              // timestamp is now always an ISO string
                              const date = new Date(step.timestamp);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleTimeString();
                              }
                              return 'Invalid time';
                            } catch (error) {
                              console.warn('Error formatting timestamp:', error, step.timestamp);
                              return 'Invalid time';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
  } catch (error) {
    console.error('Error rendering ReasoningChain:', error);
    return (
      <div className="border rounded-lg bg-white shadow-sm p-4">
        <div className="flex items-center gap-3 text-red-600">
          <Brain className="h-5 w-5" />
          <span className="font-medium">
            Error loading reasoning chain
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          There was an error displaying the reasoning steps. Please check the browser console for details.
        </p>
      </div>
    );
  }
}