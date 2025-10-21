import { z } from "zod";
import { tool } from "ai";

// Import all mathematical functions
import {
  // Core Statistics
  calculateMean,
  calculateStd,
  calculateVariance,
  calculateMedian,
  calculateQuantile,
  calculateIQR,
  calculateSkewness,
  calculateKurtosis,
  calculateZScores,
  calculateBasicStats,
  testNormality,
  calculateNormalPDF,
  calculateEntropy,

  // Time Series Analysis
  calculateLinearTrend,
  simpleMovingAverage,
  exponentialMovingAverage,
  movingStandardDeviation,
  detectChangePoints,
  calculateAutocorrelation,
  detectCyclicPatterns,
  decomposeTimeSeries,

  // Pattern Detection
  findPeaks,
  findValleys,
  detectSpikes,
  findSimilarPatterns,
  detectRepeatingSequences,
  findDominantFrequencies,
  analyzePeakFrequency,

  // Correlation Analysis
  calculateCorrelation,
  calculateCrossCorrelation,
  calculateCorrelationMatrix,
  detectCausality,
  detectSynchronizedEvents,
  analyzeCascadingFailures,

  // Anomaly Detection
  zScoreAnomalies,
  modifiedZScore,
  iqrOutliers,
  localOutlierFactor,
  seasonalAnomalies,
  trendDeviationAnomalies,
  ensembleAnomalyDetection,
  adaptiveThresholding
} from "@/lib/monitoring";

// =============================================================================
// CORE STATISTICS TOOLS (13 functions)
// =============================================================================

export const calculateMeanTool = tool({
  description: "Calculate the arithmetic mean (average) of a dataset",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return { mean: calculateMean(values), count: values.length };
  }
});

export const calculateStdTool = tool({
  description: "Calculate the standard deviation of a dataset",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return { standardDeviation: calculateStd(values), count: values.length };
  }
});

export const calculateVarianceTool = tool({
  description: "Calculate the variance of a dataset",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return { variance: calculateVariance(values), count: values.length };
  }
});

export const calculateMedianTool = tool({
  description: "Calculate the median (middle value) of a dataset",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return { median: calculateMedian(values), count: values.length };
  }
});

export const calculateQuantileTool = tool({
  description: "Calculate a specific quantile (percentile) of a dataset",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    quantile: z.number().min(0).max(1).describe("Quantile to calculate (0-1, e.g., 0.25 for 25th percentile)")
  }),
  execute: async ({ values, quantile }) => {
    return {
      quantile,
      value: calculateQuantile(values, quantile),
      percentile: quantile * 100,
      count: values.length
    };
  }
});

export const calculateIQRTool = tool({
  description: "Calculate the Interquartile Range (Q3 - Q1) of a dataset",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return { iqr: calculateIQR(values), count: values.length };
  }
});

export const calculateSkewnessTool = tool({
  description: "Calculate the skewness (asymmetry) of a dataset distribution",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    const skewness = calculateSkewness(values);
    let interpretation = 'symmetric';
    if (skewness > 0.5) interpretation = 'right-skewed (positive)';
    else if (skewness < -0.5) interpretation = 'left-skewed (negative)';

    return { skewness, interpretation, count: values.length };
  }
});

export const calculateKurtosisTool = tool({
  description: "Calculate the kurtosis (tail heaviness) of a dataset distribution",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    const kurtosis = calculateKurtosis(values);
    let interpretation = 'mesokurtic (normal)';
    if (kurtosis > 3) interpretation = 'leptokurtic (heavy tails)';
    else if (kurtosis < 3) interpretation = 'platykurtic (light tails)';

    return { kurtosis, interpretation, count: values.length };
  }
});

export const calculateZScoresTool = tool({
  description: "Calculate Z-scores (standardized values) for all data points",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    const zScores = calculateZScores(values);
    const extremeCount = zScores.filter(z => Math.abs(z) > 2).length;
    return {
      zScores,
      extremeValues: extremeCount,
      extremePercentage: (extremeCount / values.length) * 100,
      count: values.length
    };
  }
});

export const calculateBasicStatsTool = tool({
  description: "Calculate comprehensive basic statistics (mean, std, min, max, quartiles, etc.)",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return calculateBasicStats(values);
  }
});

export const testNormalityTool = tool({
  description: "Test if data follows a normal distribution using Shapiro-Wilk test",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return testNormality(values);
  }
});

export const calculateNormalPDFTool = tool({
  description: "Calculate probability density function value for normal distribution at a specific point",
  inputSchema: z.object({
    x: z.number().describe("Point to evaluate PDF at"),
    mean: z.number().describe("Mean of the normal distribution"),
    std: z.number().describe("Standard deviation of the distribution")
  }),
  execute: async ({ x, mean, std }) => {
    return { x, pdfValue: calculateNormalPDF(x, mean, std), mean, std };
  }
});

