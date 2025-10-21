================================================================
Jeeves HVAC Monitoring System - Developer Manual
================================================================

:Author: Jeeves Development Team
:Date: 2025-10-13
:Version: 2.0
:Status: Production

.. contents:: Table of Contents
   :depth: 3
   :backlinks: top

================================================================
1. System Overview
================================================================

1.1 Introduction
----------------------------------------------------------------

Jeeves is an AI-powered autonomous HVAC monitoring system that:

* Monitors Fan Coil Units (FCUs) via MQTT broker integration
* Ingests telemetry data from 49 FCUs in real-time
* Analyzes patterns using Claude AI (Anthropic)
* Discovers anomalies and operational insights
* Generates persona-based notifications
* Creates visual dashboards automatically
* Provides chat interface for queries

**Primary Focus:** FCU-01_04 deep analysis before scaling to all units

1.2 Technology Stack
----------------------------------------------------------------

**Backend:**

* Next.js 15 (App Router, React Server Components)
* TypeScript 5.6
* Drizzle ORM 0.34
* Vercel Postgres (database)
* Inngest 3.30 (background job orchestration)
* MQTT.js 5.11 (message broker client)

**AI/ML:**

* AI SDK 5.0 (Vercel AI SDK)
* Anthropic Claude (Sonnet 4.5)
* Prompt caching for token optimization

**Frontend:**

* React 19 RC
* shadcn/ui + Tailwind CSS 4.1
* Recharts 2.13 (data visualization)
* Server-Sent Events (real-time updates)

**Infrastructure:**

* Vercel (hosting + serverless functions)
* HiveMQ Cloud (MQTT broker)
* Redis 5.0 (deduplication, optional)

1.3 Key Features
----------------------------------------------------------------

**Real-Time Monitoring:**

* MQTT integration with HiveMQ Cloud broker
* 5-minute data ingestion cycle
* Live charts with SSE streaming
* 48-hour data retention (automatic cleanup)

**AI-Powered Analysis:**

* Autonomous pattern discovery
* 19 stream analysis tools
* Anomaly detection
* Correlation analysis
* Predictive insights

**Persona System:**

* Role-based notifications (Facility Manager, Building Engineer, etc.)
* Personalized communication style
* Interest-based filtering
* Feedback loop for learning

**Dashboard Generation:**

* Automatic visual report creation
* Embeddable charts
* Shareable URLs with access control
* v0-powered dashboard rendering

================================================================
2. Architecture
================================================================

2.1 System Architecture
----------------------------------------------------------------

::

    ┌─────────────────────────────────────────────────────────┐
    │                   FCU-01_04 Hardware                       │
    │              (Fan Coil Unit - Building HVAC)             │
    └──────────────────────┬──────────────────────────────────┘
                           │ LonWorks Protocol
                           ↓
    ┌─────────────────────────────────────────────────────────┐
    │              HiveMQ Cloud MQTT Broker                    │
    │      Topic: dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue           │
    │      Publishes: Every ~5 minutes (all 49 FCUs)          │
    └──────────────────────┬──────────────────────────────────┘
                           │
                           ↓ MQTT Subscribe
    ┌─────────────────────────────────────────────────────────┐
    │         Inngest Worker: fcu-data-ingestion               │
    │      lib/inngest/functions/fcu-data-ingestion.ts         │
    │      Cron: */5 * * * * (every 5 minutes)                 │
    │                                                           │
    │      1. Connect to MQTT broker                            │
    │      2. Parse MQTT message (all 49 FCUs)                 │
    │      3. Extract FCU-01_04 data                              │
    │      4. Normalize field names (LonWorks → streams)       │
    │      5. Save numeric values to database                   │
    │      6. Disconnect after 50s timeout                      │
    └──────────────────────┬──────────────────────────────────┘
                           │
                           ↓ INSERT INTO TelemetryTick
    ┌─────────────────────────────────────────────────────────┐
    │                Vercel Postgres Database                   │
    │                                                           │
    │      • TelemetryTick: sensor data (id, sensorId, ts,    │
    │        value)                                             │
    │      • TelemetryAnomaly: detected anomalies              │
    │      • JeevesState: configuration                         │
    │      • JeevesDiscovery: AI-discovered patterns           │
    │      • JeevesNotification: persona notifications         │
    │      • JeevesActivityLog: execution logs                 │
    │                                                           │
    │      Cleanup: Daily at 3 AM UTC (48h TTL)                │
    └──────────────────────┬──────────────────────────────────┘
                           │
                           ↓ Query streams
    ┌─────────────────────────────────────────────────────────┐
    │      Inngest Worker: jeeves-auto-scheduler               │
    │   lib/inngest/functions/jeeves-auto-scheduler.ts         │
    │   Cron: */5 * * * * (checks if analysis needed)          │
    │                                                           │
    │   IF enabled AND time >= nextAnalysisAt:                 │
    │     → Trigger discovery analysis                          │
    └──────────────────────┬──────────────────────────────────┘
                           │
                           ↓ Run Discovery
    ┌─────────────────────────────────────────────────────────┐
    │           Jeeves Discovery Engine                         │
    │        lib/jeeves/discovery-engine.ts                     │
    │                                                           │
    │   1. Load persona contexts from database                 │
    │   2. List available streams (fcu-01_04-*)                  │
    │   3. Build LLM context with monitored streams            │
    │   4. Call Claude with 19 analysis tools                  │
    │   5. Parse AI response (discoveries array)               │
    │   6. Save discoveries to database                         │
    │   7. Trigger Inngest events for notifications            │
    └──────────────────────┬──────────────────────────────────┘
                           │
                           ↓ Inngest Event: discovery.completed
    ┌─────────────────────────────────────────────────────────┐
    │        Inngest Worker: process-notifications             │
    │     lib/inngest/functions/process-notifications.ts       │
    │                                                           │
    │   FOR EACH intendedRecipient:                            │
    │     1. Load persona context                               │
    │     2. Generate personalized notification (LLM)          │
    │     3. Create dashboard (optional, v0)                   │
    │     4. Save notification to database                      │
    │     5. Update discovery status                            │
    └──────────────────────┬──────────────────────────────────┘
                           │
                           ↓
    ┌─────────────────────────────────────────────────────────┐
    │              Next.js Frontend Application                 │
    │                                                           │
    │   • /jeeves - Command center (discoveries, settings)     │
    │   • /mqtt-monitor - Live charts (SSE streaming)          │
    │   • /chat - AI chat interface                            │
    │   • /d/[slug] - Published dashboards                     │
    └─────────────────────────────────────────────────────────┘

2.2 Data Flow
----------------------------------------------------------------

**Ingestion Flow:**

1. FCU-01_04 generates data (LonWorks protocol)
2. Gateway publishes to MQTT broker (HiveMQ Cloud)
3. Inngest worker subscribes and receives message
4. Parser extracts FCU-01_04 fields:

   * ``nvoSpaceTemp`` → ``fcu-01_04-spacetemp``
   * ``nvoHeatOutput`` → ``fcu-01_04-heatoutput``
   * ``nvoCoolOutput`` → ``fcu-01_04-cooloutput``
   * ... (20-30 fields total)

5. Numeric values saved to ``TelemetryTick`` table
6. Cleanup worker deletes data older than 48 hours

**Analysis Flow:**

1. Auto-scheduler checks if analysis needed (every 5 minutes)
2. Discovery Engine loads monitored streams
3. Claude AI analyzes data with 19 analysis tools:

   * ``analyzeStreamAnomaliesTool``
   * ``correlateTwoStreamsTool``
   * ``detectPatternsTool``
   * ... (16 more tools)

4. AI generates discovery with:

   * Title, category, severity, confidence
   * Reasoning, evidence, hypothesis
   * Recommendations
   * Intended recipients (personas)

5. Discovery saved to database
6. Inngest event triggered for each discovery
7. Notification worker processes in background:

   * Generates personalized message per persona
   * Creates optional dashboard (v0)
   * Saves notification to database
   * Marks discovery as "notified"

**Query Flow:**

1. User opens ``/jeeves`` page
2. Server-side data loading (React Server Component):

   * Load Jeeves state
   * Load recent discoveries (24h)
   * Load notifications (50 limit)
   * Load persona contexts

3. Client-side interactivity:

   * Settings panel (enable/disable, interval)
   * "Analyze Now" button (manual trigger)
   * Activity log (auto-refresh every 5s)
   * Discovery cards with embedded dashboards

2.3 Directory Structure
----------------------------------------------------------------

