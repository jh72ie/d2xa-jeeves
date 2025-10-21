/**
 * Time Series Analysis Functions
 * Temporal pattern detection and trend analysis
 */

import { calculateMean, calculateStd } from './core-stats';

export interface TrendResult {
  slope: number;
  intercept: number;
  rSquared: number;
  direction: 'up' | 'down' | 'stable';
  strength: 'weak' | 'moderate' | 'strong';
}

export interface ChangePoint {
  index: number;
  timestamp?: Date;
  significance: number;
  beforeMean: number;
  afterMean: number;
  changeType: 'mean' | 'variance' | 'trend';
}

export interface SeasonalDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalPeriod: number;
}

export interface AutocorrelationResult {
  correlations: number[];
  significantLags: number[];
  optimalLag: number;
  isPersistent: boolean;
}

/**
 * Calculate linear trend using least squares regression
 */
export function calculateLinearTrend(values: number[]): TrendResult {
  if (values.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      direction: 'stable',
      strength: 'weak'
    };
  }

  const n = values.length;
  const xValues = Array.from({ length: n }, (_, i) => i);

  const xMean = calculateMean(xValues);
  const yMean = calculateMean(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  let ssRes = 0; // Sum of squares of residuals
  let ssTot = 0; // Total sum of squares

  for (let i = 0; i < n; i++) {
    const predicted = slope * xValues[i] + intercept;
    ssRes += Math.pow(values[i] - predicted, 2);
    ssTot += Math.pow(values[i] - yMean, 2);
  }

  const rSquared = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

  // Determine direction and strength
  const direction = slope > 0.001 ? 'up' : slope < -0.001 ? 'down' : 'stable';
  const strength = rSquared > 0.7 ? 'strong' : rSquared > 0.3 ? 'moderate' : 'weak';

  return {
    slope,
    intercept,
    rSquared,
    direction,
    strength
  };
}

/**
 * Simple moving average
 */
export function simpleMovingAverage(values: number[], window: number): number[] {
  if (window <= 0 || window > values.length) return [...values];

  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      // For initial values, use available data
      const slice = values.slice(0, i + 1);
      result.push(calculateMean(slice));
    } else {
      const slice = values.slice(i - window + 1, i + 1);
      result.push(calculateMean(slice));
    }
  }

  return result;
}

/**
 * Exponential moving average
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  if (alpha <= 0 || alpha > 1) alpha = 0.3;

  const result: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Moving standard deviation
 */
export function movingStandardDeviation(values: number[], window: number): number[] {
  if (window <= 0 || window > values.length) return new Array(values.length).fill(0);

  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      const slice = values.slice(0, i + 1);
      result.push(calculateStd(slice));
    } else {
      const slice = values.slice(i - window + 1, i + 1);
      result.push(calculateStd(slice));
    }
  }

  return result;
}

/**
 * Detect change points in time series using CUSUM algorithm
 */
export function detectChangePoints(values: number[], threshold: number = 2.0): ChangePoint[] {
  if (values.length < 10) return [];

  const changePoints: ChangePoint[] = [];
  const mean = calculateMean(values);
  const std = calculateStd(values);

  if (std === 0) return [];

  let cumulativeSum = 0;
  let maxCumSum = 0;
  let minCumSum = 0;

  for (let i = 1; i < values.length; i++) {
    const standardized = (values[i] - mean) / std;
    cumulativeSum += standardized;

    if (cumulativeSum > maxCumSum) {
      maxCumSum = cumulativeSum;
    }
    if (cumulativeSum < minCumSum) {
      minCumSum = cumulativeSum;
    }

    // Check for upward change point
    if (maxCumSum - cumulativeSum > threshold) {
      const beforeSlice = values.slice(Math.max(0, i - 10), i);
      const afterSlice = values.slice(i, Math.min(values.length, i + 10));

      changePoints.push({
        index: i,
        significance: maxCumSum - cumulativeSum,
        beforeMean: calculateMean(beforeSlice),
        afterMean: calculateMean(afterSlice),
        changeType: 'mean'
      });

      maxCumSum = 0;
      cumulativeSum = 0;
    }

    // Check for downward change point
    if (cumulativeSum - minCumSum > threshold) {
      const beforeSlice = values.slice(Math.max(0, i - 10), i);
      const afterSlice = values.slice(i, Math.min(values.length, i + 10));

      changePoints.push({
        index: i,
        significance: cumulativeSum - minCumSum,
        beforeMean: calculateMean(beforeSlice),
        afterMean: calculateMean(afterSlice),
        changeType: 'mean'
      });

      minCumSum = 0;
      cumulativeSum = 0;
    }
  }

  return changePoints;
}

