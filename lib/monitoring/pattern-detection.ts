/**
 * Pattern Detection Functions
 * Identify peaks, valleys, spikes, and recurring patterns
 */

import { calculateMean, calculateStd } from './core-stats';

export interface Peak {
  index: number;
  value: number;
  prominence: number;
  width: number;
  timestamp?: Date;
}

export interface Valley {
  index: number;
  value: number;
  depth: number;
  width: number;
  timestamp?: Date;
}

export interface Spike {
  index: number;
  value: number;
  magnitude: number;
  direction: 'up' | 'down';
  duration: number;
  timestamp?: Date;
}

export interface PatternMatch {
  startIndex: number;
  endIndex: number;
  similarity: number;
  templateIndex: number;
  pattern: number[];
}

export interface FrequencyComponent {
  frequency: number;
  amplitude: number;
  phase: number;
  power: number;
}

/**
 * Find peaks in time series data
 */
export function findPeaks(values: number[], minDistance: number = 1, minHeight?: number): Peak[] {
  if (values.length < 3) return [];

  const peaks: Peak[] = [];
  const threshold = minHeight ?? calculateMean(values) + calculateStd(values);

  for (let i = 1; i < values.length - 1; i++) {
    const current = values[i];
    const prev = values[i - 1];
    const next = values[i + 1];

    // Check if it's a local maximum above threshold
    if (current > prev && current > next && current >= threshold) {
      // Check minimum distance from previous peaks
      const tooClose = peaks.some(peak => Math.abs(peak.index - i) < minDistance);
      if (tooClose) continue;

      // Calculate prominence (how much the peak stands out)
      let leftMin = current;
      let rightMin = current;

      // Look left for minimum
      for (let j = i - 1; j >= 0; j--) {
        leftMin = Math.min(leftMin, values[j]);
        if (values[j] > current) break;
      }

      // Look right for minimum
      for (let j = i + 1; j < values.length; j++) {
        rightMin = Math.min(rightMin, values[j]);
        if (values[j] > current) break;
      }

      const prominence = current - Math.max(leftMin, rightMin);

      // Calculate width at half prominence
      const halfHeight = current - prominence / 2;
      let leftWidth = i;
      let rightWidth = i;

      for (let j = i; j >= 0 && values[j] >= halfHeight; j--) {
        leftWidth = j;
      }
      for (let j = i; j < values.length && values[j] >= halfHeight; j++) {
        rightWidth = j;
      }

      const width = rightWidth - leftWidth;

      peaks.push({
        index: i,
        value: current,
        prominence,
        width
      });
    }
  }

  return peaks.sort((a, b) => b.prominence - a.prominence);
}

/**
 * Find valleys (inverse peaks) in time series data
 */
export function findValleys(values: number[], minDistance: number = 1, maxHeight?: number): Valley[] {
  if (values.length < 3) return [];

  // Invert the values and find peaks, then convert back
  const invertedValues = values.map(v => -v);
  const threshold = maxHeight ?? calculateMean(values) - calculateStd(values);

  const valleys: Valley[] = [];

  for (let i = 1; i < values.length - 1; i++) {
    const current = values[i];
    const prev = values[i - 1];
    const next = values[i + 1];

    // Check if it's a local minimum below threshold
    if (current < prev && current < next && current <= threshold) {
      // Check minimum distance from previous valleys
      const tooClose = valleys.some(valley => Math.abs(valley.index - i) < minDistance);
      if (tooClose) continue;

      // Calculate depth (how much the valley stands out)
      let leftMax = current;
      let rightMax = current;

      // Look left for maximum
      for (let j = i - 1; j >= 0; j--) {
        leftMax = Math.max(leftMax, values[j]);
        if (values[j] < current) break;
      }

      // Look right for maximum
      for (let j = i + 1; j < values.length; j++) {
        rightMax = Math.max(rightMax, values[j]);
        if (values[j] < current) break;
      }

      const depth = Math.min(leftMax, rightMax) - current;

      // Calculate width
      const halfDepth = current + depth / 2;
      let leftWidth = i;
      let rightWidth = i;

      for (let j = i; j >= 0 && values[j] <= halfDepth; j--) {
        leftWidth = j;
      }
      for (let j = i; j < values.length && values[j] <= halfDepth; j++) {
        rightWidth = j;
      }

      const width = rightWidth - leftWidth;

      valleys.push({
        index: i,
        value: current,
        depth,
        width
      });
    }
  }

  return valleys.sort((a, b) => b.depth - a.depth);
}

