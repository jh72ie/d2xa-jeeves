/**
 * Ingestion Status API
 *
 * Quick health check to see if FCU data is being ingested
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { TelemetryTick } from '@/lib/db/telemetry-ops';
import { desc, sql } from 'drizzle-orm';
import { getJeevesState } from '@/lib/db/jeeves-queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Check Jeeves state
    const jeevesState = await getJeevesState();

    // Check for recent FCU-201 data (last 30 minutes)
    const recentData = await db
      .select({
        sensorId: TelemetryTick.sensorId,
        ts: TelemetryTick.ts,
        value: TelemetryTick.value,
      })
      .from(TelemetryTick)
      .where(sql`${TelemetryTick.sensorId} LIKE 'fcu-201-%' AND ${TelemetryTick.ts} > NOW() - INTERVAL '30 minutes'`)
      .orderBy(desc(TelemetryTick.ts))
      .limit(5);

    // Count total FCU-201 records
    const totalCount = await db
      .select({ count: sql<string>`count(*)` })
      .from(TelemetryTick)
      .where(sql`${TelemetryTick.sensorId} LIKE 'fcu-201-%'`);

    // Get distinct streams
    const streams = await db
      .selectDistinct({ sensorId: TelemetryTick.sensorId })
      .from(TelemetryTick)
      .where(sql`${TelemetryTick.sensorId} LIKE 'fcu-201-%'`);

    const status = {
      ingestionEnabled: jeevesState?.ingestionEnabled ?? false,
      hasRecentData: recentData.length > 0,
      lastDataPoint: recentData[0] || null,
      recentDataCount: recentData.length,
      totalDataPoints: totalCount[0]?.count || '0',
      streamCount: streams.length,
      streams: streams.map(s => s.sensorId).slice(0, 10),
      allStreams: streams.map(s => s.sensorId),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      status,
      summary: status.hasRecentData
        ? `✅ Ingestion is working! ${status.recentDataCount} data points in last 30 min`
        : status.ingestionEnabled
        ? `⚠️ Ingestion enabled but no recent data (may need to wait for next cycle)`
        : `❌ Ingestion is disabled in Jeeves console`,
    });

  } catch (error: any) {
    console.error('[Ingestion Status] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check ingestion status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
