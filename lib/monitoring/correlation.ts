/**
 * Correlation and Multi-Stream Analysis Functions
 * Analyze relationships between different data streams
 */

import { calculateMean, calculateStd } from './core-stats';

export interface CorrelationResult {
  correlation: number;
  significance: number;
  pValue: number;
  strength: 'none' | 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative' | 'none';
}

export interface CrossCorrelationResult {
  correlations: number[];
  lags: number[];
  maxCorrelation: number;
  optimalLag: number;
  confidence: number;
}

export interface CorrelationMatrix {
  matrix: number[][];
  labels: string[];
  strongPairs: Array<{
    stream1: string;
    stream2: string;
    correlation: number;
    significance: string;
  }>;
}

export interface CausalityResult {
  causality: 'x_causes_y' | 'y_causes_x' | 'bidirectional' | 'no_causality';
  strength: number;
  confidence: number;
  optimalLag: number;
}

export interface SynchronizedEvent {
  timestamp: number;
  streams: string[];
  correlationScore: number;
  eventType: 'spike' | 'dip' | 'change';
  magnitude: number;
}

/**
 * Calculate Pearson correlation coefficient between two series
 */
export function calculateCorrelation(x: number[], y: number[]): CorrelationResult {
  if (x.length !== y.length || x.length < 2) {
    return {
      correlation: 0,
      significance: 0,
      pValue: 1,
      strength: 'none',
      direction: 'none'
    };
  }

  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  const stdX = calculateStd(x);
  const stdY = calculateStd(y);

  if (stdX === 0 || stdY === 0) {
    return {
      correlation: 0,
      significance: 0,
      pValue: 1,
      strength: 'none',
      direction: 'none'
    };
  }

  // Calculate correlation
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += ((x[i] - meanX) / stdX) * ((y[i] - meanY) / stdY);
  }
  const correlation = numerator / (n - 1);

  // Calculate significance (t-statistic)
  const tStat = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
  const significance = Math.abs(tStat);

  // Approximate p-value (simplified)
  const df = n - 2;
  const pValue = df > 0 ? Math.max(0, 1 - Math.abs(correlation) * Math.sqrt(n / 2)) : 1;

  // Determine strength and direction
  const absCorr = Math.abs(correlation);
  let strength: 'none' | 'weak' | 'moderate' | 'strong';
  if (absCorr < 0.1) strength = 'none';
  else if (absCorr < 0.3) strength = 'weak';
  else if (absCorr < 0.7) strength = 'moderate';
  else strength = 'strong';

  const direction = correlation > 0.1 ? 'positive' : correlation < -0.1 ? 'negative' : 'none';

  return {
    correlation,
    significance,
    pValue,
    strength,
    direction
  };
}

/**
 * Calculate cross-correlation at different time lags
 */
export function calculateCrossCorrelation(
  x: number[],
  y: number[],
  maxLag: number = 20
): CrossCorrelationResult {
  if (x.length !== y.length || x.length < 3) {
    return {
      correlations: [],
      lags: [],
      maxCorrelation: 0,
      optimalLag: 0,
      confidence: 0
    };
  }

  const n = x.length;
  const effectiveMaxLag = Math.min(maxLag, Math.floor(n / 4));

  const correlations: number[] = [];
  const lags: number[] = [];

  // Calculate correlations for negative lags (y leads x)
  for (let lag = -effectiveMaxLag; lag <= effectiveMaxLag; lag++) {
    let xSlice: number[], ySlice: number[];

    if (lag >= 0) {
      // Positive lag: x leads y
      xSlice = x.slice(0, n - lag);
      ySlice = y.slice(lag, n);
    } else {
      // Negative lag: y leads x
      xSlice = x.slice(-lag, n);
      ySlice = y.slice(0, n + lag);
    }

    const corr = calculateCorrelation(xSlice, ySlice);
    correlations.push(corr.correlation);
    lags.push(lag);
  }

  // Find maximum correlation and its lag
  let maxCorrelation = 0;
  let optimalLag = 0;

  correlations.forEach((corr, index) => {
    if (Math.abs(corr) > Math.abs(maxCorrelation)) {
      maxCorrelation = corr;
      optimalLag = lags[index];
    }
  });

  // Calculate confidence based on data length and correlation strength
  const confidence = Math.min(0.99, Math.abs(maxCorrelation) * Math.sqrt(n / 100));

  return {
    correlations,
    lags,
    maxCorrelation,
    optimalLag,
    confidence
  };
}

