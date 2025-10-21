/**
 * Stream Quality Assessment Tools for LLM
 * Data quality evaluation, gap detection, and data health monitoring
 */

import { getStreamRecentData, getStreamTimeWindow, StreamContext, DataQuality } from './stream-tools';
import { AnalysisResult } from './analysis-tools';
import { calculateBasicStats, calculateStd, calculateMean } from './core-stats';

export interface QualityReport {
  streamId: string;
  sensorType: string;
  unit: string;
  overallScore: number; // 0-1
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: QualityIssue[];
  recommendations: string[];
  assessment: {
    completeness: number;
    consistency: number;
    accuracy: number;
    timeliness: number;
  };
  context: {
    sampleSize: number;
    timeRange: { from: Date; to: Date };
    evaluationTimestamp: Date;
  };
}

export interface QualityIssue {
  type: 'missing_data' | 'outliers' | 'gaps' | 'drift' | 'noise' | 'duplicates' | 'range_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  percentage: number;
  description: string;
  locations?: number[];
  suggestedAction: string;
}

export interface DataHealthTrend {
  streamId: string;
  sensorType: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  recentChanges: Array<{
    timestamp: Date;
    changeType: string;
    impact: number;
    description: string;
  }>;
}

/**
 * Comprehensive data quality assessment
 */
export async function assessStreamDataQuality(params: {
  streamId: string;
  count?: number;
  timeRange?: { from: Date; to: Date };
  expectedRange?: { min: number; max: number };
  expectedSamplingRate?: number;
}): Promise<QualityReport> {
  // Get stream data
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

  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];

  // 1. Completeness Assessment
  const completeness = assessCompleteness(streamData, params.expectedSamplingRate);
  if (completeness.score < 0.9) {
    issues.push({
      type: 'missing_data',
      severity: completeness.score < 0.7 ? 'high' : 'medium',
      count: completeness.missingCount,
      percentage: (1 - completeness.score) * 100,
      description: `${completeness.missingCount} data points missing (${((1 - completeness.score) * 100).toFixed(1)}% incomplete)`,
      suggestedAction: 'Check sensor connectivity and data pipeline'
    });
    recommendations.push('Investigate data collection reliability');
  }

  // 2. Accuracy Assessment (outliers and range violations)
  const accuracy = assessAccuracy(streamData, params.expectedRange);
  if (accuracy.outliers.length > 0) {
    issues.push({
      type: 'outliers',
      severity: accuracy.outliers.length > streamData.values.length * 0.1 ? 'high' : 'medium',
      count: accuracy.outliers.length,
      percentage: (accuracy.outliers.length / streamData.values.length) * 100,
      description: `${accuracy.outliers.length} statistical outliers detected`,
      locations: accuracy.outliers,
      suggestedAction: 'Review sensor calibration and environmental factors'
    });
  }

  if (accuracy.rangeViolations.length > 0) {
    issues.push({
      type: 'range_violation',
      severity: 'high',
      count: accuracy.rangeViolations.length,
      percentage: (accuracy.rangeViolations.length / streamData.values.length) * 100,
      description: `${accuracy.rangeViolations.length} values outside expected range`,
      locations: accuracy.rangeViolations,
      suggestedAction: 'Validate sensor specifications and check for malfunctions'
    });
    recommendations.push('Verify sensor operating parameters');
  }

  // 3. Consistency Assessment (drift, noise)
  const consistency = assessConsistency(streamData);
  if (consistency.driftScore > 0.3) {
    issues.push({
      type: 'drift',
      severity: consistency.driftScore > 0.6 ? 'high' : 'medium',
      count: 1,
      percentage: consistency.driftScore * 100,
      description: `Sensor drift detected (score: ${consistency.driftScore.toFixed(3)})`,
      suggestedAction: 'Schedule sensor recalibration'
    });
    recommendations.push('Monitor for continued drift and plan calibration');
  }

  if (consistency.noiseLevel > 0.4) {
    issues.push({
      type: 'noise',
      severity: 'medium',
      count: 1,
      percentage: consistency.noiseLevel * 100,
      description: `High noise level detected (${(consistency.noiseLevel * 100).toFixed(1)}%)`,
      suggestedAction: 'Check for electrical interference or mechanical vibrations'
    });
  }

  // 4. Timeliness Assessment (gaps)
  const timeliness = assessTimeliness(streamData, params.expectedSamplingRate);
  if (timeliness.gaps.length > 0) {
    issues.push({
      type: 'gaps',
      severity: timeliness.gaps.length > 5 ? 'high' : 'medium',
      count: timeliness.gaps.length,
      percentage: (timeliness.totalGapDuration / timeliness.totalDuration) * 100,
      description: `${timeliness.gaps.length} time gaps found, total gap duration: ${(timeliness.totalGapDuration / 1000).toFixed(1)}s`,
      suggestedAction: 'Investigate data transmission reliability'
    });
    recommendations.push('Improve data collection frequency and reliability');
  }

  // Calculate overall scores
  const scores = {
    completeness: completeness.score,
    consistency: 1 - Math.max(consistency.driftScore, consistency.noiseLevel),
    accuracy: 1 - Math.min(1, (accuracy.outliers.length + accuracy.rangeViolations.length) / streamData.values.length * 10),
    timeliness: Math.max(0, 1 - timeliness.gaps.length / 10)
  };

  const overallScore = (scores.completeness + scores.consistency + scores.accuracy + scores.timeliness) / 4;

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 0.9) grade = 'A';
  else if (overallScore >= 0.8) grade = 'B';
  else if (overallScore >= 0.7) grade = 'C';
  else if (overallScore >= 0.6) grade = 'D';
  else grade = 'F';

  // Add general recommendations
  if (overallScore < 0.8) {
    recommendations.push('Consider implementing data validation checks');
  }
  if (issues.length > 3) {
    recommendations.push('Prioritize addressing high-severity issues first');
  }

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    unit: streamData.unit,
    overallScore,
    grade,
    issues,
    recommendations,
    assessment: scores,
    context: {
      sampleSize: streamData.values.length,
      timeRange: streamData.timeRange || {
        from: streamData.timestamps[streamData.timestamps.length - 1],
        to: streamData.timestamps[0]
      },
      evaluationTimestamp: new Date()
    }
  };
}

