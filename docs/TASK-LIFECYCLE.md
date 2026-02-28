# Mission Control - Task Lifecycle Workflow

## Overview

The Dashboard Bot now orchestrates the full task lifecycle from approval through completion.

---

## Task Flow

```
┌──────────┐    Approve     ┌──────────────┐    Dashboard Bot    ┌──────────┐
│  📋      │ ──────────────▶│   📥         │ ──────────────────▶│  📤      │
│  REVIEW  │                │  IN-PROGRESS │   Auto-assigns     │ ASSIGNED │
└──────────┘                └──────────────┘   to bot            └──────────┘
                                                                    │
                                                                    │ Bot picks up
                                                                    ▼
                                                            ┌──────────┐
                                                            │  🔨      │
                                                            │EXECUTING │
                                                            └──────────┘
                                                                    │
                                                                    │ Bot completes
                                                                    ▼
                                                            ┌──────────┐
                                                            │  ✅      │
                                                            │COMPLETED │
                                                            └──────────┘
```

---

## Column Definitions

| Column | Emoji | Description |
|--------|-------|-------------|
| **Review** | 📋 | Awaiting Anwar approval |
| **In-Progress** | 📥 | Approved, Dashboard Bot will auto-assign |
| **Assigned** | 📤 | Assigned to bot, waiting for bot to start work |
| **Executing** | 🔨 | Bot actively working on task |
| **Completed** | ✅ | Task finished and confirmed |

---

## How It Works

### 1. Approval (Anwar)
- You approve via Telegram: `/approve <task-id>`
- Or via dashboard approval button

### 2. Auto-Assignment (Dashboard Bot)
Every 10 seconds, the Dashboard Bot:
- Scans tasks in `in-progress` column
- Uses the **Delegation Router** to determine the right bot
- Updates task: `column: assigned`, `status: assigned`
- Adds to bot's **incoming queue**

### 3. Bot Execution
Bot checks its queue (via `/api/bot/queue/:botId`) and:
1. Marks task as `executing` via `/api/bot/start-execution`
2. Performs the work
3. Reports completion via `/api/bot/complete`

### 4. Completion (Dashboard Bot)
Dashboard Bot sees completion in bot's completed queue:
- Moves task to `completed` column
- Adds completion comment
- Logs activity

---

## New API Endpoints

### For Bots

```bash
# Get bot's assigned tasks
GET /api/bot/queue/:botId

# Mark task as executing
POST /api/bot/start-execution
{"taskId": "...", "bot": "proxmox"}

# Report task completion
POST /api/bot/complete
{
  "taskId": "...",
  "bot": "proxmox",
  "result": "success",
  "summary": "Backed up 5 VMs"
}
```

### For Monitoring

```bash
# Get queue summary
GET /api/queue/summary
```

---

## Bot Queue File Structure

```
data/queues/
├── leader/
│   ├── incoming.jsonl   # New tasks for Leader
│   └── completed.jsonl  # Leader's completed tasks
├── proxmox/
│   ├── incoming.jsonl
│   └── completed.jsonl
├── home/
│   ├── incoming.jsonl
│   └── completed.jsonl
├── storage/
├── network/
└── security/
```

---

## File Changes Made

| File | Change |
|------|--------|
| `dashboard-bot.js` | **NEW** - Queue orchestrator service |
| `api-server.js` | Added Dashboard Bot integration + new API endpoints |
| `index.html` | Added ASSIGNED + EXECUTING columns + CSS |
| `app.js` | Updated columns array to include new columns |

---

## Current Task Status

Run this to see current queue:

```bash
curl http://localhost:3000/api/queue/summary | python3 -m json.tool
```

Current state:

| Column | Count |
|--------|-------|
| Review | 1 |
| In-Progress | 1 |
| **Assigned** | 13 |
| Executing | 0 |
| Completed | 8 |
| Waiting | 6 |

The 5 tasks you approved (`risk-003`, `risk-004`, `risk-005`, `improvement-002`, `improvement-005`) are now in the **Assigned** column and ready for their respective bots to pick up and execute.

---

## Next Steps

1. **Build bot workers** that poll their queue and execute tasks
2. **Add Telegram notifications** when tasks move to Assigned/Executing/Completed
3. **Add task retry logic** for failed executions
4. **Build visual indicators** showing which bot "owns" each executing task
