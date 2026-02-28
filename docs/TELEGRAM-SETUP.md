# Telegram Integration Setup
**Date:** 2026-02-15  
**Bot Token:** Configured ✅

---

## ✅ Status

| Component | Status |
|-----------|--------|
| Bot Token | ✅ Saved to `.config/telegram.env` |
| Service Module | ✅ `telegram-service.js` created |
| API Endpoints | ✅ Updated `api-server.js` |
| Chat ID | ⏳ Pending — you need to message `/start` |

---

## 📱 How to Activate

### Step 1: Get Your Bot
Your bot is: **@OpenClawMissionControlBot** (or use token to find it)

### Step 2: Send `/start`
1. Open Telegram
2. Find your bot
3. Send message: `/start`

### Step 3: Server Captures Chat ID
The server will automatically:
- Receive the `/start` webhook
- Extract your Chat ID
- Save to `.config/telegram.env`
- Send confirmation message

---

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telegram/webhook` | POST | Incoming Telegram messages |
| `/api/notify/serious` | POST | Send SERIOUS alert |
| `/api/notify/approval` | POST | Send approval request |
| `/api/notify/broadcast` | POST | Send broadcast |
| `/api/notify/telegram-config` | GET | Check config status |

---

## 🚨 Notification Types

### SERIOUS Alerts
Triggered for:
- Data-loss risks
- Outage events
- Security breaches
- Critical backup failures

**Format:**
```
🚨 **SERIOUS EVENT**

**Task:** [title]
**ID:** [id]
**Risk:** [level]
**Agent:** [agent]

[description preview]

🔗 [Dashboard link]
```

### Approval Requests
**Format:**
```
🚦 **APPROVAL REQUIRED**

**Task:** [title]
**ID:** [id]
**Risk:** [level]
**Benefit:** [benefit]

🔗 [Approve/Deny link]
```

### Broadcasts
**Priorities:**
- `Normal` — 📢
- `Urgent` — ⚠️
- `SERIOUS` — 🚨

---

## 🧪 Testing

Run test:
```bash
cd /root/.openclaw/workspace/dashboard
node test-telegram.js
```

Check config:
```bash
curl http://192.168.40.70:3000/api/notify/telegram-config
```

Manual test via API:
```bash
curl -X POST http://192.168.40.70:3000/api/notify/broadcast \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Hello from Mission Control","priority":"Normal"}'
```

---

## 📋 Files

| File | Purpose |
|------|---------|
| `.config/telegram.env` | Bot token + chat ID (restricted) |
| `telegram-service.js` | Telegram API wrapper |
| `api-server.js` | HTTP endpoints for notifications |
| `test-telegram.js` | Test script |

---

## 🔒 Security

- Bot token stored in `.config/telegram.env`
- Chat ID automatically discovered via webhook
- Only `/start` command saves chat ID
- Messages include dashboard links for verification

---

## ⏭️ Next Steps

1. ✅ Send `/start` to your Telegram bot
2. ✅ Restart dashboard server to pick up chat ID
3. ✅ Trigger a test SERIOUS alert
4. ✅ Verify approval notifications

**Dashboard:** http://192.168.40.70:3000
