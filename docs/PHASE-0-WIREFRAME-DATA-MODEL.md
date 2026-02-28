# PHASE 0 — Mission Control Portal: Wireframe + Data Model + API Routes
**Date:** 2026-02-15  
**Status:** Phase 0 Deliverables (STOP after this)  
**Dashboard:** http://192.168.40.70:3000

---

## 1. WIREFRAME LAYOUT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 MISSION CONTROL                [💬 Chat] [📢 Broadcast] [📄 Docs]      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  🟢 Active | Agents: 5 | Tasks: 12 | ⚠️ Alerts: 1                           │
├──────────┬────────────────────────────────────────────────────────┬─────────┤
│          │                                                        │         │
│ 🤖 AGENT │   📋 MISSION QUEUE (Kanban Board)                      │  👤     │
│  FLEET   │                                                        │ PROFILE │
│          │   ┌──────────┬─────────┬──────────┬─────────┬───────┐   │ DRAWER  │
│ 🎯 Ldr   │   │  📝      │  👤     │  ⚡       │  🔍     │  ✅   │   │ (Right) │
│ ● working│   │ Inbox    │Assigned │In Progress│Review   │ Done  │   │         │
│ 2m ago   │   │          │         │           │        │       │   │ Avatar  │
│ 🔴 2     │   │ • 5      │ • 3     │ • 2       │ • 1    │ • 4   │   │ Role    │
│          │   │          │         │           │        │       │   │ Skills  │
│ 🖥️ Prxm  │   ├──────────┴─────────┴──────────┴─────────┴───────┤   │ Current │
│ ○ idle   │   │           🚦 Waiting(Approval)                   │   │ Task    │
│ 5m ago   │   │           • 2 items pending Anwar                │   │ Mentions│
│ ⚪ 0     │   └─────────────────────────────────────────────────┘   │ 🔴 2    │
│          │                                                        │         │
│ 🏠 Home  │   [Click task → open Task Detail Drawer (slide from right)] │
│ ○ idle   │                                                        │         │
│ 12m ago  │                                                        │         │
│ ⚪ 0     │                                                        │         │
│          │                                                        │         │
│ 🔐 Sec   │                                                        │         │
│ ○ idle   │                                                        │         │
│ 1h ago   │                                                        │         │
│ ⚪ 0     │                                                        │         │
│          │                                                        │         │
│ 🌐 Net   │                                                        │         │
│ ● working│                                                        │         │
│ 30s ago  │                                                        │         │
│ 🟡 1     │                                                        │         │
│          │                                                        │         │
├──────────┴────────────────────────────────────────────────────────┴─────────┤
│                                                                              │
│  💬 SQUAD CHAT MODAL (opens center screen on Chat button)                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ [Leader] 🎯 18:45: Approval Bundle #1 published — awaiting Anwar        ││
│  │ [Proxmox] 🖥️ 18:30: Health check complete. Z840: healthy               ││
│  │ [Home] 🏠 18:30: HA healthy, update pending                            ││
│                                                                         [×]││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  📢 BROADCAST MODAL (opens on Broadcast button)                            │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ Title: _______________________  Priority: [Normal ▼]          │        │
│  │ Message: ________________________________________________      │        │
│  │ Send to: [All Agents ▼]                                         │        │
│  │ [Cancel]                                    [🚨 Send Broadcast] │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

TASK DETAIL DRAWER (slides from right on task click)
┌──────────────────────────────────────────────────┬─────────────────────────────┐
│                                                  │                             │
│  #approval-001 — Configure Proxmox Backup Jobs   │                             │
│  ────────────────────────────────────────────────┼────────────────────────  │
│                                                  │                             │
│  Status: 🚦 Waiting(Approval)                     │                             │
│  Owner: 🖥️ Proxmox Bot                          │                             │
│  Priority: P0                                   │                             │
│                                                  │                             │
│  ┌─ DESCRIPTION ────────────────────────────────┐ │                             │
│  │ [a] EXACT ACTION: ...                       │ │                             │
│  │ [b] IMPACT: ...                             │ │                             │
│  │ ...                                         │ │                             │
│  └────────────────────────────────────────────┘ │                             │
│                                                  │                             │
│  ┌─ APPROVALS CHECKLIST ──────────────────────┐ │                             │
│  │ ☐ Anwar approved                            │ │                             │
│  │ ☐ Security reviewed (if required)           │ │                             │
│  │ ☐ Preconditions verified                  │ │                             │
│  └────────────────────────────────────────────┘ │                             │
│                                                  │                             │
│  ┌─ COMMENTS ──────────────────────────────────┐ │                             │
│  │ [Leader] 18:48: Awaiting approval...      │ │                             │
│  │                                            │ │                             │
│  │ [Input...]                           [Send]│ │                             │
│  └────────────────────────────────────────────┘ │                             │
│                                                  │                             │
│  ┌─ DELIVERABLES ────────────────────────────┐ │                             │
│  │ 📄 Config file: /etc/pve/jobs/...         │ │                             │
│  │ 📊 Log output: /var/log/...               │ │                             │
│  └────────────────────────────────────────────┘ │                             │
│                                                  │                             │
└──────────────────────────────────────────────────┴─────────────────────────────┘
```

---

## 2. DATA MODEL

### Agent Model
```typescript
interface Agent {
  id: string;                    // 'leader' | 'proxmox' | 'home' | 'security' | 'network'
  name: string;                  // Display name
  icon: string;                  // Emoji
  status: 'active' | 'idle' | 'working' | 'blocked' | 'offline';
  lastUpdate: ISO8601;           // Timestamp of last activity
  mentionCount: number;          // Unread mentions (@agent)
  blockedCount: number;          // Tasks waiting for this agent
  role: string;                  // Short role description
  skills: string[];              // List of capabilities
  currentTaskId: string | null;  // Currently assigned task
  
