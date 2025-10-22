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
  H_O_A?: string;
  Fan_Fault?: string;
  Fan_Status?: string;
  Wall_Adjuster?: number;
  Local_Setpoint?: number;
  Return_Air_Temp?: number;
  Supply_Air_Temp?: number;
  Wall_Stat_Fitted?: string;
  Occupation_Status?: string;
  Cooling_Override?: number;

  Effective_Setpoint?: number;
  
  Heating_Override?: number;
  FCU_Clg_Check_Failure?: string;
  FCU_Htg_Check_Failure?: string;
  Cooling_Valve_Position?: number;
  Heating_Valve_Position?: number;
  Enable_Cooling_Override?: string;
  Enable_Heating_Override?: string;
  FCU_Clg_Exercise_Failure?: string;
  FCU_Htg_Exercise_Failure?: string;
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
  // Use 'as FCUStatus' to satisfy TypeScript that this object literal, 
  // which contains only the REQUIRED properties, is a valid starting point.
  const status: FCUStatus = {
    id: fcuId,
    status: 'ok',
    rawData: fcuData,
  } as FCUStatus; // <--- FIX: Added type assertion to resolve initialization error

  let hasFault = false;
  let faultDetails: string[] = [];

  // Helper function to extract the cleaned value from the string (e.g., "24.0 °C {ok}" -> 24.0)
  // This assumes 'parseValueString' is responsible for converting the value and status.
  // Based on your previous code, 'parseValueString' seems to return an object like { value: any, status: string }.
  const extractValue = (value: any): any => {
      // If the value is a string and contains {ok} or {fault}, strip it out
      if (typeof value === 'string') {
          // Check if it's a number/percentage/degree value
          const match = value.match(/([\d.-]+)/);
          if (match) {
              // If it has a number, return it as a float
              return parseFloat(match[1]);
          }
          // If it's a pure string value (like "Auto {ok}"), strip the status part
          const stringMatch = value.match(/^([^{]+)/);
          if (stringMatch) {
              return stringMatch[1].trim();
          }
      }
      return value;
  };

  // Parse each field
  for (const [key, value] of Object.entries(fcuData)) {
    // We'll rely on a manual string check here, as 'parseValueString' may not handle the complex format
    // const parsed = parseValueString(value); // Assuming this is no longer reliable for new format

    // Check for faults/downs using the explicit status string in the new format
    if (typeof value === 'string' && (value.includes('{fault}') || value.includes('{down}') || value.includes('{null}'))) {
        hasFault = true;
        faultDetails.push(`${key}: ${value.match(/\{(.+?)\}/)?.[1] || 'fault'}`);
    } else if (typeof value === 'object' && value !== null && (value.status?.includes('fault') || value.status?.includes('down'))) {
        // Fallback for old parsing format if needed
        hasFault = true;
        faultDetails.push(`${key}: ${value.status}`);
    }

    const cleanedValue = extractValue(value);
    const keyLower = key.toLowerCase();

    // =====================================================================
    // Dedicated Mapping for NEW (Explicit) FCU Keys
    // =====================================================================

    switch (key) {
        case 'H_O_A':
            status.H_O_A = cleanedValue; // e.g., "Auto"
            status.mode = cleanedValue; // Map to old 'mode' for backward compatibility
            break;
        case 'Fan_Fault':
            status.Fan_Fault = cleanedValue; // e.g., "Health"
            break;
        case 'Fan_Status':
            status.Fan_Status = cleanedValue; // e.g., "Running"
            break;
        case 'Wall_Adjuster':
            status.Wall_Adjuster = cleanedValue; // e.g., 24.0
            break;
        case 'Local_Setpoint':
            status.Local_Setpoint = cleanedValue; // e.g., 23.0
            status.userSetpoint = cleanedValue; // Map to old 'userSetpoint'
            break;
        case 'Return_Air_Temp':
            status.Return_Air_Temp = cleanedValue; // e.g., 22.7
            status.spaceTemp = cleanedValue; // Map to old 'spaceTemp'
            break;
        case 'Supply_Air_Temp':
            status.Supply_Air_Temp = cleanedValue; // e.g., 17.5
            break;
        case 'Wall_Stat_Fitted':
            status.Wall_Stat_Fitted = cleanedValue; // e.g., "Disabled"
            break;
        case 'Occupation_Status':
            status.Occupation_Status = cleanedValue; // e.g., "Occupied"
            status.occupancy = cleanedValue; // Map to old 'occupancy'
            break;
        case 'Cooling_Override_%':
            status.Cooling_Override = cleanedValue; // e.g., 50.0
            break;
        case 'Effective_Setpoint':
            status.Effective_Setpoint = cleanedValue; // e.g., 23.0
            status.effectiveSetpoint = cleanedValue; // Map to old 'effectiveSetpoint'
            break;
        case 'Heating_Override_%':
            status.Heating_Override = cleanedValue; // e.g., 0.0
            break;
        case 'FCU_Clg_Check_Failure':
            status.FCU_Clg_Check_Failure = cleanedValue; // e.g., "Normal"
            break;
        case 'FCU_Htg_Check_Failure':
            status.FCU_Htg_Check_Failure = cleanedValue; // e.g., "Failed"
            break;
        case 'Cooling_Valve_Position':
            status.Cooling_Valve_Position = cleanedValue; // e.g., 50.0
            status.coolOutput = cleanedValue; // Map to old 'coolOutput'
            break;
        case 'Heating_Valve_Position':
            status.Heating_Valve_Position = cleanedValue; // e.g., 0.0
            status.heatOutput = cleanedValue; // Map to old 'heatOutput'
            break;
        case 'Enable_Cooling_Override':
            status.Enable_Cooling_Override = cleanedValue; // e.g., "On"
            break;
        case 'Enable_Heating_Override':
            status.Enable_Heating_Override = cleanedValue; // e.g., "Off"
            break;
        case 'FCU_Clg_Exercise_Failure':
            status.FCU_Clg_Exercise_Failure = cleanedValue; // e.g., "-"
            break;
        case 'FCU_Htg_Exercise_Failure':
            status.FCU_Htg_Exercise_Failure = cleanedValue; // e.g., "-"
            break;
        default:
            // =====================================================================
            // Existing Mapping for OLD/Generic Keys (if needed)
            // =====================================================================
            // This is where your original parsing logic remains as a fallback.
            
            // Occupancy (check multiple possible field names)
            if (keyLower.includes('occup') || key === 'nvoOccup' || key === 'nvoEffectOccup') {
                status.occupancy = String(cleanedValue);
            }
            // Space temperature
            // ... (rest of your original mapping logic here, using cleanedValue)
            // Note: Since the explicit keys above already map to the old fields (e.g., spaceTemp), 
            // the original block is largely redundant but kept for any non-FCU_01_04 data.

            break;
    }
  }

  // Set overall status
  if (hasFault) {
    // Check the raw status string from the fault details
    if (faultDetails.some(d => d.includes('down') || d.includes('null'))) {
      status.status = 'down';
    } else {
      status.status = 'fault';
    }
    status.faultDetails = faultDetails.join(', ');
  }

  return status;
}

