/**
 * Universal Mathematical Analysis Tools for LLM
 * Context-aware wrappers around our 42 mathematical functions
 */

import { getStreamRecentData, getStreamTimeWindow, StreamContext } from './stream-tools';
import {
  calculateBasicStats,
  calculateZScores,
  calculateMean,
  calculateStd,
  testNormality,
  calculateEntropy
} from './core-stats';
import {
  calculateLinearTrend,
  simpleMovingAverage,
  exponentialMovingAverage,
  detectChangePoints,
  calculateAutocorrelation,
  detectCyclicPatterns,
  decomposeTimeSeries
} from './time-series';
import {
  findPeaks,
  findValleys,
  detectSpikes,
  findSimilarPatterns,
  detectRepeatingSequences,
  analyzePeakFrequency
} from './pattern-detection';
import {
  zScoreAnomalies,
  modifiedZScore,
  iqrOutliers,
  seasonalAnomalies,
  ensembleAnomalyDetection,
  adaptiveThresholding
} from './anomaly-detection';

export interface AnalysisResult {
  streamId: string;
  sensorType: string;
  unit: string;
  method: string;
  result: any;
  interpretation: string;
  quality: {
    dataQuality: number;
    confidence: number;
    reliability: string;
  };
  context: {
    sampleSize: number;
    timeRange?: { from: Date; to: Date };
    parameters: Record<string, any>;
  };
}

/**
 * Universal Statistical Analysis - Basic Stats for any stream
 */
export async function analyzeStreamStatistics(params: {
  streamId: string;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<AnalysisResult> {
  // Get stream data with context
  const streamData = params.timeRange
    ? await getStreamTimeWindow({
        streamId: params.streamId,
        from: params.timeRange.from,
        to: params.timeRange.to
      })
    : await getStreamRecentData({
        streamId: params.streamId,
        count: params.count || 200
      });

  // Apply universal math
  const stats = calculateBasicStats(streamData.values);

  // Generate context-aware interpretation
  const interpretation = `${streamData.sensorType} statistics: mean=${stats.mean.toFixed(3)}${streamData.unit}, std=${stats.std.toFixed(3)}${streamData.unit}, range=[${stats.min.toFixed(2)}-${stats.max.toFixed(2)}]${streamData.unit}. Distribution skewness=${stats.skewness.toFixed(3)} ${stats.skewness > 1 ? '(right-skewed)' : stats.skewness < -1 ? '(left-skewed)' : '(symmetric)'}.`;

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    method: 'basic-statistics',
    result: stats,
    interpretation,
    quality: {
      dataQuality: streamData.quality.score,
      confidence: Math.min(0.95, streamData.values.length / 100),
      reliability: streamData.quality.score > 0.8 ? 'high' : streamData.quality.score > 0.6 ? 'medium' : 'low'
    },
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange,
      parameters: { method: 'comprehensive' }
    }
  };
}

/**
 * Universal Trend Analysis - Works for any time series
 */
export async function analyzeStreamTrend(params: {
  streamId: string;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<AnalysisResult> {
  const streamData = params.timeRange
    ? await getStreamTimeWindow({
        streamId: params.streamId,
        from: params.timeRange.from,
        to: params.timeRange.to
      })
    : await getStreamRecentData({
        streamId: params.streamId,
        count: params.count || 200
      });

  const trend = calculateLinearTrend(streamData.values);

  // Context-aware interpretation
  let interpretation = `${streamData.sensorType} shows ${trend.direction} trend`;
  if (trend.direction !== 'stable') {
    const ratePerHour = trend.slope * 3600; // Assuming 1 second intervals
    interpretation += ` at ${Math.abs(ratePerHour).toFixed(4)}${streamData.unit}/hour`;
  }
  interpretation += `. Trend strength: ${trend.strength} (R²=${trend.rSquared.toFixed(3)})`;

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    method: 'linear-trend-analysis',
    result: trend,
    interpretation,
    quality: {
      dataQuality: streamData.quality.score,
      confidence: trend.rSquared,
      reliability: trend.rSquared > 0.7 ? 'high' : trend.rSquared > 0.3 ? 'medium' : 'low'
    },
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange,
      parameters: { method: 'least-squares' }
    }
  };
}

/**
 * Universal Anomaly Detection - Adaptive to any data type
 */
