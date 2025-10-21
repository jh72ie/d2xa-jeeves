# Jeeves Documentation

Complete documentation for the Jeeves HVAC Monitoring System.

## 📚 Core Documentation

### **[DEVELOPER_MANUAL.rst](DEVELOPER_MANUAL.rst)** ⭐ START HERE
Comprehensive developer manual covering the entire system architecture, codebase structure, and implementation details. Written in reStructuredText (RST) format.

**Contents:**
- System Overview & Architecture
- Database Schema (all tables documented)
- Core Components (Discovery Engine, MQTT Ingestion, FCU Parser)
- Background Workers (Inngest functions)
- API Routes (complete endpoint reference)
- Frontend Components (UI architecture)
- Configuration & Setup
- Development Guide
- Deployment Instructions
- Troubleshooting
- Performance Optimization

---

## 🔧 Integration Guides

### [FCU_JEEVES_INTEGRATION.md](FCU_JEEVES_INTEGRATION.md)
MQTT integration guide for connecting FCU-201 to Jeeves AI analysis.

**Topics:**
- MQTT broker setup (HiveMQ Cloud)
- Data ingestion worker configuration
- Stream naming conventions
- Monitoring & debugging
- Scaling to multiple FCUs

### [JEEVES_BACKGROUND_PROCESSING.md](JEEVES_BACKGROUND_PROCESSING.md)
Inngest background job orchestration for Jeeves workers.

**Topics:**
- Inngest setup and configuration
- Worker function structure
- Step functions for reliability
- Error handling and retries
- Monitoring and observability

### [JEEVES_DEDUPLICATION.md](JEEVES_DEDUPLICATION.md)
Redis-based deduplication for preventing duplicate data processing.

**Topics:**
- Redis setup (optional)
- Timestamp-based deduplication
- TTL configuration
- Performance impact

---

## 🎨 Architecture & Design

### [JEEVES_ARCHITECTURE.md](JEEVES_ARCHITECTURE.md)
Detailed technical architecture documentation (37K file).

**Topics:**
- System architecture diagrams
- Data flow patterns
- Component interactions
- Rate limiting strategy
- Token optimization
- Database design decisions

### [JEEVES_DISCOVERY_LOGGING.md](JEEVES_DISCOVERY_LOGGING.md)
Activity logging system for real-time execution tracking.

**Topics:**
- Activity log table schema
- Logging patterns
- UI display
- Debugging with logs

---

## 📡 MQTT Monitoring

### [MQTT_MONITOR_SETUP.md](MQTT_MONITOR_SETUP.md)
Local MQTT monitoring setup for development and debugging.

**Topics:**
- Python script installation
- MQTT client configuration
- Message parsing
- Field name identification

### [MQTT_INNGEST_SETUP.md](MQTT_INNGEST_SETUP.md)
Inngest worker setup for MQTT data ingestion.

**Topics:**
- Worker registration
- Cron scheduling
- MQTT connection management
- Database persistence

### [mqtt-message-structure.json](mqtt-message-structure.json)
Sample MQTT message structure showing all 49 FCUs.

---

## 💬 Chat & Discovery Features

### [DISCOVERY_CHAT_FEATURE.md](DISCOVERY_CHAT_FEATURE.md)
Chat interface for interacting with Jeeves discoveries.

**Topics:**
- Chat integration
- Discovery queries
- Context sharing
- UI components

### [DISCOVERY_CHAT_CAPABILITIES.md](DISCOVERY_CHAT_CAPABILITIES.md)
Detailed capabilities of the discovery chat system.

**Topics:**
- Query patterns
- Tool usage
- Response formats
- Limitations

---

## 📧 Notifications

### [JEEVES_EMAIL_NOTIFICATIONS.md](JEEVES_EMAIL_NOTIFICATIONS.md)
Email notification system for persona-based alerts.

**Topics:**
- Email service setup (Resend)
- Template system
- Persona personalization
- Delivery tracking

---

## 🚀 Advanced Topics

### [EXTERNAL_JOB_QUEUES_GUIDE.md](EXTERNAL_JOB_QUEUES_GUIDE.md)
Guide to using external job queues (Inngest) vs. internal processing.