/**
 * Calculate correlation matrix for multiple streams
 */
export function calculateCorrelationMatrix(
  streams: Record<string, number[]>,
  significanceThreshold: number = 0.5
): CorrelationMatrix {
  const labels = Object.keys(streams);
  const n = labels.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  // Calculate pairwise correlations
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const corr = calculateCorrelation(streams[labels[i]], streams[labels[j]]);
        matrix[i][j] = corr.correlation;
      }
    }
  }

  // Find strongly correlated pairs
  const strongPairs: Array<{
    stream1: string;
    stream2: string;
    correlation: number;
    significance: string;
  }> = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const correlation = matrix[i][j];
      if (Math.abs(correlation) >= significanceThreshold) {
        let significance: string;
        const absCorr = Math.abs(correlation);
        if (absCorr >= 0.8) significance = 'very_strong';
        else if (absCorr >= 0.6) significance = 'strong';
        else if (absCorr >= 0.4) significance = 'moderate';
        else significance = 'weak';

        strongPairs.push({
          stream1: labels[i],
          stream2: labels[j],
          correlation,
          significance
        });
      }
    }
  }

  return {
    matrix,
    labels,
    strongPairs: strongPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
  };
}

/**
 * Detect Granger causality between two time series
 */
export function detectCausality(
  x: number[],
  y: number[],
  maxLag: number = 5
): CausalityResult {
  if (x.length !== y.length || x.length < maxLag * 3) {
    return {
      causality: 'no_causality',
      strength: 0,
      confidence: 0,
      optimalLag: 0
    };
  }

  // Simplified Granger causality test
  // Test if past values of x help predict y, and vice versa

  let bestLag = 1;
  let maxImprovement = 0;
  let bestDirection: 'x_causes_y' | 'y_causes_x' | 'bidirectional' | 'no_causality' = 'no_causality';

  for (let lag = 1; lag <= maxLag; lag++) {
    // Test x -> y causality
    const xyImprovement = testPredictiveImprovement(y, x, lag);

    // Test y -> x causality
    const yxImprovement = testPredictiveImprovement(x, y, lag);

    const totalImprovement = xyImprovement + yxImprovement;

    if (totalImprovement > maxImprovement) {
      maxImprovement = totalImprovement;
      bestLag = lag;

      if (xyImprovement > 0.1 && yxImprovement > 0.1) {
        bestDirection = 'bidirectional';
      } else if (xyImprovement > yxImprovement) {
        bestDirection = 'x_causes_y';
      } else if (yxImprovement > xyImprovement) {
        bestDirection = 'y_causes_x';
      } else {
        bestDirection = 'no_causality';
      }
    }
  }

  const confidence = Math.min(0.95, maxImprovement * 2);
  const strength = maxImprovement;

  return {
    causality: bestDirection,
    strength,
    confidence,
    optimalLag: bestLag
  };
}

/**
 * Helper function to test predictive improvement
 */
function testPredictiveImprovement(target: number[], predictor: number[], lag: number): number {
  if (target.length <= lag + 2) return 0;

  // Simple autoregressive model comparison
  // Model 1: y(t) = a*y(t-1) + error
  // Model 2: y(t) = a*y(t-1) + b*x(t-lag) + error

  const n = target.length - lag;
  let sse1 = 0; // Sum of squared errors for model 1
  let sse2 = 0; // Sum of squared errors for model 2

  for (let i = lag; i < target.length - 1; i++) {
    const actual = target[i + 1];
    const prev = target[i];

    // Model 1: simple persistence
    const pred1 = prev;
    sse1 += Math.pow(actual - pred1, 2);

    // Model 2: include predictor variable
    const predValue = predictor[i - lag + 1];
    const alpha = 0.7; // Weight for autoregressive term
    const beta = 0.3;  // Weight for predictor term
    const pred2 = alpha * prev + beta * predValue;
    sse2 += Math.pow(actual - pred2, 2);
  }

  // Return improvement (reduction in error)
  const improvement = sse1 > 0 ? (sse1 - sse2) / sse1 : 0;
  return Math.max(0, improvement);
}

/**
 * Detect synchronized events across multiple streams
 */