export const calculateEntropyTool = tool({
  description: "Calculate Shannon entropy to measure information content/randomness",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    bins: z.number().optional().default(10).describe("Number of bins for histogram calculation")
  }),
  execute: async ({ values, bins }) => {
    const entropy = calculateEntropy(values, bins);
    let interpretation = 'moderate randomness';
    if (entropy < 1) interpretation = 'low randomness (predictable)';
    else if (entropy > 3) interpretation = 'high randomness (chaotic)';

    return { entropy, interpretation, bins, count: values.length };
  }
});

// =============================================================================
// TIME SERIES ANALYSIS TOOLS (8 functions)
// =============================================================================

export const calculateLinearTrendTool = tool({
  description: "Calculate linear trend using least squares regression",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values (time series)")
  }),
  execute: async ({ values }) => {
    return calculateLinearTrend(values);
  }
});

export const simpleMovingAverageTool = tool({
  description: "Calculate simple moving average to smooth data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    windowSize: z.number().min(1).describe("Size of the moving window")
  }),
  execute: async ({ values, windowSize }) => {
    return {
      movingAverage: simpleMovingAverage(values, windowSize),
      windowSize,
      originalLength: values.length
    };
  }
});

export const exponentialMovingAverageTool = tool({
  description: "Calculate exponential moving average (gives more weight to recent values)",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    alpha: z.number().min(0).max(1).describe("Smoothing factor (0-1, higher = more responsive)")
  }),
  execute: async ({ values, alpha }) => {
    return {
      exponentialMovingAverage: exponentialMovingAverage(values, alpha),
      alpha,
      originalLength: values.length
    };
  }
});

export const movingStandardDeviationTool = tool({
  description: "Calculate moving standard deviation to track volatility over time",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    windowSize: z.number().min(2).describe("Size of the moving window")
  }),
  execute: async ({ values, windowSize }) => {
    return {
      movingStd: movingStandardDeviation(values, windowSize),
      windowSize,
      originalLength: values.length
    };
  }
});

export const detectChangePointsTool = tool({
  description: "Detect change points in time series using CUSUM algorithm",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    threshold: z.number().optional().default(2.0).describe("Threshold for change point detection")
  }),
  execute: async ({ values, threshold }) => {
    return detectChangePoints(values, threshold || 2.0);
  }
});

export const calculateAutocorrelationTool = tool({
  description: "Calculate autocorrelation to find periodic patterns",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    maxLag: z.number().optional().describe("Maximum lag to calculate (auto-determined if not provided)")
  }),
  execute: async ({ values, maxLag }) => {
    return calculateAutocorrelation(values, maxLag);
  }
});

export const detectCyclicPatternsTool = tool({
  description: "Detect cyclical patterns and seasonality in time series",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return detectCyclicPatterns(values);
  }
});

export const decomposeTimeSeriesTool = tool({
  description: "Decompose time series into trend, seasonal, and residual components",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    period: z.number().describe("Period length for seasonal decomposition")
  }),
  execute: async ({ values, period }) => {
    return decomposeTimeSeries(values, period);
  }
});

// =============================================================================
// PATTERN DETECTION TOOLS (7 functions)
// =============================================================================

export const findPeaksTool = tool({
  description: "Find local maxima (peaks) in the data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    minHeight: z.number().optional().describe("Minimum height for peaks"),
    minDistance: z.number().optional().default(1).describe("Minimum distance between peaks")
  }),
  execute: async ({ values, minHeight, minDistance }) => {
    return findPeaks(values, minHeight, minDistance);
  }
});

export const findValleysTool = tool({
  description: "Find local minima (valleys) in the data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    maxHeight: z.number().optional().describe("Maximum height for valleys"),
    minDistance: z.number().optional().default(1).describe("Minimum distance between valleys")
  }),
  execute: async ({ values, maxHeight, minDistance }) => {
    return findValleys(values, maxHeight, minDistance);
  }
});

export const detectSpikesTool = tool({
  description: "Detect sudden spikes or outlier events in the data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    threshold: z.number().optional().default(3.0).describe("Z-score threshold for spike detection"),
    minDuration: z.number().optional().default(1).describe("Minimum duration for spike detection")
  }),
  execute: async ({ values, threshold, minDuration }) => {
    return detectSpikes(values, threshold || 3.0, minDuration || 1);
  }
});

export const findSimilarPatternsTool = tool({
  description: "Find similar patterns or subsequences in the data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    template: z.array(z.number()).describe("Template pattern to search for"),
    threshold: z.number().optional().default(0.8).describe("Similarity threshold (0-1)")
  }),
  execute: async ({ values, template, threshold }) => {
    return findSimilarPatterns(values, template, threshold || 0.8);
  }
});

