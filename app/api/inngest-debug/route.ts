import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function GET() {
  // Create a fresh client to test what values are being used
  const testAppId = process.env.INNGEST_APP_ID || "jeeves-fcu-monitoring";

  return NextResponse.json({
    // Environment
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,

    // Keys (prefixes only for safety)
    signingKeyPrefix: process.env.INNGEST_SIGNING_KEY?.substring(0, 20) || 'MISSING',
    eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.substring(0, 20) || 'MISSING',
    hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
    hasEventKey: !!process.env.INNGEST_EVENT_KEY,

    // DIRECT env var check
    INNGEST_APP_ID_raw: process.env.INNGEST_APP_ID || 'NOT SET',
    INNGEST_APP_NAME_raw: process.env.INNGEST_APP_NAME || 'NOT SET',

    // Client config
    // @ts-ignore - accessing private property for debugging
    clientId: inngest._id || 'unknown',
    // @ts-ignore
    clientName: inngest._name || 'unknown',

    // What the client.ts fallback would be
    expectedFallbackId: 'jeeves-fcu-monitoring',
    expectedFallbackName: 'Jeeves FCU Monitoring',

    // Test what a fresh evaluation would use
    testFreshAppId: testAppId,

    help: "If testFreshAppId matches INNGEST_APP_ID_raw but clientId is unknown, there's a property access issue. Check Vercel function logs for '[Inngest Client] Initializing with:' message.",
  });
}
