#!/usr/bin/env python3
"""
MQTT Monitor - Direct observation of broker messages

This script connects directly to the MQTT broker and logs:
- When messages arrive
- Message timestamps
- Time between messages

Run: python scripts/mqtt-monitor.py
"""

import paho.mqtt.client as mqtt
import json
import ssl
from datetime import datetime

# MQTT Configuration (same as your Node.js code)
MQTT_CONFIG = {
    'host': '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
    'port': 8883,
    'username': 'Beringar',
    'password': 'Winter2025!',
#    'topic': 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue'
    'topic': 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue'
}

# Track message timing
last_message_time = None
last_data_timestamp = None
message_count = 0

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"✅ Connected to MQTT broker: {MQTT_CONFIG['host']}")
        client.subscribe(MQTT_CONFIG['topic'])
        print(f"📡 Subscribed to: {MQTT_CONFIG['topic']}")
        print(f"\n{'='*80}")
        print(f"Monitoring MQTT messages... (Ctrl+C to stop)")
        print(f"{'='*80}\n")
    else:
        print(f"❌ Connection failed with code {reason_code}")

def on_message(client, userdata, msg):
    global last_message_time, last_data_timestamp, message_count

    message_count += 1
    received_at = datetime.now()

    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        data_timestamp = payload.get('timestamp', 'N/A')

        # Calculate time since last message
        time_since_last = None
        if last_message_time:
            time_since_last = (received_at - last_message_time).total_seconds()

        # Check if data timestamp changed
        is_new_data = (data_timestamp != last_data_timestamp)

        # Print message info
        print(f"📩 Message #{message_count} received at {received_at.strftime('%H:%M:%S')}")
        print(f"   📅 Data timestamp: {data_timestamp}")
        print(f"   📏 Payload size: {len(msg.payload)} bytes")

        if time_since_last:
            print(f"   ⏱️  Time since last message: {time_since_last:.1f} seconds")

        if is_new_data:
            print(f"   ✨ NEW DATA (timestamp changed)")
            if last_data_timestamp:
                print(f"      Previous: {last_data_timestamp}")
                print(f"      Current:  {data_timestamp}")
        else:
            print(f"   🔁 DUPLICATE DATA (same timestamp as before)")

        # Count FCUs if available
        if 'status' in payload:
            fcu_count = len(payload['status'])
            print(f"   🏢 FCUs in message: {fcu_count}")

        # Print ENTIRE MQTT payload (all 49 FCUs + metadata)
        print(f"\n   📄 COMPLETE MQTT PAYLOAD (ALL DATA):")
        print(f"   {'='*76}")
        import json as json_lib
        full_json = json.dumps(payload, indent=4, ensure_ascii=False)

        # Save to file for detailed inspection
        filename = f"mqtt_payload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(full_json)
            print(f"   💾 Full payload saved to: {filename}")
        except Exception as e:
            print(f"   ⚠️  Could not save to file: {e}")

        # Print with indentation (limit to first 200 lines to avoid overwhelming terminal)
        lines = full_json.split('\n')
        display_lines = min(200, len(lines))
        for idx, line in enumerate(lines[:display_lines], 1):
            print(f"   {line}")
        if len(lines) > display_lines:
            print(f"   ... [{len(lines) - display_lines} more lines omitted]")
            print(f"   ... Full payload: {len(lines)} lines, {len(msg.payload)} bytes")
            print(f"   ... See complete data in: {filename}")
        print(f"   {'='*76}")

        # Extract FCU-201 data to see actual values