**Topics:**
- When to use job queues
- Event-driven architecture
- Step functions
- Error recovery

### [JEEVES_PROMPT_CACHING_SOLUTION.md](JEEVES_PROMPT_CACHING_SOLUTION.md)
Anthropic prompt caching implementation for token optimization.

**Topics:**
- Prompt caching setup
- Token savings (90%+)
- Cache invalidation
- Performance impact

### [AI_SDK_5_REFERENCE.md](AI_SDK_5_REFERENCE.md)
Vercel AI SDK 5.0 reference and patterns used in Jeeves.

**Topics:**
- generateText API
- Tool definitions
- Streaming responses
- Error handling

---

## 🛠️ Development Tools

### [step-guidance.md](step-guidance.md)
AI tool for providing step-by-step guidance in chat interface.

---

## 📋 Quick Start

1. **New Developer?** → Start with [DEVELOPER_MANUAL.rst](DEVELOPER_MANUAL.rst)
2. **Setting up MQTT?** → Read [FCU_JEEVES_INTEGRATION.md](FCU_JEEVES_INTEGRATION.md)
3. **Debugging issues?** → Check [MQTT_MONITOR_SETUP.md](MQTT_MONITOR_SETUP.md)
4. **Deploying?** → See Section 9 in [DEVELOPER_MANUAL.rst](DEVELOPER_MANUAL.rst)
5. **Performance tuning?** → Read [JEEVES_PROMPT_CACHING_SOLUTION.md](JEEVES_PROMPT_CACHING_SOLUTION.md)

---

## 📊 Documentation Structure

```
docs/
├── README.md (this file)                    # Documentation index
├── DEVELOPER_MANUAL.rst                     # ⭐ MAIN MANUAL (start here)
│
├── Integration Guides/
│   ├── FCU_JEEVES_INTEGRATION.md           # MQTT integration
│   ├── MQTT_MONITOR_SETUP.md               # Local monitoring
│   ├── MQTT_INNGEST_SETUP.md               # Worker setup
│   └── mqtt-message-structure.json         # Sample data
│
├── Architecture/
│   ├── JEEVES_ARCHITECTURE.md              # Detailed architecture
│   ├── JEEVES_BACKGROUND_PROCESSING.md     # Background jobs
│   ├── JEEVES_DEDUPLICATION.md             # Deduplication
│   └── JEEVES_DISCOVERY_LOGGING.md         # Activity logging
│
├── Features/
│   ├── DISCOVERY_CHAT_FEATURE.md           # Chat integration
│   ├── DISCOVERY_CHAT_CAPABILITIES.md      # Chat capabilities
│   └── JEEVES_EMAIL_NOTIFICATIONS.md       # Email system
│
├── Advanced/
│   ├── EXTERNAL_JOB_QUEUES_GUIDE.md        # Job queue patterns
│   ├── JEEVES_PROMPT_CACHING_SOLUTION.md   # Token optimization
│   └── AI_SDK_5_REFERENCE.md               # AI SDK usage
│
└── Tools/
    └── step-guidance.md                     # AI guidance tool
```

---

## 🔗 External Resources

- **Project Repository:** [GitHub](https://github.com/your-org/jeeves)
- **Inngest Dashboard:** [app.inngest.com](https://app.inngest.com)
- **Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)
- **HiveMQ Cloud:** [console.hivemq.cloud](https://console.hivemq.cloud)

---

## 📝 Contributing to Documentation

When updating documentation:

1. Keep information **strictly based on codebase**
2. Update **DEVELOPER_MANUAL.rst** for major changes
3. Update **this README** if adding/removing files
4. Use clear examples and code snippets
5. Test all commands and queries before documenting

---

## 🆘 Getting Help

1. **Check the manual first:** [DEVELOPER_MANUAL.rst](DEVELOPER_MANUAL.rst)
2. **Look at examples:** See Section 8 (Development Guide)
3. **Check logs:** Activity Log in UI or Vercel logs
4. **Troubleshoot:** See Section 10 (Troubleshooting)

---

**Last Updated:** 2025-10-13
**Documentation Version:** 2.0
**Status:** Production Ready
