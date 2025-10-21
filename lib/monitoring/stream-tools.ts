/**
 * Stream Analysis Tools for LLM
 * Enhanced data retrieval with context and metadata
 */

import { getRecentDataPoints as dbGetRecentDataPoints, getTicksInWindow } from '@/lib/db/telemetry-ops';

export interface StreamContext {
  streamId: string;
  sensorType: string;
  unit: string;
  values: number[];
  timestamps: Date[];
  quality: DataQuality;
  count: number;
  timeRange?: { from: Date; to: Date };
  valueType: 'binary' | 'percentage' | 'continuous';
  valueRange?: { min: number; max: number; values?: number[]; unit?: string };
}

export interface DataQuality {
  score: number; // 0-1, where 1 = perfect quality
  issues: string[];
  missingPoints: number;
  suspiciousValues: number;
  gaps: Array<{ start: Date; end: Date; duration: number }>;
}

export interface StreamMetadata {
  streamId: string;
  sensorType: string;
  unit: string;
  firstSeen: Date;
  lastSeen: Date;
  totalPoints: number;
  averageSamplingRate: number; // Hz
  valueType: 'binary' | 'percentage' | 'continuous';
  valueRange?: { min: number; max: number; values?: number[]; unit?: string };
}

/**
 * Extract metadata from raw database record
 */
function extractStreamMetadata(rawPoint: any): { sensorType: string; unit: string } {
  // Handle both current format and any future formats
  return {
    sensorType: rawPoint.sensorType || rawPoint.sensor_type || 'unknown',
    unit: rawPoint.unit || ''
  };
}

/**
 * Determine value type and range from stream ID
 * Prevents hallucinations by explicitly defining data semantics
 */
function determineValueType(streamId: string): {
  valueType: 'binary' | 'percentage' | 'continuous';
  valueRange?: { min: number; max: number; values?: number[]; unit?: string };
} {
  const lowerStreamId = streamId.toLowerCase();

  // Binary sensors: occupancy, fan state (0=off/vacant, 1=on/occupied)
  if (lowerStreamId.includes('occup') || lowerStreamId.includes('fan')) {
    return {
      valueType: 'binary',
      valueRange: { min: 0, max: 1, values: [0, 1] }
    };
  }

  // Percentage sensors: valve positions, outputs (0-100%)
  if (lowerStreamId.includes('output') || lowerStreamId.includes('valve') ||
      lowerStreamId.includes('heat') || lowerStreamId.includes('cool')) {
    return {
      valueType: 'percentage',
      valueRange: { min: 0, max: 100, unit: '%' }
    };
  }

  // Temperature sensors: continuous values
  if (lowerStreamId.includes('temp') || lowerStreamId.includes('setpt')) {
    return {
      valueType: 'continuous',
      valueRange: { min: 15, max: 30, unit: '°C' }
    };
  }

  // Default: continuous
  return {
    valueType: 'continuous',
    valueRange: undefined
  };
}

/**
 * Assess data quality of a stream
 */
