# MQTT Live Monitor - Setup & Usage

## Overview

A real-time monitoring console for HVAC sensor data streaming from HiveMQ Cloud broker.

**Features:**
- ✅ Live JSON message display
- ✅ Connection status indicator
- ✅ Message counter (received & buffer)
- ✅ Pause/Resume streaming
- ✅ Auto-scroll toggle
- ✅ Clear buffer
- ⏳ Charts (to be added after JSON structure confirmation)

---

## Files Created

### 1. Page Component
**`app/(chat)/mqtt-monitor/page.tsx`**
- Main page layout
- Server component with metadata

### 2. Live Console Component
**`components/mqtt/mqtt-live-console.tsx`**
- Client component with SSE connection
- Real-time message display
- Controls (pause, clear, auto-scroll)
- Connection status badge

### 3. API Route
**`app/api/mqtt/stream/route.ts`**
- Server-Sent Events (SSE) endpoint
- MQTT broker connection
- Message streaming to clients

### 4. Navigation
**`components/app-sidebar.tsx`**
- Added "📡 MQTT Monitor" link

### 5. Dependencies
**`package.json`**
- Added `mqtt: ^5.11.4`
- Added `@types/mqtt: ^2.5.0`

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
npm install
```

Or if using pnpm:
```bash
pnpm install
```

> **Note**: If you encounter peer dependency conflicts, use:
> ```bash
> npm install --legacy-peer-deps
> ```

### Step 2: Start Development Server

```bash
npm run dev
```

### Step 3: Access the Monitor

1. Navigate to `http://localhost:3000`
2. Login (or guest access)
3. Click **📡 MQTT Monitor** in the sidebar

---

## MQTT Broker Configuration

**Current Configuration** (hardcoded in `app/api/mqtt/stream/route.ts`):

```typescript
{
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts',
  username: 'Beringar',
  password: 'Winter2025!',
  topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue'
}
```

**Topic Pattern:**
- `dt/yh/gic/hvac/fcu/level_2_fcus/{sensor_type}/{device_id}`
- Sensor types: `temperature`, `humidity`, `occupancy`
- Device IDs: `201`, `202`, `203`, etc.

**Message Format** (expected):
```json
{
  "value": 20.5,
  "timestamp": 1730000000000,
  "device_id": "201",
  "location": "level_2_fcu_201",
  "sensor_type": "temperature",
  "datetime": "2025-10-10T10:49:40.123456"
}
```

---

## Usage

### Monitoring Messages

1. The console automatically connects on page load
2. Messages appear in real-time in the message buffer
3. Each message shows:
   - Topic (last segment as badge)
   - Full topic path
   - Timestamp
   - Raw JSON payload

### Controls

**Pause/Resume**
- Temporarily stop receiving new messages
- Closes SSE connection when paused
- Resume reconnects automatically

**Clear**
- Clears all messages from the buffer
- Message counter continues counting

**Auto-scroll**
- When ON: Automatically scrolls to latest message
- When OFF: Allows manual scrolling through history

### Buffer Limit

- Keeps **last 100 messages** in memory
- Older messages are automatically removed
- Prevents browser memory issues with long-running sessions

---

## Architecture

### Data Flow

```
MQTT Broker (HiveMQ)
    ↓ (MQTT over TLS)
Next.js API Route (/api/mqtt/stream)
    ↓ (Server-Sent Events)
Browser Client (React Component)
    ↓
Live UI Display
```

### Why SSE vs WebSocket?

✅ **Server-Sent Events (SSE)**:
- Simpler implementation
- Automatic reconnection
- Built-in browser support
- Works with HTTP/2
- Unidirectional (server → client) - perfect for this use case

❌ **WebSocket** (not needed):
- Bidirectional - overkill for read-only monitoring
- More complex setup
- Requires separate WebSocket server

---

## Next Steps

### Phase 1: Data Collection (Current)
- ✅ View raw JSON messages
- ⏳ Confirm actual data structure
- ⏳ Document field variations

### Phase 2: Visualization (After JSON confirmation)
- 📊 Time-series charts per device
- 📊 Multi-device comparison
- 📊 Sensor type filtering
- 📊 Real-time gauges (current values)

### Phase 3: Database Integration
- 💾 Store messages in PostgreSQL
- 💾 TimescaleDB hypertables
- 💾 Continuous aggregates
- 💾 Historical queries

### Phase 4: Jeeves Integration
- 🎩 Jeeves discovery on real MQTT data
- 🎩 Anomaly detection
- 🎩 Automated insights
- 🎩 Personalized notifications

---

