'use client';

import { create } from 'zustand';
import type { AnalysisStepData } from '@/lib/ai/analysis-events';

export interface AnalysisState {
  isAnalyzing: boolean;
  currentStep: number;
  totalSteps: number;
  elapsedTime: number;
  estimatedRemaining: number;
  steps: AnalysisStepData[];
  startTime?: number;
  // Tool-based progress tracking
  toolsExecuted: number;
  toolsInProgress: Set<string>;
  totalToolsEstimated: number;
  toolExecutionTimes: Map<string, number>;
  // Reasoning chain data
  reasoningSteps: Array<{
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
  }>;
  toolReasonings: Array<{
    step: number;
    toolName: string;
    toolCategory: string;
    reasoning: string;
    parameters: Record<string, any>;
    timestamp: string; // ISO string
  }>;
}

interface AnalysisStore extends AnalysisState {
  startAnalysis: (totalSteps: number) => void;
  startToolExecution: (toolName: string) => void;
  addToolCall: (step: number, toolName: string, toolCategory: string, parameters: Record<string, any>) => void;
  addToolResult: (step: number, toolName: string, duration: number, success: boolean, summary: any, error?: string) => void;
  updateProgress: (step: number, elapsedTime: number, estimatedRemaining: number) => void;
  completeAnalysis: () => void;
  reset: () => void;
  addReasoningStep: (data: {
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
  }) => void;
  addToolReasoning: (data: {
    step: number;
    toolName: string;
    toolCategory: string;
    reasoning: string;
    parameters: Record<string, any>;
    timestamp: string; // ISO string
  }) => void;
}

const initialState: AnalysisState = {
  isAnalyzing: false,
  currentStep: 0,
  totalSteps: 0,
  elapsedTime: 0,
  estimatedRemaining: 0,
  steps: [],
  toolsExecuted: 0,
  toolsInProgress: new Set<string>(),
  totalToolsEstimated: 10,
  toolExecutionTimes: new Map<string, number>(),
  reasoningSteps: [],
  toolReasonings: [],
};

export const useAnalysisStream = create<AnalysisStore>((set, get) => ({
  ...initialState,

  startAnalysis: (totalSteps: number) => {
    set({
      isAnalyzing: true,
      currentStep: 0,
      totalSteps,
      elapsedTime: 0,
      estimatedRemaining: 0,
      steps: [],
      startTime: Date.now(),
      toolsExecuted: 0,
      toolsInProgress: new Set<string>(),
      totalToolsEstimated: 10,
      toolExecutionTimes: new Map<string, number>(),
    });
  },

  startToolExecution: (toolName: string) => {
    set((state) => {
      const newInProgress = new Set(state.toolsInProgress);
      newInProgress.add(toolName);

      const newTimes = new Map(state.toolExecutionTimes);
      newTimes.set(toolName, Date.now());

      return {
        toolsInProgress: newInProgress,
        toolExecutionTimes: newTimes,
      };
    });
  },

  addToolCall: (step: number, toolName: string, toolCategory: string, parameters: Record<string, any>) => {
    set((state) => {
      // Check if step already exists
      const existingStepIndex = state.steps.findIndex(s => s.step === step && s.toolName === toolName);

      if (existingStepIndex >= 0) {
        // Update existing step
        const newSteps = [...state.steps];
        newSteps[existingStepIndex] = {
          ...newSteps[existingStepIndex],
          parameters,
        };
        return { steps: newSteps, currentStep: step };
      }

      // Add new step
      return {
        steps: [
          ...state.steps,
          {
            step,
            toolName,
            toolCategory,
            parameters,
            timestamp: new Date(),
          },
        ],
        currentStep: step,
      };
    });
  },

  addToolResult: (step: number, toolName: string, duration: number, success: boolean, summary: any, error?: string) => {
    set((state) => {
      const stepIndex = state.steps.findIndex(s => s.step === step && s.toolName === toolName);

      // Update tool tracking
      const newInProgress = new Set(state.toolsInProgress);
      newInProgress.delete(toolName);

      const newToolsExecuted = state.toolsExecuted + 1;

      // Calculate estimated remaining based on tool execution
      const avgTimePerTool = state.startTime
        ? (Date.now() - state.startTime) / newToolsExecuted
        : 0;
      const remainingTools = Math.max(0, state.totalToolsEstimated - newToolsExecuted);
      const newEstimatedRemaining = Math.round(avgTimePerTool * remainingTools);

      if (stepIndex >= 0) {
        const newSteps = [...state.steps];
        newSteps[stepIndex] = {
          ...newSteps[stepIndex],
          result: {
            duration,
            success,
            summary,
            error,
          },
        };
        return {
          steps: newSteps,
          toolsExecuted: newToolsExecuted,
          toolsInProgress: newInProgress,
          estimatedRemaining: newEstimatedRemaining,
        };
      }

      return {
        ...state,
        toolsExecuted: newToolsExecuted,
        toolsInProgress: newInProgress,
        estimatedRemaining: newEstimatedRemaining,
      };
    });
  },

  updateProgress: (step: number, elapsedTime: number, estimatedRemaining: number) => {
    set({
      currentStep: step,
      elapsedTime,
      estimatedRemaining,
    });
  },

  completeAnalysis: () => {
    set({
      isAnalyzing: false,
      estimatedRemaining: 0,
    });
  },

  addReasoningStep: (data) => {
    set((state) => ({
      reasoningSteps: [...state.reasoningSteps, data],
    }));
  },

  addToolReasoning: (data) => {
    set((state) => ({
      toolReasonings: [...state.toolReasonings, data],
    }));
  },

  reset: () => {
    set({
      ...initialState,
      reasoningSteps: [],
      toolReasonings: []
    });
  },
}));