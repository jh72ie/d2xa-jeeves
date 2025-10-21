/**
 * Core Statistical Functions
 * Foundation mathematics for all monitoring analyses
 */

export interface BasicStatsResult {
  count: number;
  mean: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  median: number;
  q25: number;
  q75: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
}

/**
 * Calculate arithmetic mean
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate sample standard deviation
 */
export function calculateStd(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate sample variance
 */
export function calculateVariance(values: number[]): number {
  if (values.length <= 1) return 0;
  const std = calculateStd(values);
  return std * std;
}

/**
 * Calculate median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate quantiles (percentiles)
 */
export function calculateQuantile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 1) throw new Error('Percentile must be between 0 and 1');

  const sorted = [...values].sort((a, b) => a - b);
  const index = percentile * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate interquartile range
 */
export function calculateIQR(values: number[]): number {
  const q75 = calculateQuantile(values, 0.75);
  const q25 = calculateQuantile(values, 0.25);
  return q75 - q25;
}

/**
 * Calculate skewness (measure of asymmetry)
 */
export function calculateSkewness(values: number[]): number {
  if (values.length < 3) return 0;

  const mean = calculateMean(values);
  const std = calculateStd(values);
  if (std === 0) return 0;

  const cubedDeviations = values.map(val => Math.pow((val - mean) / std, 3));
  const sum = cubedDeviations.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate kurtosis (measure of tail heaviness)
 */
export function calculateKurtosis(values: number[]): number {
  if (values.length < 4) return 0;

  const mean = calculateMean(values);
  const std = calculateStd(values);
  if (std === 0) return 0;

  const fourthMoments = values.map(val => Math.pow((val - mean) / std, 4));
  const sum = fourthMoments.reduce((acc, val) => acc + val, 0);
  return (sum / values.length) - 3; // Excess kurtosis (normal distribution = 0)
}

/**
 * Calculate z-scores for all values
 */
export function calculateZScores(values: number[]): number[] {
  if (values.length === 0) return [];

  const mean = calculateMean(values);
  const std = calculateStd(values);
  if (std === 0) return values.map(() => 0);

  return values.map(val => (val - mean) / std);
}

/**
 * Calculate comprehensive basic statistics
 */
export function calculateBasicStats(values: number[]): BasicStatsResult {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      std: 0,
      variance: 0,
      min: 0,
      max: 0,
      median: 0,
      q25: 0,
      q75: 0,
      iqr: 0,
      skewness: 0,
      kurtosis: 0
    };
  }

  const mean = calculateMean(values);
  const std = calculateStd(values);
  const variance = calculateVariance(values);
  const median = calculateMedian(values);
  const q25 = calculateQuantile(values, 0.25);
  const q75 = calculateQuantile(values, 0.75);
  const iqr = calculateIQR(values);
  const skewness = calculateSkewness(values);
  const kurtosis = calculateKurtosis(values);

  return {
    count: values.length,
    mean,
    std,
    variance,
    min: Math.min(...values),
    max: Math.max(...values),
    median,
    q25,
    q75,
    iqr,
    skewness,
    kurtosis
  };
}

/**
 * Test if data follows normal distribution (Shapiro-Wilk approximation)
 */
export function testNormality(values: number[]): { isNormal: boolean; pValue: number; statistic: number } {
  if (values.length < 3 || values.length > 5000) {
    return { isNormal: false, pValue: 0, statistic: 0 };
  }

  // Simple normality test based on skewness and kurtosis
  const skewness = calculateSkewness(values);
  const kurtosis = calculateKurtosis(values);

  // Approximate test: normal distribution has skewness ≈ 0 and excess kurtosis ≈ 0
  const skewnessThreshold = 2;
  const kurtosisThreshold = 7;

  const isNormal = Math.abs(skewness) < skewnessThreshold && Math.abs(kurtosis) < kurtosisThreshold;

  // Rough approximation of p-value based on how far from normal
  const skewnessDeviation = Math.abs(skewness) / skewnessThreshold;
  const kurtosisDeviation = Math.abs(kurtosis) / kurtosisThreshold;
  const maxDeviation = Math.max(skewnessDeviation, kurtosisDeviation);
  const pValue = Math.max(0, 1 - maxDeviation);

  return {
    isNormal,
    pValue,
    statistic: maxDeviation
  };
}

/**
 * Calculate probability density for normal distribution
 */
export function calculateNormalPDF(x: number, mean: number, std: number): number {
  if (std <= 0) return 0;

  const coefficient = 1 / (std * Math.sqrt(2 * Math.PI));
  const exponent = -0.5 * Math.pow((x - mean) / std, 2);
  return coefficient * Math.exp(exponent);
}

/**
 * Calculate entropy of a dataset (measure of randomness)
 */
export function calculateEntropy(values: number[], bins: number = 10): number {
  if (values.length === 0) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins;

  if (binWidth === 0) return 0; // All values are the same

  // Create histogram
  const histogram = new Array(bins).fill(0);
  for (const value of values) {
    let binIndex = Math.floor((value - min) / binWidth);
    if (binIndex >= bins) binIndex = bins - 1; // Handle edge case
    histogram[binIndex]++;
  }

  // Calculate entropy
  let entropy = 0;
  const total = values.length;
  for (const count of histogram) {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  }

  return entropy;
}