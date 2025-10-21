/**
 * Quick test to verify mathematical functions work correctly
 */

import {
  calculateMean,
  calculateStd,
  calculateBasicStats
} from './core-stats';

import {
  calculateLinearTrend,
  simpleMovingAverage
} from './time-series';

import {
  findPeaks,
  detectSpikes
} from './pattern-detection';

import {
  calculateCorrelation
} from './correlation';

import {
  zScoreAnomalies
} from './anomaly-detection';

/**
 * Run basic tests on mathematical functions
 */
export function runBasicTests(): { success: boolean; results: Record<string, any> } {
  const results: Record<string, any> = {};

  try {
    // Test data: temperature readings with an anomaly
    const testData = [
      22.1, 22.3, 21.9, 22.2, 22.0, 22.4, 22.1, 21.8, 22.2, 22.3,
      22.0, 21.9, 22.1, 22.2, 25.5, 22.1, 21.9, 22.0, 22.2, 22.1  // 25.5 is anomaly
    ];

    // Test core statistics
    results.mean = calculateMean(testData);
    results.std = calculateStd(testData);
    results.basicStats = calculateBasicStats(testData);

    // Test time series
    results.trend = calculateLinearTrend(testData);
    results.movingAverage = simpleMovingAverage(testData, 3);

    // Test pattern detection
    results.peaks = findPeaks(testData);
    results.spikes = detectSpikes(testData);

    // Test correlation (correlate with itself should be 1.0)
    results.selfCorrelation = calculateCorrelation(testData, testData);

    // Test anomaly detection
    results.anomalies = zScoreAnomalies(testData);

    // Additional test: humidity data
    const humidityData = [65, 66, 64, 65, 67, 66, 65, 68, 64, 66];
    results.correlation = calculateCorrelation(testData.slice(0, 10), humidityData);

    return { success: true, results };

  } catch (error) {
    return {
      success: false,
      results: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Test specific function with known expected results
 */
export function testKnownValues(): { success: boolean; details: Record<string, any> } {
  const details: Record<string, any> = {};

  try {
    // Test with simple known values
    const simpleData = [1, 2, 3, 4, 5];

    const mean = calculateMean(simpleData);
    details.meanTest = { calculated: mean, expected: 3, passed: Math.abs(mean - 3) < 0.001 };

    const std = calculateStd(simpleData);
    const expectedStd = Math.sqrt(2.5); // Known standard deviation
    details.stdTest = { calculated: std, expected: expectedStd, passed: Math.abs(std - expectedStd) < 0.001 };

    // Perfect correlation test
    const corr = calculateCorrelation(simpleData, simpleData);
    details.corrTest = { calculated: corr.correlation, expected: 1, passed: Math.abs(corr.correlation - 1) < 0.001 };

    return { success: true, details };

  } catch (error) {
    return {
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}