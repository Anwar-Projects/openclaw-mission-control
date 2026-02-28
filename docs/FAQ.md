# Frequently Asked Questions

## General

### What is OpenClaw Mission Control?
A unified dashboard for managing infrastructure assets, agent bots, tasks, and approvals.

### Do I need Telegram?
No, Telegram integration is optional but adds remote control capabilities.

### What infrastructure can it monitor?
- Proxmox VE hosts
- Home Assistant
- Proxmox Backup Server
- Network devices
- Custom SSH-accessible servers

## Installation

### What Node.js version is required?
Node.js 20.x or higher. Node.js 22.x is recommended.

### Can I run this on a Raspberry Pi?
Yes, it runs on any device that supports Node.js, including Raspberry Pi.

### Does it require a database?
No, it uses file-based JSON storage by default.

## Configuration

### How do I set up Telegram?
1. Message @BotFather on Telegram
2. Create a new bot
3. Copy the token to your .env
4. Set TELEGRAM_BOT_TOKEN

### Where do I configure infrastructure?
Edit the INFRA_ASSETS object in src/services/infra-service.js

### Can I restrict Telegram access?
Yes, set TELEGRAM_ALLOWED_CHAT_ID and TELEGRAM_ALLOWED_USERNAME.

## Usage

### How do I add a new bot?
1. Create a file in src/bots/
2. Extend the base bot class
3. Register in the router

### How do I check logs?
Logs are written to:
- data/activity_log.jsonl
- console output
- data/logs/ directory

### Can I customize the dashboard?
Yes, edit public/index.html and public/styles.css

## Troubleshooting

### Dashboard won't load
- Check if port 3000 is available
- Verify npm install completed
- Check server logs

### Telegram not receiving messages
- Verify bot token is correct
- Check TELEGRAM_ALLOWED_CHAT_ID
- Ensure bot privacy mode is disabled for groups

### Tasks not executing
- Check bot status in dashboard
- Verify bot has proper permissions
- Check execution-engine logs

### Proxmox connection fails
- Verify SSH keys are set up
- Check PROXMOX_HOST in config
- Ensure SSH port 22 is open

## Contributing

### How can I contribute?
See CONTRIBUTING.md for guidelines.

### Where do I report bugs?
Open an issue on GitHub.

### Can I request features?
Yes, open a feature request issue.
