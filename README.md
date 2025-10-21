# Jeeves - AI-Powered HVAC Monitoring System

<p align="center">
  <strong>An intelligent building management assistant that monitors HVAC systems, discovers anomalies, and provides persona-based insights.</strong>
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#documentation"><strong>Documentation</strong></a>
</p>

---

## Overview

Jeeves is an AI-powered butler for building management systems. It continuously monitors HVAC Fan Coil Units (FCUs), analyzes telemetry data, discovers anomalies, and notifies relevant stakeholders with personalized insights.

**Current Focus:** FCU-201 monitoring with real-time data ingestion from MQTT broker.

## Features

### 🤖 AI-Powered Analysis
- **Jeeves AI Butler**: Autonomous discovery agent that analyzes telemetry streams
- **Anomaly Detection**: Automatically identifies unusual patterns (e.g., setpoint gaps, temperature anomalies)
- **Persona-Based Notifications**: Tailored insights for different stakeholders (Facility Manager, Building Engineer, etc.)
- **Chat Interface**: Ask Jeeves about current conditions, historical trends, and discoveries

### 📊 Real-Time Monitoring
- **MQTT Integration**: Connects to HiveMQ Cloud broker for live FCU data
- **Live Charts**: Real-time visualization of temperature, valve positions, and HVAC status
- **Telemetry Streams**: Dynamic discovery of all available data streams from database
- **48-Hour Data Retention**: Automatic cleanup prevents database bloat

### 🏗️ Built With Modern Stack
- **Next.js 15** with App Router and React Server Components
- **AI SDK 5** for LLM integration (Anthropic Claude)
- **Inngest** for background job orchestration
- **Vercel Postgres** for telemetry and state persistence
- **Redis** for deduplication and caching
- **shadcn/ui** + Tailwind CSS for beautiful UI

### 🔧 HVAC-Specific Features
- **FCU Data Parser**: Handles LonWorks protocol field names (nvoSpaceTemp, nviSetpoint, etc.)
- **Multi-Mode Support**: Adapts to FCU's detailed mode (20-30 fields) and minimal mode (7 fields)
- **Field Name Flexibility**: Recognizes multiple variations of field names
- **Original Timestamps**: Preserves FCU data generation time vs. receive time

## Architecture

### Data Flow

```
FCU-201 Hardware
    ↓
HiveMQ Cloud MQTT Broker
    ↓
Inngest Worker (every 5 min) ──→ Vercel Postgres
    ↓                                    ↓
Jeeves AI Analyzer (every 1 hour)      Telemetry Streams
    ↓                                    ↓
Discoveries & Notifications          Real-Time Charts
    ↓
Persona Dashboards & Emails
```

### Key Components

- **`lib/inngest/functions/fcu-data-ingestion.ts`**: MQTT data ingestion worker (cron: every 5 minutes)
- **`lib/inngest/functions/jeeves-auto-scheduler.ts`**: Jeeves analysis scheduler (cron: checks every 5 minutes)
- **`lib/inngest/functions/telemetry-cleanup.ts`**: Database cleanup (cron: daily at 3 AM UTC)
- **`lib/mqtt/fcu-parser.ts`**: Parser for FCU MQTT messages with LonWorks field names
- **`components/mqtt/mqtt-live-charts.tsx`**: Real-time charts using Server-Sent Events
- **`scripts/mqtt-monitor.py`**: Local Python script for debugging MQTT messages

### Database Tables

- **TelemetryTick**: Raw sensor data (sensorId, timestamp, value)
- **TelemetryAnomaly**: Detected anomalies
- **JeevesState**: Jeeves configuration (enabled, interval, monitored streams)
- **JeevesDiscovery**: AI-discovered insights
- **JeevesNotification**: Persona-specific notifications
- **JeevesLearning**: Feedback and learning data

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Vercel account (for deployment)
- MQTT broker access (or use HiveMQ Cloud)
- Redis instance (optional, for deduplication)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd jeeves
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   ```env
   # Database
   POSTGRES_URL=<your-vercel-postgres-url>

   # AI Provider
   ANTHROPIC_API_KEY=<your-anthropic-key>

   # Authentication (optional for local dev)
   AUTH_SECRET=<generate-with-openssl-rand>

   # Inngest (for background jobs)
   INNGEST_SIGNING_KEY=<from-inngest-dashboard>
   INNGEST_EVENT_KEY=<from-inngest-dashboard>

   # Redis (optional, for deduplication)
   REDIS_REDIS_URL=<your-redis-url>
   ```