## Troubleshooting

### Connection Fails

**Error**: "Connection error" in console

**Solutions**:
1. Check broker credentials in `app/api/mqtt/stream/route.ts`
2. Verify broker is accessible: `ping 4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud`
3. Check firewall/network blocks port 8883
4. Review server console logs for detailed error

### No Messages Appearing

**Possible causes**:
1. No publishers sending data to the topic
2. Topic pattern mismatch
3. Broker permissions issue
4. Client disconnected (check status badge)

**Debug**:
- Open browser DevTools → Network tab
- Look for `/api/mqtt/stream` request
- Check EventStream for incoming messages
- Review server console for MQTT client logs

### High Memory Usage

**Issue**: Browser slows down after many messages

**Solutions**:
- Clear message buffer periodically
- Pause when not actively monitoring
- Buffer is limited to 100 messages (already implemented)

---

## Configuration (Future Enhancements)

### Move to Environment Variables

**`.env.local`**:
```bash
MQTT_BROKER_HOST=4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_USERNAME=Beringar
MQTT_PASSWORD=Winter2025!
MQTT_TOPIC=dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue
```

**Update `route.ts`**:
```typescript
const MQTT_CONFIG = {
  host: process.env.MQTT_BROKER_HOST!,
  port: parseInt(process.env.MQTT_BROKER_PORT || '8883'),
  protocol: 'mqtts' as const,
  username: process.env.MQTT_USERNAME!,
  password: process.env.MQTT_PASSWORD!,
  topic: process.env.MQTT_TOPIC || 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue',
};
```

### Dynamic Topic Subscription

Allow users to change topics without code changes:
- Add topic input field in UI
- Send topic to API via query parameter
- Subscribe/unsubscribe dynamically

---

## Performance Considerations

### Current Implementation

- **Connection**: 1 MQTT client per SSE connection
- **Impact**: Each browser tab = 1 broker connection
- **Limit**: HiveMQ free tier allows ~50 concurrent connections

### Production Optimization (Future)

**Option 1: Shared MQTT Client**
- Single global MQTT client
- Multiple SSE streams listen to same client
- Reduces broker connections
- Requires Redis pub/sub for fan-out

**Option 2: Inngest Background Worker**
- Long-running MQTT listener
- Writes to Redis stream
- API route reads from Redis
- Best for persistent monitoring

---

## Testing

### Manual Test

1. Start dev server: `npm run dev`
2. Open MQTT Monitor page
3. Check console logs for connection status
4. Verify messages appear in UI

### With Mock Publisher

If no real publisher is available, create a test script:

**`scripts/mqtt-test-publisher.ts`**:
```typescript
import mqtt from 'mqtt';

const client = mqtt.connect({
  host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
  port: 8883,
  protocol: 'mqtts',
  username: 'Beringar',
  password: 'Winter2025!',
});

client.on('connect', () => {
  console.log('Connected - Publishing test messages...');

  setInterval(() => {
    const message = {
      value: 20 + Math.random() * 5,
      timestamp: Date.now(),
      device_id: '201',
      location: 'level_2_fcu_201',
      sensor_type: 'temperature',
      datetime: new Date().toISOString(),
    };

    client.publish(
      'dt/yh/gic/hvac/fcu/level_2_fcus/temperature/201',
      JSON.stringify(message)
    );

    console.log('Published:', message);
  }, 2000);
});
```

Run: `tsx scripts/mqtt-test-publisher.ts`

---

## Security Notes

### Current Status: ⚠️ Development Only

**Issues**:
- Broker credentials hardcoded in source
- No authentication on API route
- All logged-in users can access

### Production Recommendations

1. **Environment Variables**: Move credentials to `.env.local` (never commit)
2. **API Auth**: Check user permissions in API route
3. **Rate Limiting**: Prevent abuse of SSE connections
4. **Connection Pooling**: Limit concurrent MQTT clients
5. **Read-only Access**: Ensure MQTT user can only subscribe (not publish)

---

## Summary

✅ **Completed**:
- Live monitoring page with SSE
- MQTT broker connection
- Real-time message display
- Navigation integration
- Controls (pause, clear, auto-scroll)

🎯 **Next**:
1. **You**: Run the app and verify messages appear
2. **You**: Provide actual JSON structure samples
3. **Me**: Add charts and visualizations
4. **Me**: Implement database storage
5. **Me**: Integrate with Jeeves discovery

---

## Contact

For questions or issues during setup, check:
- Server console logs
- Browser DevTools console
- Network tab for SSE stream
- MQTT broker dashboard (HiveMQ Cloud)
