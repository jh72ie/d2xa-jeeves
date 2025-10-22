/**
 * Manual Ingestion Trigger
 *
 * Bypasses Inngest and runs FCU ingestion directly
 * Use this as temporary solution until Inngest is set up
 */

import { NextResponse } from 'next/server';
import mqtt from 'mqtt';
import { parseMQTTMessage, parseCustomTimestamp, toSafeISOString } from '@/lib/mqtt/fcu-parser';
import { insertTick } from '@/lib/db/telemetry-ops';
import { createClient } from 'redis';
import { getJeevesState } from '@/lib/db/jeeves-queries';

const MQTT_CONFIG = {
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts' as const,
  username: 'Beringar',
  password: 'Winter2025!',
  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue',
};

const TARGET_FCU = 'fCU_01_04';
const REDIS_TIMESTAMP_KEY = `fcu:${TARGET_FCU}:last-timestamp`;
const REDIS_LATEST_KEY = 'mqtt:fcu:latest';

function normalizeFieldName(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/^(nvo|nvi|nci)/, '')
    .replace(/[^a-z0-9]/g, '');
}

function extractNumericValue(valueStr: any): number | null {
  if (typeof valueStr === 'number') return valueStr;
  if (typeof valueStr !== 'string') return null;

  const match = valueStr.match(/^([\d\.]+|nan)/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const instanceId = `manual-${Date.now()}`;
  console.log(`[Manual Ingestion] 🔍 INSTANCE: ${instanceId} - Starting...`);

  try {
    // Check if ingestion is enabled
    const jeevesState = await getJeevesState();
    if (jeevesState && jeevesState.ingestionEnabled === false) {
      return NextResponse.json({
        status: 'disabled',
        message: 'FCU data ingestion is disabled in Jeeves Console. Enable it at /jeeves',
      });
    }

    // Connect to Redis if available
    let redis: ReturnType<typeof createClient> | null = null;
    if (process.env.REDIS_URL) {
      redis = createClient({ url: process.env.REDIS_URL });
      await redis.connect();
      console.log(`[Manual Ingestion] Redis connected`);
    }

    return new Promise<Response>((resolve) => {
      const timeout = setTimeout(async () => {
        console.warn(`[Manual Ingestion] ⏱️ TIMEOUT after 40s`);
        if (client) client.end();
        if (redis) await redis.disconnect();
        resolve(NextResponse.json({
          status: 'timeout',
          message: 'No MQTT data received in 40s',
        }));
      }, 40000);

      let client: mqtt.MqttClient | null = null;

      try {
        client = mqtt.connect({
          host: MQTT_CONFIG.host,
          port: MQTT_CONFIG.port,
          protocol: MQTT_CONFIG.protocol,
          username: MQTT_CONFIG.username,
          password: MQTT_CONFIG.password,
          clientId: `jeeves-manual-${Date.now()}`,
          clean: true,
          keepalive: 60,
        });

        client.on('connect', () => {
          console.log('[Manual Ingestion] Connected to MQTT broker');
          client!.subscribe(MQTT_CONFIG.topic, (err) => {
            if (err) {
              console.error('[Manual Ingestion] Subscribe error:', err);
              clearTimeout(timeout);
              client!.end();
              if (redis) redis.disconnect();
              resolve(NextResponse.json({
                error: 'Subscribe failed',
                message: err.message,
              }, { status: 500 }));
            } else {
              console.log('[Manual Ingestion] Subscribed to:', MQTT_CONFIG.topic);
            }
          });
        });

        client.on('message', async (topic, payload) => {
          clearTimeout(timeout);

          try {
            const rawData = JSON.parse(payload.toString());
            const parsed = parseMQTTMessage(rawData);

            console.log(`[Manual Ingestion] Received ${parsed.totalCount} FCUs`);

            // ---------------------------------------------------
            const rawData_timestamp = parseCustomTimestamp(rawData.timestamp);   
            if (!rawData_timestamp) {
                console.error(`[Manual Ingestion] ❌ Invalid timestamp format received: ${rawData.timestamp}`);
                clearTimeout(timeout);
                client!.end();
                if (redis) await redis.disconnect();
                resolve(NextResponse.json({
                  status: 'error_timestamp',
                  reason: `Invalid timestamp format: ${rawData.timestamp}`,
                }));
                return;
            }
            // ---------------------------------------------------


            // Validate timestamp
            // const dataAge = Date.now() - new Date(rawData.timestamp).getTime();
            const dataAge = Date.now() - rawData_timestamp.getTime();
            const maxAge = 10 * 60 * 1000;
            const maxFuture = 2 * 60 * 1000;

            if (dataAge > maxAge) {
              client!.end();
              if (redis) await redis.disconnect();
              resolve(NextResponse.json({
                status: 'skipped_stale',
                reason: `Data too old (${Math.round(dataAge / 60000)} minutes)`,
              }));
              return;
            }

            if (dataAge < -maxFuture) {
              client!.end();
              if (redis) await redis.disconnect();
              resolve(NextResponse.json({
                status: 'skipped_future',
                reason: `Data from future (${Math.round(-dataAge / 60000)} minutes ahead)`,
              }));
              return;
            }

            // Check for duplicate
            if (redis) {
              const lastProcessed = await redis.get(REDIS_TIMESTAMP_KEY);
              if (lastProcessed === toSafeISOString(rawData.timestamp)) {
                client!.end();
                await redis.disconnect();
                resolve(NextResponse.json({
                  status: 'skipped_duplicate',
                  message: 'Already processed this timestamp',
                }));
                return;
              }
            }

            // Find target FCU
            const targetFCU = parsed.fcus.find(f => f.id === TARGET_FCU);
            if (!targetFCU) {
              client!.end();
              if (redis) await redis.disconnect();
              resolve(NextResponse.json({
                status: 'fcu_not_found',
                message: `${TARGET_FCU} not in this message`,
              }));
              return;
            }

            // Save all fields
            const insertPromises: Promise<any>[] = [];
            const savedStreams: string[] = [];

            for (const [fieldName, fieldValue] of Object.entries(targetFCU.rawData)) {
              const numericValue = extractNumericValue(fieldValue);
              if (numericValue !== null) {
                const streamId = `fcu-01_04-${normalizeFieldName(fieldName)}`;
                insertPromises.push(
                  insertTick({
                    sensorId: streamId,
                    ts: rawData_timestamp,
                    value: numericValue,
                  }).then(() => savedStreams.push(streamId))
                  .catch((err) => console.error(`Failed to save ${streamId}:`, err))
                );
              }
            }

            // Save derived metrics
            // const derivedMetrics: Array<[string, number | undefined]> = [
            //   ['parsed-spacetemp', targetFCU.spaceTemp],
            //   ['parsed-effectsetpoint', targetFCU.effectiveSetpoint],
            //   ['parsed-usersetpoint', targetFCU.userSetpoint],
            //   ['parsed-heatoutput', targetFCU.heatOutput],
            //   ['parsed-cooloutput', targetFCU.coolOutput],
            //   ['parsed-status', targetFCU.status === 'ok' ? 0 : targetFCU.status === 'fault' ? 1 : 2],
            // ];


            const derivedMetrics: Array<[string, number | undefined]> = [
                ['parsed-hoa', targetFCU.H_O_A === 'Hand' ? 0 : targetFCU.H_O_A === 'Off' ? 1 : 2],
                ['parsed-fanfault', targetFCU.Fan_Fault === 'Ok' ? 0 : targetFCU.Fan_Fault === 'Fault' ? 1 : 2],
                ['parsed-fanstatus', targetFCU.Fan_Status === 'Running' ? 0 : targetFCU.Fan_Status === 'Stop' ? 1 : 2],
                ['parsed-wallstatfitted', targetFCU.Wall_Stat_Fitted === 'Disabled' ? 0 : 1],
                ['parsed-occupationstatus', targetFCU.Occupation_Status === 'Occupied' ? 0 : 1],
                ['parsed-fcuclgcheckfailure', targetFCU.FCU_Clg_Check_Failure === 'Normal' ? 0 : 1],
                ['parsed-fcuhtgcheckfailure', targetFCU.FCU_Htg_Check_Failure === 'Normal' ? 0 : 1],
                ['parsed-enablecoolingoverride', targetFCU.Enable_Cooling_Override === 'On' ? 0 : 1],
                ['parsed-enableheatingoverride', targetFCU.Enable_Heating_Override === 'On' ? 0 : 1],
                // ['parsed-FCU_Clg_Exercise_Failure'.toLowerCase(), targetFCU.FCU_Clg_Exercise_Failure],
                // ['parsed-FCU_Htg_Exercise_Failure'.toLowerCase(), targetFCU.FCU_Htg_Exercise_Failure],
          ];
    
            for (const [metricName, value] of derivedMetrics) {
              if (value !== undefined && !isNaN(value)) {
                const streamId = `fcu-01_04-${metricName}`;
                insertPromises.push(
                  insertTick({
                    sensorId: streamId,
                    ts: rawData_timestamp,
                    value: value,
                  }).then(() => savedStreams.push(streamId))
                  .catch((err) => console.error(`Failed to save ${streamId}:`, err))
                );
              }
            }

            await Promise.all(insertPromises);

            // Store timestamp in Redis
            if (redis) {
              await redis.set(REDIS_TIMESTAMP_KEY, toSafeISOString(rawData.timestamp), { EX: 600 });
              await redis.set(
                REDIS_LATEST_KEY,
                JSON.stringify({
                  payload: rawData,
                  topic,
                  receivedAt: new Date().toISOString(),
                  processedBy: instanceId,
                }),
                { EX: 600 }
              );
            }

            console.log(`[Manual Ingestion] ✓ Saved ${savedStreams.length} streams`);

            client!.end();
            if (redis) await redis.disconnect();
            resolve(NextResponse.json({
              status: 'success',
              instanceId,
              streamsCreated: savedStreams.length,
              streamSample: savedStreams.slice(0, 10),
              timestamp: rawData_timestamp,
            }));

          } catch (error: any) {
            console.error('[Manual Ingestion] Error:', error);
            client!.end();
            if (redis) await redis.disconnect();
            resolve(NextResponse.json({
              error: 'Processing failed',
              message: error.message,
            }, { status: 500 }));
          }
        });

        client.on('error', async (err) => {
          console.error('[Manual Ingestion] MQTT error:', err);
          clearTimeout(timeout);
          if (client) client.end();
          if (redis) await redis.disconnect();
          resolve(NextResponse.json({
            error: 'MQTT error',
            message: err.message,
          }, { status: 500 }));
        });

      } catch (error: any) {
        console.error('[Manual Ingestion] Setup error:', error);
        clearTimeout(timeout);
        if (client) client.end();
        if (redis) redis.disconnect().catch(console.error);
        resolve(NextResponse.json({
          error: 'Setup failed',
          message: error.message,
        }, { status: 500 }));
      }
    });

  } catch (error: any) {
    console.error('[Manual Ingestion] Error:', error);
    return NextResponse.json({
      error: 'Failed to start ingestion',
      message: error.message,
    }, { status: 500 });
  }
}
