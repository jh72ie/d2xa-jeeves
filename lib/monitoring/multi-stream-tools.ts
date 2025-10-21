/**
 * Multi-Stream Analysis Tools for LLM
 * Cross-stream correlation, causality, and relationship analysis
 */

import { getMultipleStreams, StreamContext } from './stream-tools';
import { AnalysisResult } from './analysis-tools';
import {
  calculateCorrelation,
  calculateCrossCorrelation,
  calculateCorrelationMatrix,
  detectCausality,
  detectSynchronizedEvents,
  analyzeCascadingFailures
} from './correlation';

export interface MultiStreamResult {
  streams: Array<{ streamId: string; sensorType: string; unit: string }>;
  method: string;
  result: any;
  interpretation: string;
  quality: {
    overallDataQuality: number;
    confidence: number;
    reliability: string;
  };
  context: {
    sampleSizes: Record<string, number>;
    timeRange?: { from: Date; to: Date };
    parameters: Record<string, any>;
  };
}

/**
 * Calculate pairwise correlation between two streams
 */
export async function correlateTwoStreams(params: {
  streamId1: string;
  streamId2: string;
  count?: number;
  timeRange?: { from: Date; to: Date };
  maxLag?: number;
}): Promise<MultiStreamResult> {
  // Load both streams
  const streams = await getMultipleStreams({
    streamIds: [params.streamId1, params.streamId2],
    count: params.count || 200,
    timeRange: params.timeRange
  });

  const stream1 = streams[params.streamId1];
  const stream2 = streams[params.streamId2];

  if (!stream1 || !stream2) {
    throw new Error(`Failed to load one or both streams: ${params.streamId1}, ${params.streamId2}`);
  }

  // Align streams to same length (use shorter one)
  const minLength = Math.min(stream1.values.length, stream2.values.length);
  const values1 = stream1.values.slice(0, minLength);
  const values2 = stream2.values.slice(0, minLength);

  // Calculate correlation
  const correlation = calculateCorrelation(values1, values2);

  // Calculate cross-correlation if lag analysis requested
  let crossCorr;
  if (params.maxLag) {
    crossCorr = calculateCrossCorrelation(values1, values2, params.maxLag);
  }

  // Generate interpretation
  let interpretation = `Correlation between ${stream1.sensorType} and ${stream2.sensorType}: `;
  interpretation += `${correlation.correlation.toFixed(3)} (${correlation.strength} ${correlation.direction})`;

  if (crossCorr && Math.abs(crossCorr.maxCorrelation) > Math.abs(correlation.correlation)) {
    const leadLag = crossCorr.optimalLag > 0 ? `${stream1.sensorType} leads by ${crossCorr.optimalLag}` :
                   crossCorr.optimalLag < 0 ? `${stream2.sensorType} leads by ${Math.abs(crossCorr.optimalLag)}` : 'synchronous';
    interpretation += `. Best lagged correlation: ${crossCorr.maxCorrelation.toFixed(3)} (${leadLag})`;
  }

  const result: any = { correlation };
  if (crossCorr) result.crossCorrelation = crossCorr;

  return {
    streams: [
      { streamId: params.streamId1, sensorType: stream1.sensorType, unit: stream1.unit },
      { streamId: params.streamId2, sensorType: stream2.sensorType, unit: stream2.unit }
    ],
    method: 'pairwise-correlation',
    result,
    interpretation,
    quality: {
      overallDataQuality: Math.min(stream1.quality.score, stream2.quality.score),
      confidence: correlation.significance / 10, // Normalize to 0-1
      reliability: correlation.strength === 'strong' ? 'high' : correlation.strength === 'moderate' ? 'medium' : 'low'
    },
    context: {
      sampleSizes: {
        [params.streamId1]: stream1.values.length,
        [params.streamId2]: stream2.values.length,
        aligned: minLength
      },
      timeRange: params.timeRange,
      parameters: { maxLag: params.maxLag }
    }
  };
}

/**
 * Calculate correlation matrix for multiple streams
 */
