/**
 * FCU Data Parser
 *
 * Parses MQTT messages from HVAC FCU system
 * Handles nested structure and status strings
 */
// export interface FCUStatus {
//   id: string;
//   occupancy?: string;
//   spaceTemp?: number;
//   effectiveSetpoint?: number;
//   userSetpoint?: number;
//   heatOutput?: number;
//   coolOutput?: number;
//   fanSpeed?: string | number;
//   fanState?: string;
//   mode?: string;
//   status: 'ok' | 'fault' | 'down' | 'unknown';
//   faultDetails?: string;
//   rawData: Record<string, any>;
// }
export interface FCUStatus {
  id: string;
  H_O_A: string;
  Fan_Fault: string;
  Fan_Status: string;
  Wall_Adjuster: number;
  Local_Setpoint?: number;
  Return_Air_Temp?: number;
  Supply_Air_Temp?: number;
  Wall_Stat_Fitted: string;
  Occupation_Status: string;
  Cooling_Override?: number;

  Effective_Setpoint?: number;
  
  Heating_Override?: number;
  FCU_Clg_Check_Failure: string;
  FCU_Htg_Check_Failure: string;
  Cooling_Valve_Position?: number;
  Heating_Valve_Position?: number;
  Enable_Cooling_Override: string;
  Enable_Heating_Override: string;
  FCU_Clg_Exercise_Failure: string;
  FCU_Htg_Exercise_Failure: string;
  ////////////////////////////   -leave these here so that the old code will still run. hopefully
  occupancy?: string;
  spaceTemp?: number;
  effectiveSetpoint?: number;
  userSetpoint?: number;
  heatOutput?: number;
  coolOutput?: number;
  fanSpeed?: string | number;
  fanState?: string;
  mode?: string;
  status: 'ok' | 'fault' | 'down' | 'unknown';
  faultDetails?: string;
  rawData: Record<string, any>;
}

export interface ParsedMQTTMessage {
  timestamp: string;
  version: string;
  fcus: FCUStatus[];
  totalCount: number;
  faultCount: number;
}

/**
 * Parse value with unit and status
 * Example: "23.2 °C {ok}" → { value: 23.2, unit: "°C", status: "ok" }
 */