/**
 * Helper: Assess data completeness
 */
function assessCompleteness(streamData: StreamContext, expectedRate?: number): {
  score: number;
  missingCount: number;
} {
  if (!expectedRate) {
    // Simple check for null/undefined values
    const validValues = streamData.values.filter(v => v !== null && v !== undefined && !isNaN(v));
    const score = validValues.length / streamData.values.length;
    return { score, missingCount: streamData.values.length - validValues.length };
  }

  // Time-based completeness check
  const timeSpan = streamData.timestamps[0].getTime() - streamData.timestamps[streamData.timestamps.length - 1].getTime();
  const expectedPoints = Math.floor(timeSpan / 1000 * expectedRate);
  const actualPoints = streamData.values.length;
  const score = Math.min(1, actualPoints / expectedPoints);

  return { score, missingCount: Math.max(0, expectedPoints - actualPoints) };
}

/**
 * Helper: Assess data accuracy
 */
function assessAccuracy(streamData: StreamContext, expectedRange?: { min: number; max: number }): {
  outliers: number[];
  rangeViolations: number[];
} {
  const outliers: number[] = [];
  const rangeViolations: number[] = [];

  // Statistical outlier detection (using IQR method)
  const values = streamData.values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outliers.push(index);
    }

    if (expectedRange && (value < expectedRange.min || value > expectedRange.max)) {
      rangeViolations.push(index);
    }
  });

  return { outliers, rangeViolations };
}

/**
 * Helper: Assess data consistency
 */
function assessConsistency(streamData: StreamContext): {
  driftScore: number;
  noiseLevel: number;
} {
  const values = streamData.values;

  // Detect drift by comparing first and second half means
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);

  const mean1 = calculateMean(firstHalf);
  const mean2 = calculateMean(secondHalf);
  const overallStd = calculateStd(values);

  const driftScore = overallStd > 0 ? Math.abs(mean2 - mean1) / overallStd / 3 : 0;

  // Assess noise level using coefficient of variation
  const overallMean = calculateMean(values);
  const coefficientOfVariation = overallStd / Math.abs(overallMean);
  const noiseLevel = Math.min(1, coefficientOfVariation);

  return { driftScore: Math.min(1, driftScore), noiseLevel };
}

/**
 * Helper: Assess data timeliness
 */
function assessTimeliness(streamData: StreamContext, expectedRate?: number): {
  gaps: Array<{ start: Date; end: Date; duration: number }>;
  totalGapDuration: number;
  totalDuration: number;
} {
  const gaps: Array<{ start: Date; end: Date; duration: number }> = [];

  if (!expectedRate || streamData.timestamps.length < 2) {
    return { gaps, totalGapDuration: 0, totalDuration: 0 };
  }

  const expectedInterval = 1000 / expectedRate; // milliseconds
  const toleranceMultiplier = 2.5;

  for (let i = 1; i < streamData.timestamps.length; i++) {
    const actualInterval = streamData.timestamps[i - 1].getTime() - streamData.timestamps[i].getTime();

    if (actualInterval > expectedInterval * toleranceMultiplier) {
      gaps.push({
        start: streamData.timestamps[i],
        end: streamData.timestamps[i - 1],
        duration: actualInterval
      });
    }
  }

  const totalGapDuration = gaps.reduce((sum, gap) => sum + gap.duration, 0);
  const totalDuration = streamData.timestamps[0].getTime() - streamData.timestamps[streamData.timestamps.length - 1].getTime();

  return { gaps, totalGapDuration, totalDuration };
}