::

    jeeves/
    ├── app/                              # Next.js App Router
    │   ├── (auth)/                       # Authentication routes
    │   │   └── api/auth/                 # Auth.js endpoints
    │   ├── (chat)/                       # Main application
    │   │   ├── api/
    │   │   │   ├── chat/                 # Chat API (streaming)
    │   │   │   ├── dashboards/           # Dashboard publishing
    │   │   │   ├── document/             # Document management
    │   │   │   ├── telemetry/            # Telemetry streams (SSE)
    │   │   │   └── ...
    │   │   ├── chat/[id]/                # Chat interface
    │   │   ├── jeeves/                   # Jeeves command center
    │   │   ├── mqtt-monitor/             # Live MQTT charts
    │   │   └── d/[slug]/                 # Published dashboards
    │   └── api/
    │       ├── cron/jeeves/              # Vercel Cron (deprecated)
    │       ├── inngest/                  # Inngest webhook
    │       ├── jeeves/                   # Jeeves API routes
    │       │   ├── analyze/              # Manual trigger
    │       │   ├── state/                # Configuration (GET/PATCH)
    │       │   ├── discoveries/          # Discoveries (GET)
    │       │   ├── notifications/        # Notifications (GET)
    │       │   ├── activity-logs/        # Execution logs (GET)
    │       │   └── dashboard-data/[slug]/# Dashboard HTML/script
    │       └── mqtt/
    │           └── stream/               # MQTT SSE endpoint
    ├── components/                        # React components
    │   ├── jeeves/                       # Jeeves UI components
    │   │   ├── status-panel.tsx          # Current state display
    │   │   ├── settings-panel.tsx        # Configuration + analyze
    │   │   ├── activity-log.tsx          # Real-time progress
    │   │   ├── discovery-card.tsx        # Discovery + dashboard
    │   │   ├── notification-card.tsx     # Notification display
    │   │   └── analysis-trail.tsx        # Tool usage display
    │   ├── mqtt/                         # MQTT monitoring
    │   │   └── mqtt-live-charts.tsx      # Live charts (SSE)
    │   └── ui/                           # shadcn/ui components
    ├── lib/                               # Core libraries
    │   ├── ai/                           # AI/LLM integration
    │   │   ├── models.ts                 # AI SDK model config
    │   │   ├── providers.ts              # Anthropic provider
    │   │   ├── prompts.ts                # System prompts
    │   │   └── tools/                    # AI tools
    │   │       ├── stream-analysis.ts    # 19 analysis tools
    │   │       ├── list-streams.ts       # Stream discovery
    │   │       ├── telemetry-query.ts    # Data queries
    │   │       └── ...
    │   ├── db/                           # Database layer
    │   │   ├── schema.ts                 # Drizzle schema
    │   │   ├── queries.ts                # Generic queries
    │   │   ├── jeeves-queries.ts         # Jeeves-specific queries
    │   │   ├── telemetry-ops.ts          # Telemetry operations
    │   │   └── migrations/               # SQL migrations
    │   ├── jeeves/                       # Jeeves core logic
    │   │   ├── discovery-engine.ts       # AI pattern discovery
    │   │   ├── orchestrator.ts           # Discovery coordinator
    │   │   ├── persona-notification-generator.ts  # Personalization
    │   │   ├── visual-report-generator.ts# Dashboard creation
    │   │   ├── notification-composer.ts  # Message composition
    │   │   ├── rate-limit-handler.ts     # API rate limiting
    │   │   └── orchestrator-utils.ts     # Helper functions
    │   ├── inngest/                      # Background workers
    │   │   ├── client.ts                 # Inngest client config
    │   │   └── functions/
    │   │       ├── fcu-data-ingestion.ts # MQTT → DB
    │   │       ├── jeeves-auto-scheduler.ts # Analysis trigger
    │   │       ├── process-notifications.ts # Notification worker
    │   │       ├── telemetry-cleanup.ts  # 48h cleanup
    │   │       └── mqtt-listener.ts      # (unused/experimental)
    │   ├── mqtt/                         # MQTT integration
    │   │   └── fcu-parser.ts             # FCU message parser
    │   └── monitoring/                   # Stream monitoring
    │       └── stream-tools.ts           # Stream discovery
    ├── scripts/                           # Development scripts
    │   ├── mqtt-monitor.py               # Local MQTT monitor
    │   └── README.md                     # Script documentation
    ├── docs/                              # Documentation
    │   ├── DEVELOPER_MANUAL.rst          # This file
    │   ├── FCU_JEEVES_INTEGRATION.md     # MQTT integration guide
    │   ├── JEEVES_ARCHITECTURE.md        # Architecture details
    │   ├── MQTT_MONITOR_SETUP.md         # Local monitoring setup
    │   └── ...
    └── README.md                          # Project overview

================================================================
3. Database Schema
================================================================

3.1 Core Tables
----------------------------------------------------------------

**User** (Authentication)
~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: User
    ├── id: UUID (PK)
    ├── email: VARCHAR(64)
    └── password: VARCHAR(64) (nullable)

**Chat** (Conversation management)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: Chat
    ├── id: UUID (PK)
    ├── createdAt: TIMESTAMP
    ├── title: TEXT
    ├── userId: UUID (FK → User.id)
    ├── visibility: VARCHAR (enum: 'public', 'private')
    └── lastContext: JSONB (nullable)

**Message_v2** (Chat messages)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: Message_v2
    ├── id: UUID (PK)
    ├── chatId: UUID (FK → Chat.id)
    ├── role: VARCHAR
    ├── parts: JSON
    ├── attachments: JSON
    └── createdAt: TIMESTAMP

3.2 Telemetry Tables
----------------------------------------------------------------

**TelemetryTick** (Sensor data points)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: TelemetryTick
    ├── id: UUID (PK)
    ├── sensorId: TEXT (e.g., "fcu-01_04-spacetemp")
    ├── personaName: TEXT (nullable)
    ├── ts: TIMESTAMP (data generation time)
    └── value: DOUBLE PRECISION

**Example Rows:**

.. code-block:: sql

    INSERT INTO "TelemetryTick" (sensorId, ts, value) VALUES
      ('fcu-01_04-spacetemp', '2025-10-13 16:27:24', 23.2),
      ('fcu-01_04-heatoutput', '2025-10-13 16:27:24', 45.0),
      ('fcu-01_04-cooloutput', '2025-10-13 16:27:24', 0.0),
      ('fcu-01_04-fanspeed', '2025-10-13 16:27:24', 3.0);

**TelemetryAnomaly** (Detected anomalies)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: TelemetryAnomaly
    ├── id: UUID (PK)
    ├── sensorId: TEXT
    ├── personaName: TEXT (nullable)
    ├── ts: TIMESTAMP
    ├── value: DOUBLE PRECISION
    ├── score: DOUBLE PRECISION (nullable)
    ├── reason: TEXT (nullable)
    └── createdAt: TIMESTAMP

3.3 Jeeves Tables
----------------------------------------------------------------

**JeevesState** (Configuration)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: JeevesState
    ├── id: UUID (PK)
    ├── enabled: BOOLEAN (default: false)
    ├── analysisInterval: VARCHAR(20) (default: "5min")
    ├── lastAnalysisAt: TIMESTAMP (nullable)
    ├── nextAnalysisAt: TIMESTAMP (nullable)
    ├── lastExecutionStartedAt: TIMESTAMP (nullable, lock)
    ├── monitoredStreams: JSONB (default: [])
    ├── totalDiscoveries: TEXT (default: "0")
    ├── createdAt: TIMESTAMP
    └── updatedAt: TIMESTAMP

**Example Row:**

.. code-block:: json

    {
      "id": "uuid",
      "enabled": true,
      "analysisInterval": "1hour",
      "monitoredStreams": [
        "fcu-01_04-spacetemp",
        "fcu-01_04-heatprimary",
        "fcu-01_04-coolprimary",
        "fcu-01_04-fanspeed",
        "fcu-01_04-occup",
        "fcu-01_04-parsed-heatoutput",
        "fcu-01_04-parsed-cooloutput",
        "fcu-01_04-parsed-status"
      ]
    }

**JeevesDiscovery** (AI discoveries)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: JeevesDiscovery
    ├── id: UUID (PK)
    ├── discoveredAt: TIMESTAMP
    ├── title: TEXT
    ├── category: TEXT (nullable)
    ├── severity: VARCHAR(20) (default: "normal")
    ├── confidence: TEXT (nullable, e.g., "0.85")
    ├── aiReasoning: TEXT
    ├── aiEvidence: JSONB (includes toolUsageTrail)
    ├── aiHypothesis: TEXT (nullable)
    ├── aiRecommendations: JSONB (nullable)
    ├── dashboardId: UUID (FK → PublishedDashboard.id, nullable)
    ├── dashboardSlug: VARCHAR(255) (nullable)
    ├── visualReportUrl: TEXT (nullable)
    ├── personaDashboards: JSONB (default: [])
    ├── intendedRecipients: JSONB (default: [])
    ├── status: VARCHAR(20) (default: "new")
    └── metadata: JSONB (nullable)

**Example Discovery:**

.. code-block:: json

    {
      "id": "uuid",
      "discoveredAt": "2025-10-13T18:45:00Z",
      "title": "Half-Degree Setpoint Paradox Detected",
      "category": "hvac_control_anomaly",
      "severity": "high",
      "confidence": "0.95",
      "aiReasoning": "User sets 22.5°C but FCU targets 22.0°C consistently",
      "aiEvidence": {
        "toolUsageTrail": [
          {"tool": "getRecentDataPoints", "result": "..."},
          {"tool": "correlateTwoStreams", "result": "..."}
        ]
      },
      "intendedRecipients": [
        {
          "personaName": "Bob-eng",
          "reasoning": "HVAC control expert needed"
        },
        {
          "personaName": "Natasha",
          "reasoning": "Facility manager oversight"
        }
      ],
      "status": "notified"
    }

**JeevesNotification** (Persona notifications)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: JeevesNotification
    ├── id: UUID (PK)
    ├── discoveryId: UUID (FK → JeevesDiscovery.id)
    ├── personaName: TEXT
    ├── format: TEXT (nullable, e.g., "email", "slack")
    ├── subject: TEXT (nullable)
    ├── bodyHtml: TEXT
    ├── bodyText: TEXT (nullable)
    ├── summaryOneLiner: TEXT (nullable)
    ├── embedDashboardUrl: TEXT (nullable)
    ├── embedChartImages: JSONB (nullable)
    ├── embedDataTable: JSONB (nullable)
    ├── sentAt: TIMESTAMP
    ├── viewedAt: TIMESTAMP (nullable)
    ├── acknowledgedAt: TIMESTAMP (nullable)
    └── feedback: JSONB (nullable)

**JeevesActivityLog** (Execution logs)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: JeevesActivityLog
    ├── id: UUID (PK)
    ├── executionId: UUID (groups related logs)
    ├── timestamp: TIMESTAMP
    ├── level: VARCHAR(20) (info, success, warning, error)
    ├── message: TEXT
    └── metadata: JSONB (default: {})

**Indexes:**

.. code-block:: sql

    CREATE INDEX idx_jeeves_activity_executionId
      ON "JeevesActivityLog"("executionId");

    CREATE INDEX idx_jeeves_activity_timestamp
      ON "JeevesActivityLog"(timestamp DESC);

**JeevesLearning** (Feedback loop)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: JeevesLearning
    ├── id: UUID (PK)
    ├── discoveryId: UUID (FK → JeevesDiscovery.id, nullable)
    ├── notificationId: UUID (FK → JeevesNotification.id, nullable)
    ├── personaName: TEXT (nullable)
    ├── actionTaken: TEXT (nullable)
    ├── outcome: TEXT (nullable)
    ├── feedbackScore: TEXT (nullable, "-1", "0", "1")
    ├── learnedPattern: TEXT (nullable)
    └── createdAt: TIMESTAMP