/**
 * Detect sudden spikes (anomalous jumps) in data
 */
export function detectSpikes(values: number[], threshold: number = 3.0, minDuration: number = 1): Spike[] {
  if (values.length < 3) return [];

  const spikes: Spike[] = [];
  const mean = calculateMean(values);
  const std = calculateStd(values);

  if (std === 0) return [];

  let spikeStart = -1;
  let spikeDirection: 'up' | 'down' | null = null;

  for (let i = 1; i < values.length; i++) {
    const current = values[i];
    const prev = values[i - 1];
    const zScore = Math.abs(current - mean) / std;

    // Check if current value is anomalous
    if (zScore > threshold) {
      const direction = current > mean ? 'up' : 'down';

      if (spikeStart === -1) {
        // Start of new spike
        spikeStart = i;
        spikeDirection = direction;
      } else if (spikeDirection !== direction) {
        // Direction changed, end previous spike and start new one
        if (i - spikeStart >= minDuration) {
          const spikeValues = values.slice(spikeStart, i);
          const magnitude = spikeDirection === 'up'
            ? Math.max(...spikeValues) - mean
            : mean - Math.min(...spikeValues);

          spikes.push({
            index: spikeStart,
            value: spikeDirection === 'up' ? Math.max(...spikeValues) : Math.min(...spikeValues),
            magnitude: magnitude / std, // Normalized magnitude
            direction: spikeDirection!,
            duration: i - spikeStart
          });
        }

        spikeStart = i;
        spikeDirection = direction;
      }
    } else {
      // End of spike
      if (spikeStart !== -1 && i - spikeStart >= minDuration) {
        const spikeValues = values.slice(spikeStart, i);
        const magnitude = spikeDirection === 'up'
          ? Math.max(...spikeValues) - mean
          : mean - Math.min(...spikeValues);

        spikes.push({
          index: spikeStart,
          value: spikeDirection === 'up' ? Math.max(...spikeValues) : Math.min(...spikeValues),
          magnitude: magnitude / std,
          direction: spikeDirection!,
          duration: i - spikeStart
        });
      }

      spikeStart = -1;
      spikeDirection = null;
    }
  }

  return spikes.sort((a, b) => b.magnitude - a.magnitude);
}

/**
 * Find similar patterns using cross-correlation
 */
