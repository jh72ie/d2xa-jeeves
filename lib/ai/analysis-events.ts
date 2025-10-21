/**
 * Analysis Event Types for Transparent AI Analysis
 * These events are streamed to the client to show the analysis process
 */

export type AnalysisEvent =
  | AnalysisStartEvent
  | ToolStartEvent
  | ToolCallEvent
  | ToolResultEvent
  | ReasoningEvent
  | ProgressEvent
  | AnalysisCompleteEvent;

export interface AnalysisStartEvent {
  type: 'analysis-start';
  timestamp: Date;
  query: string;
  estimatedSteps: number;
}

export interface ToolStartEvent {
  type: 'analysis-tool-start';
  step: number;
  toolName: string;
  toolCategory: 'data-retrieval' | 'statistics' | 'time-series' | 'patterns' | 'anomalies' | 'correlation' | 'quality' | 'discovery' | 'orchestration' | 'other';
  timestamp: Date;
}

export interface ToolCallEvent {
  type: 'analysis-tool-call';
  step: number;
  totalSteps: number;
  toolName: string;
  toolCategory: 'data-retrieval' | 'statistics' | 'time-series' | 'patterns' | 'anomalies' | 'correlation' | 'quality' | 'discovery' | 'orchestration' | 'other';
  parameters: Record<string, any>;
  timestamp: Date;
  reasoning?: string;
}

export interface ToolResultEvent {
  type: 'analysis-tool-result';
  step: number;
  toolName: string;
  duration: number;
  success: boolean;
  resultSummary: ResultSummary;
  error?: string;
}

export interface ResultSummary {
  dataPoints?: number;
  anomaliesFound?: number;
  qualityScore?: number;
  qualityGrade?: string;
  correlationValue?: number;
  streamsFound?: number;
  trendsDetected?: number;
  patternsFound?: number;
  [key: string]: any;
}

export interface ReasoningEvent {
  type: 'analysis-reasoning';
  step: number;
  thought: string;
}

export interface ProgressEvent {
  type: 'analysis-progress';
  step: number;
  totalSteps: number;
  elapsedTime: number;
  estimatedRemaining: number;
  percentComplete: number;
}

export interface AnalysisCompleteEvent {
  type: 'analysis-complete';
  totalSteps: number;
  totalDuration: number;
  success: boolean;
  toolsUsed: string[];
}

export interface AnalysisStepData {
  step: number;
  toolName: string;
  toolCategory: string;
  parameters: Record<string, any>;
  result?: {
    duration: number;
    success: boolean;
    summary: ResultSummary;
    error?: string;
  };
  timestamp: Date;
}