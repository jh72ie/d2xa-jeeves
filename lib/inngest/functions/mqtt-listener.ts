/**
 * Inngest MQTT Listener - Long-running background worker
 *
 * Connects to MQTT broker, receives FCU data, and stores in Redis
 * Runs continuously with automatic reconnection
 */

import { inngest } from '../client';
import mqtt from 'mqtt';
import { createClient } from 'redis';
import { parseMQTTMessage, parseCustomTimestamp, toSafeISOString } from '@/lib/mqtt/fcu-parser';

const MQTT_CONFIG = {
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts' as const,
  username: 'Beringar',
  password: 'Winter2025!',
//  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue',
  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue',
};

const REDIS_KEY = 'mqtt:fcu:latest';

export const mqttListener = inngest.createFunction(
  {
    id: 'mqtt-fcu-listener',
    name: 'MQTT FCU Data Listener',
    retries: 0, // Don't retry - we'll handle reconnection internally
  },
  { cron: '* * * * *' }, // Run every minute (standard cron - no seconds)
  async ({ step }) => {

    return await step.run('listen-to-mqtt', async () => {
      console.log('[MQTT Listener] Starting MQTT connection...');

      // Connect to Redis
      const redis = createClient({
        url: process.env.REDIS_URL,
      });

      await redis.connect();
      console.log('[MQTT Listener] Redis connected');

      // Connect to MQTT
      const client = mqtt.connect({
        host: MQTT_CONFIG.host,
        port: MQTT_CONFIG.port,
        protocol: MQTT_CONFIG.protocol,
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        clientId: `jeeves-inngest-${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        keepalive: 60,
        rejectUnauthorized: true,
      });

      return new Promise((resolve, reject) => {
        let messageCount = 0;
        const startTime = Date.now();
        const maxDuration = 50000; // Run for 50 seconds, then finish (cron will restart every minute)

        client.on('connect', () => {
          console.log('[MQTT Listener] Connected to MQTT broker');

          client.subscribe(MQTT_CONFIG.topic, (err) => {
            if (err) {
              console.error('[MQTT Listener] Subscribe error:', err);
              reject(err);
            } else {
              console.log(`[MQTT Listener] Subscribed to ${MQTT_CONFIG.topic}`);
            }
          });
        });

        client.on('message', async (topic, payload) => {
          try {
            const data = JSON.parse(payload.toString());
            messageCount++;


            // ---------------------------------------------------
            const rawData_timestamp = parseCustomTimestamp(data.timestamp);   
            if (!rawData_timestamp) {
                console.error(`[MQTT Listener] ❌ Invalid timestamp format received: ${data.timestamp}`);
                return;
            }
            // ---------------------------------------------------
  
            console.log(`[MQTT Listener] Message ${messageCount} received:`, {
              topic,
              timestamp: rawData_timestamp,
              fcuCount: data.status ? Object.keys(data.status).length : 0,
            });

            // Store in Redis with 5-minute expiry
            await redis.set(
              REDIS_KEY,
              JSON.stringify({
                payload: data,
                topic,
                receivedAt: new Date().toISOString(),
                messageCount,
              }),
              {
                EX: 300, // Expire after 5 minutes
              }
            );

            console.log(`[MQTT Listener] Stored in Redis (message ${messageCount})`);

          } catch (error) {
            console.error('[MQTT Listener] Failed to process message:', error);
          }
        });

        client.on('error', (error) => {
          console.error('[MQTT Listener] MQTT error:', error);
          reject(error);
        });

        // Stop after max duration to allow cron to restart
        setTimeout(async () => {
          console.log(`[MQTT Listener] Stopping after ${maxDuration}ms (received ${messageCount} messages)`);
          client.end();
          await redis.disconnect();
          resolve({
            success: true,
            messageCount,
            duration: Date.now() - startTime,
          });
        }, maxDuration);
      });
    });
  }
);
