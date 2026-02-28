# Architecture Overview

## System Architecture

```
+-------------+     +-------------+     +------------------+
|   Browser   |---->|  Web Server |---->|   API Handlers   |
+-------------+     +-------------+     +------------------+
                            |
                            v
                   +------------------+
                   |  Services Layer  |
                   +------------------+
                            |
       +--------------------+--------------------+
       |                    |                    |
       v                    v                    v
+--------------+  +----------------+  +------------------+
|  Delegation  |  |  Infra Monitor |  |  Telegram Bot    |
+--------------+  +----------------+  +------------------+
       |                    |                    |
       v                    v                    v
+--------------+  +----------------+  +------------------+
|  Execution   |  |  Asset Store   |  |  Message Queue   |
|  Engine      |  |  (JSON files)  |  |  (JSONL)         |
+--------------+  +----------------+  +------------------+
```

## Data Flow

1. **User Input**
   - HTTP requests to API endpoints
   - Telegram messages via polling
   - WebSocket for real-time updates

2. **Routing Layer**
   - Natural Language Router parses input
   - Delegation Router assigns to appropriate bot
   - Approval Engine checks authorization

3. **Service Layer**
   - Infrastructure Monitor fetches metrics
   - Task Storage persists operations
   - Execution Engine runs commands

4. **Data Layer**
   - File-based JSON for configuration
   - JSONL for activity logs
   - In-memory for runtime state

## Key Components

### api-server.js
HTTP server handling REST API and serving frontend.

### delegation-service.js
Routes tasks to appropriate bots based on type and priority.

### infra-service.js
Monitors infrastructure assets and reports status.

### telegram-service.js
Bot polling and message handling for Telegram integration.

### execution-engine.js
Task execution with rollback capabilities.

## Directory Structure

```
openclaw-mission-control/
├── src/                    # Source code
│   ├── bots/              # Bot implementations
│   ├── services/          # Core services
│   ├── evaluators/        # Chat evaluators
│   └── utils/             # Utilities
├── public/                # Frontend files
├── config/                # Configuration
├── data/                  # Runtime data
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Bot Fleet

| Bot | Purpose |
|-----|---------|
| Leader | Task assignment, orchestration |
| Proxmox | VM/LXC management |
| Home | Home Assistant control |
| Storage | PBS/TrueNAS management |
| Network | Firewall/routing |
| Security | Security monitoring |

## Event Flow

1. Event occurs (timer, user action, alert)
2. Activity Logger records event
3. Natural Language Router determines handler
4. Bot processes the event
5. Result is logged and reported
