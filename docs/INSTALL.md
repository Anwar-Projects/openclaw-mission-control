# Installation Guide

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Telegram Bot Token (optional, for Telegram integration)
- Proxmox access (optional, for Proxmox monitoring)

## Step-by-Step Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Anwar-Projects/openclaw-mission-control.git
cd openclaw-mission-control
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ALLOWED_CHAT_ID=your_chat_id
TELEGRAM_ALLOWED_USERNAME=your_username

# Infrastructure (optional)
PROXMOX_HOST=your_proxmox_ip
PROXMOX_USER=root
```

### 4. Create Data Directories

```bash
mkdir -p data/tasks data/runs data/queues data/telegram data/logs
```

### 5. Start the Server

```bash
npm start
```

The dashboard will be available at http://localhost:3000

## Development Mode

```bash
npm run dev
```

## Verifying Installation

1. Open http://localhost:3000 in your browser
2. You should see the dashboard UI
3. Check browser console for any errors
4. Check terminal for server logs

## Troubleshooting

### Port already in use

Change the PORT in .env or kill the existing process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Permission errors

Ensure the data directory is writable:
```bash
chmod -R 755 data/
```

### Module not found

Delete node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```
