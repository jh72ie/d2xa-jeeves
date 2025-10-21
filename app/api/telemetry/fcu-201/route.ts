/**
 * FCU-01_04 Telemetry API
 *
 * Returns recent data for all FCU-01_04 streams from database
 */

import { NextResponse } from 'next/server';
import { getRecentDataPoints } from '@/lib/db/telemetry-ops';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get list of all FCU-01_04 streams from database
    const { db } = await import('@/lib/db/queries');
    const { TelemetryTick } = await import('@/lib/db/telemetry-ops');
    const { sql } = await import('drizzle-orm');

    const streamIdsResult = await db
      .selectDistinct({ sensorId: TelemetryTick.sensorId })
      .from(TelemetryTick)
      .where(sql`${TelemetryTick.sensorId} LIKE 'fcu-01_04-%' AND ${TelemetryTick.ts} > NOW() - INTERVAL '1 hour'`);

    const streamIds = streamIdsResult.map(r => r.sensorId);

    if (streamIds.length === 0) {
      return NextResponse.json({
        error: 'No FCU-01_04 data available',
        message: 'Waiting for ingestion worker to collect data...',
      }, { status: 404 });
    }

    // Fetch recent data for each stream (last 100 points)
    const streamDataPromises = streamIds.map(async (streamId) => {
      const data = await getRecentDataPoints({
        sensorId: streamId,
        count: 100,
      });

      return {
        streamId,
        data: data.map(point => ({
          timestamp: point.ts.toISOString(),
          value: point.value,
        })),
      };
    });

    const streamData = await Promise.all(streamDataPromises);

    // Organize streams by category
    const categorized = {
      temperature: streamData.filter(s =>
        s.streamId.includes('temp') || s.streamId.includes('setpoint') || s.streamId.includes('setpt')
      ),
      valves: streamData.filter(s =>
        s.streamId.includes('heat') || s.streamId.includes('cool')
      ),
      fan: streamData.filter(s =>
        s.streamId.includes('fan')
      ),
      occupancy: streamData.filter(s =>
        s.streamId.includes('occup')
      ),
      status: streamData.filter(s =>
        s.streamId.includes('status') || s.streamId.includes('parsed-status')
      ),
      other: streamData.filter(s =>
        !s.streamId.includes('temp') &&
        !s.streamId.includes('setpoint') &&
        !s.streamId.includes('setpt') &&
        !s.streamId.includes('heat') &&
        !s.streamId.includes('cool') &&
        !s.streamId.includes('fan') &&
        !s.streamId.includes('occup') &&
        !s.streamId.includes('status')
      ),
    };

    return NextResponse.json({
      success: true,
      streamCount: streamIds.length,
      categorized,
      allStreams: streamData,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[FCU-01_04 API] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch FCU-01_04 data',
      message: error.message,
    }, { status: 500 });
  }
}