3. **Run database migrations:**
   ```bash
   pnpm db:migrate
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

5. **Access the application:**
   - Web UI: [http://localhost:3000](http://localhost:3000)
   - Inngest Dev Server: [http://localhost:3000/api/inngest](http://localhost:3000/api/inngest)

### MQTT Monitoring

To monitor MQTT messages locally:

```bash
# Install Python dependencies
pip install paho-mqtt

# Run the monitor
python scripts/mqtt-monitor.py
```

This will display live MQTT messages and save complete payloads to JSON files.

## Documentation

Comprehensive documentation is available in the `/docs` directory:

### Core Documentation
- **[JEEVES_ARCHITECTURE.md](docs/JEEVES_ARCHITECTURE.md)**: System architecture and design
- **[FCU_JEEVES_INTEGRATION.md](docs/FCU_JEEVES_INTEGRATION.md)**: MQTT integration guide
- **[MQTT_MONITOR_SETUP.md](docs/MQTT_MONITOR_SETUP.md)**: Setting up MQTT monitoring

### Implementation Guides
- **[JEEVES_BACKGROUND_PROCESSING.md](docs/JEEVES_BACKGROUND_PROCESSING.md)**: Inngest worker configuration
- **[JEEVES_DEDUPLICATION.md](docs/JEEVES_DEDUPLICATION.md)**: Redis-based deduplication
- **[JEEVES_EMAIL_NOTIFICATIONS.md](docs/JEEVES_EMAIL_NOTIFICATIONS.md)**: Email notification setup

### Features
- **[DISCOVERY_CHAT_FEATURE.md](docs/DISCOVERY_CHAT_FEATURE.md)**: Chat with Jeeves about discoveries
- **[JEEVES_PERSONA_VISUAL_REPORTS_PLAN.md](docs/JEEVES_PERSONA_VISUAL_REPORTS_PLAN.md)**: Visual dashboards

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Vercel Postgres connection string |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `AUTH_SECRET` | Optional | NextAuth.js secret (required for auth) |
| `INNGEST_SIGNING_KEY` | Yes | Inngest signing key |
| `INNGEST_EVENT_KEY` | Yes | Inngest event key |
| `REDIS_REDIS_URL` | Optional | Redis URL for deduplication |
| `RESEND_API_KEY` | Optional | Resend API key for emails |

## Deployment

### Vercel (Recommended)

1. **Connect to Vercel:**
   ```bash
   vercel link
   ```

2. **Set environment variables** in Vercel dashboard

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Set up Inngest:**
   - Create Inngest app at [inngest.com](https://inngest.com)
   - Configure webhook: `https://your-domain.vercel.app/api/inngest`
   - Add `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` to Vercel

### Database Management

```bash
# Generate new migration
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio
pnpm db:studio
```

## Current Status

### ✅ Implemented
- MQTT data ingestion (FCU-201)
- Real-time charts with SSE
- Jeeves autonomous analysis
- Discovery logging and storage
- Persona-based notifications
- Chat interface with Jeeves
- Telemetry cleanup (48h TTL)
- Field name flexibility (handles FCU mode changes)

### 🚧 In Progress
- Expanding to all 49 FCUs (currently focusing on FCU-201)
- Email notifications via Resend
- Advanced anomaly detection algorithms

### 📋 Planned
- Historical data export
- Custom alert thresholds per persona
- Mobile app notifications
- Multi-building support

## Contributing

This is a private project. For questions or issues, contact the project maintainer.

## License

Private - All rights reserved.

---

**Built with ❤️ using Next.js, Anthropic Claude, and Inngest**
