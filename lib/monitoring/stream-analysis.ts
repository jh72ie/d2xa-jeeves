/**
 * Complete Stream Analysis System for LLM Tools
 * Unified export of all stream analysis capabilities
 */

// Import for internal use in testStreamAnalysisSystem
import { getStreamRecentData, listAvailableStreams } from './stream-tools';
import { analyzeStreamStatistics } from './analysis-tools';
import { assessStreamDataQuality } from './quality-tools';
import { correlateTwoStreams } from './multi-stream-tools';

// Data Retrieval Tools
export {
  getStreamRecentData,
  getStreamTimeWindow,
  getStreamInfo,
  getMultipleStreams,
  listAvailableStreams,
  type StreamContext,
  type DataQuality,
  type StreamMetadata
} from './stream-tools';

// Single Stream Analysis Tools
export {
  analyzeStreamStatistics,
  analyzeStreamTrend,
  analyzeStreamAnomalies,
  analyzeStreamPatterns,
  analyzeStreamAutocorrelation,
  analyzeStreamMovingAverage,
  type AnalysisResult
} from './analysis-tools';

// Multi-Stream Analysis Tools
export {
  correlateTwoStreams,
  correlateMultipleStreams,
  testStreamCausality,
  detectSynchronizedStreamEvents,
  analyzeCascadingStreamFailures,
  type MultiStreamResult
} from './multi-stream-tools';

// Quality Assessment Tools
export {
  assessStreamDataQuality,
  monitorStreamHealth,
  compareStreamQualityPeriods,
  type QualityReport,
  type QualityIssue,
  type DataHealthTrend
} from './quality-tools';

// Re-export all mathematical functions for direct use
export * from './index';

/**
 * Get all available stream analysis tools for LLM
 */
export function getStreamAnalysisTools(): Record<string, string[]> {
  return {
    'data-retrieval': [
      'getStreamRecentData',
      'getStreamTimeWindow',
      'getStreamInfo',
      'getMultipleStreams',
      'listAvailableStreams'
    ],
    'single-stream-analysis': [
      'analyzeStreamStatistics',
      'analyzeStreamTrend',
      'analyzeStreamAnomalies',
      'analyzeStreamPatterns',
      'analyzeStreamAutocorrelation',
      'analyzeStreamMovingAverage'
    ],
    'multi-stream-analysis': [
      'correlateTwoStreams',
      'correlateMultipleStreams',
      'testStreamCausality',
      'detectSynchronizedStreamEvents',
      'analyzeCascadingStreamFailures'
    ],
    'quality-assessment': [
      'assessStreamDataQuality',
      'monitorStreamHealth',
      'compareStreamQualityPeriods'
    ],
    'mathematical-functions': [
      // Core Statistics
      'calculateMean', 'calculateStd', 'calculateBasicStats', 'calculateZScores',
      'calculateQuantile', 'calculateIQR', 'testNormality', 'calculateEntropy',

      // Time Series Analysis
      'calculateLinearTrend', 'simpleMovingAverage', 'exponentialMovingAverage',
      'detectChangePoints', 'calculateAutocorrelation', 'detectCyclicPatterns',

      // Pattern Detection
      'findPeaks', 'findValleys', 'detectSpikes', 'findSimilarPatterns',
      'detectRepeatingSequences', 'analyzePeakFrequency',

      // Correlation Analysis
      'calculateCorrelation', 'calculateCrossCorrelation', 'calculateCorrelationMatrix',
      'detectCausality', 'detectSynchronizedEvents', 'analyzeCascadingFailures',

      // Anomaly Detection
      'zScoreAnomalies', 'modifiedZScore', 'iqrOutliers', 'seasonalAnomalies',
      'ensembleAnomalyDetection', 'adaptiveThresholding'
    ]
  };
}

/**
 * Tool usage guide for LLM
 */