#        if 'status' in payload and 'fCU_201' in payload['status']:
        if 'status' in payload and 'fCU_01_04' in payload['status']:
            the_fcu = payload['status']['fCU_01_04']



    #   'H_O_A'
    #   Fan_Fault'
    #   Fan_Status'
    #   Wall_Adjuster'
    #   Local_Setpoint'
    #   Return_Air_Temp'
    #   Supply_Air_Temp'
    #   Wall_Stat_Fitted'
    #   Occupation_Status'
    #   Cooling_Override_%'
    #   Effective_Setpoint"'
    #   Heating_Override_%'
    #   FCU_Clg_Check_Failure'
    #   FCU_Htg_Check_Failure'
    #   Cooling_Valve_Position'
    #   Heating_Valve_Position'
    #   Enable_Cooling_Override'
    #   Enable_Heating_Override'
    #   FCU_Clg_Exercise_Failure;




            # Helper function to parse status strings like "23.2 °C {ok}"
            def parse_value(val):
                if val is None or val == 'N/A':
                    return 'N/A'
                val_str = str(val)
                # Extract number before unit
                import re
                match = re.match(r'^([\d\.]+|nan)', val_str)
                if match:
                    num = match.group(1)
                    # Extract status
                    status_match = re.search(r'\{([^}]+)\}', val_str)
                    status = status_match.group(1) if status_match else 'ok'
                    return f"{num} {{{status}}}"
                return val_str

            print(f"\n   🌡️  {the_fcu} RAW VALUES:")

            # Temperature sensors
            print(f"      Space Temp (nvoSpaceTemp):     {parse_value(the_fcu.get('nvoSpaceTemp'))}")
            print(f"      Effective Setpoint:             {parse_value(the_fcu.get('nvoEffectSetpt'))}")
            print(f"      User Setpoint (nviSetpoint):    {parse_value(the_fcu.get('nviSetpoint'))}")
            print(f"      Supply Temp (nvoSupplyTemp):    {parse_value(the_fcu.get('nvoSupplyTemp'))}")

            # Valve outputs (check both possible names)
            heat_val = the_fcu.get('nvoHeatOutput') or the_fcu.get('nvoHeatPrimary') or the_fcu.get('nvoHeatOut')
            cool_val = the_fcu.get('nvoCoolOutput') or the_fcu.get('nvoCoolPrimary') or the_fcu.get('nvoCoolOut')
            print(f"      Heat Output:                    {parse_value(heat_val)}")
            print(f"      Cool Output:                    {parse_value(cool_val)}")

            # Fan (check both possible names)
            fan_val = the_fcu.get('nvoFanSpeed') or the_fcu.get('nvoFanSpeed_state')
            print(f"      Fan Speed:                      {parse_value(fan_val)}")

            # Occupancy (check both possible names)
            occup_val = the_fcu.get('nvoOccup') or the_fcu.get('nvoEffectOccup')
            print(f"      Occupancy:                      {parse_value(occup_val)}")

            # Show ALL fields count and list them
            print(f"\n      📊 Total fields in message: {len(the_fcu)}")
            print(f"      📝 All field names:")
            for idx, field_name in enumerate(sorted(the_fcu.keys()), 1):
                field_value = parse_value(the_fcu[field_name])
                print(f"         {idx}. {field_name:30s} = {field_value}")

            # Check for supply temp variations
            supply_temp_candidates = [k for k in the_fcu.keys() if 'supply' in k.lower() or 'sat' in k.lower() or 'supplyair' in k.lower()]
            if supply_temp_candidates:
                print(f"\n      🔍 Found supply temp field(s): {', '.join(supply_temp_candidates)}")
            else:
                print(f"\n      ⚠️  No supply temp field found (was in older messages but not current)")

            # Helper to extract numeric values
            def extractNumericValue(val):
                if not val:
                    return None
                import re
                match = re.match(r'^([\d\.]+)', str(val))
                return float(match.group(1)) if match else None

            # Analysis summary
            heat_num = extractNumericValue(heat_val) if heat_val else 0
            cool_num = extractNumericValue(cool_val) if cool_val else 0

            print(f"\n      🔍 HVAC Status:")
            if heat_num and heat_num > 0:
                print(f"         🔥 HEATING at {heat_num}%")
            elif cool_num and cool_num > 0:
                print(f"         ❄️  COOLING at {cool_num}%")
            else:
                print(f"         ⏸️  IDLE (no heating/cooling)")

            # Check for the setpoint gap mystery
            try:
                user_sp = extractNumericValue(the_fcu.get('nviSetpoint'))
                eff_sp = extractNumericValue(the_fcu.get('nvoEffectSetpt'))
                if user_sp and eff_sp and abs(user_sp - eff_sp) > 0.1:
                    print(f"         ⚠️  SETPOINT GAP: {abs(user_sp - eff_sp):.1f}°C (User: {user_sp}°C, Effective: {eff_sp}°C)")
            except Exception as e:
                pass  # Ignore parsing errors

        print(f"{'-'*80}\n")

        # Update tracking
        last_message_time = received_at
        last_data_timestamp = data_timestamp

    except json.JSONDecodeError:
        print(f"❌ Failed to parse JSON payload")
    except Exception as e:
        print(f"❌ Error processing message: {e}")

def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    if reason_code != 0:
        print(f"\n⚠️  Unexpected disconnection (code {reason_code})")
    else:
        print(f"\n👋 Disconnected cleanly")

def main():
    print(f"\n🔍 MQTT Broker Monitor")
    print(f"   Host: {MQTT_CONFIG['host']}")
    print(f"   Port: {MQTT_CONFIG['port']}")
    print(f"   Topic: {MQTT_CONFIG['topic']}")
    print(f"\n⏳ Connecting...\n")

    # Create MQTT client (using callback API v2)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"jeeves-monitor-{datetime.now().timestamp()}")

    # Set username and password
    client.username_pw_set(MQTT_CONFIG['username'], MQTT_CONFIG['password'])

    # Enable TLS/SSL
    client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS)

    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    # Connect to broker
    try:
        client.connect(MQTT_CONFIG['host'], MQTT_CONFIG['port'], keepalive=60)

        # Blocking loop
        client.loop_forever()

    except KeyboardInterrupt:
        print(f"\n\n⏹️  Monitoring stopped by user")
        print(f"📊 Summary: Received {message_count} messages")
        client.disconnect()
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