/**
 * Calculate autocorrelation function
 */
export function calculateAutocorrelation(values: number[], maxLag?: number): AutocorrelationResult {
  if (values.length < 3) {
    return {
      correlations: [],
      significantLags: [],
      optimalLag: 0,
      isPersistent: false
    };
  }

  const n = values.length;
  const effectiveMaxLag = maxLag || Math.min(Math.floor(n / 4), 50);
  const mean = calculateMean(values);
  const variance = calculateStd(values) ** 2;

  if (variance === 0) {
    return {
      correlations: new Array(effectiveMaxLag + 1).fill(1),
      significantLags: [],
      optimalLag: 0,
      isPersistent: true
    };
  }

  const correlations: number[] = [];

  // Calculate autocorrelation for each lag
  for (let lag = 0; lag <= effectiveMaxLag; lag++) {
    let covariance = 0;
    const count = n - lag;

    for (let i = 0; i < count; i++) {
      covariance += (values[i] - mean) * (values[i + lag] - mean);
    }

    covariance /= count;
    const correlation = covariance / variance;
    correlations.push(correlation);
  }

  // Find significant lags (above confidence interval)
  const confidenceThreshold = 1.96 / Math.sqrt(n); // 95% confidence
  const significantLags = correlations
    .map((corr, lag) => ({ corr: Math.abs(corr), lag }))
    .filter(({ corr, lag }) => lag > 0 && corr > confidenceThreshold)
    .map(({ lag }) => lag);

  // Find optimal lag (first significant lag or highest correlation)
  let optimalLag = 0;
  if (significantLags.length > 0) {
    optimalLag = significantLags[0];
  } else {
    let maxCorr = 0;
    for (let i = 1; i < correlations.length; i++) {
      if (Math.abs(correlations[i]) > maxCorr) {
        maxCorr = Math.abs(correlations[i]);
        optimalLag = i;
      }
    }
  }

  // Check if series is persistent (slow decay of autocorrelation)
  const decayRate = correlations.length > 5 ? correlations[5] / correlations[1] : 0;
  const isPersistent = decayRate > 0.7;

  return {
    correlations,
    significantLags,
    optimalLag,
    isPersistent
  };
}

/**
 * Detect cyclical patterns using FFT approximation
 */
export function detectCyclicPatterns(values: number[]): { periods: number[]; strengths: number[] } {
  if (values.length < 8) return { periods: [], strengths: [] };

  // Simple peak detection in autocorrelation function
  const autocorr = calculateAutocorrelation(values);
  const correlations = autocorr.correlations;

  const periods: number[] = [];
  const strengths: number[] = [];

  // Look for peaks in autocorrelation (indicating cycles)
  for (let i = 2; i < correlations.length - 2; i++) {
    const current = correlations[i];
    const prev1 = correlations[i - 1];
    const prev2 = correlations[i - 2];
    const next1 = correlations[i + 1];
    const next2 = correlations[i + 2];

    // Check if this is a local maximum above threshold
    if (current > 0.3 &&
        current > prev1 && current > prev2 &&
        current > next1 && current > next2) {
      periods.push(i);
      strengths.push(current);
    }
  }

  return { periods, strengths };
}

/**
 * Simple seasonal decomposition
 */
export function decomposeTimeSeries(values: number[], period: number): SeasonalDecomposition {
  if (values.length < period * 2) {
    return {
      trend: [...values],
      seasonal: new Array(values.length).fill(0),
      residual: new Array(values.length).fill(0),
      seasonalPeriod: period
    };
  }

  // Calculate trend using moving average
  const trend = simpleMovingAverage(values, period);

  // Calculate seasonal component
  const seasonal: number[] = new Array(values.length).fill(0);
  const seasonalAverages: number[] = new Array(period).fill(0);
  const seasonalCounts: number[] = new Array(period).fill(0);

  // Compute seasonal averages
  for (let i = 0; i < values.length; i++) {
    const seasonIndex = i % period;
    const detrended = values[i] - trend[i];
    seasonalAverages[seasonIndex] += detrended;
    seasonalCounts[seasonIndex]++;
  }

  // Normalize seasonal averages
  for (let i = 0; i < period; i++) {
    if (seasonalCounts[i] > 0) {
      seasonalAverages[i] /= seasonalCounts[i];
    }
  }

  // Apply seasonal pattern
  for (let i = 0; i < values.length; i++) {
    seasonal[i] = seasonalAverages[i % period];
  }

  // Calculate residuals
  const residual: number[] = values.map((val, i) => val - trend[i] - seasonal[i]);

  return {
    trend,
    seasonal,
    residual,
    seasonalPeriod: period
  };
}