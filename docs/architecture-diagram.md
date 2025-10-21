# Intelligent Building Analytics Platform - System Architecture

## Complete System Architecture Diagram

```mermaid
flowchart TB
    %% Physical Layer
    subgraph Physical["Physical Layer - Building HVAC"]
        FCUs["49 Fan Coil Units (FCUs)<br/>LonWorks Protocol<br/>Sensors: Temp, Setpoint, Heat, Cool, Fan"]
    end

    %% MQTT Broker
    subgraph MQTT["HiveMQ Cloud MQTT Broker"]
        Broker["MQTT Broker (Port 8883)<br/>Topic: dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue<br/>Frequency: ~5 minutes<br/>TLS Encryption"]
    end

    %% Data Ingestion
    subgraph Ingestion["Inngest Background Worker"]
        FCUWorker["fcu-data-ingestion.ts<br/>Cron: */5 * * * *<br/>• Connect to MQTT<br/>• Parse 49 FCU messages<br/>• Extract FCU-201 data<br/>• Normalize field names<br/>• Filter numeric values<br/>Timeout: 50 seconds"]
    end

    %% Database
    subgraph DB["Vercel Postgres Database"]
        TelemetryTick["TelemetryTick<br/>• sensorId<br/>• ts (timestamp)<br/>• value"]
        TelemetryAnomaly["TelemetryAnomaly<br/>• anomaly records"]
        JeevesState["JeevesState<br/>• system config<br/>• monitored streams"]
        JeevesDiscovery["JeevesDiscovery<br/>• discoveries<br/>• AI reasoning<br/>• evidence"]
        JeevesNotification["JeevesNotification<br/>• persona notifications<br/>• dashboards"]
        ActivityLog["JeevesActivityLog<br/>• execution logs"]
        Cleanup["Cleanup Worker<br/>48h TTL<br/>Daily at 3 AM UTC"]
    end

    %% AI Discovery Engine
    subgraph AI["AI Discovery Engine (Anthropic Claude)"]
        DiscoveryEngine["discovery-engine.ts<br/>• Load persona contexts<br/>• Query telemetry streams<br/>• Run 19 analysis tools<br/>• Generate discoveries<br/>• Identify recipients"]

        subgraph Tools["19 Analysis Tools"]
            T1["analyzeStreamAnomaliesTool"]
            T2["correlateTwoStreamsTool"]
            T3["detectPatternsTool"]
            T4["calculateStreamStatsTool"]
            T5["predictNextValuesTool"]
            T6["...14 more tools"]
        end
    end

    %% Notification Processing
    subgraph Notifications["Inngest Notification Worker"]
        NotifyWorker["process-notifications.ts<br/>Event: discovery.completed<br/>• Generate personalized notifications<br/>• Create visual dashboards (v0)<br/>• Save to database<br/>• Step functions with retries"]
    end

    %% Frontend
    subgraph Frontend["Next.js Frontend (Vercel)"]
        CommandCenter["/jeeves<br/>Command center<br/>Discoveries display<br/>Activity logs"]
        MQTTMonitor["/mqtt-monitor<br/>Live charts<br/>SSE streaming<br/>Real-time data"]
        Chat["/chat<br/>AI chat interface<br/>Natural language queries"]
        Dashboards["/d/[slug]<br/>Published dashboards<br/>Embedded visualizations"]
    end

    %% Scheduler
    subgraph Scheduler["Inngest Auto-Scheduler"]
        AutoScheduler["jeeves-auto-scheduler<br/>Cron: */5 * * * *<br/>• Check if enabled<br/>• Check if time >= nextAnalysisAt<br/>• Trigger discovery if ready"]
    end

    %% Data Flow
    FCUs -->|"MQTT Protocol<br/>TLS (8883)"| Broker
    Broker -->|"Subscribe<br/>Every 5 min"| FCUWorker
    FCUWorker -->|"Insert<br/>20-30 streams"| TelemetryTick

    AutoScheduler -->|"Check config"| JeevesState
    AutoScheduler -->|"Trigger if ready"| DiscoveryEngine

    JeevesState -.->|"Config"| DiscoveryEngine
    TelemetryTick -.->|"Query data"| DiscoveryEngine
    JeevesDiscovery -.->|"Recent discoveries"| DiscoveryEngine

    DiscoveryEngine -->|"Use tools"| Tools
    DiscoveryEngine -->|"Save discoveries"| JeevesDiscovery
    DiscoveryEngine -->|"Log activity"| ActivityLog

    JeevesDiscovery -->|"Trigger event<br/>discovery.completed"| NotifyWorker
    NotifyWorker -->|"Save notifications"| JeevesNotification
    NotifyWorker -->|"Update status"| JeevesDiscovery

    TelemetryTick -.->|"Cleanup old data"| Cleanup
    TelemetryAnomaly -.->|"Cleanup old data"| Cleanup

    JeevesState -.->|"Load config"| CommandCenter
    JeevesDiscovery -.->|"Display"| CommandCenter
    JeevesNotification -.->|"Display"| CommandCenter
    ActivityLog -.->|"Display"| CommandCenter

    Broker -.->|"SSE stream"| MQTTMonitor
    TelemetryTick -.->|"Query"| Chat
    DiscoveryEngine -.->|"AI context"| Chat
    JeevesNotification -.->|"Embed dashboards"| Dashboards

    %% Styling
    classDef physical fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef mqtt fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef worker fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef db fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef ai fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef frontend fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class FCUs physical
    class Broker mqtt
    class FCUWorker,NotifyWorker,AutoScheduler worker
    class TelemetryTick,TelemetryAnomaly,JeevesState,JeevesDiscovery,JeevesNotification,ActivityLog,Cleanup db
    class DiscoveryEngine,T1,T2,T3,T4,T5,T6 ai
    class CommandCenter,MQTTMonitor,Chat,Dashboards frontend
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant FCU as FCU-201 Hardware
    participant MQTT as HiveMQ Cloud
    participant Ingestion as FCU Data Ingestion
    participant DB as PostgreSQL
    participant Scheduler as Auto-Scheduler
    participant AI as Discovery Engine
    participant Tools as 19 Analysis Tools
    participant Notify as Notification Worker
    participant User as Web UI

    Note over FCU,MQTT: Every 5 minutes
    FCU->>MQTT: Publish sensor data<br/>(49 FCUs, LonWorks)
    MQTT->>Ingestion: Message received
    Ingestion->>Ingestion: Parse FCU-201 data<br/>Normalize field names
    Ingestion->>DB: Insert 20-30 telemetry ticks

    Note over Scheduler,DB: Every 5 minutes
    Scheduler->>DB: Check JeevesState<br/>(enabled? time to run?)
    DB-->>Scheduler: Config + last run time

    alt Analysis needed
        Scheduler->>AI: Trigger discovery
        AI->>DB: Load persona contexts
        AI->>DB: Query monitored streams
        AI->>DB: Get recent discoveries

        loop Tool usage (max 10 steps)
            AI->>Tools: Call analysis tool<br/>(anomalies, correlation, patterns)
            Tools->>DB: Query telemetry data
            DB-->>Tools: Return data points
            Tools-->>AI: Analysis result
        end

        AI->>AI: Generate discoveries<br/>(LLM with 19 tools)
        AI->>DB: Save JeevesDiscovery
        AI->>DB: Log to JeevesActivityLog

        AI->>Notify: Trigger event<br/>discovery.completed

        loop For each persona
            Notify->>DB: Load persona context
            Notify->>Notify: Generate personalized<br/>notification (LLM)
            Notify->>Notify: Create dashboard (v0)
            Notify->>DB: Save JeevesNotification
        end

        Notify->>DB: Mark discovery as "notified"
    end

    Note over User,DB: User interaction
    User->>DB: Load /jeeves page
    DB-->>User: Discoveries + Notifications<br/>+ Activity logs
    User->>AI: Chat query
    AI->>Tools: Use analysis tools
    AI-->>User: Natural language response
```