/**
 * Monitor data health trends over time
 */
export async function monitorStreamHealth(params: {
  streamId: string;
  timeRange: { from: Date; to: Date };
  windowSize?: number;
}): Promise<DataHealthTrend> {
  const streamData = await getStreamTimeWindow({
    streamId: params.streamId,
    from: params.timeRange.from,
    to: params.timeRange.to
  });

  const windowSize = params.windowSize || 100;
  const windows = [];

  // Create sliding windows
  for (let i = 0; i < streamData.values.length - windowSize; i += windowSize / 2) {
    const windowValues = streamData.values.slice(i, i + windowSize);
    const windowTimestamps = streamData.timestamps.slice(i, i + windowSize);

    // Assess quality for this window
    const windowQuality = assessStreamDataQuality({
      streamId: params.streamId,
      timeRange: {
        from: windowTimestamps[windowTimestamps.length - 1],
        to: windowTimestamps[0]
      }
    });

    windows.push({
      timestamp: windowTimestamps[Math.floor(windowSize / 2)],
      qualityScore: (await windowQuality).overallScore
    });
  }

  // Calculate trend
  const scores = windows.map(w => w.qualityScore);
  const recentScore = calculateMean(scores.slice(-3));
  const earlierScore = calculateMean(scores.slice(0, 3));

  let trend: 'improving' | 'stable' | 'degrading';
  const trendThreshold = 0.05;

  if (recentScore > earlierScore + trendThreshold) {
    trend = 'improving';
  } else if (recentScore < earlierScore - trendThreshold) {
    trend = 'degrading';
  } else {
    trend = 'stable';
  }

  // Detect recent significant changes
  const recentChanges = [];
  for (let i = 1; i < windows.length; i++) {
    const change = windows[i].qualityScore - windows[i - 1].qualityScore;
    if (Math.abs(change) > 0.1) {
      recentChanges.push({
        timestamp: windows[i].timestamp,
        changeType: change > 0 ? 'improvement' : 'degradation',
        impact: Math.abs(change),
        description: `Quality score ${change > 0 ? 'improved' : 'degraded'} by ${(Math.abs(change) * 100).toFixed(1)}%`
      });
    }
  }

  return {
    streamId: params.streamId,
    sensorType: streamData.sensorType,
    healthScore: recentScore,
    trend,
    recentChanges: recentChanges.slice(-5) // Last 5 significant changes
  };
}

/**
 * Compare stream quality between different time periods
 */
export async function compareStreamQualityPeriods(params: {
  streamId: string;
  period1: { from: Date; to: Date };
  period2: { from: Date; to: Date };
}): Promise<{
  streamId: string;
  sensorType: string;
  period1Quality: QualityReport;
  period2Quality: QualityReport;
  comparison: {
    scoreChange: number;
    trendDirection: 'improved' | 'degraded' | 'unchanged';
    significantChanges: string[];
  };
}> {
  // Get quality reports for both periods
  const [quality1, quality2] = await Promise.all([
    assessStreamDataQuality({
      streamId: params.streamId,
      timeRange: params.period1
    }),
    assessStreamDataQuality({
      streamId: params.streamId,
      timeRange: params.period2
    })
  ]);

  const scoreChange = quality2.overallScore - quality1.overallScore;
  let trendDirection: 'improved' | 'degraded' | 'unchanged';

  if (scoreChange > 0.05) {
    trendDirection = 'improved';
  } else if (scoreChange < -0.05) {
    trendDirection = 'degraded';
  } else {
    trendDirection = 'unchanged';
  }

  // Identify significant changes
  const significantChanges: string[] = [];

  // Compare issue counts
  const issueTypes1 = new Set(quality1.issues.map(i => i.type));
  const issueTypes2 = new Set(quality2.issues.map(i => i.type));

  // New issues
  issueTypes2.forEach(type => {
    if (!issueTypes1.has(type)) {
      significantChanges.push(`New issue type appeared: ${type}`);
    }
  });

  // Resolved issues
  issueTypes1.forEach(type => {
    if (!issueTypes2.has(type)) {
      significantChanges.push(`Issue type resolved: ${type}`);
    }
  });

  // Score changes by dimension
  Object.entries(quality2.assessment).forEach(([dimension, score2]) => {
    const score1 = quality1.assessment[dimension as keyof typeof quality1.assessment];
    const change = score2 - score1;
    if (Math.abs(change) > 0.1) {
      significantChanges.push(
        `${dimension} ${change > 0 ? 'improved' : 'degraded'} by ${(Math.abs(change) * 100).toFixed(1)}%`
      );
    }
  });

  return {
    streamId: params.streamId,
    sensorType: quality1.sensorType,
    period1Quality: quality1,
    period2Quality: quality2,
    comparison: {
      scoreChange,
      trendDirection,
      significantChanges
    }
  };
}