export const detectRepeatingSequencesTool = tool({
  description: "Detect repeating sequences or motifs in the data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    minLength: z.number().optional().default(3).describe("Minimum length of repeating sequences"),
    maxLength: z.number().optional().describe("Maximum length of sequences (auto-determined if not provided)")
  }),
  execute: async ({ values, minLength, maxLength }) => {
    return detectRepeatingSequences(values, minLength || 3, maxLength);
  }
});

export const findDominantFrequenciesTool = tool({
  description: "Find dominant frequencies using spectral analysis (FFT)",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    samplingRate: z.number().optional().default(1.0).describe("Sampling rate of the data"),
    topN: z.number().optional().default(5).describe("Number of top frequencies to return")
  }),
  execute: async ({ values, samplingRate, topN }) => {
    return findDominantFrequencies(values, samplingRate || 1.0, topN || 5);
  }
});

export const analyzePeakFrequencyTool = tool({
  description: "Analyze the frequency and spacing of peaks in the data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values")
  }),
  execute: async ({ values }) => {
    return analyzePeakFrequency(values);
  }
});

// =============================================================================
// CORRELATION ANALYSIS TOOLS (6 functions)
// =============================================================================

export const calculateCorrelationTool = tool({
  description: "Calculate Pearson correlation coefficient between two datasets",
  inputSchema: z.object({
    x: z.array(z.number()).describe("First dataset"),
    y: z.array(z.number()).describe("Second dataset")
  }),
  execute: async ({ x, y }) => {
    return calculateCorrelation(x, y);
  }
});

export const calculateCrossCorrelationTool = tool({
  description: "Calculate cross-correlation to find time delays between signals",
  inputSchema: z.object({
    x: z.array(z.number()).describe("First signal"),
    y: z.array(z.number()).describe("Second signal"),
    maxLag: z.number().optional().describe("Maximum lag to calculate (auto-determined if not provided)")
  }),
  execute: async ({ x, y, maxLag }) => {
    return calculateCrossCorrelation(x, y, maxLag);
  }
});

export const calculateCorrelationMatrixTool = tool({
  description: "Calculate correlation matrix for multiple datasets",
  inputSchema: z.object({
    datasets: z.record(z.string(), z.array(z.number())).describe("Named datasets for correlation matrix"),
    significanceThreshold: z.number().optional().default(0.3).describe("Minimum correlation for significance")
  }),
  execute: async ({ datasets, significanceThreshold }) => {
    return calculateCorrelationMatrix(datasets, significanceThreshold);
  }
});

export const detectCausalityTool = tool({
  description: "Test for Granger causality between two time series",
  inputSchema: z.object({
    x: z.array(z.number()).describe("First time series (potential cause)"),
    y: z.array(z.number()).describe("Second time series (potential effect)"),
    maxLag: z.number().optional().default(10).describe("Maximum lag to test for causality")
  }),
  execute: async ({ x, y, maxLag }) => {
    return detectCausality(x, y, maxLag);
  }
});

export const detectSynchronizedEventsTool = tool({
  description: "Detect synchronized events across multiple time series",
  inputSchema: z.object({
    datasets: z.record(z.string(), z.array(z.number())).describe("Named time series datasets"),
    timeWindow: z.number().optional().default(3).describe("Time window for event synchronization"),
    threshold: z.number().optional().default(2.0).describe("Anomaly threshold for event detection")
  }),
  execute: async ({ datasets, timeWindow, threshold }) => {
    return detectSynchronizedEvents(datasets, timeWindow, threshold);
  }
});

export const analyzeCascadingFailuresTool = tool({
  description: "Analyze cascading failure patterns across multiple systems",
  inputSchema: z.object({
    datasets: z.record(z.string(), z.array(z.number())).describe("Named system datasets"),
    maxDelay: z.number().optional().default(10).describe("Maximum delay for cascade propagation")
  }),
  execute: async ({ datasets, maxDelay }) => {
    return analyzeCascadingFailures(datasets, maxDelay);
  }
});

// =============================================================================
// ANOMALY DETECTION TOOLS (8 functions)
// =============================================================================

export const zScoreAnomaliesTool = tool({
  description: "Detect anomalies using Z-score method (standard deviations from mean)",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    threshold: z.number().optional().default(3.0).describe("Z-score threshold for anomaly detection")
  }),
  execute: async ({ values, threshold }) => {
    return zScoreAnomalies(values, threshold);
  }
});

export const modifiedZScoreTool = tool({
  description: "Detect anomalies using Modified Z-score (more robust to outliers)",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    threshold: z.number().optional().default(3.5).describe("Modified Z-score threshold")
  }),
  execute: async ({ values, threshold }) => {
    return modifiedZScore(values, threshold);
  }
});