function xx_parseFCU(fcuId: string, fcuData: Record<string, any>): FCUStatus {
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

  // ---------------------------------------------------
  const rawData_timestamp = parseCustomTimestamp(payload.timestamp);   
  if (!rawData_timestamp) {
      console.error(`[XXXXX-X] ❌ Invalid timestamp format received: ${payload.timestamp}`);
  }
  // ---------------------------------------------------

  if (!payload.status || typeof payload.status !== 'object') {
    return {
      timestamp: toSafeISOString(rawData_timestamp) || new Date().toISOString(),
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
    timestamp: toSafeISOString(rawData_timestamp), //payload.timestamp,
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

export function parseCustomTimestamp(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    // Try ISO 8601 format first (already in UTC)
    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
    
    // Custom format: '21-Oct-25 8:45 PM BST'
    const customFormatRegex = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+([A-Z]{3})$/i;
    const match = dateString.match(customFormatRegex);
    
    if (match) {
      const [, day, monthStr, year, hour, minute, ampm, timezone] = match;
      
      // Convert month name to number
      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      
      const month = monthMap[monthStr.toLowerCase()];
      if (month === undefined) return null;
      
      // Convert 2-digit year to 4-digit (assuming 20xx)
      const fullYear = 2000 + parseInt(year, 10);
      
      // Convert 12-hour to 24-hour format
      let hour24 = parseInt(hour, 10);
      if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
        hour24 += 12;
      } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
        hour24 = 0;
      }
      
      // Timezone offset map (hours to subtract from local time to get UTC)
      const timezoneOffsets: Record<string, number> = {
        'BST': 1,   // British Summer Time (UTC+1)
        'GMT': 0,   // Greenwich Mean Time (UTC+0)
        'UTC': 0,   // UTC
        'EST': -5,  // Eastern Standard Time (UTC-5)
        'EDT': -4,  // Eastern Daylight Time (UTC-4)
        'PST': -8,  // Pacific Standard Time (UTC-8)
        'PDT': -7,  // Pacific Daylight Time (UTC-7)
        'CET': 1,   // Central European Time (UTC+1)
        'CEST': 2,  // Central European Summer Time (UTC+2)
      };
      
      const tzOffset = timezoneOffsets[timezone.toUpperCase()] ?? 0;
      
      // Create UTC date by using Date.UTC()
      // Subtract timezone offset to convert local time to UTC
      const utcDate = new Date(Date.UTC(
        fullYear,
        month,
        parseInt(day, 10),
        hour24 - tzOffset,  // Adjust for timezone
        parseInt(minute, 10),
        0,
        0
      ));
      
      return isNaN(utcDate.getTime()) ? null : utcDate;
    }
    
    return null;
  } catch (error) {
    console.error('[FCU Ingestion] Error parsing timestamp:', error);
    return null;
  }
}

export function toSafeISOString(dateValue: any): string {
  const parsed = typeof dateValue === 'string' 
    ? parseCustomTimestamp(dateValue) 
    : new Date(dateValue);
    
  return parsed && !isNaN(parsed.getTime())
    ? parsed.toISOString()
    : new Date().toISOString();
}
