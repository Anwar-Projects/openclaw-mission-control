# Improved Daily Summary Format
**Date:** 2026-02-15 21:15 GST+4

---

## Format Specification

### Header
```
📊 DAILY HOMELAB SUMMARY — Leader Bot
📅 [Day, Month Date, Year]
```

### Infrastructure Section
Status per domain with 🟢/🟡/🔴 indicators:
- 🟢 OK — No blockers, healthy
- 🟡 Issues/Busy — Blocked tasks present or high load
- 🔴 Critical — P0 items exist

```
🖥️ Infrastructure
  • Proxmox: [status]
  • Home Assistant: [status]
  • Storage: [status]
  • Network: [status]
```

### Critical Risks (P0)
```
🚨 Critical Risks (P0): [count] item(s)
  🔴 [bot-icon] [task title]
  🔴 [bot-icon] [task title]
```

If none: `🚨 Critical Risks (P0): None ✅`

### Approval Queue
```
🚦 Awaiting Approval: [count] item(s)
  • [bot-icon] [bot-name]: [count]
```

### Improvements Today
P2/P3 tasks created today (non-critical improvements):
```
🛠️ Improvements Proposed Today: [count] total
  • [task title]
  • [task title]
  • [task title]
```

### Bot Status
Detailed per-bot status with indicators:
```
🤖 Bot Status:
  🎯 Leader: [indicator] ([tasks] tasks, [blocked] blocked)
  🖥️ Proxmox: [indicator] ([tasks] tasks, [blocked] blocked)
  🏠 Home: [indicator] ([tasks] tasks, [blocked] blocked)
  💾 Storage: [indicator] ([tasks] tasks, [blocked] blocked)
  🌐 Network: [indicator] ([tasks] tasks, [blocked] blocked)
  🔐 Security: [indicator] ([tasks] tasks, [blocked] blocked)
```

Indicator logic:
- 🔴 = Has P0 tasks
- 🟡 = Has blocked tasks OR >5 active tasks
- 🟢 = Healthy

### Next Actions
Top P1 items queued by each bot:
```
📌 Next Planned Actions:
  • [bot-icon] [action title]
  • [bot-icon] [action title]
```

### Footer
```
— End of Report
```

---

## API Response Structure

```json
{
  "timestamp": "2026-02-15T21:15:00.000Z",
  "serious": true|false,
  "summary": {
    "totalAgents": 6,
    "totalActive": 19,
    "totalBlocked": 10,
    "totalWaiting": 1,
    "p0Count": 2,
    "improvementsToday": 7
  },
  "infrastructure": {
    "proxmox": "🟡 Issues",
    "homeAssistant": "🟡 Issues",
    "storage": "🟡 Issues",
    "network": "🟡 Issues"
  },
  "botReports": [
    {
      "botId": "proxmox",
      "botName": "Proxmox",
      "totalActive": 5,
      "blocked": 4,
      "p0Tasks": 0,
      "status": "issues"
    }
  ],
  "p0Tasks": [...],
  "improvementsToday": [...],
  "message": "📊 DAILY HOMELAB SUMMARY..."
}
```

---

## Example Output

```
📊 DAILY HOMELAB SUMMARY — Leader Bot
📅 Sunday, Feb 15, 2026

🖥️ Infrastructure
  • Proxmox: 🟡 Issues
  • Home Assistant: 🟡 Issues
  • Storage: 🟡 Issues
  • Network: 🟡 Issues

🚨 Critical Risks (P0): 2 item(s)
  🔴 🎯 🚦 APPROVAL BUNDLE #1 — Infrastructure Fixes
  🔴 🎯 🔴 RISK: Zero backup jobs configured

🚦 Awaiting Approval: 1 item(s)
  • 🎯 Leader: 1

🛠️ Improvements Proposed Today: 7 total
  • 🟡 RISK: HA Core update pending
  • 🟡 RISK: TrueNAS monitoring gap
  • ✨ QUICK WIN: PBS datastore monitoring

🤖 Bot Status:
  🎯 Leader: 🔴 (4 tasks, 1 blocked)
  🖥️ Proxmox: 🟡 (5 tasks, 4 blocked)
  🏠 Home: 🟡 (3 tasks, 2 blocked)
  💾 Storage: 🟡 (3 tasks, 2 blocked)
  🌐 Network: 🟡 (2 tasks, 1 blocked)
  🔐 Security: 🟢 (0 tasks)

📌 Next Planned Actions:
  • 🎯 LEADER — Baseline Status (2026-02-15)
  • 🖥️ PROXMOX BOT — Daily Baseline Report
  • 🏠 HOME BOT — Daily Baseline Report

— End of Report
```

---

**Endpoint:** `GET /api/reports/daily`
