# MQTT Monitor Script

Direct observation tool to diagnose MQTT data arrival patterns.

## Purpose

This Python script connects directly to the MQTT broker to answer:
- **How often does MQTT actually send messages?**
- **Are we getting duplicate data from the broker, or creating duplicates in our pipeline?**
- **What is the real data timestamp vs. arrival time?**

## Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r scripts/requirements.txt
   ```

2. **Run the monitor:**
   ```bash
   python scripts/mqtt-monitor.py
   ```

3. **Let it run for 10-15 minutes** to observe the pattern

4. **Press Ctrl+C to stop**

## What to Look For

### Scenario 1: Broker sends fresh data every minute with changing values
```
📩 Message #1 at 13:20:00
   📅 Data timestamp: 2025-10-13T13:20:24.075Z
   ✨ NEW DATA
   🌡️  FCU-201 VALUES:
      Space Temp:     23.2 °C {ok}
      Setpoint:       22.0 °C {ok}

📩 Message #2 at 13:21:00
   📅 Data timestamp: 2025-10-13T13:21:24.075Z
   ✨ NEW DATA
   🌡️  FCU-201 VALUES:
      Space Temp:     23.4 °C {ok}  ← CHANGED!
      Setpoint:       22.0 °C {ok}
```
→ **Result**: Broker is fine, values are changing, pipeline is working correctly

### Scenario 2: Broker sends data every 5 minutes
```
📩 Message #1 at 13:20:00
   📅 Data timestamp: 2025-10-13T13:20:24.075Z
   ✨ NEW DATA

📩 Message #2 at 13:25:00
   📅 Data timestamp: 2025-10-13T13:25:24.075Z
   ✨ NEW DATA
   ⏱️  300 seconds since last
```
→ **Result**: Broker sends every 5 min, our 1-min cron is too frequent

### Scenario 3: Temperature values NOT changing (stuck sensor)
```
📩 Message #1 at 13:20:00
   📅 Data timestamp: 2025-10-13T13:20:24.075Z
   ✨ NEW DATA
   🌡️  FCU-201 VALUES:
      Space Temp:     23.2 °C {ok}
      Setpoint:       22.0 °C {ok}

📩 Message #2 at 13:25:00
   📅 Data timestamp: 2025-10-13T13:25:24.075Z
   ✨ NEW DATA (timestamp changed)
   🌡️  FCU-201 VALUES:
      Space Temp:     23.2 °C {ok}  ← SAME VALUE!
      Setpoint:       22.0 °C {ok}  ← SAME VALUE!
```
→ **Result**: Timestamp changes but temperature stays the same. This could mean:
  - Room temperature is stable (normal)
  - Sensor is stuck (problem)
  - Values update slower than we expect

### Scenario 4: Broker repeats same data (QoS behavior)
```
📩 Message #1 at 13:20:00
   📅 Data timestamp: 2025-10-13T13:20:24.075Z
   ✨ NEW DATA
   🌡️  FCU-201 VALUES:
      Space Temp:     23.2 °C {ok}

📩 Message #2 at 13:20:05
   📅 Data timestamp: 2025-10-13T13:20:24.075Z
   🔁 DUPLICATE DATA (same timestamp)
   🌡️  FCU-201 VALUES:
      Space Temp:     23.2 °C {ok}  ← Same timestamp = Same values
```
→ **Result**: Broker itself is sending duplicates (MQTT QoS behavior)

## Output Explanation

- **Message #X** - Sequential count of all messages received
- **Data timestamp** - The `timestamp` field from the message payload
- **⏱️ Time since last** - Seconds since previous message arrived
- **✨ NEW DATA** - Data timestamp changed (fresh data)
- **🔁 DUPLICATE DATA** - Same timestamp as before (duplicate)
- **🌡️ FCU-201 VALUES** - Actual sensor readings:
  - **Space Temp** - Current room temperature
  - **Setpoint** - Target temperature (effective setpoint)
  - **User Setpoint** - User-configured cooling setpoint
  - **Heat Output** - Heating valve position (0-100%)
  - **Cool Output** - Cooling valve position (0-100%)

## Features

### Real-Time Console Output
- Live message tracking with timestamps
- FCU-201 detailed analysis (temperature, setpoints, HVAC status)
- Field name enumeration (shows all available data points)
- Setpoint gap detection
- HVAC status analysis (heating/cooling/idle)

### Complete Payload Logging
**New Feature**: The script now saves the COMPLETE MQTT payload to timestamped JSON files:

```
mqtt_payload_20251013_194917.json
mqtt_payload_20251013_200051.json
```

Each file contains:
- **All 49 FCUs** (not just FCU-201)
- **All fields** for each FCU
- **Complete metadata** (timestamp, version, etc.)

**Why this is useful:**
- Discover field names for other FCUs
- Find FCUs with more detailed data
- Offline inspection of complete messages
- Verify nothing is missed by the parser

The script displays the first 200 lines in the terminal and saves the complete payload to a file for detailed inspection.

## After Running

Based on what you observe, you'll know:
1. **How often MQTT sends messages** (adjust cron interval if needed)
2. **Whether temperature values are actually changing** (or if sensor is stuck)
3. **Whether broker sends duplicates** (need deduplication)
4. **Whether Jeeves is correct** (values changing = Jeeves should detect patterns)
5. **What fields are available** across all 49 FCUs (check saved JSON files)