export const iqrOutliersTool = tool({
  description: "Detect outliers using Interquartile Range (IQR) method",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    factor: z.number().optional().default(1.5).describe("IQR factor for outlier detection")
  }),
  execute: async ({ values, factor }) => {
    return iqrOutliers(values, factor);
  }
});

export const localOutlierFactorTool = tool({
  description: "Detect anomalies using Local Outlier Factor (LOF) algorithm",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    k: z.number().optional().default(5).describe("Number of neighbors for LOF calculation"),
    threshold: z.number().optional().default(1.5).describe("LOF threshold for anomaly detection")
  }),
  execute: async ({ values, k, threshold }) => {
    return localOutlierFactor(values, k, threshold);
  }
});

export const seasonalAnomaliesTool = tool({
  description: "Detect seasonal anomalies in time series data",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values (time series)"),
    period: z.number().describe("Seasonal period length"),
    threshold: z.number().optional().default(2.0).describe("Threshold for seasonal anomaly detection")
  }),
  execute: async ({ values, period, threshold }) => {
    return seasonalAnomalies(values, period, threshold || 2.0);
  }
});

export const trendDeviationAnomaliesTool = tool({
  description: "Detect anomalies based on deviations from trend",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    windowSize: z.number().optional().default(10).describe("Window size for trend calculation"),
    threshold: z.number().optional().default(2.0).describe("Threshold for trend deviation")
  }),
  execute: async ({ values, windowSize, threshold }) => {
    return trendDeviationAnomalies(values, windowSize || 10, threshold || 2.0);
  }
});

export const ensembleAnomalyDetectionTool = tool({
  description: "Ensemble anomaly detection using multiple methods with consensus scoring",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    methods: z.array(z.enum(['z-score', 'modified-z-score', 'iqr', 'lof'])).optional()
      .default(['z-score', 'modified-z-score', 'iqr', 'lof']).describe("Anomaly detection methods to use"),
    consensusThreshold: z.number().optional().default(0.6).describe("Consensus threshold (0-1)")
  }),
  execute: async ({ values, methods, consensusThreshold }) => {
    return ensembleAnomalyDetection(values, methods || ['z-score', 'modified-z-score', 'iqr', 'lof'], consensusThreshold || 0.6);
  }
});

export const adaptiveThresholdingTool = tool({
  description: "Adaptive thresholding for dynamic anomaly detection",
  inputSchema: z.object({
    values: z.array(z.number()).describe("Array of numeric values"),
    windowSize: z.number().optional().default(20).describe("Window size for adaptive calculation"),
    sensitivity: z.number().optional().default(2.0).describe("Sensitivity factor for threshold adjustment")
  }),
  execute: async ({ values, windowSize, sensitivity }) => {
    return adaptiveThresholding(values, windowSize || 20, sensitivity || 2.0);
  }
});

// =============================================================================
// MATHEMATICAL FUNCTIONS COLLECTION EXPORT
// =============================================================================

export const mathematicalFunctionTools = {
  // Core Statistics (13)
  calculateMeanTool,
  calculateStdTool,
  calculateVarianceTool,
  calculateMedianTool,
  calculateQuantileTool,
  calculateIQRTool,
  calculateSkewnessTool,
  calculateKurtosisTool,
  calculateZScoresTool,
  calculateBasicStatsTool,
  testNormalityTool,
  calculateNormalPDFTool,
  calculateEntropyTool,

  // Time Series Analysis (8)
  calculateLinearTrendTool,
  simpleMovingAverageTool,
  exponentialMovingAverageTool,
  movingStandardDeviationTool,
  detectChangePointsTool,
  calculateAutocorrelationTool,
  detectCyclicPatternsTool,
  decomposeTimeSeriesTool,

  // Pattern Detection (7)
  findPeaksTool,
  findValleysTool,
  detectSpikesTool,
  findSimilarPatternsTool,
  detectRepeatingSequencesTool,
  findDominantFrequenciesTool,
  analyzePeakFrequencyTool,

  // Correlation Analysis (6)
  calculateCorrelationTool,
  calculateCrossCorrelationTool,
  calculateCorrelationMatrixTool,
  detectCausalityTool,
  detectSynchronizedEventsTool,
  analyzeCascadingFailuresTool,

  // Anomaly Detection (8)
  zScoreAnomaliesTool,
  modifiedZScoreTool,
  iqrOutliersTool,
  localOutlierFactorTool,
  seasonalAnomaliesTool,
  trendDeviationAnomaliesTool,
  ensembleAnomalyDetectionTool,
  adaptiveThresholdingTool
};

export const mathematicalFunctionToolNames = Object.keys(mathematicalFunctionTools);

console.log(`🔧 Mathematical Function AI Tools: ${mathematicalFunctionToolNames.length} mathematical functions ready for LLM use`);