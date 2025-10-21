/**
 * Advanced Anomaly Detection Functions
 * Sophisticated outlier detection beyond simple z-scores
 */

import { calculateMean, calculateStd, calculateQuantile } from './core-stats';
import { calculateLinearTrend } from './time-series';

export interface AnomalyResult {
  index: number;
  value: number;
  score: number;
  method: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  context?: any;
}

export interface OutlierDetectionResult {
  outliers: AnomalyResult[];
  threshold: number;
  method: string;
  totalAnomalies: number;
}

export interface SeasonalAnomalyResult extends AnomalyResult {
  expectedValue: number;
  seasonalDeviation: number;
  context: {
    season: number;
    seasonalPattern: number[];
  };
}

export interface EnsembleAnomalyResult {
  index: number;
  value: number;
  consensusScore: number;
  methodScores: Record<string, number>;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Z-score based anomaly detection with configurable threshold
 */
export function zScoreAnomalies(
  values: number[],
  threshold: number = 3.0
): OutlierDetectionResult {
  if (values.length < 3) {
    return { outliers: [], threshold, method: 'z-score', totalAnomalies: 0 };
  }

  const mean = calculateMean(values);
  const std = calculateStd(values);

  if (std === 0) {
    return { outliers: [], threshold, method: 'z-score', totalAnomalies: 0 };
  }

  const outliers: AnomalyResult[] = [];

  values.forEach((value, index) => {
    const zScore = Math.abs(value - mean) / std;

    if (zScore > threshold) {
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (zScore > 4) severity = 'critical';
      else if (zScore > 3.5) severity = 'high';
      else if (zScore > 3) severity = 'medium';
      else severity = 'low';

      outliers.push({
        index,
        value,
        score: zScore,
        method: 'z-score',
        severity,
        confidence: Math.min(0.99, zScore / 5)
      });
    }
  });

  return {
    outliers: outliers.sort((a, b) => b.score - a.score),
    threshold,
    method: 'z-score',
    totalAnomalies: outliers.length
  };
}

/**
 * Modified Z-score (using median absolute deviation)
 */
export function modifiedZScore(
  values: number[],
  threshold: number = 3.5
): OutlierDetectionResult {
  if (values.length < 3) {
    return { outliers: [], threshold, method: 'modified-z-score', totalAnomalies: 0 };
  }

  const median = calculateQuantile(values, 0.5);
  const medianAbsoluteDeviations = values.map(val => Math.abs(val - median));
  const mad = calculateQuantile(medianAbsoluteDeviations, 0.5);

  if (mad === 0) {
    return { outliers: [], threshold, method: 'modified-z-score', totalAnomalies: 0 };
  }

  const outliers: AnomalyResult[] = [];
  const madConstant = 1.4826; // For consistency with standard deviation

  values.forEach((value, index) => {
    const modifiedZ = (0.6745 * (value - median)) / (mad * madConstant);
    const absModifiedZ = Math.abs(modifiedZ);

    if (absModifiedZ > threshold) {
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (absModifiedZ > 5) severity = 'critical';
      else if (absModifiedZ > 4.5) severity = 'high';
      else if (absModifiedZ > 4) severity = 'medium';
      else severity = 'low';

      outliers.push({
        index,
        value,
        score: absModifiedZ,
        method: 'modified-z-score',
        severity,
        confidence: Math.min(0.99, absModifiedZ / 6)
      });
    }
  });

  return {
    outliers: outliers.sort((a, b) => b.score - a.score),
    threshold,
    method: 'modified-z-score',
    totalAnomalies: outliers.length
  };
}

/**
 * Interquartile Range (IQR) method for outlier detection
 */
export function iqrOutliers(
  values: number[],
  multiplier: number = 1.5
): OutlierDetectionResult {
  if (values.length < 4) {
    return { outliers: [], threshold: multiplier, method: 'iqr', totalAnomalies: 0 };
  }

  const q1 = calculateQuantile(values, 0.25);
  const q3 = calculateQuantile(values, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const outliers: AnomalyResult[] = [];

  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      const distanceFromBound = Math.min(
        Math.abs(value - lowerBound),
        Math.abs(value - upperBound)
      );
      const score = distanceFromBound / iqr;

      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (score > 3) severity = 'critical';
      else if (score > 2) severity = 'high';
      else if (score > 1) severity = 'medium';
      else severity = 'low';

      outliers.push({
        index,
        value,
        score,
        method: 'iqr',
        severity,
        confidence: Math.min(0.95, score / 4)
      });
    }
  });

  return {
    outliers: outliers.sort((a, b) => b.score - a.score),
    threshold: multiplier,
    method: 'iqr',
    totalAnomalies: outliers.length
  };
}

/**
 * Local Outlier Factor (LOF) - simplified version
 */