## Component Architecture

```mermaid
graph TB
    subgraph "Backend (Next.js 15 App Router)"
        subgraph "API Routes"
            API1["/api/jeeves/*<br/>State, Analyze, Discoveries"]
            API2["/api/mqtt/stream<br/>SSE Streaming"]
            API3["/api/telemetry/*<br/>Data queries"]
            API4["/api/inngest<br/>Worker registration"]
        end

        subgraph "Server Components"
            SC1["JeevesCommandCenter<br/>(RSC)"]
            SC2["MQTTMonitor<br/>(Client)"]
            SC3["ChatInterface<br/>(Client + RSC)"]
        end
    end

    subgraph "Inngest Workers (Background)"
        W1["fcu-data-ingestion<br/>Cron: */5 * * * *"]
        W2["jeeves-auto-scheduler<br/>Cron: */5 * * * *"]
        W3["process-notifications<br/>Event-driven"]
        W4["telemetry-cleanup<br/>Cron: 0 3 * * *"]
    end

    subgraph "Core Libraries"
        L1["lib/jeeves/discovery-engine.ts<br/>Main AI logic"]
        L2["lib/monitoring/stream-tools.ts<br/>19 analysis tools"]
        L3["lib/mqtt/parsers.ts<br/>LonWorks parsing"]
        L4["lib/inngest/client.ts<br/>Event bus"]
    end

    subgraph "Database Layer (Drizzle ORM)"
        D1["schema.ts<br/>Type-safe schema"]
        D2["queries.ts<br/>Reusable queries"]
        D3["migrations/<br/>Version control"]
    end

    API1 --> L1
    API1 --> D1
    API2 --> L3
    API3 --> D2
    API4 --> W1
    API4 --> W2
    API4 --> W3
    API4 --> W4

    W1 --> L3
    W1 --> D2
    W2 --> L1
    W3 --> L1
    W4 --> D2

    L1 --> L2
    L1 --> D2
    L2 --> D2

    SC1 --> API1
    SC2 --> API2
    SC3 --> API1
```

