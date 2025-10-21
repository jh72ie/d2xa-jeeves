/**
 * FCU Data Ingestion Worker
 *
 * Connects to MQTT broker every minute and saves FCU data to database
 * for Jeeves analysis.
 *
 * STRATEGY: Start with ONE FCU (FCU-201) and save ALL its fields as streams
 * This allows deep analysis of one unit before scaling to all 49 FCUs.
 */

import { inngest } from "@/lib/inngest/client";
import mqtt from "mqtt";
import { parseMQTTMessage } from "@/lib/mqtt/fcu-parser";
import { insertTick } from "@/lib/db/telemetry-ops";
import { createClient } from "redis";
import { getJeevesState } from "@/lib/db/jeeves-queries";

const MQTT_CONFIG = {
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts' as const,
  username: 'Beringar',
  password: 'Winter2025!',
//  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue',
  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue',
};

// Focus on ONE FCU for deep analysis
//const TARGET_FCU = 'fCU_201';
const TARGET_FCU = 'fCU_01_04';

// Redis key for tracking last processed timestamp (prevents duplicate processing)
const REDIS_TIMESTAMP_KEY = `fcu:${TARGET_FCU}:last-timestamp`;

// Redis key for storing latest MQTT message (for live monitor frontend)
const REDIS_LATEST_KEY = 'mqtt:fcu:latest';

/**
 * Normalize field name to stream ID format
 * Example: "nvoSpaceTemp" -> "spacetemp"
 */
function normalizeFieldName(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/^(nvo|nvi|nci)/, '') // Remove LonWorks prefixes
    .replace(/[^a-z0-9]/g, ''); // Remove special chars
}

