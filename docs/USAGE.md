# Usage Guide

## Dashboard Overview

The main dashboard provides:
- System status overview
- Active tasks list
- Bot fleet status
- Recent activity log

## Managing Tasks

### View All Tasks
Open http://localhost:3000 and click the Tasks tab.

### Create a Task
```bash
curl -X POST http://localhost:3000/api/tasks   -H 'Content-Type: application/json'   -d '{"title":"Example Task","bot":"proxmox","priority":"medium"}'
```

### Complete a Task
```bash
curl -X POST http://localhost:3000/api/tasks/123/complete
```

## Natural Language Commands

The dashboard understands natural language commands:

| Command | Action |
|---------|--------|
| "Show queue" | Lists all queued tasks |
| "What is the status of Proxmox?" | Checks Proxmox status |
| "Assign critical task to Leader" | Routes task to Leader bot |
| "Show completed tasks" | Lists completed tasks |

## Telegram Commands

Send these to your Telegram bot:

- /status - Show system status
- /queue - List queued tasks
- /bots - Show bot fleet status

## Infrastructure Monitoring

The dashboard automatically monitors:
- Proxmox hosts
- Home Assistant
- Storage servers
- Network devices

Results display in the Infrastructure panel.

## Approval Workflow

High-risk operations require approval:
1. Operation is queued
2. Dashboard shows approval request
3. Click Approve or Reject
4. Operation proceeds or cancels

## Token Analytics

View usage statistics:
- Total tokens used
- Cost estimates
- Usage by bot
- Daily summaries

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+R | Refresh data |
| Ctrl+/ | Focus search |
| Escape | Close modals |
