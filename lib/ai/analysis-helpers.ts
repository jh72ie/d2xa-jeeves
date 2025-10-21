/**
 * Helper functions for analysis event processing
 */

import type { ResultSummary } from './analysis-events';

const TOOL_CATEGORY_MAP: Record<string, string> = {
  // Data Retrieval Tools
  'getStreamRecentDataTool': 'data-retrieval',
  'getStreamTimeWindowTool': 'data-retrieval',
  'getStreamInfoTool': 'data-retrieval',
  'getMultipleStreamsTool': 'data-retrieval',
  'listAvailableStreamsTool': 'data-retrieval',

  // Statistics Tools
  'analyzeStreamStatisticsTool': 'statistics',
  'calculateMeanTool': 'statistics',
  'calculateStdTool': 'statistics',
  'calculateVarianceTool': 'statistics',
  'calculateMedianTool': 'statistics',
  'calculateQuantileTool': 'statistics',
  'calculateIQRTool': 'statistics',
  'calculateSkewnessTool': 'statistics',
  'calculateKurtosisTool': 'statistics',
  'calculateZScoresTool': 'statistics',
  'calculateBasicStatsTool': 'statistics',
  'testNormalityTool': 'statistics',
  'calculateEntropyTool': 'statistics',

  // Time Series Tools
  'analyzeStreamTrendTool': 'time-series',
  'analyzeStreamAutocorrelationTool': 'time-series',
  'analyzeStreamMovingAverageTool': 'time-series',
  'calculateLinearTrendTool': 'time-series',
  'simpleMovingAverageTool': 'time-series',
  'exponentialMovingAverageTool': 'time-series',
  'movingStandardDeviationTool': 'time-series',
  'detectChangePointsTool': 'time-series',
  'calculateAutocorrelationTool': 'time-series',
  'detectCyclicPatternsTool': 'time-series',
  'decomposeTimeSeriesTool': 'time-series',

  // Pattern Detection Tools
  'analyzeStreamPatternsTool': 'patterns',
  'findPeaksTool': 'patterns',
  'findValleysTool': 'patterns',
  'detectSpikesTool': 'patterns',
  'findSimilarPatternsTool': 'patterns',
  'detectRepeatingSequencesTool': 'patterns',
  'findDominantFrequenciesTool': 'patterns',
  'analyzePeakFrequencyTool': 'patterns',

  // Anomaly Detection Tools
  'analyzeStreamAnomaliesTool': 'anomalies',
  'zScoreAnomaliesTool': 'anomalies',
  'modifiedZScoreTool': 'anomalies',
  'iqrOutliersTool': 'anomalies',
  'localOutlierFactorTool': 'anomalies',
  'seasonalAnomaliesTool': 'anomalies',
  'trendDeviationAnomaliesTool': 'anomalies',
  'ensembleAnomalyDetectionTool': 'anomalies',
  'adaptiveThresholdingTool': 'anomalies',

  // Correlation Tools
  'correlateTwoStreamsTool': 'correlation',
  'correlateMultipleStreamsTool': 'correlation',
  'testStreamCausalityTool': 'correlation',
  'detectSynchronizedStreamEventsTool': 'correlation',
  'analyzeCascadingStreamFailuresTool': 'correlation',
  'calculateCorrelationTool': 'correlation',
  'calculateCrossCorrelationTool': 'correlation',
  'calculateCorrelationMatrixTool': 'correlation',
  'detectCausalityTool': 'correlation',
  'detectSynchronizedEventsTool': 'correlation',
  'analyzeCascadingFailuresTool': 'correlation',

  // Quality Assessment Tools
  'assessStreamDataQualityTool': 'quality',
  'monitorStreamHealthTool': 'quality',
  'compareStreamQualityPeriodsTool': 'quality',

  // Tool Discovery Tools
  'discoverToolsTool': 'discovery',
  'getToolInfoTool': 'discovery',
  'suggestWorkflowTool': 'discovery',
  'validateToolCompatibilityTool': 'discovery',

  // Workflow Orchestration Tools
  'executeWorkflowTool': 'orchestration',
  'createCustomWorkflowTool': 'orchestration',
  'optimizeWorkflowTool': 'orchestration',
  'getWorkflowStatusTool': 'orchestration',
};

/**
 * Get the category for a tool name
 */
export function getToolCategory(toolName: string): string {
  return TOOL_CATEGORY_MAP[toolName] || 'other';
}

/**
 * Extract key metrics from tool results for display
 */
