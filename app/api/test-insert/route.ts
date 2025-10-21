/**
 * Test endpoint to verify database insertTick works
 * Visit: /api/test-insert to manually test database insertion
 */

import { NextResponse } from 'next/server';
import { insertTick } from '@/lib/db/telemetry-ops';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[Test Insert] Starting test insertion...');

    // Insert a test FCU-201 stream
    const result = await insertTick({
      sensorId: 'fcu-201-test-spacetemp',
      ts: new Date(),
      value: 22.5,
    });

    console.log('[Test Insert] Success:', result);

    return NextResponse.json({
      success: true,
      message: 'Test insertion successful',
      data: result,
    });
  } catch (error: any) {
    console.error('[Test Insert] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