export function localOutlierFactor(
  values: number[],
  k: number = 5,
  threshold: number = 1.5
): OutlierDetectionResult {
  if (values.length < k + 2) {
    return { outliers: [], threshold, method: 'lof', totalAnomalies: 0 };
  }

  const outliers: AnomalyResult[] = [];

  // For each point, calculate its local outlier factor
  values.forEach((value, index) => {
    // Find k nearest neighbors
    const distances = values
      .map((otherValue, otherIndex) => ({
        distance: Math.abs(value - otherValue),
        index: otherIndex
      }))
      .filter(d => d.index !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);

    if (distances.length === 0) return;

    // Calculate local reachability density
    const kDistance = distances[distances.length - 1].distance;
    const reachabilityDistance = kDistance === 0 ? 1e-6 : kDistance;
    const localDensity = 1 / reachabilityDistance;

    // Calculate LOF score (simplified)
    const neighborDensities = distances.map(d => {
      const neighborValue = values[d.index];
      const neighborDistances = values
        .map((v, i) => ({ distance: Math.abs(neighborValue - v), index: i }))
        .filter(nd => nd.index !== d.index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, k);

      const neighborKDistance = neighborDistances[neighborDistances.length - 1]?.distance || 1e-6;
      return 1 / neighborKDistance;
    });

    const avgNeighborDensity = calculateMean(neighborDensities);
    const lofScore = avgNeighborDensity / localDensity;

    if (lofScore > threshold) {
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (lofScore > 3) severity = 'critical';
      else if (lofScore > 2.5) severity = 'high';
      else if (lofScore > 2) severity = 'medium';
      else severity = 'low';

      outliers.push({
        index,
        value,
        score: lofScore,
        method: 'lof',
        severity,
        confidence: Math.min(0.9, lofScore / 4)
      });
    }
  });

  return {
    outliers: outliers.sort((a, b) => b.score - a.score),
    threshold,
    method: 'lof',
    totalAnomalies: outliers.length
  };
}

/**
 * Seasonal anomaly detection
 */
export function seasonalAnomalies(
  values: number[],
  seasonLength: number,
  threshold: number = 2.5
): SeasonalAnomalyResult[] {
  if (values.length < seasonLength * 2) return [];

  const seasonalAnomalies: SeasonalAnomalyResult[] = [];

  // Calculate seasonal patterns
  const seasonalPattern: number[] = new Array(seasonLength).fill(0);
  const seasonalCounts: number[] = new Array(seasonLength).fill(0);

  // Compute average for each seasonal position
  for (let i = 0; i < values.length; i++) {
    const seasonIndex = i % seasonLength;
    seasonalPattern[seasonIndex] += values[i];
    seasonalCounts[seasonIndex]++;
  }

  for (let i = 0; i < seasonLength; i++) {
    if (seasonalCounts[i] > 0) {
      seasonalPattern[i] /= seasonalCounts[i];
    }
  }

  // Calculate seasonal standard deviations
  const seasonalStds: number[] = new Array(seasonLength).fill(0);
  const seasonalVariances: number[] = new Array(seasonLength).fill(0);

  for (let i = 0; i < values.length; i++) {
    const seasonIndex = i % seasonLength;
    const deviation = values[i] - seasonalPattern[seasonIndex];
    seasonalVariances[seasonIndex] += deviation * deviation;
  }

  for (let i = 0; i < seasonLength; i++) {
    if (seasonalCounts[i] > 1) {
      seasonalStds[i] = Math.sqrt(seasonalVariances[i] / (seasonalCounts[i] - 1));
    }
  }

  // Find seasonal anomalies
  for (let i = 0; i < values.length; i++) {
    const seasonIndex = i % seasonLength;
    const expected = seasonalPattern[seasonIndex];
    const std = seasonalStds[seasonIndex];

    if (std > 0) {
      const deviation = Math.abs(values[i] - expected) / std;

      if (deviation > threshold) {
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (deviation > 4) severity = 'critical';
        else if (deviation > 3.5) severity = 'high';
        else if (deviation > 3) severity = 'medium';
        else severity = 'low';

        seasonalAnomalies.push({
          index: i,
          value: values[i],
          score: deviation,
          method: 'seasonal',
          severity,
          confidence: Math.min(0.95, deviation / 5),
          expectedValue: expected,
          seasonalDeviation: std,
          context: {
            season: seasonIndex,
            seasonalPattern
          }
        });
      }
    }
  }

  return seasonalAnomalies.sort((a, b) => b.score - a.score);
}

/**
 * Trend deviation anomalies
 */
