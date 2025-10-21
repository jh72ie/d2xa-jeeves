/**
 * Comprehensive Mathematical Toolkit for Stream Monitoring
 * Export all functions for use by LLM tools
 */

// Core Statistics
export * from './core-stats';

// Time Series Analysis
export * from './time-series';

// Pattern Detection
export * from './pattern-detection';

// Correlation Analysis
export * from './correlation';

// Advanced Anomaly Detection
export * from './anomaly-detection';

// Convenience function to get all available analysis methods
export function getAvailableAnalysisMethods(): Record<string, string[]> {
  return {
    'core-stats': [
      'calculateMean',
      'calculateStd',
      'calculateVariance',
      'calculateMedian',
      'calculateQuantile',
      'calculateIQR',
      'calculateSkewness',
      'calculateKurtosis',
      'calculateZScores',
      'calculateBasicStats',
      'testNormality',
      'calculateNormalPDF',
      'calculateEntropy'
    ],
    'time-series': [
      'calculateLinearTrend',
      'simpleMovingAverage',
      'exponentialMovingAverage',
      'movingStandardDeviation',
      'detectChangePoints',
      'calculateAutocorrelation',
      'detectCyclicPatterns',
      'decomposeTimeSeries'
    ],
    'pattern-detection': [
      'findPeaks',
      'findValleys',
      'detectSpikes',
      'findSimilarPatterns',
      'detectRepeatingSequences',
      'findDominantFrequencies',
      'analyzePeakFrequency'
    ],
    'correlation': [
      'calculateCorrelation',
      'calculateCrossCorrelation',
      'calculateCorrelationMatrix',
      'detectCausality',
      'detectSynchronizedEvents',
      'analyzeCascadingFailures'
    ],
    'anomaly-detection': [
      'zScoreAnomalies',
      'modifiedZScore',
      'iqrOutliers',
      'localOutlierFactor',
      'seasonalAnomalies',
      'trendDeviationAnomalies',
      'ensembleAnomalyDetection',
      'adaptiveThresholding'
    ]
  };
}