export async function analyzeStreamAnomalies(params: {
  streamId: string;
  methods?: string[];
  threshold?: number;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<AnalysisResult> {
  const streamData = params.timeRange
    ? await getStreamTimeWindow({
        streamId: params.streamId,
        from: params.timeRange.from,
        to: params.timeRange.to
      })
    : await getStreamRecentData({
        streamId: params.streamId,
        count: params.count || 500
      });

  const methods = params.methods || ['z-score', 'modified-z-score', 'iqr'];

  // Use ensemble method for robustness
  const anomalies = ensembleAnomalyDetection(streamData.values, methods);

  // Context-aware interpretation
  const severeCounts = anomalies.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let interpretation = `Found ${anomalies.length} anomalies in ${streamData.sensorType} data`;
  if (anomalies.length > 0) {
    const severityDesc = Object.entries(severeCounts)
      .map(([severity, count]) => `${count} ${severity}`)
      .join(', ');
    interpretation += ` (${severityDesc})`;

    const topAnomaly = anomalies[0];
    const timestamp = streamData.timestamps[topAnomaly.index];
    interpretation += `. Most significant: ${topAnomaly.consensusScore.toFixed(2)} score at ${timestamp.toISOString()}`;
  }

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    method: 'ensemble-anomaly-detection',
    result: {
      anomalies,
      totalAnomalies: anomalies.length,
      anomalyRate: anomalies.length / streamData.values.length,
      severityBreakdown: severeCounts,
      methods: methods
    },
    interpretation,
    quality: {
      dataQuality: streamData.quality.score,
      confidence: anomalies.length > 0 ? Math.min(...anomalies.map(a => a.confidence)) : 1.0,
      reliability: streamData.quality.score > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange,
      parameters: { methods, threshold: params.threshold }
    }
  };
}

/**
 * Universal Pattern Detection - Find patterns in any stream
 */
export async function analyzeStreamPatterns(params: {
  streamId: string;
  patternTypes?: string[];
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<AnalysisResult> {
  const streamData = params.timeRange
    ? await getStreamTimeWindow({
        streamId: params.streamId,
        from: params.timeRange.from,
        to: params.timeRange.to
      })
    : await getStreamRecentData({
        streamId: params.streamId,
        count: params.count || 300
      });

  const patternTypes = params.patternTypes || ['peaks', 'spikes', 'cycles'];
  const results: any = {};

  // Find peaks if requested
  if (patternTypes.includes('peaks')) {
    results.peaks = findPeaks(streamData.values);
    results.valleys = findValleys(streamData.values);
  }

  // Find spikes if requested
  if (patternTypes.includes('spikes')) {
    results.spikes = detectSpikes(streamData.values);
  }

  // Find cycles if requested
  if (patternTypes.includes('cycles')) {
    results.cycles = detectCyclicPatterns(streamData.values);
  }

  // Find repeating patterns if requested
  if (patternTypes.includes('repeating')) {
    results.repeatingSequences = detectRepeatingSequences(streamData.values);
  }

  // Generate interpretation
  let interpretation = `Pattern analysis for ${streamData.sensorType}:`;
  if (results.peaks) {
    interpretation += ` ${results.peaks.length} peaks, ${results.valleys.length} valleys detected.`;
  }
  if (results.spikes) {
    interpretation += ` ${results.spikes.length} spikes found.`;
  }
  if (results.cycles && results.cycles.periods.length > 0) {
    interpretation += ` Cyclical patterns detected at periods: ${results.cycles.periods.slice(0, 3).join(', ')}.`;
  }

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    method: 'pattern-detection',
    result: results,
    interpretation,
    quality: {
      dataQuality: streamData.quality.score,
      confidence: Math.min(0.9, streamData.values.length / 200),
      reliability: streamData.quality.score > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange,
      parameters: { patternTypes }
    }
  };
}

/**
 * Universal Autocorrelation Analysis - Find temporal dependencies
 */
export async function analyzeStreamAutocorrelation(params: {
  streamId: string;
  maxLag?: number;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<AnalysisResult> {
  const streamData = params.timeRange
    ? await getStreamTimeWindow({
        streamId: params.streamId,
        from: params.timeRange.from,
        to: params.timeRange.to
      })
    : await getStreamRecentData({
        streamId: params.streamId,
        count: params.count || 400
      });

  const autocorr = calculateAutocorrelation(streamData.values, params.maxLag);

  let interpretation = `Autocorrelation analysis for ${streamData.sensorType}:`;
  interpretation += ` ${autocorr.isPersistent ? 'Persistent' : 'Non-persistent'} time series.`;
  if (autocorr.optimalLag > 0) {
    interpretation += ` Strongest autocorrelation at lag ${autocorr.optimalLag} (${autocorr.correlations[autocorr.optimalLag]?.toFixed(3)}).`;
  }
  if (autocorr.significantLags.length > 0) {
    interpretation += ` ${autocorr.significantLags.length} significant lags detected.`;
  }

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    method: 'autocorrelation-analysis',
    result: autocorr,
    interpretation,
    quality: {
      dataQuality: streamData.quality.score,
      confidence: Math.min(0.9, streamData.values.length / 300),
      reliability: streamData.quality.score > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange,
      parameters: { maxLag: params.maxLag }
    }
  };
}

/**
 * Universal Moving Average Analysis
 */
export async function analyzeStreamMovingAverage(params: {
  streamId: string;
  window?: number;
  type?: 'simple' | 'exponential';
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<AnalysisResult> {
  const streamData = params.timeRange
    ? await getStreamTimeWindow({
        streamId: params.streamId,
        from: params.timeRange.from,
        to: params.timeRange.to
      })
    : await getStreamRecentData({
        streamId: params.streamId,
        count: params.count || 200
      });

  const window = params.window || Math.min(20, Math.floor(streamData.values.length / 10));
  const type = params.type || 'simple';

  const ma = type === 'simple'
    ? simpleMovingAverage(streamData.values, window)
    : exponentialMovingAverage(streamData.values);

  // Calculate deviation from moving average
  const deviations = streamData.values.map((val, i) => Math.abs(val - ma[i]));
  const avgDeviation = calculateMean(deviations);

  const interpretation = `${type === 'simple' ? 'Simple' : 'Exponential'} moving average for ${streamData.sensorType} (window=${window}): Average deviation from trend is ${avgDeviation.toFixed(3)}${streamData.unit}`;

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    method: `${type}-moving-average`,
    result: {
      movingAverage: ma,
      averageDeviation: avgDeviation,
      window: window,
      type: type
    },
    interpretation,
    quality: {
      dataQuality: streamData.quality.score,
      confidence: Math.min(0.95, streamData.values.length / 100),
      reliability: streamData.quality.score > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange,
      parameters: { window, type }
    }
  };
}