  // Derived
  isOnline: boolean;
  health: 'healthy' | 'warning' | 'critical';
}
```

### Task Model
```typescript
interface Task {
  id: string;                    // Unique ID (e.g., "approval-001-backup-jobs")
  title: string;
  description: string;
  
  // Assignment
  agent: string;                   // Assigned agent ID
  agentIcon: string;               // Emoji for display
  
  // Status & Workflow
  status: 'inbox' | 'assigned' | 'in-progress' | 'review' | 'done' | 'waiting-approval';
  column: string;                  // Current kanban column
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'INFO';
  
  // Timestamps
  created: ISO8601;
  updated: ISO8601;
  due?: ISO8601;
  completed?: ISO8601;
  
  // Approval Workflow (for waiting-approval tasks)
  type: 'approval' | 'task' | 'risk' | 'improvement' | 'baseline' | 'template';
  requiresConfirmation: boolean;
  
  // If type === 'approval'
  bundleId?: string;               // Group related approvals
  bundleOrder?: number;            // Order within bundle
  risk?: 'Low' | 'Medium' | 'High' | 'Critical';
  benefit?: string;
  securityReview?: 'pending' | 'approved' | 'rejected';
  dependsOn?: string[];            // Task IDs that must complete first
  
  // Approval Request (structured)
  approvalRequest?: {
    exactAction: string;           // [a] Exact commands/steps
    impact: string;                // [b] What changes
    riskLevel: string;             // [c] Low/Med/High/Critical
    rollbackPlan: string;          // [d] How to undo
    verificationSteps: string;     // [e] How to confirm success
    timeWindow: string;            // [f] When + duration
    preconditions: string[];       // [g] Prerequisites
  };
  
  // Approval State
  approvalState?: {
    approvedBy: string | null;     // Who approved
    approvedAt: ISO8601 | null;
    deniedBy: string | null;
    deniedAt: ISO8601 | null;
    reason: string | null;         // Denial reason
    preconditionsVerified: boolean;
  };
  
  // Deliverables
  deliverables?: {
    type: 'file' | 'log' | 'config' | 'url' | 'command-output';
    path?: string;
    url?: string;
    content?: string;
  }[];
  
  // Serious flag (triggers Telegram)
  isSerious: boolean;              // Data-loss/outage/security risk
}
```

### Message Model (Squad Chat)
```typescript
interface Message {
  id: string;
  timestamp: ISO8601;
  
  // Sender
  fromAgent: string;               // Agent ID or 'leader' or 'human'
  fromAgentIcon: string;
  fromAgentName: string;
  
  // Content
  content: string;
  type: 'text' | 'system' | 'alert' | 'approval-request' | 'approval-granted' | 'broadcast';
  
  // Context
  taskId?: string;                 // Linked task (optional)
  mentions?: string[];             // Array of agent IDs mentioned
  
  // For broadcasts
  broadcast?: {
    title: string;
    priority: 'Normal' | 'Urgent' | 'SERIOUS';
    recipients: string[];          // 'all' or array of agent IDs
  };
  
  // Telegram notification
  telegramSent?: boolean;
  telegramMessageId?: string;
}
```

### Approval Model (Standalone for tracking)
```typescript
interface Approval {
  id: string;                      // Same as task.id
  taskId: string;
  
  // Request fields (a-g)
  exactAction: string;
  impact: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  rollbackPlan: string;
  verificationSteps: string;
  timeWindow: string;
  preconditions: string[];
  
  // State
  status: 'pending' | 'approved' | 'denied' | 'executing' | 'completed' | 'failed';
  requester: string;               // Agent requesting
  approver: string | null;         // Human who approved
  
  // Timeline
  requestedAt: ISO8601;
  approvedAt: ISO8601 | null;
  executedAt: ISO8601 | null;
  completedAt: ISO8601 | null;
  
  // Execution log
  executionLog?: {
    startedAt: ISO8601;
    commands: string[];
    outputs: string[];
    errors: string[];
    verified: boolean;
  };
  