function assessStreamDataQuality(
  values: number[],
  timestamps: Date[],
  expectedSamplingRate?: number
): DataQuality {
  const issues: string[] = [];
  let score = 1.0;

  // Check for missing values
  const missingPoints = values.filter(v => v === null || v === undefined || isNaN(v)).length;
  if (missingPoints > 0) {
    issues.push(`${missingPoints} missing/invalid values`);
    score -= (missingPoints / values.length) * 0.3;
  }

  // Check for time gaps if we have expected sampling rate
  const gaps: Array<{ start: Date; end: Date; duration: number }> = [];
  if (expectedSamplingRate && timestamps.length > 1) {
    const expectedInterval = 1000 / expectedSamplingRate; // ms

    for (let i = 1; i < timestamps.length; i++) {
      const actualInterval = timestamps[i].getTime() - timestamps[i-1].getTime();
      if (actualInterval > expectedInterval * 2) { // Allow 2x tolerance
        gaps.push({
          start: timestamps[i-1],
          end: timestamps[i],
          duration: actualInterval
        });
      }
    }

    if (gaps.length > 0) {
      issues.push(`${gaps.length} time gaps detected`);
      score -= Math.min(0.2, gaps.length / timestamps.length);
    }
  }

  // Check for suspicious values (extremely high/low compared to others)
  const validValues = values.filter(v => !isNaN(v) && v !== null && v !== undefined);
  if (validValues.length > 2) {
    const sorted = [...validValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 3 * iqr;
    const upperBound = q3 + 3 * iqr;

    const suspiciousValues = validValues.filter(v => v < lowerBound || v > upperBound).length;
    if (suspiciousValues > 0) {
      issues.push(`${suspiciousValues} potential outliers detected`);
      score -= Math.min(0.1, suspiciousValues / validValues.length);
    }
  }

  return {
    score: Math.max(0, score),
    issues,
    missingPoints,
    suspiciousValues: 0,
    gaps
  };
}

/**
 * Enhanced tool: Get recent data points with full context
 */
export async function getStreamRecentData(params: {
  streamId: string;
  count: number;
}): Promise<StreamContext> {
  const rawData = await dbGetRecentDataPoints({
    sensorId: params.streamId,
    count: params.count
  });

  if (rawData.length === 0) {
    throw new Error(`No data found for stream ${params.streamId}`);
  }

  // Extract metadata from first point
  const metadata = extractStreamMetadata(rawData[0]);

  // Extract values and timestamps
  const values = rawData.map(point => point.value);
  const timestamps = rawData.map(point => new Date(point.ts));

  // Assess data quality
  const quality = assessStreamDataQuality(values, timestamps);

  // Determine value type and range
  const { valueType, valueRange } = determineValueType(params.streamId);

  return {
    streamId: params.streamId,
    sensorType: metadata.sensorType,
    unit: metadata.unit,
    values,
    timestamps,
    quality,
    count: values.length,
    valueType,
    valueRange
  };
}

/**
 * Enhanced tool: Get data within time window with context
 */
export async function getStreamTimeWindow(params: {
  streamId: string;
  from: Date;
  to: Date;
  limit?: number;
}): Promise<StreamContext> {
  const rawData = await getTicksInWindow({
    sensorId: params.streamId,
    from: params.from,
    to: params.to,
    limit: params.limit || 1000
  });

  if (rawData.length === 0) {
    throw new Error(`No data found for stream ${params.streamId} in specified time range`);
  }

  // Extract metadata from first point
  const metadata = extractStreamMetadata(rawData[0]);

  // Extract values and timestamps
  const values = rawData.map(point => point.value);
  const timestamps = rawData.map(point => new Date(point.ts));

  // Calculate expected sampling rate from data
  if (timestamps.length > 1) {
    const totalDuration = timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime();
    const expectedRate = (timestamps.length - 1) / (totalDuration / 1000); // Hz
  }

  // Assess data quality
  const quality = assessStreamDataQuality(values, timestamps);

  // Determine value type and range
  const { valueType, valueRange } = determineValueType(params.streamId);

  return {
    streamId: params.streamId,
    sensorType: metadata.sensorType,
    unit: metadata.unit,
    values,
    timestamps,
    quality,
    count: values.length,
    timeRange: { from: params.from, to: params.to },
    valueType,
    valueRange
  };
}

/**
 * Enhanced tool: Get stream metadata and basic information
 */
export async function getStreamInfo(streamId: string): Promise<StreamMetadata> {
  // Get a small sample to extract metadata
  const recentData = await dbGetRecentDataPoints({
    sensorId: streamId,
    count: 10
  });

  if (recentData.length === 0) {
    throw new Error(`Stream ${streamId} not found`);
  }

  // Get oldest data to determine first seen
  const oldestData = await getTicksInWindow({
    sensorId: streamId,
    from: new Date('1970-01-01'), // Very old date
    to: new Date(),
    limit: 1
  });

  const metadata = extractStreamMetadata(recentData[0]);
  const firstPoint = oldestData[0] || recentData[recentData.length - 1];
  const lastPoint = recentData[0];

  // Calculate approximate total points and sampling rate
  const timeSpan = lastPoint.ts.getTime() - firstPoint.ts.getTime();
  const estimatedSamplingRate = timeSpan > 0 ? (recentData.length / (timeSpan / 1000)) : 0;

  // Determine value type and range
  const { valueType, valueRange } = determineValueType(streamId);

  return {
    streamId,
    sensorType: metadata.sensorType,
    unit: metadata.unit,
    firstSeen: new Date(firstPoint.ts),
    lastSeen: new Date(lastPoint.ts),
    totalPoints: recentData.length, // This is approximate
    averageSamplingRate: estimatedSamplingRate,
    valueType,
    valueRange
  };
}

/**
 * Enhanced tool: Get multiple streams simultaneously
 */
export async function getMultipleStreams(params: {
  streamIds: string[];
  timeRange?: { from: Date; to: Date };
  count?: number;
}): Promise<Record<string, StreamContext>> {
  const results: Record<string, StreamContext> = {};

  // Load all streams in parallel
  const streamPromises = params.streamIds.map(async streamId => {
    try {
      let streamData: StreamContext;

      if (params.timeRange) {
        streamData = await getStreamTimeWindow({
          streamId,
          from: params.timeRange.from,
          to: params.timeRange.to,
          limit: params.count
        });
      } else {
        streamData = await getStreamRecentData({
          streamId,
          count: params.count || 200
        });
      }

      return { streamId, data: streamData };
    } catch (error) {
      console.error(`Failed to load stream ${streamId}:`, error);
      return null;
    }
  });

  const streamResults = await Promise.all(streamPromises);

  // Build results object
  streamResults.forEach(result => {
    if (result) {
      results[result.streamId] = result.data;
    }
  });

  return results;
}

/**
 * Tool: List all available streams
 * Dynamically discovers streams from database
 */
export async function listAvailableStreams(): Promise<StreamMetadata[]> {
  const { db } = await import('@/lib/db/queries');
  const { TelemetryTick } = await import('@/lib/db/telemetry-ops');
  const { sql } = await import('drizzle-orm');

  try {
    // Query for distinct sensor IDs with recent activity
    const result = await db
      .selectDistinct({ sensorId: TelemetryTick.sensorId })
      .from(TelemetryTick)
      .where(sql`${TelemetryTick.ts} > NOW() - INTERVAL '24 hours'`);

    const streamIds = result.map(r => r.sensorId);
    console.log(`[Stream Discovery] Found ${streamIds.length} active streams:`, streamIds);

    // Get metadata for each stream
    const streamInfos = await Promise.all(
      streamIds.map(async streamId => {
        try {
          return await getStreamInfo(streamId);
        } catch (error) {
          console.warn(`[Stream Discovery] Failed to get info for ${streamId}:`, error);
          return null;
        }
      })
    );

    return streamInfos.filter(info => info !== null) as StreamMetadata[];
  } catch (error) {
    console.error('[Stream Discovery] Failed to list streams:', error);
    // Fallback: Try to find FCU-01_04 streams
    try {
      const fallbackResult = await db
        .selectDistinct({ sensorId: TelemetryTick.sensorId })
        .from(TelemetryTick)
        .where(sql`${TelemetryTick.sensorId} LIKE 'fcu-01_04-%'`)
        .limit(50);

      const fallbackStreamIds = fallbackResult.map(r => r.sensorId);

      if (fallbackStreamIds.length > 0) {
        console.log(`[Stream Discovery] Fallback found ${fallbackStreamIds.length} FCU-01_04 streams`);
        const streamInfos = await Promise.all(
          fallbackStreamIds.map(async streamId => {
            try {
              return await getStreamInfo(streamId);
            } catch (error) {
              return null;
            }
          })
        );
        return streamInfos.filter(info => info !== null) as StreamMetadata[];
      }
    } catch (fallbackError) {
      console.error('[Stream Discovery] Fallback also failed:', fallbackError);
    }

    // Last resort: return empty array (no streams available)
    console.warn('[Stream Discovery] No streams found - returning empty array');
    return [];
  }
}