export async function correlateMultipleStreams(params: {
  streamIds: string[];
  count?: number;
  timeRange?: { from: Date; to: Date };
  significanceThreshold?: number;
}): Promise<MultiStreamResult> {
  if (params.streamIds.length < 2) {
    throw new Error('At least 2 streams required for correlation matrix');
  }

  // Load all streams
  const streams = await getMultipleStreams({
    streamIds: params.streamIds,
    count: params.count || 200,
    timeRange: params.timeRange
  });

  // Find minimum length across all streams
  const streamValues = Object.entries(streams);
  const minLength = Math.min(...streamValues.map(([_, stream]) => stream.values.length));

  // Align all streams to same length
  const alignedStreams: Record<string, number[]> = {};
  streamValues.forEach(([streamId, stream]) => {
    alignedStreams[streamId] = stream.values.slice(0, minLength);
  });

  // Calculate correlation matrix
  const corrMatrix = calculateCorrelationMatrix(alignedStreams, params.significanceThreshold);

  // Generate interpretation
  let interpretation = `Correlation matrix for ${params.streamIds.length} streams`;
  if (corrMatrix.strongPairs.length > 0) {
    interpretation += `. Found ${corrMatrix.strongPairs.length} significant relationships:`;
    corrMatrix.strongPairs.slice(0, 3).forEach(pair => {
      const stream1Type = streams[pair.stream1].sensorType;
      const stream2Type = streams[pair.stream2].sensorType;
      interpretation += ` ${stream1Type}-${stream2Type}: ${pair.correlation.toFixed(3)} (${pair.significance})`;
    });
  } else {
    interpretation += '. No significant correlations found.';
  }

  const overallQuality = Object.values(streams).reduce((avg, stream) => avg + stream.quality.score, 0) / streamValues.length;

  return {
    streams: streamValues.map(([streamId, stream]) => ({
      streamId,
      sensorType: stream.sensorType,
      unit: stream.unit
    })),
    method: 'correlation-matrix',
    result: corrMatrix,
    interpretation,
    quality: {
      overallDataQuality: overallQuality,
      confidence: Math.min(0.9, minLength / 100),
      reliability: overallQuality > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSizes: Object.fromEntries(
        streamValues.map(([streamId, stream]) => [streamId, stream.values.length])
      ),
      timeRange: params.timeRange,
      parameters: {
        significanceThreshold: params.significanceThreshold,
        alignedLength: minLength
      }
    }
  };
}

/**
 * Test for Granger causality between two streams
 */