function parseValueString(valueStr: string): {
  value: number | string;
  unit?: string;
  status: string;
} {
  if (!valueStr) {
    return { value: 'unknown', status: 'unknown' };
  }

  const str = String(valueStr);

  // Extract status from {...}
  const statusMatch = str.match(/\{([^}]+)\}/);
  
  const status = statusMatch ? statusMatch[1] : 'unknown';

  // Extract value and unit
  // Pattern: "23.2 °C {ok}" or "100.0 % {ok}" or "ocOccupied {ok}"
  const valueMatch = str.match(/^([^\{]+?)\s*\{/);
  if (!valueMatch) {
    return { value: str, status };
  }

  const valuePart = valueMatch[1].trim();

  // Try to parse as number with unit
  const numericMatch = valuePart.match(/^([\d\.]+|nan)\s*([°C%]+)?/);
  if (numericMatch) {
    const numValue = numericMatch[1] === 'nan' ? NaN : parseFloat(numericMatch[1]);
    const unit = numericMatch[2];
    return { value: numValue, unit, status };
  }

  // Non-numeric value (e.g., "ocOccupied", "Auto", "Enable")
  return { value: valuePart, status };
}

/**
 * Parse single FCU status object
 */
function parseFCU(fcuId: string, fcuData: Record<string, any>): FCUStatus {
  const status: FCUStatus = {
    id: fcuId,
    status: 'ok',
    rawData: fcuData,
  };

  let hasFault = false;
  let faultDetails: string[] = [];

  // Parse each field
  for (const [key, value] of Object.entries(fcuData)) {
    const parsed = parseValueString(value);

    // Check for faults
    if (parsed.status.includes('fault') || parsed.status.includes('down')) {
      hasFault = true;
      faultDetails.push(`${key}: ${parsed.status}`);
    }

    // Map to standardized fields
    const keyLower = key.toLowerCase();

    // Occupancy (check multiple possible field names)
    if (keyLower.includes('occup') || key === 'nvoOccup' || key === 'nvoEffectOccup') {
      status.occupancy = String(parsed.value);
    }

    // Space temperature
    if (keyLower.includes('spacetemp') || keyLower.includes('return_air_temp') || keyLower.includes('wall_temp')) {
      if (typeof parsed.value === 'number' && !isNaN(parsed.value)) {
        status.spaceTemp = parsed.value;
      }
    }

    // Effective setpoint
    if (keyLower.includes('effectsetpt') || keyLower.includes('effective_setpoint')) {
      if (typeof parsed.value === 'number') {
        status.effectiveSetpoint = parsed.value;
      }
    }

    // User setpoint
    if (keyLower.includes('nvisetpoint') || key === 'Setpoint') {
      if (typeof parsed.value === 'number') {
        status.userSetpoint = parsed.value;
      }
    }

    // Heat output (check multiple possible field names)
    if (keyLower.includes('heatoutput') || keyLower.includes('heatprimary') ||
        keyLower.includes('heating_demand') || key === 'nvoHeatOutput' || key === 'nvoHeatOut') {
      if (typeof parsed.value === 'number') {
        status.heatOutput = parsed.value;
      }
    }

    // Cool output (check multiple possible field names)
    if (keyLower.includes('cooloutput') || keyLower.includes('coolprimary') ||
        keyLower.includes('cooling_demand') || key === 'nvoCoolOutput' || key === 'nvoCoolOut') {
      if (typeof parsed.value === 'number') {
        status.coolOutput = parsed.value;
      }
    }

    // Fan speed (numeric value)
    if ((keyLower.includes('fanspeed') && !keyLower.includes('state')) || key === 'nvoFanSpeed') {
      status.fanSpeed = parsed.value;
    }

    // Fan state (text value - on/off/auto)
    if (keyLower.includes('fanspeed_state') || keyLower.includes('fan enable') || key === 'nvoFanSpeed_state') {
      status.fanState = String(parsed.value);
    }

    // Mode
    if (keyLower.includes('unitstatus_mode') || keyLower.includes('applicmode') || key === 'H_O_A') {
      status.mode = String(parsed.value);
    }
  }

  // Set overall status
  if (hasFault) {
    if (faultDetails.some(d => d.includes('down'))) {
      status.status = 'down';
    } else {
      status.status = 'fault';
    }
    status.faultDetails = faultDetails.join(', ');
  }

  return status;
}

/**
 * Parse complete MQTT message
 */
export function parseMQTTMessage(payload: any): ParsedMQTTMessage {
  const fcus: FCUStatus[] = [];

  if (!payload.status || typeof payload.status !== 'object') {
    return {
      timestamp: payload.timestamp || new Date().toISOString(),
      version: payload.version || 'unknown',
      fcus: [],
      totalCount: 0,
      faultCount: 0,
    };
  }

  // Parse each FCU
  for (const [fcuId, fcuData] of Object.entries(payload.status)) {
    if (typeof fcuData === 'object' && fcuData !== null) {
      const fcu = parseFCU(fcuId, fcuData as Record<string, any>);
      fcus.push(fcu);
    }
  }

  // Count faults
  const faultCount = fcus.filter(
    f => f.status === 'fault' || f.status === 'down'
  ).length;

  return {
    timestamp: payload.timestamp,
    version: payload.version,
    fcus,
    totalCount: fcus.length,
    faultCount,
  };
}

/**
 * Get FCU health summary
 */
export function getFCUHealthSummary(parsed: ParsedMQTTMessage) {
  const summary = {
    total: parsed.totalCount,
    ok: 0,
    fault: 0,
    down: 0,
    avgTemp: 0,
    tempMin: Infinity,
    tempMax: -Infinity,
    heatingCount: 0,
    coolingCount: 0,
    offCount: 0,
  };

  let tempSum = 0;
  let tempCount = 0;

  for (const fcu of parsed.fcus) {
    // Count by status
    if (fcu.status === 'ok') summary.ok++;
    else if (fcu.status === 'fault') summary.fault++;
    else if (fcu.status === 'down') summary.down++;

    // Temperature stats
    if (fcu.spaceTemp !== undefined && !isNaN(fcu.spaceTemp)) {
      tempSum += fcu.spaceTemp;
      tempCount++;
      summary.tempMin = Math.min(summary.tempMin, fcu.spaceTemp);
      summary.tempMax = Math.max(summary.tempMax, fcu.spaceTemp);
    }

    // Mode counts
    if (fcu.heatOutput && fcu.heatOutput > 0) {
      summary.heatingCount++;
    } else if (fcu.coolOutput && fcu.coolOutput > 0) {
      summary.coolingCount++;
    } else if (fcu.fanState?.toLowerCase().includes('off')) {
      summary.offCount++;
    }
  }

  summary.avgTemp = tempCount > 0 ? tempSum / tempCount : 0;
  if (summary.tempMin === Infinity) summary.tempMin = 0;
  if (summary.tempMax === -Infinity) summary.tempMax = 0;

  return summary;
}