  // Serious flag
  isSerious: boolean;              // Triggers Telegram notification
}
```

---

## 3. API ROUTES (Minimal)

### Agent Routes
```
GET  /api/agents                    → List all agents with status
GET  /api/agents/:id                → Single agent details
POST /api/agents/:id/status         → Update agent status (from bot)
POST /api/agents/:id/heartbeat      → Agent heartbeat ping
```

### Task Routes
```
GET    /api/tasks                   → List all tasks (optionally ?column=xxx&agent=xxx)
GET    /api/tasks/:id               → Single task with comments, approvals
POST   /api/tasks                   → Create new task
PUT    /api/tasks/:id               → Update task (status, column, etc.)
DELETE /api/tasks/:id               → Delete task
POST   /api/tasks/:id/move          → Move task to column { column: string }
```

### Approval Routes
```
GET  /api/approvals                 → List approvals (optionally ?status=pending)
GET  /api/approvals/:id             → Single approval with full details
POST /api/approvals/:id/approve     → Human approves { approver: string, notes?: string }
POST /api/approvals/:id/deny        → Human denies { approver: string, reason: string }
POST /api/approvals/:id/execute     → Begin execution (sets status=executing)
POST /api/approvals/:id/complete    → Mark complete with verification { log: object }
POST /api/approvals/:id/fail        → Mark failed { error: string }
```

### Message Routes
```
GET  /api/messages                  → Get chat history (optionally ?taskId=xxx&limit=50)
GET  /api/messages/unread           → Get unread mentions for agent
POST /api/messages                  → Send message { fromAgent, content, taskId?, mentions?[] }
POST /api/messages/broadcast        → Send broadcast { title, content, priority, recipients[] }
POST /api/messages/:id/read         → Mark message as read
```

### System Routes
```
GET  /api/status                    → Dashboard status (counts, health)
GET  /api/stats                     → Task statistics by column/agent
POST /api/notify/telegram           → Trigger Telegram alert { message, taskId?, isSerious: boolean }
```

### WebSocket (Future)
```
ws://host:3000/ws                   → Real-time updates (task moves, new messages, approvals)
```

---

## 4. FILE STRUCTURE (Proposed)

```
/root/.openclaw/workspace/dashboard/
├── index.html                      # Main SPA shell
├── styles.css                     # Updated Mission Control theme
├── js/
│   ├── app.js                     # Main controller (refactored)
│   ├── components/
│   │   ├── AgentFleet.js          # Left rail component
│   │   ├── KanbanBoard.js         # Main kanban component
│   │   ├── TaskCard.js            # Draggable task card
│   │   ├── TaskDetailDrawer.js    # Right panel drawer
│   │   ├── AgentProfileDrawer.js  # Right panel agent info
│   │   ├── SquadChatModal.js      # Chat modal component
│   │   ├── BroadcastModal.js      # Broadcast modal component
│   │   └── TopBar.js              # Header with counters
│   ├── models/
│   │   ├── Agent.js               # Agent class
│   │   ├── Task.js                # Task class
│   │   ├── Approval.js            # Approval class
│   │   └── Message.js             # Message class
│   └── services/
│       ├── ApiService.js          # HTTP API wrapper
│       ├── StorageService.js      # Local storage + API sync
│       └── TelegramService.js     # Telegram alert integration
├── api-server.js                  # Extended with new routes
└── data/
    ├── tasks/
    │   └── tasks.json             # Task store
    ├── agents/
    │   └── agents.json            # Agent store
    ├── messages/
    │   └── messages.json          # Chat log
    └── approvals/
        └── approvals.json         # Approval records
```

---

## 5. TELEGRAM INTEGRATION (SERIOUS Events Only)

```javascript
// Trigger conditions
const SERIOUS_KEYWORDS = [
  'data-loss', 'outage', 'security breach', 'credential leak',
  'disk full', 'backup failed', 'PBS broken', 'zero backups'
];

// Alert format
{
  "chat_id": "${TELEGRAM_CHAT_ID}",
  "text": "🚨 SERIOUS EVENT\n\nTask: {title}\nRisk: {riskLevel}\n\n{description}\n\n🔗 http://192.168.40.70:3000/approval/{id}",
  "parse_mode": "Markdown",
  "disable_web_page_preview": false
}
```

---

## 6. CURRENT STATE vs TARGET

| Feature | Current | Target | Gap |
|---------|---------|--------|-----|
| Left Rail | ✅ Agents list | + Status, last update, badges | Add agent state fields |
| Top Bar | ⚠️ Basic status | + Active toggle, counters | Add counters component |
| Kanban | ✅ 3 columns | 6 columns (add Inbox, Assigned, Waiting) | Extend columns |
| Task Detail | ⚠️ Minimal modal | Full drawer with approvals | Create TaskDetailDrawer |
| Agent Profile | ❌ None | Right panel drawer | Create AgentProfileDrawer |
| Squad Chat | ⚠️ Inline panel | Modal with full history | Create SquadChatModal |
| Broadcast | ⚠️ Not implemented | Modal with priority | Create BroadcastModal |
| Approvals | ⚠️ Checkbox only | First-class approval objects | Add Approval model |
| Telegram | ❌ None | SERIOUS alerts only | Add TelegramService |

---

**STOP — Phase 0 Complete:** Wireframe, Data Model, and API Routes documented above.

**Next Phase (Not Yet):** Implement components and extend api-server.js with new routes.
