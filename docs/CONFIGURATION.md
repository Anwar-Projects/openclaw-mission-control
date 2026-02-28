# Configuration Guide

## Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| NODE_ENV | development | Environment mode |
| DATA_DIR | ./data | Data storage directory |

### Telegram Integration

| Variable | Required | Description |
|----------|----------|-------------|
| TELEGRAM_BOT_TOKEN | No | Bot token from @BotFather |
| TELEGRAM_ALLOWED_CHAT_ID | No | Restrict to specific chat |
| TELEGRAM_ALLOWED_USERNAME | Yes | Allowed username |
| TELEGRAM_POLL_INTERVAL_MS | 1500 | Polling interval |

### Infrastructure Monitoring

Configure infrastructure assets in code or set these env vars:

| Variable | Description |
|----------|-------------|
| PROXMOX_HOST | Proxmox IP address |
| PROXMOX_USER | SSH username |
| HOME_ASSISTANT_HOST | HA IP address |
| PBS_HOST | Proxmox Backup Server IP |

## Configuration Files

### .env.example

See the root `.env.example` file for a complete template.

### config/ Directory

The `config/` directory contains YAML configuration files for dashboard layouts.

## Bot Configuration

Bots are configured in `src/bots/`. Each bot has:
- Topics it handles
- Commands it responds to
- Routing rules

## Security Considerations

1. Never commit `.env` to git
2. Use strong tokens for Telegram bots
3. Restrict allowed chat IDs in production
4. Keep SSH keys secure
5. Regular dependency updates
