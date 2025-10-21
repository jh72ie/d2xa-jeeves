/**
 * Telemetry Stream API - Server-Sent Events
 *
 * Connects to HiveMQ MQTT broker and streams live FCU data to clients
 */

import mqtt from 'mqtt';
import { NextRequest } from 'next/server';
import { parseMQTTMessage } from '@/lib/mqtt/fcu-parser';

// MQTT Configuration
const MQTT_CONFIG = {
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts' as const,
  username: 'Beringar',
  password: 'Winter2025!',
  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue', // Wildcard to get all sensors
};

/**
 * Extract numeric value from status string or enum
 * Same logic as fcu-data-ingestion
 */
function extractNumericValue(valueStr: any): number | null {
  if (typeof valueStr === 'number') return valueStr;
  if (typeof valueStr !== 'string') return null;

  // Try to extract number from status string first
  const numMatch = valueStr.match(/^([\d\.]+|nan)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    return isNaN(num) ? null : num;
  }

  // Convert enums to numbers
  const lowerValue = valueStr.toLowerCase();

  // Occupancy states
  if (lowerValue.includes('ococcupied')) return 1;
  if (lowerValue.includes('ocunoccupied')) return 0;
  if (lowerValue.includes('ocstandby')) return 0.5;

  // Fan/equipment states
  if (lowerValue.includes('stateon')) return 1;
  if (lowerValue.includes('stateoff')) return 0;

  // Enable/Disable states
  if (lowerValue.includes('enable')) return 1;
  if (lowerValue.includes('disable')) return 0;

  // HVAC modes
  if (lowerValue.includes('hvacoff')) return 0;
  if (lowerValue.includes('hvacheat')) return 1;
  if (lowerValue.includes('hvaccool')) return 2;
  if (lowerValue.includes('hvacauto')) return 3;

  // Boolean-like states
  if (lowerValue.includes('yes')) return 1;
  if (lowerValue.includes('no')) return 0;
  if (lowerValue.includes('on ')) return 1;
  if (lowerValue.includes('off ')) return 0;

  return null;
}

/**
 * Normalize field name to stream ID format
 */
function normalizeFieldName(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/^(nvo|nvi|nci)/, '')
    .replace(/[^a-z0-9]/g, '');
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes (requires Vercel Pro)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sensorId = searchParams.get('sensorId') || searchParams.get('streamId');

  console.log(`[Telemetry Stream] Starting MQTT stream for sensorId: ${sensorId}`);

  // Create ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE message
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const send = (line: string) => {
        controller.enqueue(encoder.encode(line));
      };

      // Connection established
      send(`: Connected to telemetry stream\n\n`);
      send(`retry: 3000\n\n`);

      // Connect to MQTT broker
      console.log('[Telemetry Stream] Connecting to MQTT broker...');

      const clientId = `jeeves-telemetry-${Date.now()}`;
      const client = mqtt.connect({
        host: MQTT_CONFIG.host,
        port: MQTT_CONFIG.port,
        protocol: MQTT_CONFIG.protocol,
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        clientId,
        clean: true,
        reconnectPeriod: 0, // Disable auto-reconnect - fail fast if connection drops
        keepalive: 60,
        connectTimeout: 120000, // 120 second timeout for TLS handshake (increased for slow connections)
        rejectUnauthorized: true, // Validate TLS certificate
      });

      // Heartbeat to keep connection alive (prevent Vercel timeout)
      const heartbeat = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`);
      }, 15000); // Send heartbeat every 15 seconds

      client.on('connect', () => {
        console.log('[Telemetry Stream] Connected to MQTT broker');

        // Subscribe to topic
        client.subscribe(MQTT_CONFIG.topic, (err) => {
          if (err) {
            console.error('[Telemetry Stream] Subscribe error:', err);
            sendEvent('error', {
              message: 'Failed to subscribe to MQTT topic',
              error: err.message,
            });
          } else {
            console.log(`[Telemetry Stream] Subscribed to ${MQTT_CONFIG.topic}`);
            sendEvent('status', {
              status: 'connected',
              topic: MQTT_CONFIG.topic,
              clientId,
            });
          }
        });
      });

      client.on('message', (topic, payload) => {
        try {
          // Parse JSON payload
          const data = JSON.parse(payload.toString());

          // Extract sensor data from FCU message
          if (data.status) {
            const targetFCU = 'fCU_01_04'; // Focus on FCU-01_04

            // Filter to specific FCU or requested sensor
            const fcuId = sensorId || targetFCU;

            if (data.status[fcuId]) {
              const fcuData = data.status[fcuId];

              // Send ALL numeric fields as separate stream events
              Object.entries(fcuData).forEach(([fieldName, fieldValue]: [string, any]) => {
                const numericValue = extractNumericValue(fieldValue);

                if (numericValue !== null) {
                  const streamId = `fcu-01_04-${normalizeFieldName(fieldName)}`;

                  sendEvent('tick', {
                    sensorId: streamId,
                    ts: data.timestamp || new Date().toISOString(),
                    value: numericValue,
                    unit: '', // Unit varies by field type
                  });
                }
              });
            }
          }

        } catch (error: any) {
          console.error('[Telemetry Stream] Failed to parse message:', error);
          sendEvent('error', {
            message: 'Failed to parse MQTT message',
            topic,
            error: error.message,
          });
        }
      });

      client.on('error', (error) => {
        console.error('[Telemetry Stream] MQTT connection error:', error);
        sendEvent('error', {
          message: 'MQTT connection error',
          error: error.message,
        });
      });

      client.on('close', () => {
        console.log('[Telemetry Stream] MQTT connection closed');
        sendEvent('status', {
          status: 'disconnected',
        });
      });

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[Telemetry Stream] Client disconnected, cleaning up...');
        clearInterval(heartbeat);
        client.end();
        controller.close();
      });
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