export const TOOL_USAGE_GUIDE = {
  'getting-started': {
    description: 'Start with these tools to understand your streams',
    tools: ['listAvailableStreams', 'getStreamInfo', 'getStreamRecentData']
  },
  'basic-analysis': {
    description: 'Fundamental analysis of single streams',
    tools: ['analyzeStreamStatistics', 'analyzeStreamTrend', 'analyzeStreamAnomalies']
  },
  'pattern-analysis': {
    description: 'Discover patterns and cyclical behavior',
    tools: ['analyzeStreamPatterns', 'analyzeStreamAutocorrelation', 'findPeaks']
  },
  'multi-stream': {
    description: 'Analyze relationships between multiple streams',
    tools: ['correlateMultipleStreams', 'testStreamCausality', 'detectSynchronizedStreamEvents']
  },
  'quality-monitoring': {
    description: 'Monitor and assess data quality',
    tools: ['assessStreamDataQuality', 'monitorStreamHealth', 'compareStreamQualityPeriods']
  },
  'advanced-math': {
    description: 'Direct access to mathematical functions for custom analysis',
    tools: ['calculateBasicStats', 'calculateLinearTrend', 'ensembleAnomalyDetection']
  }
};

/**
 * Example workflows for common analysis scenarios
 */
export const ANALYSIS_WORKFLOWS = {
  'investigate-anomaly': [
    'getStreamRecentData', // Get recent data
    'analyzeStreamAnomalies', // Detect anomalies
    'analyzeStreamTrend', // Check if trend changed
    'assessStreamDataQuality', // Check data quality
    'correlateMultipleStreams' // Check if other streams affected
  ],
  'system-health-check': [
    'listAvailableStreams', // See what streams exist
    'getMultipleStreams', // Load all stream data
    'correlateMultipleStreams', // Check relationships
    'detectSynchronizedStreamEvents', // Look for system-wide events
    'assessStreamDataQuality' // Assess overall quality
  ],
  'performance-analysis': [
    'getStreamTimeWindow', // Get historical data
    'analyzeStreamTrend', // Look for performance trends
    'analyzeStreamPatterns', // Find cyclical patterns
    'compareStreamQualityPeriods', // Compare time periods
    'monitorStreamHealth' // Track health over time
  ],
  'root-cause-analysis': [
    'detectSynchronizedStreamEvents', // When did the issue start?
    'testStreamCausality', // What caused what?
    'analyzeCascadingStreamFailures', // How did it propagate?
    'analyzeStreamPatterns', // Are there recurring issues?
    'correlateMultipleStreams' // What systems are involved?
  ]
};

/**
 * Create a simple test function for validating the system
 */
export async function testStreamAnalysisSystem(): Promise<{
  success: boolean;
  results: Record<string, any>;
  errors: string[];
}> {
  const results: Record<string, any> = {};
  const errors: string[] = [];

  try {
    // Test basic data retrieval
    const streams = await listAvailableStreams();
    results.availableStreams = streams.map(s => s.streamId);

    if (streams.length > 0) {
      const streamId = streams[0].streamId;

      // Test single stream analysis
      const recentData = await getStreamRecentData({ streamId, count: 50 });
      results.dataRetrieval = {
        streamId: recentData.streamId,
        sensorType: recentData.sensorType,
        dataPoints: recentData.values.length,
        quality: recentData.quality.score
      };

      // Test statistical analysis
      const stats = await analyzeStreamStatistics({ streamId, count: 50 });
      results.statisticalAnalysis = {
        method: stats.method,
        mean: stats.result.mean,
        std: stats.result.std,
        confidence: stats.quality.confidence
      };

      // Test quality assessment
      const quality = await assessStreamDataQuality({ streamId, count: 50 });
      results.qualityAssessment = {
        overallScore: quality.overallScore,
        grade: quality.grade,
        issueCount: quality.issues.length
      };

      // Test multi-stream if multiple streams available
      if (streams.length > 1) {
        const correlation = await correlateTwoStreams({
          streamId1: streams[0].streamId,
          streamId2: streams[1].streamId,
          count: 50
        });
        results.multiStreamAnalysis = {
          correlation: correlation.result.correlation.correlation,
          strength: correlation.result.correlation.strength
        };
      }
    }

    return { success: true, results, errors };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { success: false, results, errors };
  }
}