export function findSimilarPatterns(
  data: number[],
  template: number[],
  threshold: number = 0.8
): PatternMatch[] {
  if (data.length < template.length || template.length === 0) return [];

  const matches: PatternMatch[] = [];

  // Normalize template
  const templateMean = calculateMean(template);
  const templateStd = calculateStd(template);
  if (templateStd === 0) return [];

  const normalizedTemplate = template.map(val => (val - templateMean) / templateStd);

  // Sliding window correlation
  for (let i = 0; i <= data.length - template.length; i++) {
    const window = data.slice(i, i + template.length);
    const windowMean = calculateMean(window);
    const windowStd = calculateStd(window);

    if (windowStd === 0) continue;

    // Calculate correlation coefficient
    const normalizedWindow = window.map(val => (val - windowMean) / windowStd);

    let correlation = 0;
    for (let j = 0; j < template.length; j++) {
      correlation += normalizedTemplate[j] * normalizedWindow[j];
    }
    correlation /= template.length;

    if (correlation >= threshold) {
      matches.push({
        startIndex: i,
        endIndex: i + template.length - 1,
        similarity: correlation,
        templateIndex: 0,
        pattern: window
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Detect repeating sequences in time series
 */
export function detectRepeatingSequences(
  values: number[],
  minLength: number = 3,
  maxLength: number = 20,
  minOccurrences: number = 2
): PatternMatch[] {
  if (values.length < minLength * minOccurrences) return [];

  const patterns: Map<string, PatternMatch[]> = new Map();

  // Try different pattern lengths
  for (let length = minLength; length <= Math.min(maxLength, Math.floor(values.length / minOccurrences)); length++) {
    for (let start = 0; start <= values.length - length; start++) {
      const pattern = values.slice(start, start + length);

      // Create a rough pattern signature (discretized)
      const signature = pattern
        .map(val => Math.round(val * 10) / 10) // Round to 1 decimal
        .join(',');

      if (!patterns.has(signature)) {
        patterns.set(signature, []);
      }

      patterns.get(signature)!.push({
        startIndex: start,
        endIndex: start + length - 1,
        similarity: 1.0,
        templateIndex: 0,
        pattern
      });
    }
  }

  // Filter patterns that occur frequently enough
  const repeatingPatterns: PatternMatch[] = [];

  patterns.forEach((matches, signature) => {
    if (matches.length >= minOccurrences) {
      // Check if matches are reasonably spaced (not overlapping)
      const spacedMatches = [];
      let lastEnd = -1;

      for (const match of matches.sort((a, b) => a.startIndex - b.startIndex)) {
        if (match.startIndex > lastEnd) {
          spacedMatches.push(match);
          lastEnd = match.endIndex;
        }
      }

      if (spacedMatches.length >= minOccurrences) {
        repeatingPatterns.push(...spacedMatches);
      }
    }
  });

  return repeatingPatterns.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Simple spectral analysis using autocorrelation-based method
 */
export function findDominantFrequencies(
  values: number[],
  samplingRate: number = 1,
  maxComponents: number = 5
): FrequencyComponent[] {
  if (values.length < 8) return [];

  const n = values.length;
  const mean = calculateMean(values);
  const centeredValues = values.map(val => val - mean);

  // Calculate power spectral density using autocorrelation
  const maxLag = Math.min(Math.floor(n / 4), 50);
  const autocorr: number[] = [];

  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    const count = n - lag;

    for (let i = 0; i < count; i++) {
      sum += centeredValues[i] * centeredValues[i + lag];
    }

    autocorr.push(sum / count);
  }

  // Find peaks in autocorrelation (corresponding to dominant periods)
  const peaks = findPeaks(autocorr.slice(1), 2); // Skip lag=0

  const frequencies: FrequencyComponent[] = [];

  for (let i = 0; i < Math.min(peaks.length, maxComponents); i++) {
    const peak = peaks[i];
    const period = peak.index + 1; // +1 because we skipped lag=0
    const frequency = samplingRate / period;
    const amplitude = Math.sqrt(peak.value);
    const power = peak.value;

    frequencies.push({
      frequency,
      amplitude,
      phase: 0, // Phase calculation would require more complex analysis
      power
    });
  }

  return frequencies.sort((a, b) => b.power - a.power);
}

/**
 * Analyze peak frequency and regularity
 */
export function analyzePeakFrequency(values: number[]): {
  averageInterval: number;
  intervalVariability: number;
  isRegular: boolean;
  peakCount: number;
} {
  const peaks = findPeaks(values);

  if (peaks.length < 2) {
    return {
      averageInterval: 0,
      intervalVariability: 0,
      isRegular: false,
      peakCount: peaks.length
    };
  }

  // Calculate intervals between consecutive peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i].index - peaks[i - 1].index);
  }

  const averageInterval = calculateMean(intervals);
  const intervalStd = calculateStd(intervals);
  const intervalVariability = intervalStd / averageInterval;

  // Consider regular if coefficient of variation is low
  const isRegular = intervalVariability < 0.3;

  return {
    averageInterval,
    intervalVariability,
    isRegular,
    peakCount: peaks.length
  };
}