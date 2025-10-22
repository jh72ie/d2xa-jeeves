/**
 * MQTT Stream API - Server-Sent Events
 *
 * Connects to HiveMQ broker and streams messages to the client via SSE
 */

import mqtt from 'mqtt';
import { NextRequest } from 'next/server';
import { parseMQTTMessage, parseCustomTimestamp, toSafeISOString } from '@/lib/mqtt/fcu-parser';

// MQTT Configuration
const MQTT_CONFIG = {
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts' as const,
  username: 'Beringar',
  password: 'Winter2025!',
  // topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue', // Wildcard to get all sensors
  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue', // Wildcard to get all sensors
};


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Create ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE message
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Connect to MQTT broker
      console.log('[MQTT Stream] Connecting to broker...');

      const clientId = `jeeves-stream-${Date.now()}`;
      const client = mqtt.connect({
        host: MQTT_CONFIG.host,
        port: MQTT_CONFIG.port,
        protocol: MQTT_CONFIG.protocol,
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        clientId,
        clean: true,
        reconnectPeriod: 5000,
        keepalive: 60,
      });

      client.on('connect', () => {
        console.log('[MQTT Stream] Connected to broker');

        // Subscribe to topic
        client.subscribe(MQTT_CONFIG.topic, (err) => {
          if (err) {
            console.error('[MQTT Stream] Subscribe error:', err);
            sendEvent({
              type: 'error',
              message: 'Failed to subscribe to topic',
              error: err.message,
            });
          } else {
            console.log(`[MQTT Stream] Subscribed to ${MQTT_CONFIG.topic}`);
            sendEvent({
              type: 'status',
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


          // ---------------------------------------------------
          const rawData_timestamp = parseCustomTimestamp(data.timestamp);   
          if (!rawData_timestamp) {
              console.error(`[MQTT Stream] ❌ Invalid timestamp format received: ${data.timestamp}`);
              return;
          }
          // ---------------------------------------------------


          console.log(`[MQTT Stream] Message received on ${topic}:`, {
            measuredvalue: data.measuredvalue,
            version: data.version,
            timestamp: rawData_timestamp,
            fcuCount: data.status ? Object.keys(data.status).length : 0,
          });

          // Send to client (may be large, but SSE handles it)
          sendEvent({
            type: 'message',
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            topic,
            payload: data,
            timestamp: rawData_timestamp || new Date().toISOString(),
          });

        } catch (error: any) {
          console.error('[MQTT Stream] Failed to parse message:', error);
          sendEvent({
            type: 'error',
            message: 'Failed to parse message',
            topic,
            error: error.message,
          });
        }
      });

      client.on('error', (error) => {
        console.error('[MQTT Stream] Connection error:', error);
        sendEvent({
          type: 'error',
          message: 'MQTT connection error',
          error: error.message,
        });
      });

      client.on('close', () => {
        console.log('[MQTT Stream] Connection closed');
        sendEvent({
          type: 'status',
          status: 'disconnected',
        });
      });

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[MQTT Stream] Client disconnected, cleaning up...');
        client.end();
        controller.close();
      });

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        sendEvent({
          type: 'ping',
          timestamp: Date.now(),
        });
      }, 30000);

      // Cleanup on stream close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
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