## Technology Stack

```mermaid
mindmap
  root((Intelligent Building<br/>Analytics Platform))
    Frontend
      Next.js 15
        App Router
        React Server Components
      React 19 RC
      TypeScript 5.6
      Tailwind CSS 4.1
      shadcn/ui
      Recharts 2.13
      SSE Streaming
    Backend
      Next.js API Routes
      Vercel Serverless
      Drizzle ORM 0.34
      MQTT.js 5.11
      Inngest 3.30
    AI/ML
      Anthropic Claude
        Sonnet 4.5
      Vercel AI SDK 5.0
      19 Analysis Tools
      Prompt Caching
        90% token savings
    Infrastructure
      Vercel Hosting
        Postgres DB
        Serverless Functions
      HiveMQ Cloud
        MQTT Broker
      Inngest Cloud
        Background Jobs
      Redis (Optional)
        Deduplication
```

## Deployment Architecture

```mermaid
graph LR
    subgraph "External Services"
        HiveMQ["HiveMQ Cloud<br/>MQTT Broker"]
        Anthropic["Anthropic API<br/>Claude Sonnet 4.5"]
        InngestCloud["Inngest Cloud<br/>Job Orchestration"]
    end

    subgraph "Vercel Platform"
        subgraph "Edge Network"
            CDN["CDN<br/>Static Assets"]
        end

        subgraph "Compute"
            Functions["Serverless Functions<br/>• API Routes<br/>• RSC<br/>• SSE Endpoints"]
        end

        subgraph "Data"
            VDB["Vercel Postgres<br/>• 48h TTL<br/>• Automatic cleanup"]
        end
    end

    subgraph "Optional Services"
        Redis["Redis Cloud<br/>Deduplication"]
        Resend["Resend API<br/>Email Delivery"]
    end

    User["End Users<br/>Facility Managers<br/>Engineers"]

    HiveMQ -->|"MQTT Data"| Functions
    Functions -->|"API Calls"| Anthropic
    Functions -->|"Events"| InngestCloud
    InngestCloud -->|"Trigger Workers"| Functions
    Functions <-->|"Read/Write"| VDB
    Functions -.->|"Optional"| Redis
    Functions -.->|"Optional"| Resend

    User -->|"HTTPS"| CDN
    User -->|"API/SSE"| Functions
    CDN -->|"Dynamic"| Functions
```
