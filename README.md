# OpenClaw Mission Control

Infrastructure monitoring and agent fleet orchestration dashboard.

## Overview

OpenClaw Mission Control is a unified dashboard for managing infrastructure assets, agent bots, tasks, and approvals. It provides real-time monitoring, natural language command routing, and seamless Telegram integration.

## Features

- **Agent Fleet Management**: Deploy and monitor specialized bots
- **Natural Language Router**: Route commands using plain English
- **Task Delegation**: Assign and track tasks across your infrastructure
- **Infrastructure Monitoring**: Proxmox, Home Assistant, storage, and network monitoring
- **Token Analytics**: Usage tracking and cost estimation
- **Approval Engine**: Multi-level approval workflows for sensitive operations
- **Telegram Integration**: Control your infrastructure from Telegram

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Anwar-Projects/openclaw-mission-control.git
cd openclaw-mission-control

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the server
npm start
```

Visit http://localhost:3000

## Documentation

- [Installation](docs/INSTALL.md)
- [Configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Usage Guide](docs/USAGE.md)
- [FAQ](docs/FAQ.md)

## Tech Stack

- Node.js (vanilla HTTP server - no Express)
- Vanilla JavaScript (frontend)
- File-based JSON storage
- SQLite for some features

## License

MIT License - see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