export async function testStreamCausality(params: {
  streamId1: string;
  streamId2: string;
  maxLag?: number;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<MultiStreamResult> {
  // Load both streams
  const streams = await getMultipleStreams({
    streamIds: [params.streamId1, params.streamId2],
    count: params.count || 300,
    timeRange: params.timeRange
  });

  const stream1 = streams[params.streamId1];
  const stream2 = streams[params.streamId2];

  if (!stream1 || !stream2) {
    throw new Error(`Failed to load one or both streams: ${params.streamId1}, ${params.streamId2}`);
  }

  // Align streams
  const minLength = Math.min(stream1.values.length, stream2.values.length);
  const values1 = stream1.values.slice(0, minLength);
  const values2 = stream2.values.slice(0, minLength);

  // Test causality
  const causality = detectCausality(values1, values2, params.maxLag);

  // Generate interpretation
  let interpretation = `Granger causality test between ${stream1.sensorType} and ${stream2.sensorType}: `;

  switch (causality.causality) {
    case 'x_causes_y':
      interpretation += `${stream1.sensorType} causes ${stream2.sensorType}`;
      break;
    case 'y_causes_x':
      interpretation += `${stream2.sensorType} causes ${stream1.sensorType}`;
      break;
    case 'bidirectional':
      interpretation += `Bidirectional causality detected`;
      break;
    case 'no_causality':
      interpretation += `No causal relationship detected`;
      break;
  }

  if (causality.causality !== 'no_causality') {
    interpretation += ` (strength: ${causality.strength.toFixed(3)}, optimal lag: ${causality.optimalLag}, confidence: ${(causality.confidence * 100).toFixed(1)}%)`;
  }

  return {
    streams: [
      { streamId: params.streamId1, sensorType: stream1.sensorType, unit: stream1.unit },
      { streamId: params.streamId2, sensorType: stream2.sensorType, unit: stream2.unit }
    ],
    method: 'granger-causality',
    result: causality,
    interpretation,
    quality: {
      overallDataQuality: Math.min(stream1.quality.score, stream2.quality.score),
      confidence: causality.confidence,
      reliability: causality.confidence > 0.7 ? 'high' : causality.confidence > 0.4 ? 'medium' : 'low'
    },
    context: {
      sampleSizes: {
        [params.streamId1]: stream1.values.length,
        [params.streamId2]: stream2.values.length,
        aligned: minLength
      },
      timeRange: params.timeRange,
      parameters: { maxLag: params.maxLag }
    }
  };
}

/**
 * Detect synchronized events across multiple streams
 */
export async function detectSynchronizedStreamEvents(params: {
  streamIds: string[];
  timeWindow?: number;
  threshold?: number;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<MultiStreamResult> {
  if (params.streamIds.length < 2) {
    throw new Error('At least 2 streams required for synchronized event detection');
  }

  // Load all streams
  const streams = await getMultipleStreams({
    streamIds: params.streamIds,
    count: params.count || 500,
    timeRange: params.timeRange
  });

  // Align all streams to same length
  const streamValues = Object.entries(streams);
  const minLength = Math.min(...streamValues.map(([_, stream]) => stream.values.length));

  const alignedStreams: Record<string, number[]> = {};
  streamValues.forEach(([streamId, stream]) => {
    alignedStreams[streamId] = stream.values.slice(0, minLength);
  });

  // Detect synchronized events
  const events = detectSynchronizedEvents(
    alignedStreams,
    params.timeWindow || 3,
    params.threshold || 2.0
  );

  // Generate interpretation
  let interpretation = `Synchronized event analysis across ${params.streamIds.length} streams`;
  if (events.length > 0) {
    interpretation += `: Found ${events.length} synchronized events.`;

    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeDesc = Object.entries(eventsByType)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    interpretation += ` Event types: ${typeDesc}.`;

    const strongestEvent = events[0];
    const involvedTypes = strongestEvent.streams.map(sid => streams[sid].sensorType);
    interpretation += ` Strongest event involved ${involvedTypes.join(', ')} with correlation ${strongestEvent.correlationScore.toFixed(3)}.`;
  } else {
    interpretation += '. No synchronized events detected.';
  }

  const overallQuality = Object.values(streams).reduce((avg, stream) => avg + stream.quality.score, 0) / streamValues.length;

  return {
    streams: streamValues.map(([streamId, stream]) => ({
      streamId,
      sensorType: stream.sensorType,
      unit: stream.unit
    })),
    method: 'synchronized-events',
    result: {
      events,
      totalEvents: events.length,
      eventsByType: events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },
    interpretation,
    quality: {
      overallDataQuality: overallQuality,
      confidence: Math.min(0.9, events.length > 0 ? events[0].correlationScore : 0.5),
      reliability: overallQuality > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSizes: Object.fromEntries(
        streamValues.map(([streamId, stream]) => [streamId, stream.values.length])
      ),
      timeRange: params.timeRange,
      parameters: {
        timeWindow: params.timeWindow,
        threshold: params.threshold,
        alignedLength: minLength
      }
    }
  };
}

/**
 * Analyze cascading failure patterns
 */
export async function analyzeCascadingStreamFailures(params: {
  streamIds: string[];
  maxDelay?: number;
  count?: number;
  timeRange?: { from: Date; to: Date };
}): Promise<MultiStreamResult> {
  if (params.streamIds.length < 2) {
    throw new Error('At least 2 streams required for cascading failure analysis');
  }

  // Load all streams
  const streams = await getMultipleStreams({
    streamIds: params.streamIds,
    count: params.count || 400,
    timeRange: params.timeRange
  });

  // Align all streams to same length
  const streamValues = Object.entries(streams);
  const minLength = Math.min(...streamValues.map(([_, stream]) => stream.values.length));

  const alignedStreams: Record<string, number[]> = {};
  streamValues.forEach(([streamId, stream]) => {
    alignedStreams[streamId] = stream.values.slice(0, minLength);
  });

  // Analyze cascading failures
  const cascades = analyzeCascadingFailures(alignedStreams, params.maxDelay);

  // Generate interpretation
  let interpretation = `Cascading failure analysis for ${params.streamIds.length} streams`;
  if (cascades.length > 0) {
    interpretation += `: Found ${cascades.length} potential cascade patterns.`;

    const topCascade = cascades[0];
    const initiatorType = streams[topCascade.initiator].sensorType;
    interpretation += ` Primary initiator: ${initiatorType} (strength: ${topCascade.cascadeStrength.toFixed(3)})`;

    if (topCascade.followers.length > 0) {
      const followerTypes = topCascade.followers.map(f => streams[f.stream].sensorType);
      interpretation += `, affects: ${followerTypes.join(', ')}`;

      const delays = topCascade.followers.map(f => f.delay);
      interpretation += `, typical delays: ${delays.join(', ')} time units`;
    }
  } else {
    interpretation += '. No cascading failure patterns detected.';
  }

  const overallQuality = Object.values(streams).reduce((avg, stream) => avg + stream.quality.score, 0) / streamValues.length;

  return {
    streams: streamValues.map(([streamId, stream]) => ({
      streamId,
      sensorType: stream.sensorType,
      unit: stream.unit
    })),
    method: 'cascading-failures',
    result: cascades,
    interpretation,
    quality: {
      overallDataQuality: overallQuality,
      confidence: cascades.length > 0 ? cascades[0].cascadeStrength : 0.5,
      reliability: overallQuality > 0.8 ? 'high' : 'medium'
    },
    context: {
      sampleSizes: Object.fromEntries(
        streamValues.map(([streamId, stream]) => [streamId, stream.values.length])
      ),
      timeRange: params.timeRange,
      parameters: {
        maxDelay: params.maxDelay,
        alignedLength: minLength
      }
    }
  };
}