3.4 Dashboard Tables
----------------------------------------------------------------

**PublishedDashboard** (Shareable dashboards)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

    Table: PublishedDashboard
    ├── id: UUID (PK)
    ├── userId: UUID (FK → User.id)
    ├── chatId: UUID (FK → Chat.id, nullable)
    ├── title: TEXT
    ├── description: TEXT (nullable)
    ├── html: TEXT (dashboard HTML)
    ├── script: TEXT (dashboard JS)
    ├── cardId: VARCHAR(255) (v0 card ID)
    ├── slug: VARCHAR(255) (unique, URL path)
    ├── accessToken: VARCHAR(255) (unique, auth token)
    ├── password: VARCHAR(255) (nullable, optional protection)
    ├── expiresAt: TIMESTAMP (nullable)
    ├── maxViews: TEXT (nullable)
    ├── currentViews: TEXT (default: "0")
    ├── streams: JSONB (nullable)
    ├── config: JSONB (nullable)
    ├── status: VARCHAR (enum: 'active', 'expired', 'revoked', 'paused')
    ├── createdAt: TIMESTAMP
    ├── updatedAt: TIMESTAMP
    └── lastAccessedAt: TIMESTAMP (nullable)

================================================================
4. Core Components
================================================================

4.1 Jeeves Discovery Engine
----------------------------------------------------------------

**File:** ``lib/jeeves/discovery-engine.ts``

**Purpose:** AI-powered pattern discovery in telemetry streams

**Main Function:**

.. code-block:: typescript

    export async function runDiscovery(
      monitoredStreams: string[],
      recentDiscoveries: JeevesDiscovery[]
    ): Promise<DiscoveryResult>

**Process:**

1. **Load Persona Contexts**

   .. code-block:: typescript

       const personaContexts = await getAllPersonaContexts();
       // Returns: { name, interests[], memory, logs[] }

2. **Build LLM Context**

   * Monitored streams list
   * Current timestamp
   * Recent discoveries (last 3)
   * Persona names + top 3 interests each
   * Task: "Discover ANYTHING interesting"

3. **Call Claude with 19 Analysis Tools**

   .. code-block:: typescript

       const result = await jeevesRateLimit.executeWithRetry(
         async () => generateText({
           model: myProvider.languageModel('claude-sonnet-4-5-20250929'),
           system: [
             {
               type: 'text',
               text: JEEVES_DISCOVERY_PROMPT,
               cacheControl: { type: 'ephemeral' }  // Prompt caching
             },
             {
               type: 'text',
               text: contextMessage
             }
           ],
           tools: streamAnalysisTools,  // 19 tools
           temperature: 0.8,
           maxSteps: 10  // Max 10 tool calls
         }),
         {
           maxRetries: 5,
           estimatedTokens: 5000
         }
       );

4. **Parse AI Response**

   * Expects JSON with ``discoveries`` array
   * Each discovery includes:

     * ``title``, ``category``, ``severity``, ``confidence``
     * ``reasoning``, ``evidence``, ``hypothesis``
     * ``recommendations``
     * ``intendedRecipients[]`` (which personas to notify)

   * Captures ``toolUsageTrail`` for UI display

5. **Fallback Handling**

   * If no JSON found: creates "Analysis Complete" discovery
   * If parse error: creates "Unstructured" discovery
   * Never fails completely

**Tool Usage:**

The engine has access to 19 stream analysis tools (from ``lib/ai/tools/stream-analysis.ts``):

* ``analyzeStreamAnomaliesTool``
* ``correlateTwoStreamsTool``
* ``detectPatternsTool``
* ``calculateStreamStatsTool``
* ``compareTimeWindowsTool``
* ``findPeaksTroughsTool``
* ``analyzeSeasonalityTool``
* ``predictNextValuesTool``
* ``classifyStreamBehaviorTool``
* ``detectChangePointsTool``
* ``measureStreamVolatilityTool``
* ``analyzeFrequencyDomainTool``
* ``compareMultipleStreamsTool``
* ``detectOutliersTool``
* ``analyzeDistributionTool``
* ``calculateMovingAverageTool``
* ``detectTrendDirectionTool``
* ``analyzeDataQualityTool``
* ``summarizeStreamTool``

**Rate Limiting:**

Wrapped in ``jeevesRateLimit.executeWithRetry()`` which:

* Tracks Anthropic API rate limits (150k tokens/min on Tier 2)
* Auto-waits if rate limit hit
* Retries up to 5 times with exponential backoff
* Updates state from response headers

4.2 MQTT Data Ingestion Worker
----------------------------------------------------------------

**File:** ``lib/inngest/functions/fcu-data-ingestion.ts``

**Purpose:** Connects to MQTT broker, extracts FCU data, saves to database

**Schedule:** Cron ``*/5 * * * *`` (every 5 minutes)

**Configuration:**

.. code-block:: typescript

    const MQTT_CONFIG = {
      host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
      port: 8883,
      protocol: 'mqtts' as const,
      username: 'Beringar',
      password: 'Winter2025!',
      topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue'
    };

**Target FCU:** ``fCU-01_04`` (focus on deep analysis of one unit)

**Process:**

1. **Connect to MQTT Broker** (50s timeout)

   .. code-block:: typescript

       const client = mqtt.connect({
         host: MQTT_CONFIG.host,
         port: MQTT_CONFIG.port,
         protocol: MQTT_CONFIG.protocol,
         username: MQTT_CONFIG.username,
         password: MQTT_CONFIG.password,
         clientId: `jeeves-ingestion-${Date.now()}`,
         clean: true,
         keepalive: 60
       });

2. **Subscribe to Topic**

   .. code-block:: typescript

       client.subscribe(MQTT_CONFIG.topic);

3. **Receive Message** (contains all 49 FCUs)

   .. code-block:: typescript

       const rawData = JSON.parse(payload.toString());
       const parsed = parseMQTTMessage(rawData);

4. **Extract FCU-01_04 Data**

   .. code-block:: typescript

       const targetFCU = parsed.fcus.find(f => f.id === TARGET_FCU);

5. **Normalize Field Names**

   .. code-block:: typescript

       function normalizeFieldName(fieldName: string): string {
         return fieldName
           .toLowerCase()
           .replace(/^(nvo|nvi|nci)/, '')  // Remove LonWorks prefixes
           .replace(/[^a-z0-9]/g, '');     // Remove special chars
       }

       // Example: "nvoSpaceTemp" → "spacetemp"
       // Stream ID: "fcu-01_04-spacetemp"

6. **Filter Numeric Values**

   .. code-block:: typescript

       function extractNumericValue(valueStr: any): number | null {
         if (typeof valueStr === 'number') return valueStr;
         if (typeof valueStr !== 'string') return null;

         const match = valueStr.match(/^([\d\.]+|nan)/);
         if (!match) return null;

         const num = parseFloat(match[1]);
         return isNaN(num) ? null : num;
       }

7. **Save to Database**

   .. code-block:: typescript

       for (const [fieldName, fieldValue] of Object.entries(targetFCU.rawData)) {
         const numericValue = extractNumericValue(fieldValue);

         if (numericValue !== null) {
           const streamId = `fcu-01_04-${normalizeFieldName(fieldName)}`;

           await insertTick({
             sensorId: streamId,
             ts: new Date(rawData.timestamp),
             value: numericValue
           });
         }
       }

8. **Save Derived Metrics**

   .. code-block:: typescript

       const derivedMetrics: Array<[string, number | undefined]> = [
         ['parsed-spacetemp', targetFCU.spaceTemp],
         ['parsed-effectsetpoint', targetFCU.effectiveSetpoint],
         ['parsed-usersetpoint', targetFCU.userSetpoint],
         ['parsed-heatoutput', targetFCU.heatOutput],
         ['parsed-cooloutput', targetFCU.coolOutput],
         ['parsed-status', targetFCU.status === 'ok' ? 0 :
                          targetFCU.status === 'fault' ? 1 : 2]
       ];

9. **Deduplication (Optional, requires Redis)**

   .. code-block:: typescript

       if (redis) {
         const lastProcessedTimestamp = await redis.get(REDIS_TIMESTAMP_KEY);

         if (lastProcessedTimestamp === rawData.timestamp) {
           // Skip duplicate
           return;
         }

         // Store this timestamp as processed (10-minute TTL)
         await redis.set(REDIS_TIMESTAMP_KEY, rawData.timestamp, {
           EX: 600
         });
       }

10. **Disconnect**

    .. code-block:: typescript

        client.end();

**Result:**

* Creates 20-30 streams: ``fcu-01_04-spacetemp``, ``fcu-01_04-heatoutput``, etc.
* Data available for Jeeves analysis
* Historical data accumulates until 48h cleanup

4.3 FCU Parser
----------------------------------------------------------------

**File:** ``lib/mqtt/fcu-parser.ts``

**Purpose:** Parse MQTT messages from HVAC FCU system

**LonWorks Field Names:**

The FCU uses LonWorks protocol with specific field naming:

* ``nvo`` prefix = Network Variable Output (from FCU)
* ``nvi`` prefix = Network Variable Input (to FCU)
* ``nci`` prefix = Network Configuration Input

**Example Fields:**

.. code-block:: text

    nvoSpaceTemp    → Space temperature (°C)
    nviSetpoint     → User setpoint (°C)
    nvoEffectSetpt  → Effective setpoint (°C)
    nvoHeatOutput   → Heating valve % (0-100)
    nvoCoolOutput   → Cooling valve % (0-100)
    nvoFanSpeed     → Fan speed (numeric)
    nvoFanSpeed_state → Fan state (text: "Enable", "Disable")
    nvoEffectOccup  → Occupancy (ocOccupied, ocUnoccupied)

**Value Format:**

Values are strings with unit and status:

.. code-block:: text

    "23.2 °C {ok}"
    "45.0 % {ok}"
    "ocOccupied {ok}"
    "nan °C {fault}"