export function trendDeviationAnomalies(
  values: number[],
  windowSize: number = 20,
  threshold: number = 3.0
): AnomalyResult[] {
  if (values.length < windowSize) return [];

  const anomalies: AnomalyResult[] = [];

  for (let i = windowSize; i < values.length; i++) {
    const window = values.slice(i - windowSize, i);
    const trend = calculateLinearTrend(window);

    // Predict next value based on trend
    const predicted = trend.intercept + trend.slope * windowSize;
    const actual = values[i];

    // Calculate residual standard deviation from trend
    const residuals = window.map((val, idx) => {
      const trendValue = trend.intercept + trend.slope * idx;
      return val - trendValue;
    });

    const residualStd = calculateStd(residuals);

    if (residualStd > 0) {
      const deviation = Math.abs(actual - predicted) / residualStd;

      if (deviation > threshold) {
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (deviation > 5) severity = 'critical';
        else if (deviation > 4) severity = 'high';
        else if (deviation > 3.5) severity = 'medium';
        else severity = 'low';

        anomalies.push({
          index: i,
          value: actual,
          score: deviation,
          method: 'trend-deviation',
          severity,
          confidence: Math.min(0.9, deviation / 6),
          context: {
            predicted,
            trendSlope: trend.slope,
            trendConfidence: trend.rSquared
          }
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.score - a.score);
}

/**
 * Ensemble anomaly detection combining multiple methods
 */
export function ensembleAnomalyDetection(
  values: number[],
  methods: string[] = ['z-score', 'modified-z-score', 'iqr', 'lof'],
  consensusThreshold: number = 0.6
): EnsembleAnomalyResult[] {
  if (values.length < 5) return [];

  const methodResults: Record<string, OutlierDetectionResult> = {};

  // Run all requested methods
  if (methods.includes('z-score')) {
    methodResults['z-score'] = zScoreAnomalies(values);
  }
  if (methods.includes('modified-z-score')) {
    methodResults['modified-z-score'] = modifiedZScore(values);
  }
  if (methods.includes('iqr')) {
    methodResults['iqr'] = iqrOutliers(values);
  }
  if (methods.includes('lof')) {
    methodResults['lof'] = localOutlierFactor(values);
  }

  // Combine results
  const indexScores: Record<number, Record<string, number>> = {};

  Object.entries(methodResults).forEach(([method, result]) => {
    result.outliers.forEach(outlier => {
      if (!indexScores[outlier.index]) {
        indexScores[outlier.index] = {};
      }
      indexScores[outlier.index][method] = outlier.score;
    });
  });

  const ensembleResults: EnsembleAnomalyResult[] = [];

  Object.entries(indexScores).forEach(([indexStr, methodScores]) => {
    const index = parseInt(indexStr);
    const numMethods = Object.keys(methodScores).length;
    const consensus = numMethods / methods.length;

    if (consensus >= consensusThreshold) {
      // Calculate consensus score (weighted average)
      const scores = Object.values(methodScores);
      const consensusScore = calculateMean(scores);

      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (consensusScore > 4 && consensus > 0.8) severity = 'critical';
      else if (consensusScore > 3 && consensus > 0.7) severity = 'high';
      else if (consensusScore > 2.5 && consensus > 0.6) severity = 'medium';
      else severity = 'low';

      ensembleResults.push({
        index,
        value: values[index],
        consensusScore,
        methodScores,
        confidence: consensus,
        severity
      });
    }
  });

  return ensembleResults.sort((a, b) => b.consensusScore - a.consensusScore);
}

/**
 * Adaptive threshold anomaly detection
 */
export function adaptiveThresholding(
  values: number[],
  windowSize: number = 50,
  sensitivity: number = 3.0
): AnomalyResult[] {
  if (values.length < windowSize) return [];

  const anomalies: AnomalyResult[] = [];

  for (let i = windowSize; i < values.length; i++) {
    const window = values.slice(i - windowSize, i);
    const mean = calculateMean(window);
    const std = calculateStd(window);

    if (std > 0) {
      const current = values[i];
      const zScore = Math.abs(current - mean) / std;

      // Adaptive threshold based on recent volatility
      const recentVolatility = std / mean;
      const adaptiveThreshold = sensitivity * (1 + recentVolatility);

      if (zScore > adaptiveThreshold) {
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (zScore > adaptiveThreshold * 1.5) severity = 'critical';
        else if (zScore > adaptiveThreshold * 1.3) severity = 'high';
        else if (zScore > adaptiveThreshold * 1.1) severity = 'medium';
        else severity = 'low';

        anomalies.push({
          index: i,
          value: current,
          score: zScore,
          method: 'adaptive-threshold',
          severity,
          confidence: Math.min(0.95, zScore / (adaptiveThreshold * 1.5)),
          context: {
            adaptiveThreshold,
            recentVolatility,
            windowMean: mean,
            windowStd: std
          }
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.score - a.score);
}