export function extractResultSummary(toolResult: any): ResultSummary {
  const summary: ResultSummary = {};

  if (!toolResult || !toolResult.result) {
    return summary;
  }

  const result = toolResult.result;

  // Data points count
  if (result.values?.length) {
    summary.dataPoints = result.values.length;
  } else if (result.count !== undefined) {
    summary.dataPoints = result.count;
  }

  // Anomalies
  if (result.anomalies?.length) {
    summary.anomaliesFound = result.anomalies.length;
  } else if (result.anomalyCount !== undefined) {
    summary.anomaliesFound = result.anomalyCount;
  }

  // Quality metrics
  if (result.quality?.score !== undefined) {
    summary.qualityScore = result.quality.score;
  } else if (result.qualityScore !== undefined) {
    summary.qualityScore = result.qualityScore;
  } else if (result.overallScore !== undefined) {
    summary.qualityScore = result.overallScore;
  }

  if (result.grade) {
    summary.qualityGrade = result.grade;
  }

  // Correlation
  if (result.correlation !== undefined) {
    summary.correlationValue = result.correlation;
  } else if (result.correlationCoefficient !== undefined) {
    summary.correlationValue = result.correlationCoefficient;
  }

  // Streams
  if (Array.isArray(result) && result.length > 0 && result[0].streamId) {
    summary.streamsFound = result.length;
  } else if (result.streams?.length) {
    summary.streamsFound = result.streams.length;
  }

  // Trends
  if (result.trend) {
    summary.trendsDetected = 1;
  }

  // Patterns
  if (result.peaks?.length || result.patterns?.length) {
    summary.patternsFound = (result.peaks?.length || 0) + (result.patterns?.length || 0);
  }

  return summary;
}

/**
 * Truncate result for preview display
 */
export function truncateResult(result: any, maxLength: number = 500): any {
  if (!result) return null;

  const str = JSON.stringify(result);
  if (str.length <= maxLength) return result;

  return {
    _truncated: true,
    _originalLength: str.length,
    preview: str.substring(0, maxLength) + '...'
  };
}

/**
 * Estimate remaining time based on current progress
 */
export function estimateRemainingTime(
  currentStep: number,
  totalSteps: number,
  startTime: number
): number {
  if (currentStep === 0) return 0;

  const elapsed = Date.now() - startTime;
  const avgTimePerStep = elapsed / currentStep;
  const remainingSteps = totalSteps - currentStep;

  return Math.round(avgTimePerStep * remainingSteps);
}

/**
 * Estimate remaining time based on tool execution
 */
export function estimateRemainingTimeByTools(
  toolsExecuted: number,
  totalToolsEstimated: number,
  startTime: number
): number {
  if (toolsExecuted === 0) return 0;

  const elapsed = Date.now() - startTime;
  const avgTimePerTool = elapsed / toolsExecuted;
  const remainingTools = Math.max(0, totalToolsEstimated - toolsExecuted);

  return Math.round(avgTimePerTool * remainingTools);
}

/**
 * Format tool name for display (remove "Tool" suffix and add spaces)
 */
export function formatToolName(toolName: string): string {
  return toolName
    .replace(/Tool$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

/**
 * Format parameter key for display
 */
export function formatParameterKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
}

/**
 * Sanitize parameters for display (remove sensitive data)
 */
export function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    // Skip sensitive fields
    if (key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret')) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Truncate long arrays
    if (Array.isArray(value) && value.length > 10) {
      sanitized[key] = [...value.slice(0, 10), `... ${value.length - 10} more`];
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Get icon for tool category
 */
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'data-retrieval': '🔍',
    'statistics': '📊',
    'time-series': '📈',
    'patterns': '🔄',
    'anomalies': '🔬',
    'correlation': '🔗',
    'quality': '✨',
    'discovery': '🧭',
    'orchestration': '⚙️',
    'other': '🔧'
  };

  return icons[category] || icons['other'];
}

/**
 * Get color class for tool category
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'data-retrieval': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'statistics': 'bg-green-500/10 text-green-600 border-green-500/20',
    'time-series': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    'patterns': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    'anomalies': 'bg-red-500/10 text-red-600 border-red-500/20',
    'correlation': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    'quality': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    'discovery': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    'orchestration': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    'other': 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  };

  return colors[category] || colors['other'];
}

/**
 * Format time duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get tool purpose explanation for reasoning display
 */
export function getToolPurpose(toolName: string): string {
  const purposes: Record<string, string> = {
    // Stream analysis tools
    'listAvailableStreamsTool': 'discover available data streams and their metadata',
    'getStreamRecentDataTool': 'retrieve recent data points for analysis',
    'analyzeStreamStatisticsTool': 'calculate statistical measures (mean, std, etc.)',
    'analyzeStreamTrendTool': 'detect trends and directional patterns',
    'analyzeStreamPatternsTool': 'identify recurring patterns and cycles',
    'analyzeStreamAnomaliesTool': 'detect outliers and anomalous behavior',
    'analyzeStreamAutocorrelationTool': 'measure data self-correlation over time',
    'detectChangePointsTool': 'identify significant changes in data behavior',
    'findPeaksTool': 'locate peaks and maxima in the data',
    'analyzePeakFrequencyTool': 'analyze frequency and spacing of peaks',

    // Mathematical tools
    'correlateTwoStreamsTool': 'measure correlation between two data streams',
    'calculateDerivativeTool': 'compute rate of change and derivatives',
    'smoothDataTool': 'apply smoothing filters to reduce noise',
    'normalizeDataTool': 'normalize data to standard scale',

    // Dashboard tools
    'publishDashboard': 'create and publish analytical dashboards',
    'claudeCodeTool': 'execute custom code analysis',

    // Quality assessment
    'assessDataQualityTool': 'evaluate data completeness and quality',
    'detectOutliersTool': 'identify data points that deviate significantly',

    // Discovery tools
    'discoverStreamRelationshipsTool': 'find relationships between different data streams',
    'identifyDataSourcesTool': 'catalog and describe available data sources'
  };

  return purposes[toolName] || 'perform specialized analysis';
}