export function detectSynchronizedEvents(
  streams: Record<string, number[]>,
  timeWindow: number = 3,
  threshold: number = 2.0
): SynchronizedEvent[] {
  const streamNames = Object.keys(streams);
  if (streamNames.length < 2) return [];

  const events: SynchronizedEvent[] = [];
  const streamLength = Math.min(...streamNames.map(name => streams[name].length));

  // Calculate z-scores for each stream
  const zScores: Record<string, number[]> = {};
  streamNames.forEach(name => {
    const values = streams[name].slice(0, streamLength);
    const mean = calculateMean(values);
    const std = calculateStd(values);

    if (std > 0) {
      zScores[name] = values.map(val => (val - mean) / std);
    } else {
      zScores[name] = new Array(streamLength).fill(0);
    }
  });

  // Look for simultaneous anomalies
  for (let i = 0; i < streamLength; i++) {
    const anomalousStreams: string[] = [];
    let totalMagnitude = 0;
    let eventType: 'spike' | 'dip' | 'change' = 'change';

    streamNames.forEach(name => {
      const zScore = zScores[name][i];
      if (Math.abs(zScore) > threshold) {
        anomalousStreams.push(name);
        totalMagnitude += Math.abs(zScore);

        if (zScore > threshold) {
          eventType = 'spike';
        } else if (zScore < -threshold) {
          eventType = eventType === 'spike' ? 'change' : 'dip';
        }
      }
    });

    // Require at least 2 streams to be anomalous simultaneously
    if (anomalousStreams.length >= 2) {
      // Calculate correlation score for this event
      const eventValues = anomalousStreams.map(name => zScores[name][i]);
      const correlationScore = eventValues.length > 1 ?
        Math.abs(calculateCorrelation(eventValues, eventValues).correlation) : 0;

      events.push({
        timestamp: i,
        streams: anomalousStreams,
        correlationScore,
        eventType,
        magnitude: totalMagnitude / anomalousStreams.length
      });
    }
  }

  // Merge nearby events
  const mergedEvents: SynchronizedEvent[] = [];
  let currentEvent: SynchronizedEvent | null = null;

  for (const event of events) {
    if (currentEvent === null || event.timestamp - currentEvent.timestamp > timeWindow) {
      if (currentEvent) {
        mergedEvents.push(currentEvent);
      }
      currentEvent = { ...event };
    } else {
      // Merge events
      const allStreams = new Set([...currentEvent.streams, ...event.streams]);
      currentEvent.streams = Array.from(allStreams);
      currentEvent.magnitude = Math.max(currentEvent.magnitude, event.magnitude);
      currentEvent.correlationScore = Math.max(currentEvent.correlationScore, event.correlationScore);
    }
  }

  if (currentEvent) {
    mergedEvents.push(currentEvent);
  }

  return mergedEvents.sort((a, b) => b.magnitude - a.magnitude);
}

/**
 * Analyze cascading failures (one failure leading to others)
 */
export function analyzeCascadingFailures(
  streams: Record<string, number[]>,
  maxDelay: number = 10
): Array<{
  initiator: string;
  followers: Array<{ stream: string; delay: number; correlation: number }>;
  cascadeStrength: number;
}> {
  const streamNames = Object.keys(streams);
  const cascades: Array<{
    initiator: string;
    followers: Array<{ stream: string; delay: number; correlation: number }>;
    cascadeStrength: number;
  }> = [];

  // For each stream, check if it could be an initiator
  streamNames.forEach(initiatorName => {
    const followers: Array<{ stream: string; delay: number; correlation: number }> = [];

    streamNames.forEach(followerName => {
      if (initiatorName === followerName) return;

      // Test different delays
      let bestCorrelation = 0;
      let bestDelay = 0;

      for (let delay = 1; delay <= maxDelay; delay++) {
        const crossCorr = calculateCrossCorrelation(
          streams[initiatorName],
          streams[followerName],
          delay
        );

        // Look for positive correlation at this delay
        const corrAtDelay = crossCorr.correlations[crossCorr.lags.indexOf(delay)] || 0;

        if (Math.abs(corrAtDelay) > Math.abs(bestCorrelation)) {
          bestCorrelation = corrAtDelay;
          bestDelay = delay;
        }
      }

      // If correlation is strong enough, consider it a follower
      if (Math.abs(bestCorrelation) > 0.4) {
        followers.push({
          stream: followerName,
          delay: bestDelay,
          correlation: bestCorrelation
        });
      }
    });

    if (followers.length > 0) {
      const cascadeStrength = followers.reduce(
        (sum, follower) => sum + Math.abs(follower.correlation),
        0
      ) / followers.length;

      cascades.push({
        initiator: initiatorName,
        followers: followers.sort((a, b) => a.delay - b.delay),
        cascadeStrength
      });
    }
  });

  return cascades.sort((a, b) => b.cascadeStrength - a.cascadeStrength);
}