/**
 * Extract numeric value from status string
 * Example: "23.2 °C {ok}" -> 23.2
 * Example: "ocOccupied {ok}" -> 1
 * Example: "stateOn {ok}" -> 1
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

  // HVAC modes (for mode analysis)
  if (lowerValue.includes('hvacoff')) return 0;
  if (lowerValue.includes('hvacheat')) return 1;
  if (lowerValue.includes('hvaccool')) return 2;
  if (lowerValue.includes('hvacauto')) return 3;

  // Boolean-like states
  if (lowerValue.includes('yes')) return 1;
  if (lowerValue.includes('no')) return 0;
  if (lowerValue.includes('on ')) return 1; // Space to avoid matching "stateOn"
  if (lowerValue.includes('off ')) return 0;

  return null; // Truly non-numeric
}

export const fcuDataIngestion = inngest.createFunction(
  {
    id: 'fcu-data-ingestion',
    name: 'FCU Data Ingestion for Jeeves',
    retries: 0, // Don't retry - next cron will run soon anyway
  },
  { cron: '*/5 * * * *' }, // Every 5 minutes (matches MQTT broker's data arrival frequency)
  async ({ step }) => {
    return await step.run('ingest-fcu-data', async () => {
      const instanceId = `worker-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log(`[FCU Ingestion] 🔍 INSTANCE: ${instanceId} - Starting MQTT data collection...`);

      // Check if ingestion is enabled in Jeeves Console
      const jeevesState = await getJeevesState();
      if (jeevesState && jeevesState.ingestionEnabled === false) {
        console.log(`[FCU Ingestion] ⏸️  INSTANCE: ${instanceId} - Ingestion is DISABLED in Jeeves Console`);
        console.log(`[FCU Ingestion] ⏸️  Skipping this run. Enable ingestion in /jeeves to resume.`);
        return {
          status: 'disabled',
          instanceId,
          message: 'FCU data ingestion is disabled in Jeeves Console settings',
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`[FCU Ingestion] ✅ INSTANCE: ${instanceId} - Ingestion is enabled, proceeding...`);

      // Check if Redis URL is configured
      if (!process.env.REDIS_URL) {
        console.warn(`[FCU Ingestion] ⚠️  REDIS_URL not configured - deduplication disabled`);
        console.log(`[FCU Ingestion] Proceeding without deduplication...`);
      }

      // Connect to Redis for deduplication (if available)
      let redis: ReturnType<typeof createClient> | null = null;

      if (process.env.REDIS_URL) {
        redis = createClient({
          url: process.env.REDIS_URL,
        });

        await redis.connect();
        console.log(`[FCU Ingestion] 🔍 INSTANCE: ${instanceId} - Redis connected`);
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(async () => {
          console.warn(`[FCU Ingestion] ⏱️ INSTANCE: ${instanceId} - TIMEOUT after 40s, no MQTT message received`);
          if (client) {
            console.log(`[FCU Ingestion] 🔌 Disconnecting MQTT client...`);
            client.end();
          }
          if (redis) {
            console.log(`[FCU Ingestion] 🔌 Disconnecting Redis...`);
            await redis.disconnect();
          }
          resolve({
            status: 'timeout',
            message: 'No MQTT data received in 40s',
            timestamp: new Date().toISOString(),
            instanceId,
          });
        }, 40000); // Timeout after 40s to avoid Vercel/Inngest function timeout

        let client: mqtt.MqttClient | null = null;

        try {
          client = mqtt.connect({
            host: MQTT_CONFIG.host,
            port: MQTT_CONFIG.port,
            protocol: MQTT_CONFIG.protocol,
            username: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            clientId: `jeeves-ingestion-${Date.now()}`,
            clean: true,
            keepalive: 60,
            rejectUnauthorized: true,
            reconnectPeriod: 0, // Disable auto-reconnect since cron handles it
          });

          client.on('connect', () => {
            console.log('[FCU Ingestion] Connected to MQTT broker');
            client!.subscribe(MQTT_CONFIG.topic, async (err) => {
              if (err) {
                console.error('[FCU Ingestion] Subscribe error:', err);
                clearTimeout(timeout);
                client!.end();
                if (redis) await redis.disconnect();
                reject(err);
              } else {
                console.log('[FCU Ingestion] Subscribed to:', MQTT_CONFIG.topic);
              }
            });
          });

          client.on('message', async (topic, payload) => {
            clearTimeout(timeout);

            try {
              const rawData = JSON.parse(payload.toString());
              const parsed = parseMQTTMessage(rawData);

              // 🔍 DIAGNOSTIC: Log message fingerprint to detect duplicates
              const messageFingerprint = {
                timestamp: rawData.timestamp,
                receivedAt: new Date().toISOString(),
                messageSize: payload.length,
                fcuCount: parsed.totalCount,
              };
              console.log(`[FCU Ingestion] 🔍 Message received:`, messageFingerprint);

              console.log(`[FCU Ingestion] Received ${parsed.totalCount} FCUs, ${parsed.faultCount} faults`);

              // ⏰ VALIDATE TIMESTAMP: Reject if too old OR in the future
              const dataAge = Date.now() - new Date(rawData.timestamp).getTime();
              const maxAge = 10 * 60 * 1000; // 10 minutes old
              const maxFuture = 2 * 60 * 1000; // 2 minutes in future (allow small clock drift)

              // Reject if too old
              if (dataAge > maxAge) {
                console.warn(`[FCU Ingestion] ⚠️ INSTANCE: ${instanceId} - Data is TOO OLD: ${Math.round(dataAge / 60000)} minutes old`);
                console.warn(`[FCU Ingestion] ⚠️ Timestamp: ${rawData.timestamp}, Current: ${new Date().toISOString()}`);
                console.warn(`[FCU Ingestion] ⚠️ This is likely a retained/cached message from MQTT broker`);
                clearTimeout(timeout);
                client!.end();
                if (redis) await redis.disconnect();
                resolve({
                  status: 'skipped_stale',
                  instanceId,
                  reason: `Data too old (${Math.round(dataAge / 60000)} minutes)`,
                  timestamp: rawData.timestamp,
                  currentTime: new Date().toISOString(),
                });
                return;
              }

              // Reject if too far in the future
              if (dataAge < -maxFuture) {
                console.warn(`[FCU Ingestion] ⚠️ INSTANCE: ${instanceId} - Data is FROM THE FUTURE: ${Math.round(-dataAge / 60000)} minutes ahead`);
                console.warn(`[FCU Ingestion] ⚠️ Timestamp: ${rawData.timestamp}, Current: ${new Date().toISOString()}`);
                console.warn(`[FCU Ingestion] ⚠️ FCU device or MQTT broker has incorrect clock/timezone`);
                clearTimeout(timeout);
                client!.end();
                if (redis) await redis.disconnect();
                resolve({
                  status: 'skipped_future',
                  instanceId,
                  reason: `Data from future (${Math.round(-dataAge / 60000)} minutes ahead)`,
                  timestamp: rawData.timestamp,
                  currentTime: new Date().toISOString(),
                });
                return;
              }

              console.log(`[FCU Ingestion] ✅ Data age: ${Math.round(dataAge / 1000)}s (fresh)`);

              // 🔍 DEDUPLICATION: Check if we've already processed this timestamp (if Redis available)
              if (redis) {
                const lastProcessedTimestamp = await redis.get(REDIS_TIMESTAMP_KEY);

                if (lastProcessedTimestamp === rawData.timestamp) {
                  console.log(`[FCU Ingestion] ⏭️  INSTANCE: ${instanceId} - Skipping DUPLICATE timestamp: ${rawData.timestamp}`);
                  console.log(`[FCU Ingestion] ⏭️  Last processed at: ${lastProcessedTimestamp}`);
                  clearTimeout(timeout);
                  client!.end();
                  await redis.disconnect();
                  resolve({
                    status: 'skipped_duplicate',
                    instanceId,
                    reason: 'Already processed this timestamp',
                    timestamp: rawData.timestamp,
                    lastProcessed: lastProcessedTimestamp,
                  });
                  return;
                }

                console.log(`[FCU Ingestion] ✅ INSTANCE: ${instanceId} - NEW timestamp detected, will process`);
                console.log(`[FCU Ingestion] Current: ${rawData.timestamp}, Last: ${lastProcessedTimestamp || 'none'}`);
              } else {
                console.log(`[FCU Ingestion] 📝 INSTANCE: ${instanceId} - Processing without deduplication check`);
              }

              // Find our target FCU
              const targetFCU = parsed.fcus.find(f => f.id === TARGET_FCU);

              if (!targetFCU) {
                console.warn(`[FCU Ingestion] Target FCU ${TARGET_FCU} not found in message`);
                clearTimeout(timeout);
                client!.end();
                if (redis) await redis.disconnect();
                resolve({
                  status: 'success',
                  instanceId,
                  message: `Target FCU ${TARGET_FCU} not in this message`,
                  totalFCUs: parsed.totalCount,
                  timestamp: rawData.timestamp,
                });
                return;
              }

              console.log(`[FCU Ingestion] 🔍 INSTANCE: ${instanceId} - Processing ${TARGET_FCU} with ${Object.keys(targetFCU.rawData).length} fields`);
              console.log(`[FCU Ingestion] 🔍 Data timestamp RAW: ${rawData.timestamp}`);
              console.log(`[FCU Ingestion] 🔍 Data timestamp TYPE: ${typeof rawData.timestamp}`);
              console.log(`[FCU Ingestion] 🔍 Data timestamp PARSED: ${new Date(rawData.timestamp).toISOString()}`);
              console.log(`[FCU Ingestion] 🔍 Data timestamp UNIX: ${new Date(rawData.timestamp).getTime()}`);

              // Save ALL fields from this FCU as separate streams
              const insertPromises: Promise<any>[] = [];
              const savedStreams: string[] = [];

              for (const [fieldName, fieldValue] of Object.entries(targetFCU.rawData)) {
                const numericValue = extractNumericValue(fieldValue);

                // Only save numeric values (Jeeves analyzes numbers)
                if (numericValue !== null) {
                  const streamId = `fcu-201-${normalizeFieldName(fieldName)}`;

                  insertPromises.push(
                    insertTick({
                      sensorId: streamId,
                      ts: new Date(rawData.timestamp),
                      value: numericValue,
                    }).then(() => {
                      savedStreams.push(streamId);
                    }).catch((err) => {
                      console.error(`[FCU Ingestion] Failed to save ${streamId}:`, err);
                    })
                  );
                }
              }

              // // Also save derived metrics from parser
              // const derivedMetrics: Array<[string, number | undefined]> = [
              //   ['parsed-spacetemp', targetFCU.spaceTemp],
              //   ['parsed-effectsetpoint', targetFCU.effectiveSetpoint],
              //   ['parsed-usersetpoint', targetFCU.userSetpoint],
              //   ['parsed-heatoutput', targetFCU.heatOutput],
              //   ['parsed-cooloutput', targetFCU.coolOutput],
              //   ['parsed-status', targetFCU.status === 'ok' ? 0 : targetFCU.status === 'fault' ? 1 : 2],
              // ];


              const derivedMetrics: Array<[string, number | undefined]> = [
                ['parsed-H_O_A'.toLowerCase(), targetFCU.H_O_A.toLowerCase() === 'hand' ? 0 : targetFCU.H_O_A.toLowerCase() === 'off' ? 1 : 2],
                ['parsed-Fan_Fault'.toLowerCase(), targetFCU.Fan_Fault.toLowerCase() === 'ok' ? 0 : targetFCU.Fan_Fault.toLowerCase() === 'fault' ? 1 : 2],
                ['parsed-Fan_Status'.toLowerCase(), targetFCU.Fan_Status.toLowerCase() === 'running' ? 0 : targetFCU.Fan_Status.toLowerCase() === 'stop' ? 1 : 2],
                ['parsed-Wall_Adjuster'.toLowerCase(), targetFCU.Wall_Adjuster],
                ['parsed-Local_Setpoint'.toLowerCase(), targetFCU.Local_Setpoint],
                ['parsed-Return_Air_Temp'.toLowerCase(), targetFCU.Return_Air_Temp],
                ['parsed-Supply_Air_Temp'.toLowerCase(), targetFCU.Supply_Air_Temp],
                ['parsed-Wall_Stat_Fitted'.toLowerCase(), targetFCU.Wall_Stat_Fitted.toLowerCase() === 'disabled' ? 0 : 1],
                ['parsed-Occupation_Status'.toLowerCase(), targetFCU.Occupation_Status.toLowerCase() === 'occupied' ? 0 : 1],
                ['parsed-Cooling_Override_%'.toLowerCase(), targetFCU.Cooling_Override],
                ['parsed-Effective_Setpoint'.toLowerCase(), targetFCU.Effective_Setpoint],
                ['parsed-Heating_Override_%'.toLowerCase(), targetFCU.Heating_Override],
                ['parsed-FCU_Clg_Check_Failure'.toLowerCase(), targetFCU.FCU_Clg_Check_Failure.toLowerCase() === 'normal' ? 0 : 1],
                ['parsed-FCU_Htg_Check_Failure'.toLowerCase(), targetFCU.FCU_Htg_Check_Failure.toLowerCase() === 'normal' ? 0 : 1],
                ['parsed-Cooling_Valve_Position'.toLowerCase(), targetFCU.Cooling_Valve_Position],
                ['parsed-Heating_Valve_Position'.toLowerCase(), targetFCU.Heating_Valve_Position],
                ['parsed-Enable_Cooling_Override'.toLowerCase(), targetFCU.Enable_Cooling_Override.toLowerCase() === 'on' ? 0 : 1],
                ['parsed-Enable_Heating_Override'.toLowerCase(), targetFCU.Enable_Heating_Override.toLowerCase() === 'on' ? 0 : 1],
                // ['parsed-FCU_Clg_Exercise_Failure'.toLowerCase(), targetFCU.FCU_Clg_Exercise_Failure],
                // ['parsed-FCU_Htg_Exercise_Failure'.toLowerCase(), targetFCU.FCU_Htg_Exercise_Failure],
            ];
      
      
      
              for (const [metricName, value] of derivedMetrics) {
                if (value !== undefined && !isNaN(value)) {
                  const streamId = `fcu-201-${metricName}`;
                  insertPromises.push(
                    insertTick({
                      sensorId: streamId,
                      ts: new Date(rawData.timestamp),
                      value: value,
                    }).then(() => {
                      savedStreams.push(streamId);
                    }).catch((err) => {
                      console.error(`[FCU Ingestion] Failed to save ${streamId}:`, err);
                    })
                  );
                }
              }

              // Wait for all inserts with timeout
              const insertTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database insert timeout')), 30000)
              );

              await Promise.race([
                Promise.all(insertPromises),
                insertTimeout
              ]).catch((err) => {
                console.error(`[FCU Ingestion] ⚠️ Insert operation failed/timeout:`, err);
                throw err;
              });

              // 🔍 DEDUPLICATION: Store this timestamp as processed (10-minute TTL) if Redis available
              if (redis) {
                await redis.set(REDIS_TIMESTAMP_KEY, rawData.timestamp, {
                  EX: 600, // Expire after 10 minutes (covers 5-min data cycle + buffer)
                });
                console.log(`[FCU Ingestion] 🔍 INSTANCE: ${instanceId} - ✓ Stored timestamp in Redis: ${rawData.timestamp}`);

                // 📡 STORE LATEST MESSAGE: Also store full message for live monitor frontend
                await redis.set(
                  REDIS_LATEST_KEY,
                  JSON.stringify({
                    payload: rawData,
                    topic,
                    receivedAt: new Date().toISOString(),
                    processedBy: instanceId,
                  }),
                  {
                    EX: 600, // Expire after 10 minutes
                  }
                );
                console.log(`[FCU Ingestion] 📡 Stored latest message in Redis for live monitor`);
              }

              console.log(`[FCU Ingestion] 🔍 INSTANCE: ${instanceId} - ✓ Saved ${savedStreams.length} streams for ${TARGET_FCU}`);
              console.log(`[FCU Ingestion] 🔍 Data timestamp: ${rawData.timestamp}`);
              console.log(`[FCU Ingestion] Stream IDs:`, savedStreams.slice(0, 5).join(', '), '...');

              clearTimeout(timeout);
              client!.end();
              if (redis) await redis.disconnect();
              resolve({
                status: 'success',
                instanceId, // Track which worker instance processed this
                targetFCU: TARGET_FCU,
                streamsCreated: savedStreams.length,
                streamSample: savedStreams.slice(0, 10),
                timestamp: rawData.timestamp,
                totalFCUs: parsed.totalCount,
                faultCount: parsed.faultCount,
              });
            } catch (error: any) {
              console.error('[FCU Ingestion] Processing error:', error);
              clearTimeout(timeout);
              client!.end();
              if (redis) await redis.disconnect();
              reject(error);
            }
          });

          client.on('error', async (err) => {
            console.error('[FCU Ingestion] MQTT error:', err);
            clearTimeout(timeout);
            if (client) client.end();
            if (redis) await redis.disconnect();
            reject(err);
          });

        } catch (error: any) {
          console.error('[FCU Ingestion] Setup error:', error);
          clearTimeout(timeout);
          if (client) client.end();
          if (redis) redis.disconnect().catch(console.error);
          reject(error);
        }
      });
    });
  }
);
