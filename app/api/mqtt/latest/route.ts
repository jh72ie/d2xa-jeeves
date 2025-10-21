/**
 * MQTT Latest Data API - Polling endpoint
 *
 * Returns the latest FCU data from Redis cache
 * Updated by Inngest background worker every 30s
 */

import { NextResponse } from 'next/server';
import { createClient } from 'redis';

const REDIS_KEY = 'mqtt:fcu:latest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Connect to Redis
    const redis = createClient({
      url: process.env.REDIS_URL,
    });

    await redis.connect();

    // Get latest data
    const data = await redis.get(REDIS_KEY);

    await redis.disconnect();

    if (!data) {
      return NextResponse.json({
        error: 'No data available',
        message: 'MQTT listener may not be running or no messages received yet',
      }, { status: 404 });
    }

    const parsed = JSON.parse(data);

    return NextResponse.json({
      success: true,
      data: parsed,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[MQTT Latest API] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch data',
      message: error.message,
    }, { status: 500 });
  }
}