**Parser Function:**

.. code-block:: typescript

    function parseValueString(valueStr: string): {
      value: number | string;
      unit?: string;
      status: string;
    } {
      // Extract status from {...}
      const statusMatch = str.match(/\{([^}]+)\}/);
      const status = statusMatch ? statusMatch[1] : 'unknown';

      // Extract value and unit
      const valueMatch = str.match(/^([^\{]+?)\s*\{/);
      const valuePart = valueMatch[1].trim();

      // Try to parse as number with unit
      const numericMatch = valuePart.match(/^([\d\.]+|nan)\s*([°C%]+)?/);
      if (numericMatch) {
        const numValue = numericMatch[1] === 'nan' ? NaN :
                         parseFloat(numericMatch[1]);
        const unit = numericMatch[2];
        return { value: numValue, unit, status };
      }

      // Non-numeric value
      return { value: valuePart, status };
    }

**FCU Modes:**

The FCU alternates between two reporting modes:

**Detailed Mode (20-30 fields):**

* All sensor readings
* Supply air temperature
* Secondary valve positions
* Advanced diagnostics

**Minimal Mode (7 fields):**

* ``nviSetpoint``
* ``nvoCoolOutput``
* ``nvoEffectOccup``
* ``nvoEffectSetpt``
* ``nvoFanSpeed_state``
* ``nvoHeatOutput``
* ``nvoSpaceTemp``

**Field Name Flexibility:**

The parser recognizes multiple variations:

.. code-block:: typescript

    // Heat output (check multiple possible field names)
    if (keyLower.includes('heatoutput') ||
        keyLower.includes('heatprimary') ||
        keyLower.includes('heating_demand') ||
        key === 'nvoHeatOutput' ||
        key === 'nvoHeatOut') {
      status.heatOutput = parsed.value;
    }

4.4 Jeeves Auto-Scheduler
----------------------------------------------------------------

**File:** ``lib/inngest/functions/jeeves-auto-scheduler.ts``

**Purpose:** Check if Jeeves analysis should run based on schedule

**Schedule:** Cron ``*/5 * * * *`` (checks every 5 minutes)

**Logic:**

.. code-block:: typescript

    export const jeevesAutoScheduler = inngest.createFunction(
      {
        id: 'jeeves-auto-scheduler',
        name: 'Jeeves Auto-Scheduler (Check if analysis needed)',
        retries: 0
      },
      { cron: '*/5 * * * *' },
      async ({ step }) => {
        return await step.run('check-and-trigger-analysis', async () => {
          // Load Jeeves state
          const state = await getJeevesState();

          // Check if enabled
          if (!state || !state.enabled) {
            return { skipped: true, reason: 'Jeeves is disabled' };
          }

          // Check if it's time for analysis
          const now = new Date();
          if (state.nextAnalysisAt && now < state.nextAnalysisAt) {
            return {
              skipped: true,
              reason: `Next analysis at ${state.nextAnalysisAt}`
            };
          }

          // Check if analysis already running
          if (state.lastExecutionStartedAt) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (state.lastExecutionStartedAt > fiveMinutesAgo) {
              return {
                skipped: true,
                reason: 'Analysis already running'
              };
            }
          }

          // Trigger analysis by calling /api/jeeves/analyze
          const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/jeeves/analyze`, {
            method: 'POST'
          });

          const result = await response.json();
          return { triggered: true, result };
        });
      }
    );

**Benefits:**

* Respects ``enabled`` flag
* Honors ``analysisInterval`` setting
* Prevents concurrent executions
* Centralized scheduling logic

4.5 Notification Processor
----------------------------------------------------------------

**File:** ``lib/inngest/functions/process-notifications.ts``

**Purpose:** Background job that generates and saves notifications for a discovery

**Trigger:** Inngest event ``discovery.completed``

**Event Data:**

.. code-block:: typescript

    {
      name: "discovery.completed",
      data: {
        discoveryId: string,
        executionId: string
      }
    }

**Process (with Inngest Step Functions):**

.. code-block:: typescript

    export const processNotifications = inngest.createFunction(
      {
        id: "process-notifications",
        name: "Process Notifications for Discovery"
      },
      { event: "discovery.completed" },
      async ({ event, step }) => {
        const { discoveryId, executionId } = event.data;

        // Step 1: Load discovery
        const discovery = await step.run('load-discovery', async () => {
          return await getDiscoveryById(discoveryId);
        });

        if (!discovery || !discovery.intendedRecipients) {
          return { success: false, reason: 'No recipients' };
        }

        // Step 2: Process each recipient (parallel)
        const results = [];

        for (const recipient of discovery.intendedRecipients) {
          const result = await step.run(
            `notify-${recipient.personaName}`,
            async () => {
              try {
                // Generate persona notification
                const notification = await generatePersonaNotification(
                  discovery,
                  recipient
                );

                // Save to database
                await createNotification({
                  discoveryId: discovery.id,
                  personaName: recipient.personaName,
                  format: notification.format,
                  subject: notification.subject,
                  bodyHtml: notification.bodyHtml,
                  bodyText: notification.bodyText,
                  summaryOneLiner: notification.summaryOneLiner,
                  embedDashboardUrl: notification.dashboardUrl
                });

                return { success: true, personaName: recipient.personaName };
              } catch (error) {
                return { success: false, personaName: recipient.personaName, error };
              }
            }
          );

          results.push(result);
        }

        // Step 3: Mark discovery as notified
        await step.run('mark-notified', async () => {
          await updateDiscoveryStatus(discoveryId, 'notified');
        });

        return { success: true, results };
      }
    );

**Benefits of Step Functions:**

* Each step is individually retried on failure
* Progress is saved between steps
* Can resume from last successful step
* Better error isolation
* Visible in Inngest dashboard

4.6 Telemetry Cleanup Worker
----------------------------------------------------------------

**File:** ``lib/inngest/functions/telemetry-cleanup.ts``

**Purpose:** Automatically delete telemetry data older than 48 hours

**Schedule:** Cron ``0 3 * * *`` (daily at 3:00 AM UTC)

**Configuration:**

.. code-block:: typescript

    const TTL_HOURS = 48;

**Process:**

.. code-block:: typescript

    export const telemetryCleanup = inngest.createFunction(
      {
        id: 'telemetry-cleanup',
        name: 'Telemetry Data Cleanup (48h TTL)',
        retries: 2
      },
      { cron: '0 3 * * *' },
      async ({ step }) => {
        return await step.run('cleanup-old-data', async () => {
          const cutoffDate = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000);

          // Count rows to be deleted
          const ticksToDelete = await db
            .select()
            .from(TelemetryTick)
            .where(lt(TelemetryTick.ts, cutoffDate));

          // Delete old telemetry ticks
          const deletedTicks = await db
            .delete(TelemetryTick)
            .where(lt(TelemetryTick.ts, cutoffDate))
            .returning({ id: TelemetryTick.id });

          // Delete old anomalies
          const deletedAnomalies = await db
            .delete(TelemetryAnomaly)
            .where(lt(TelemetryAnomaly.ts, cutoffDate))
            .returning({ id: TelemetryAnomaly.id });

          // Get remaining data stats
          const remainingTicks = await db
            .select()
            .from(TelemetryTick);

          return {
            status: 'success',
            deletedTicks: deletedTicks.length,
            deletedAnomalies: deletedAnomalies.length,
            remainingTicks: remainingTicks.length,
            cutoffDate: cutoffDate.toISOString(),
            ttlHours: TTL_HOURS
          };
        });
      }
    );

**Database Impact:**

* Prevents database bloat
* Maintains 48 hours of historical data
* Runs during low-traffic hours
* Logged for monitoring

**Storage Estimates:**

* 1 FCU: ~336 rows/hour = 8k rows/day
* With 48h TTL: max ~16k rows steady state
* With cleanup: database size stays at ~1 MB

================================================================
5. API Routes
================================================================

5.1 Jeeves API Endpoints
----------------------------------------------------------------

All Jeeves endpoints are under ``/api/jeeves/*``

**POST /api/jeeves/analyze** (Manual trigger)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Trigger immediate analysis (manual "Analyze Now" button).

**Request:** Empty POST

**Response:**

.. code-block:: json

    {
      "success": true,
      "message": "Analysis started in background",
      "executionId": "uuid",
      "triggeredAt": "2025-10-13T18:45:00Z",
      "note": "Check activity logs for progress"
    }

**Implementation:**

.. code-block:: typescript

    export async function POST(request: Request) {
      const executionId = crypto.randomUUID();

      // Use Next.js 15 after() for background processing
      after(async () => {
        await logActivity(executionId, "info", "🎩 Analysis started");

        // Run discovery
        const discoveries = await runDiscovery(...);

        // Trigger Inngest for notifications
        for (const disc of discoveries) {
          await inngest.send({
            name: "discovery.completed",
            data: { discoveryId: disc.id, executionId }
          });
        }
      });

      return NextResponse.json({
        success: true,
        executionId,
        triggeredAt: new Date().toISOString()
      });
    }

**GET /api/jeeves/state** (Get configuration)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Response:**

.. code-block:: json

    {
      "id": "uuid",
      "enabled": true,
      "analysisInterval": "1hour",
      "monitoredStreams": ["fcu-01_04-spacetemp", "..."],
      "lastAnalysisAt": "2025-10-13T17:00:00Z",
      "nextAnalysisAt": "2025-10-13T18:00:00Z",
      "totalDiscoveries": "42",
      "createdAt": "2025-10-01T00:00:00Z",
      "updatedAt": "2025-10-13T17:00:00Z"
    }

**PATCH /api/jeeves/state** (Update configuration)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Request:**

.. code-block:: json

    {
      "enabled": true,
      "analysisInterval": "1hour",
      "monitoredStreams": [
        "fcu-01_04-spacetemp",
        "fcu-01_04-heatprimary",
        "fcu-01_04-coolprimary"
      ]
    }

**Response:**

.. code-block:: json

    {
      "success": true,
      "message": "Jeeves configuration updated",
      "state": { ...updated state }
    }

**GET /api/jeeves/discoveries** (Get discoveries)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Query Parameters:**

* ``hours`` (default: 24): time range in hours
* ``limit`` (default: 20): max results
* ``status`` (optional): filter by status

**Response:**

.. code-block:: json

    {
      "discoveries": [
        {
          "id": "uuid",
          "discoveredAt": "2025-10-13T18:45:00Z",
          "title": "Half-Degree Setpoint Paradox",
          "category": "hvac_control_anomaly",
          "severity": "high",
          "confidence": "0.95",
          "aiReasoning": "...",
          "aiEvidence": { "toolUsageTrail": [...] },
          "intendedRecipients": [...],
          "status": "notified"
        }
      ],
      "count": 1,
      "hours": 24
    }

**GET /api/jeeves/notifications** (Get notifications)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Query Parameters:**

* ``personaName`` (optional): filter by persona
* ``limit`` (default: 50): max results

**Response:**

.. code-block:: json

    {
      "notifications": [
        {
          "id": "uuid",
          "discoveryId": "uuid",
          "personaName": "Bob-eng",
          "format": "email",
          "subject": "HVAC Alert: Setpoint Paradox Detected",
          "bodyHtml": "<html>...</html>",
          "summaryOneLiner": "User setpoint ignored by FCU",
          "embedDashboardUrl": "/d/abc123",
          "sentAt": "2025-10-13T18:50:00Z",
          "viewedAt": null,
          "acknowledgedAt": null
        }
      ],
      "count": 1
    }

**GET /api/jeeves/activity-logs** (Get execution logs)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Query Parameters:**

* ``executionId`` (optional): filter by execution
* ``limit`` (default: 100): max results

**Response:**

.. code-block:: json

    {
      "logs": [
        {
          "id": "uuid",
          "executionId": "uuid",
          "timestamp": "2025-10-13T18:45:00Z",
          "level": "info",
          "message": "🎩 Analysis started",
          "metadata": {}
        },
        {
          "id": "uuid",
          "executionId": "uuid",
          "timestamp": "2025-10-13T18:45:05Z",
          "level": "info",
          "message": "🔍 Running discovery on 8 streams",
          "metadata": { "streamCount": 8 }
        }
      ],
      "count": 2
    }

**GET /api/jeeves/dashboard-data/[slug]** (Get dashboard)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Purpose:** Used by DiscoveryCard to embed dashboards

**Response:**

.. code-block:: json

    {
      "html": "<div>...</div>",
      "script": "const data = ...",
      "cardId": "v0-card-123"
    }

**Security:**

* Checks if dashboard is revoked or expired
* Public endpoint (no auth required)
* Used with V0Card component (srcDoc, not iframe src)

5.2 MQTT Monitoring Endpoints
----------------------------------------------------------------

**GET /api/mqtt/stream** (SSE streaming)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Purpose:** Server-Sent Events stream for live MQTT data

**Implementation:**

.. code-block:: typescript

    export async function GET(request: Request) {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Connect to MQTT
      const client = mqtt.connect(MQTT_CONFIG);

      client.on('message', async (topic, payload) => {
        const data = JSON.parse(payload.toString());
        const parsed = parseMQTTMessage(data);

        // Send to client via SSE
        await writer.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'message',
              payload: data,
              timestamp: new Date().toISOString()
            })}\n\n`
          )
        );
      });

      // Keep-alive ping every 30s
      const pingInterval = setInterval(async () => {
        await writer.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ type: 'ping' })}\n\n`
          )
        );
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        client.end();
        writer.close();
      });

      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

**Client Usage:**

.. code-block:: typescript

    const eventSource = new EventSource('/api/mqtt/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        const parsed = parseMQTTMessage(data.payload);
        // Update charts
      }
    };

5.3 Telemetry Query Endpoints
----------------------------------------------------------------

**GET /api/telemetry/stream** (Historical data)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Query Parameters:**

* ``streamId``: sensor ID (e.g., "fcu-01_04-spacetemp")
* ``intervalMs`` (default: 5000): polling interval
* ``maxMs`` (default: 25000): max duration

**Response:** SSE stream with historical data points

.. code-block:: text

    data: {"type":"tick","data":{"sensorId":"fcu-01_04-spacetemp","ts":"2025-10-13T18:45:00Z","value":23.2}}

    data: {"type":"tick","data":{"sensorId":"fcu-01_04-spacetemp","ts":"2025-10-13T18:50:00Z","value":23.4}}

================================================================
6. Frontend Components
================================================================

6.1 Jeeves Command Center
----------------------------------------------------------------

**File:** ``app/(chat)/jeeves/page.tsx``

**Purpose:** Main dashboard for Jeeves system

**Server-Side Data Loading:**

.. code-block:: typescript

    export default async function JeevesPage() {
      const [state, discoveries, notifications, personas] = await Promise.all([
        ensureJeevesState(),
        getRecentDiscoveries(24, 20),
        getAllNotifications(50),
        loadPersonas()
      ]);

      return (
        <div className="container">
          <StatusPanel state={state} />
          <SettingsPanel state={state} />
          <ActivityLog />
          <PersonaCards personas={personas} notifications={notifications} />
          <RecentDiscoveries discoveries={discoveries} />
        </div>
      );
    }

**Auto-Refresh:**

.. code-block:: typescript

    export const revalidate = 30; // Revalidate every 30 seconds

**Sections:**

1. **Status Panel** - Current state (enabled, interval, last run)
2. **Settings Panel** - Configuration + "Analyze Now" button
3. **Activity Log** - Real-time execution logs (auto-refresh 5s)
4. **Persona Cards** - Team members with unread notification counts
5. **Recent Discoveries** - Discovery cards with embedded dashboards

6.2 Discovery Card
----------------------------------------------------------------

**File:** ``components/jeeves/discovery-card.tsx``

**Purpose:** Display individual discovery with embedded dashboard

**Key Features:**

1. **Metadata Display**

   * Title, category, severity badge (color-coded)
   * Confidence percentage
   * Discovery timestamp

2. **Analysis Trail** (Tool Usage)

   .. code-block:: tsx

       {discovery.aiEvidence?.toolUsageTrail && (
         <Collapsible>
           <CollapsibleTrigger>
             View Analysis Trail ({toolCount} tools used)
           </CollapsibleTrigger>
           <CollapsibleContent>
             {toolUsageTrail.map((tool, idx) => (
               <Card key={idx}>
                 <CardHeader>
                   <CardTitle>{tool.name}</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <pre>{JSON.stringify(tool.result, null, 2)}</pre>
                 </CardContent>
               </Card>
             ))}
           </CollapsibleContent>
         </Collapsible>
       )}

3. **Dashboard Embedding**

   .. code-block:: tsx

       useEffect(() => {
         if (discovery.dashboardSlug) {
           fetch(`/api/jeeves/dashboard-data/${discovery.dashboardSlug}`)
             .then(res => res.json())
             .then(data => setDashboardData(data));
         }
       }, [discovery.dashboardSlug]);

       {dashboardData && (
         <>
           <V0Card
             id={dashboardData.cardId}
             html={dashboardData.html}
           />
           <V0CardScriptRunner
             cardId={dashboardData.cardId}
             script={dashboardData.script}
           />
         </>
       )}

4. **Recipients Display**

   * Lists notified personas
   * Shows format (email/slack/dashboard)
   * Links to persona notifications

6.3 MQTT Live Charts
----------------------------------------------------------------

**File:** ``components/mqtt/mqtt-live-charts.tsx``

**Purpose:** Real-time visualization of MQTT data

**Data Structure:**

.. code-block:: typescript

    interface TimeSeriesDataPoint {
      timestamp: string;
      time: number;  // Unix timestamp
      avgTemp: number;
      minTemp: number;
      maxTemp: number;
      avgSetpoint: number;
      avgHeatOutput: number;
      avgCoolOutput: number;
      totalHeating: number;  // Count of units heating
      totalCooling: number;  // Count of units cooling
      faultCount: number;
      totalFCUs: number;
    }

**Connection:**

.. code-block:: typescript

    useEffect(() => {
      const eventSource = new EventSource('/api/mqtt/stream');

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
          const parsed = parseMQTTMessage(data.payload);

          // Calculate aggregated metrics
          const temps = parsed.fcus.map(f => f.spaceTemp).filter(Boolean);
          const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

          // Use ORIGINAL data timestamp (from FCU)
          const originalTimestamp = parsed.timestamp || data.timestamp;

          const dataPoint: TimeSeriesDataPoint = {
            timestamp: new Date(originalTimestamp).toLocaleTimeString(),
            time: new Date(originalTimestamp).getTime(),
            avgTemp: Number(avgTemp.toFixed(1)),
            // ...
          };

          // Add to historical data (keep last 100 points)
          setHistoricalData(prev => {
            const updated = [...prev, dataPoint];
            return updated.slice(-MAX_DATA_POINTS);
          });
        }
      };

      return () => eventSource.close();
    }, []);

**Charts:**

1. **Temperature Trends**

   * Average, min, max temperatures
   * Average setpoint
   * Line chart with Recharts

2. **Heating & Cooling Output**

   * Average heat output %
   * Average cool output %
   * Line chart

3. **Active Units**

   * Units heating count
   * Units cooling count
   * Fault count
   * Line chart

**Features:**

* Pause/Resume streaming
* Clear history
* Auto-reconnect on disconnect
* Status indicator (connected/connecting/error)

6.4 Settings Panel
----------------------------------------------------------------

**File:** ``components/jeeves/settings-panel.tsx``

**Purpose:** Configure Jeeves and trigger manual analysis

**Controls:**

1. **Enable/Disable Toggle**

   .. code-block:: tsx

       <Switch
         checked={enabled}
         onCheckedChange={setEnabled}
       />

2. **Analysis Interval Select**

   .. code-block:: tsx

       <Select value={interval} onValueChange={setInterval}>
         <SelectItem value="1hour">Every Hour</SelectItem>
         <SelectItem value="3hour">Every 3 Hours</SelectItem>
         <SelectItem value="6hour">Every 6 Hours</SelectItem>
         <SelectItem value="24hour">Daily</SelectItem>
       </Select>

3. **Save Settings Button**

   .. code-block:: tsx

       const handleSave = async () => {
         const response = await fetch('/api/jeeves/state', {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             enabled,
             analysisInterval: interval,
             monitoredStreams
           })
         });

         if (response.ok) {
           toast({ title: 'Settings saved' });
           router.refresh();
         }
       };

4. **Analyze Now Button**

   .. code-block:: tsx

       const handleAnalyzeNow = async () => {
         setIsAnalyzing(true);

         const response = await fetch('/api/jeeves/analyze', {
           method: 'POST'
         });

         const result = await response.json();

         toast({
           title: result.success ? 'Analysis Started' : 'Error',
           description: result.message
         });

         router.refresh();
         setIsAnalyzing(false);
       };

6.5 Activity Log
----------------------------------------------------------------

**File:** ``components/jeeves/activity-log.tsx``

**Purpose:** Real-time execution progress display

**Features:**

* Fetches ``/api/jeeves/activity-logs``
* Auto-refreshes every 5 seconds when expanded
* Color-coded badges (info/success/warning/error)
* Timestamp display (locale-specific)
* Expandable/collapsible

**Implementation:**

.. code-block:: typescript

    const [logs, setLogs] = useState<JeevesActivityLog[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const fetchLogs = async () => {
      const response = await fetch('/api/jeeves/activity-logs?limit=50');
      const data = await response.json();
      setLogs(data.logs);
    };

    useEffect(() => {
      fetchLogs();

      // Auto-refresh when expanded
      const interval = isExpanded ? setInterval(fetchLogs, 5000) : null;

      return () => {
        if (interval) clearInterval(interval);
      };
    }, [isExpanded]);

**Display:**

.. code-block:: tsx

    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger>
        Activity Log ({logs.length} entries)
      </CollapsibleTrigger>
      <CollapsibleContent>
        {logs.map(log => (
          <div key={log.id}>
            <Badge variant={log.level}>{log.level}</Badge>
            <span>{log.message}</span>
            <span>{new Date(log.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>

================================================================
7. Configuration & Setup
================================================================

7.1 Environment Variables
----------------------------------------------------------------

**Required Variables:**

.. code-block:: bash

    # Database
    POSTGRES_URL=postgresql://user:pass@host/db

    # AI Provider
    ANTHROPIC_API_KEY=sk-ant-...

    # Application URL
    NEXT_PUBLIC_URL=https://your-app.vercel.app

    # Authentication
    AUTH_SECRET=<generate-with-openssl-rand-base64-32>

    # Inngest (Auto-set by Vercel integration)
    INNGEST_SIGNING_KEY=signkey-...
    INNGEST_EVENT_KEY=...

**Optional Variables:**

.. code-block:: bash

    # Redis (for deduplication)
    REDIS_REDIS_URL=redis://...

    # Email (future feature)
    RESEND_API_KEY=re_...

    # MQTT (if not using hardcoded values)
    MQTT_HOST=broker.hivemq.cloud
    MQTT_PORT=8883
    MQTT_USERNAME=...
    MQTT_PASSWORD=...
    MQTT_TOPIC=dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue

7.2 Database Setup
----------------------------------------------------------------

**Run Migrations:**

.. code-block:: bash

    pnpm db:migrate

**Manual Migration (if needed):**

.. code-block:: sql

    -- Jeeves tables
    psql $POSTGRES_URL < lib/db/migrations/012_jeeves_activity_log.sql

**Initialize Jeeves State:**

The state is automatically initialized on first access via ``ensureJeevesState()``:

.. code-block:: typescript

    // Default configuration
    {
      enabled: false,
      analysisInterval: "1hour",
      monitoredStreams: [
        "fcu-01_04-spacetemp",
        "fcu-01_04-supplytemp",
        "fcu-01_04-effectsetpt",
        "fcu-01_04-heatprimary",
        "fcu-01_04-coolprimary",
        "fcu-01_04-fanspeed",
        "fcu-01_04-occup",
        "fcu-01_04-parsed-spacetemp",
        "fcu-01_04-parsed-heatoutput",
        "fcu-01_04-parsed-cooloutput",
        "fcu-01_04-parsed-status"
      ]
    }

**Verify Streams:**

.. code-block:: sql

    SELECT DISTINCT "sensorId", COUNT(*) as data_points
    FROM "TelemetryTick"
    WHERE "sensorId" LIKE 'fcu-01_04-%'
      AND "ts" > NOW() - INTERVAL '1 hour'
    GROUP BY "sensorId"
    ORDER BY "sensorId";

Expected output:

.. code-block:: text

    fcu-01_04-coolprimary       | 12
    fcu-01_04-effectsetpt       | 12
    fcu-01_04-fanspeed          | 12
    fcu-01_04-heatprimary       | 12
    fcu-01_04-parsed-spacetemp  | 12
    fcu-01_04-spacetemp         | 12
    ... (20-30 total streams)

7.3 Inngest Setup
----------------------------------------------------------------

**Option 1: Vercel Integration (Recommended)**

1. Visit: https://vercel.com/integrations/inngest
2. Click "Add Integration"
3. Select your Vercel project
4. Environment variables auto-configured
5. Deploy to Vercel
6. Functions appear in Inngest dashboard

**Option 2: Manual Setup**

1. Create account at https://app.inngest.com
2. Create app in Inngest dashboard
3. Get signing key and event key
4. Add to ``.env.local``:

   .. code-block:: bash

       INNGEST_SIGNING_KEY=signkey-...
       INNGEST_EVENT_KEY=...

5. Deploy application
6. Register webhook URL in Inngest:

   .. code-block:: text

       https://your-app.vercel.app/api/inngest

**Verify Setup:**

1. Check functions are registered:

   Visit: https://app.inngest.com → Functions

   Should see:

   * ``fcu-data-ingestion``
   * ``jeeves-auto-scheduler``
   * ``process-notifications``
   * ``telemetry-cleanup``

2. Check function runs:

   Visit: https://app.inngest.com → Runs

   Should see recent executions

7.4 MQTT Configuration
----------------------------------------------------------------

**Current Setup (HiveMQ Cloud):**

The system is configured for HiveMQ Cloud broker:

.. code-block:: typescript

    const MQTT_CONFIG = {
      host: '4ce6f772ed4c4e8f811eb35e20cedc91.s1.eu.hivemq.cloud',
      port: 8883,
      protocol: 'mqtts',
      username: 'Beringar',
      password: 'Winter2025!',
      topic: 'dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue'
    };

**To Change MQTT Broker:**

1. Update ``lib/inngest/functions/fcu-data-ingestion.ts``
2. Update ``app/api/mqtt/stream/route.ts``
3. Redeploy application

**Test MQTT Connection Locally:**

.. code-block:: bash

    # Install dependencies
    pip install paho-mqtt

    # Run monitor
    python scripts/mqtt-monitor.py

Should see:

.. code-block:: text

    ✅ Connected to MQTT broker
    📡 Subscribed to: dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue

    📩 Message #1 received at 19:47:23
       📅 Data timestamp: 2025-10-13T16:27:24.075Z
       🌡️  FCU-01_04 VALUES:
          Space Temp:     23.2 °C {ok}
          Setpoint:       22.0 °C {ok}

================================================================
8. Development Guide
================================================================

8.1 Local Development
----------------------------------------------------------------

**Prerequisites:**

* Node.js 18+
* pnpm 9.12+
* Postgres database (local or Vercel)
* Python 3.9+ (for MQTT monitor)

**Setup Steps:**

1. **Clone repository**

   .. code-block:: bash

       git clone <repository-url>
       cd jeeves

2. **Install dependencies**

   .. code-block:: bash

       pnpm install

3. **Configure environment**

   .. code-block:: bash

       cp .env.example .env.local
       # Edit .env.local with your values

4. **Run migrations**

   .. code-block:: bash

       pnpm db:migrate

5. **Start development server**

   .. code-block:: bash

       pnpm dev

6. **Access application**

   * Web UI: http://localhost:3000
   * Inngest Dev Server: http://localhost:3000/api/inngest
   * Jeeves: http://localhost:3000/jeeves
   * MQTT Monitor: http://localhost:3000/mqtt-monitor

**Development Workflow:**

1. Make code changes
2. Hot reload happens automatically
3. Test changes in browser
4. Check logs in terminal
5. Commit changes

8.2 Testing
----------------------------------------------------------------

**Manual Testing:**

1. **Enable Jeeves**

   * Go to ``/jeeves`` page
   * Toggle "Enable Jeeves" ON
   * Set interval to "1hour"
   * Click "Save Settings"

2. **Trigger Analysis**

   * Click "🔍 Analyze Now"
   * Watch Activity Log populate
   * Check browser console for errors
   * Verify discoveries appear

3. **View Discovery**

   * Click on discovery card
   * Dashboard should embed correctly
   * Analysis trail should expand
   * Recipients list should show

4. **Check Notifications**

   * Go to notification feed
   * Verify persona names correct
   * Check HTML/text content
   * Dashboard URL should work

**API Testing:**

.. code-block:: bash

    # Get Jeeves state
    curl http://localhost:3000/api/jeeves/state

    # Trigger analysis
    curl -X POST http://localhost:3000/api/jeeves/analyze

    # Get discoveries
    curl http://localhost:3000/api/jeeves/discoveries?hours=24

    # Get notifications
    curl http://localhost:3000/api/jeeves/notifications?limit=50

    # Update settings
    curl -X PATCH http://localhost:3000/api/jeeves/state \
      -H "Content-Type: application/json" \
      -d '{"enabled": true, "analysisInterval": "1hour"}'

**Database Testing:**

.. code-block:: sql

    -- Check Jeeves state
    SELECT * FROM "JeevesState";

    -- Check recent discoveries
    SELECT id, title, severity, "discoveredAt", status
    FROM "JeevesDiscovery"
    ORDER BY "discoveredAt" DESC
    LIMIT 10;

    -- Check telemetry data
    SELECT "sensorId", COUNT(*) as points,
           MIN(ts) as first_point, MAX(ts) as last_point
    FROM "TelemetryTick"
    WHERE "ts" > NOW() - INTERVAL '1 hour'
    GROUP BY "sensorId"
    ORDER BY "sensorId";

    -- Check activity logs
    SELECT "executionId", level, message, timestamp
    FROM "JeevesActivityLog"
    ORDER BY timestamp DESC
    LIMIT 20;

8.3 Adding New Analysis Tools
----------------------------------------------------------------

**Step 1: Define Tool in** ``lib/ai/tools/stream-analysis.ts``

.. code-block:: typescript

    export const myNewAnalysisTool = tool({
      description: "Analyze XYZ pattern in stream data",
      parameters: z.object({
        streamId: z.string().describe("Stream ID to analyze"),
        windowHours: z.number().optional().describe("Time window in hours")
      }),
      execute: async ({ streamId, windowHours = 24 }) => {
        // 1. Query data from database
        const data = await getTicksInWindow({
          sensorId: streamId,
          from: new Date(Date.now() - windowHours * 60 * 60 * 1000),
          to: new Date()
        });

        // 2. Perform analysis
        const result = analyzeXYZ(data);

        // 3. Return result (will be passed to LLM)
        return {
          streamId,
          windowHours,
          analysisType: "XYZ pattern detection",
          result: result,
          dataPoints: data.length
        };
      }
    });

**Step 2: Add to Tool Collection**

.. code-block:: typescript

    export const streamAnalysisTools = {
      // ... existing tools
      myNewAnalysisTool
    };

**Step 3: Update Discovery Engine**

No changes needed! The discovery engine automatically has access to all tools in ``streamAnalysisTools``.

**Step 4: Test**

1. Trigger manual analysis
2. Check activity log for tool usage
3. Verify tool appears in discovery's ``toolUsageTrail``

8.4 Adding New Inngest Workers
----------------------------------------------------------------

**Step 1: Create Worker File**

Create ``lib/inngest/functions/my-worker.ts``:

.. code-block:: typescript

    import { inngest } from "@/lib/inngest/client";

    export const myWorker = inngest.createFunction(
      {
        id: 'my-worker',
        name: 'My Background Worker',
        retries: 2
      },
      { cron: '0 * * * *' },  // Every hour
      async ({ step }) => {
        return await step.run('do-work', async () => {
          // Your logic here
          console.log('[My Worker] Running...');

          // Return result
          return {
            status: 'success',
            timestamp: new Date().toISOString()
          };
        });
      }
    );

**Step 2: Register Worker**

Update ``app/api/inngest/route.ts``:

.. code-block:: typescript

    import { myWorker } from "@/lib/inngest/functions/my-worker";

    export const { GET, POST, PUT } = serve({
      client: inngest,
      functions: [
        // ... existing functions
        myWorker
      ]
    });

**Step 3: Deploy and Verify**

1. Deploy to Vercel
2. Check Inngest dashboard
3. Verify function appears
4. Check for scheduled runs

================================================================
9. Deployment
================================================================

9.1 Vercel Deployment
----------------------------------------------------------------

**Prerequisites:**

* Vercel account
* GitHub repository connected
* Environment variables configured

**Deployment Steps:**

1. **Connect Repository**

   * Visit: https://vercel.com/new
   * Import Git repository
   * Select framework: Next.js

2. **Configure Environment Variables**

   In Vercel dashboard:

   .. code-block:: bash

       POSTGRES_URL=<from-vercel-postgres>
       ANTHROPIC_API_KEY=<your-key>
       NEXT_PUBLIC_URL=https://<your-app>.vercel.app
       AUTH_SECRET=<generate-with-openssl>
       INNGEST_SIGNING_KEY=<from-vercel-integration>
       INNGEST_EVENT_KEY=<from-vercel-integration>
       REDIS_REDIS_URL=<optional>

3. **Deploy**

   .. code-block:: bash

       vercel --prod

4. **Set up Inngest Integration**

   * Visit: https://vercel.com/integrations/inngest
   * Click "Add Integration"
   * Select project
   * Environment variables auto-configured

5. **Verify Deployment**

   * Visit: https://your-app.vercel.app
   * Check: https://your-app.vercel.app/jeeves
   * Check Inngest dashboard for functions

**Vercel Configuration:**

``vercel.json``:

.. code-block:: json

    {
      "functions": {
        "app/api/jeeves/analyze/route.ts": {
          "maxDuration": 300
        }
      }
    }

9.2 Database Migration
----------------------------------------------------------------

**Automatic Migration (Recommended):**

Migrations run automatically on build:

.. code-block:: json

    {
      "scripts": {
        "build": "tsx lib/db/migrate && next build"
      }
    }

**Manual Migration:**

.. code-block:: bash

    # Connect to production database
    vercel env pull

    # Run migrations
    pnpm db:migrate

**Verify Migration:**

.. code-block:: sql

    -- Check tables exist
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;

    -- Should include:
    -- - TelemetryTick
    -- - TelemetryAnomaly
    -- - JeevesState
    -- - JeevesDiscovery
    -- - JeevesNotification
    -- - JeevesActivityLog
    -- - JeevesLearning

9.3 Monitoring & Logging
----------------------------------------------------------------

**Vercel Logs:**

.. code-block:: bash

    # Real-time logs
    vercel logs --follow

    # Filter by function
    vercel logs --follow --filter="api/jeeves"

**Inngest Dashboard:**

* Visit: https://app.inngest.com
* View function runs
* Check for errors
* Monitor execution times
* Retry failed jobs

**Database Monitoring:**

.. code-block:: sql

    -- Check data ingestion
    SELECT COUNT(*) as total_points,
           MIN(ts) as oldest,
           MAX(ts) as newest
    FROM "TelemetryTick";

    -- Check stream count
    SELECT COUNT(DISTINCT "sensorId") as stream_count
    FROM "TelemetryTick"
    WHERE ts > NOW() - INTERVAL '1 hour';

    -- Check Jeeves activity
    SELECT COUNT(*) as total_discoveries,
           COUNT(CASE WHEN status = 'new' THEN 1 END) as new,
           COUNT(CASE WHEN status = 'notified' THEN 1 END) as notified
    FROM "JeevesDiscovery";

**Activity Log Monitoring:**

* Visit: ``/jeeves`` page
* Expand "Activity Log"
* Check for errors (red badges)
* Monitor analysis progress

================================================================
10. Troubleshooting
================================================================

10.1 Common Issues
----------------------------------------------------------------

**Issue: "Analyze Now" Does Nothing**

**Symptoms:**

* Button clicks but nothing happens
* No activity logs appear
* No errors in console

**Solutions:**

1. Check browser console for errors
2. Verify ``/api/jeeves/analyze`` endpoint returns 200
3. Check Vercel logs for backend errors:

   .. code-block:: bash

       vercel logs --follow --filter="api/jeeves/analyze"

4. Verify Jeeves is enabled in database:

   .. code-block:: sql

       SELECT enabled FROM "JeevesState";

5. Check for import order issues in ``discovery-engine.ts``

**Issue: No MQTT Data in Database**

**Symptoms:**

* ``SELECT * FROM "TelemetryTick" WHERE "sensorId" LIKE 'fcu-01_04-%'`` returns 0 rows
* MQTT monitor shows data locally but database empty

**Solutions:**

1. Check Inngest worker is registered:

   .. code-block:: bash

       grep "fcuDataIngestion" app/api/inngest/route.ts

2. Check Inngest dashboard for errors
3. Verify MQTT credentials are correct
4. Check if FCU-01_04 exists in MQTT messages:

   .. code-block:: bash

       python scripts/mqtt-monitor.py

5. Check Vercel logs for ingestion worker:

   .. code-block:: bash

       vercel logs --follow --filter="FCU Ingestion"

**Issue: Rate Limit Errors**

**Symptoms:**

.. code-block:: text

    Error: This request would exceed the rate limit
    anthropic-ratelimit-input-tokens-remaining: 0

**Solutions:**

1. Wait 60 seconds for rate limit reset
2. Check current tier (Tier 2 = 150k tokens/min)
3. Rate limit handler should auto-retry:

   .. code-block:: typescript

       await jeevesRateLimit.executeWithRetry(
         async () => generateText(...),
         { maxRetries: 5, estimatedTokens: 5000 }
       );

4. Monitor rate limit status:

   .. code-block:: typescript

       console.log(jeevesRateLimit.getStatus());

**Issue: Dashboard Won't Embed**

**Symptoms:**

* Dashboard shows blank
* 401/403 errors in console
* X-Frame-Options errors

**Solutions:**

1. Check if ``dashboardSlug`` exists in database:

   .. code-block:: sql

       SELECT "dashboardSlug" FROM "JeevesDiscovery" WHERE id = '<uuid>';

2. Verify ``/api/jeeves/dashboard-data/[slug]`` returns data:

   .. code-block:: bash

       curl https://your-app.vercel.app/api/jeeves/dashboard-data/<slug>

3. Check V0Card component is rendering:

   .. code-block:: typescript

       console.log('[DiscoveryCard] Dashboard data:', dashboardData);

4. Verify middleware excludes ``/d/`` routes:

   .. code-block:: typescript

       export const config = {
         matcher: [
           "/((?!_next/static|_next/image|favicon.ico|d/).*)"
         ]
       };

**Issue: Inngest Functions Not Running**

**Symptoms:**

* No function runs in Inngest dashboard
* No data being ingested
* No auto-scheduled analysis

**Solutions:**

1. Verify Inngest integration is installed
2. Check environment variables are set:

   .. code-block:: bash

       vercel env ls
       # Should include INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY

3. Re-sync functions:

   * Visit: https://app.inngest.com
   * Go to Functions tab
   * Click "Sync"

4. Check webhook URL is correct:

   .. code-block:: text

       https://your-app.vercel.app/api/inngest

5. Test endpoint manually:

   .. code-block:: bash

       curl https://your-app.vercel.app/api/inngest

10.2 Debug Mode
----------------------------------------------------------------

**Enable Verbose Logging:**

Add to ``lib/jeeves/discovery-engine.ts``:

.. code-block:: typescript

    const DEBUG = process.env.DEBUG === 'true';

    if (DEBUG) {
      console.log('[Discovery Engine] Input:', {
        monitoredStreams,
        recentDiscoveries,
        personaContexts
      });
    }

Set environment variable:

.. code-block:: bash

    DEBUG=true vercel --prod

**Check Inngest Execution Details:**

1. Visit: https://app.inngest.com
2. Go to "Runs" tab
3. Click on specific run
4. View step-by-step execution
5. Check input/output for each step

**Monitor Database Queries:**

Enable Drizzle logging:

.. code-block:: typescript

    import { drizzle } from 'drizzle-orm/vercel-postgres';

    export const db = drizzle(sql, {
      logger: true  // Log all queries
    });

================================================================
11. Performance & Optimization
================================================================

11.1 Token Optimization
----------------------------------------------------------------

**Current Usage (per analysis):**

* System prompt: ~800 tokens
* User message: ~500 tokens
* Tools (19): ~2,850 tokens
* Tool calls: ~2,000-5,000 tokens (variable)
* **Total estimate: 5,000-10,000 tokens per request**

**Optimizations Applied:**

1. **Prompt Caching**

   .. code-block:: typescript

       system: [
         {
           type: 'text',
           text: JEEVES_DISCOVERY_PROMPT,
           cacheControl: { type: 'ephemeral' }  // Cache system prompt
         }
       ]

   * Saves 90%+ on subsequent requests
   * Cache lifetime: 5 minutes
   * Automatically managed by Anthropic

2. **Reduced Persona Context**

   * Was: Full memory + logs + behavior for each
   * Now: Just names + top 3 interests
   * Savings: ~2,000 tokens

3. **Reduced Discovery History**

   * Was: 10 recent discoveries
   * Now: 3 recent discoveries
   * Savings: ~1,500 tokens

4. **Compact Prompt Format**

   * Single-line persona list
   * No JSON formatting overhead
   * Savings: ~500 tokens

**Total Savings: ~5,500 tokens (52% reduction)**

**Rate Limit Impact (Tier 2: 150k tokens/min):**

* Can handle ~30 discovery requests per minute
* ~300 persona notifications per minute
* Sufficient for normal operation

11.2 Database Optimization
----------------------------------------------------------------

**Indexes:**

.. code-block:: sql

    -- Activity log indexes
    CREATE INDEX idx_jeeves_activity_executionId
      ON "JeevesActivityLog"("executionId");

    CREATE INDEX idx_jeeves_activity_timestamp
      ON "JeevesActivityLog"(timestamp DESC);

    -- Telemetry indexes (recommended)
    CREATE INDEX idx_telemetry_sensorid_ts
      ON "TelemetryTick"("sensorId", ts DESC);

    CREATE INDEX idx_telemetry_ts
      ON "TelemetryTick"(ts DESC);

**Query Optimization:**

.. code-block:: typescript

    // Instead of loading all data then filtering in JS:
    const allData = await db.select().from(TelemetryTick);
    const filtered = allData.filter(d => d.sensorId === 'fcu-01_04-spacetemp');

    // Use database filtering:
    const filtered = await db
      .select()
      .from(TelemetryTick)
      .where(eq(TelemetryTick.sensorId, 'fcu-01_04-spacetemp'));

**Data Retention:**

* 48-hour TTL prevents database bloat
* Cleanup runs daily at 3 AM UTC
* Maintains ~16k rows steady state (1 FCU)
* Database size: ~1-2 MB

11.3 Caching Strategy
----------------------------------------------------------------

**Server Component Caching:**

.. code-block:: typescript

    // Jeeves page revalidates every 30 seconds
    export const revalidate = 30;

**Redis Caching (Optional):**

.. code-block:: typescript

    // Cache persona contexts (expensive to load)
    const cacheKey = `persona:${personaName}:context`;

    let context = await redis.get(cacheKey);
    if (!context) {
      context = await loadPersonaContext(personaName);
      await redis.set(cacheKey, JSON.stringify(context), {
        EX: 300  // 5-minute TTL
      });
    }

**SSE Connection Pooling:**

* Reuse MQTT connection across SSE clients
* Single MQTT subscription for multiple viewers
* Broadcast to all connected clients

================================================================
12. Security Considerations
================================================================

12.1 Authentication
----------------------------------------------------------------

**NextAuth.js Configuration:**

* User authentication required for chat interface
* Public access for dashboards (``/d/[slug]``)
* Middleware excludes public routes

**Middleware:**

.. code-block:: typescript

    // middleware.ts
    export const config = {
      matcher: [
        "/((?!_next/static|_next/image|favicon.ico|d/).*)"
      ]
    };

12.2 Dashboard Security
----------------------------------------------------------------

**Published Dashboards:**

* Unique access tokens (UUID)
* Optional password protection
* Expiration dates
* Max view limits
* Revocation support

**Access Control:**

.. code-block:: typescript

    // Check if dashboard is accessible
    if (dashboard.status === 'revoked') {
      return { error: 'Dashboard has been revoked' };
    }

    if (dashboard.expiresAt && new Date() > dashboard.expiresAt) {
      return { error: 'Dashboard has expired' };
    }

    if (dashboard.maxViews &&
        parseInt(dashboard.currentViews) >= parseInt(dashboard.maxViews)) {
      return { error: 'View limit reached' };
    }

12.3 API Security
----------------------------------------------------------------

**Rate Limiting:**

* Anthropic API rate limit tracking
* Automatic retry with backoff
* Prevents abuse

**Input Validation:**

.. code-block:: typescript

    // Validate request parameters
    const schema = z.object({
      enabled: z.boolean().optional(),
      analysisInterval: z.enum(['1hour', '3hour', '6hour', '24hour']).optional(),
      monitoredStreams: z.array(z.string()).optional()
    });

    const validated = schema.parse(await request.json());

**Environment Variables:**

* Sensitive credentials in environment variables
* Never committed to version control
* Secured in Vercel dashboard

================================================================
13. Appendix
================================================================

13.1 Glossary
----------------------------------------------------------------

**Terms:**

* **FCU** - Fan Coil Unit (HVAC component)
* **LonWorks** - Protocol for building automation
* **SSE** - Server-Sent Events (real-time streaming)
* **Inngest** - Background job orchestration platform
* **Drizzle ORM** - TypeScript ORM for SQL databases
* **RSC** - React Server Components
* **TTL** - Time To Live (data retention period)

**Field Name Prefixes:**

* ``nvo`` - Network Variable Output (from FCU)
* ``nvi`` - Network Variable Input (to FCU)
* ``nci`` - Network Configuration Input

**Stream Naming:**

* ``fcu-01_04-spacetemp`` - Raw LonWorks field
* ``fcu-01_04-parsed-spacetemp`` - Derived metric

13.2 File Locations Quick Reference
----------------------------------------------------------------

**Core Logic:**

* Discovery Engine: ``lib/jeeves/discovery-engine.ts``
* FCU Parser: ``lib/mqtt/fcu-parser.ts``
* Rate Limiter: ``lib/jeeves/rate-limit-handler.ts``

**Workers:**

* MQTT Ingestion: ``lib/inngest/functions/fcu-data-ingestion.ts``
* Auto Scheduler: ``lib/inngest/functions/jeeves-auto-scheduler.ts``
* Notifications: ``lib/inngest/functions/process-notifications.ts``
* Cleanup: ``lib/inngest/functions/telemetry-cleanup.ts``

**API Routes:**

* Analyze: ``app/api/jeeves/analyze/route.ts``
* State: ``app/api/jeeves/state/route.ts``
* Discoveries: ``app/api/jeeves/discoveries/route.ts``
* MQTT Stream: ``app/api/mqtt/stream/route.ts``

**UI Components:**

* Jeeves Page: ``app/(chat)/jeeves/page.tsx``
* Discovery Card: ``components/jeeves/discovery-card.tsx``
* MQTT Charts: ``components/mqtt/mqtt-live-charts.tsx``
* Settings Panel: ``components/jeeves/settings-panel.tsx``

**Database:**

* Schema: ``lib/db/schema.ts``
* Queries: ``lib/db/jeeves-queries.ts``
* Telemetry: ``lib/db/telemetry-ops.ts``

**Scripts:**

* MQTT Monitor: ``scripts/mqtt-monitor.py``
* Requirements: ``scripts/requirements.txt``

13.3 Useful SQL Queries
----------------------------------------------------------------

**Check Data Freshness:**

.. code-block:: sql

    SELECT "sensorId",
           MAX(ts) as last_data_point,
           EXTRACT(EPOCH FROM (NOW() - MAX(ts)))/60 as minutes_ago
    FROM "TelemetryTick"
    WHERE "sensorId" LIKE 'fcu-01_04-%'
    GROUP BY "sensorId"
    ORDER BY minutes_ago;

**Find Recent Discoveries:**

.. code-block:: sql

    SELECT title, severity, confidence, "discoveredAt", status
    FROM "JeevesDiscovery"
    WHERE "discoveredAt" > NOW() - INTERVAL '24 hours'
    ORDER BY "discoveredAt" DESC;

**Check Notification Status:**

.. code-block:: sql

    SELECT n."personaName",
           COUNT(*) as total,
           COUNT(n."viewedAt") as viewed,
           COUNT(n."acknowledgedAt") as acknowledged
    FROM "JeevesNotification" n
    WHERE n."sentAt" > NOW() - INTERVAL '7 days'
    GROUP BY n."personaName";

**Analyze Data Volume:**

.. code-block:: sql

    SELECT DATE_TRUNC('hour', ts) as hour,
           COUNT(*) as data_points
    FROM "TelemetryTick"
    WHERE ts > NOW() - INTERVAL '24 hours'
    GROUP BY hour
    ORDER BY hour DESC;

================================================================
End of Developer Manual
================================================================

For questions or issues:

* Check Activity Log in UI
* Review Vercel logs
* Check Inngest dashboard
* Consult this manual

**Last Updated:** 2025-10-13
**Version:** 2.0
**Status:** Production Ready
