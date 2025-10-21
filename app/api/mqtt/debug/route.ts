/**
 * MQTT Debug Endpoint
 *
 * Connects to MQTT once and returns raw message + parsed FCU IDs
 * to debug why ingestion worker isn't finding FCU-201
 */

import { NextResponse } from 'next/server';
import mqtt from 'mqtt';
import { parseMQTTMessage } from '@/lib/mqtt/fcu-parser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  console.log('[MQTT Debug] Starting diagnostic...');

  return new Promise<Response>((resolve) => {
    const timeout = setTimeout(() => {
      resolve(NextResponse.json({
        error: 'Timeout',
        message: 'No MQTT message received in 55 seconds',
      }, { status: 408 }));
    }, 55000);

    const client = mqtt.connect({
      host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
      port: 8883,
      protocol: 'mqtts',
      username: 'Beringar',
      password: 'Winter2025!',
      clientId: `debug-${Date.now()}`,
    });

    client.on('connect', () => {
      console.log('[MQTT Debug] Connected');
      client.subscribe('dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue');
    });

    client.on('message', (topic, payload) => {
      clearTimeout(timeout);
      client.end();

      try {
        const rawData = JSON.parse(payload.toString());
        const parsed = parseMQTTMessage(rawData);

        // Extract FCU IDs
        const fcuIds = parsed.fcus.map(f => f.id);
        // const hasFCU201 = fcuIds.includes('fCU_201');
        // const fcu201Data = parsed.fcus.find(f => f.id === 'fCU_201');
        const hasFCU201 = fcuIds.includes('fCU_01_04');
        const fcu201Data = parsed.fcus.find(f => f.id === 'fCU_01_04');

        resolve(NextResponse.json({
          success: true,
          diagnostics: {
            rawMessageKeys: Object.keys(rawData),
            hasStatusObject: !!rawData.status,
            statusObjectType: typeof rawData.status,
            totalFCUs: parsed.totalCount,
            fcuIds: fcuIds.slice(0, 10), // First 10 FCU IDs
            allFcuIds: fcuIds, // All FCU IDs
            hasFCU201,
            fcu201Keys: fcu201Data ? Object.keys(fcu201Data.rawData) : null,
            fcu201Sample: fcu201Data ? {
              id: fcu201Data.id,
              Effective_Setpoint: fcu201Data.Effective_Setpoint,
              Heating_Override: fcu201Data.Heating_Override,
              Heating_Valve_Position: fcu201Data.Heating_Valve_Position,
              Fan_Status: fcu201Data.Fan_Status,
              // spaceTemp: fcu201Data.spaceTemp,
              // heatOutput: fcu201Data.heatOutput,
              // coolOutput: fcu201Data.coolOutput,
              // status: fcu201Data.status,
              rawDataKeys: Object.keys(fcu201Data.rawData),
            } : null,
          },
          rawMessage: rawData, // Full message for inspection
        }));
      } catch (error: any) {
        resolve(NextResponse.json({
          error: 'Parse error',
          message: error.message,
          rawPayload: payload.toString().substring(0, 1000),
        }, { status: 500 }));
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      resolve(NextResponse.json({
        error: 'MQTT error',
        message: err.message,
      }, { status: 500 }));
    });
  });
}
