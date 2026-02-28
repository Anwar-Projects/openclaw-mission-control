// Default configuration - override in .env file
module.exports = {
  server: {
    port: process.env.PORT || 3000,
    dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000'
  },
  
  infrastructure: {
    proxmox: {
      primary: {
        host: process.env.PROXMOX_PRIMARY_HOST || '192.168.10.150',
        user: process.env.PROXMOX_USER || 'root',
        sshKey: process.env.PROXMOX_SSH_KEY || '~/.ssh/openclaw_infra'
      },
      secondary: {
        host: process.env.PROXMOX_SECONDARY_HOST || '192.168.10.100',
        user: process.env.PROXMOX_USER || 'root',
        sshKey: process.env.PROXMOX_SSH_KEY || '~/.ssh/openclaw_infra'
      }
    },
    homeAssistant: {
      host: process.env.HOME_ASSISTANT_HOST || '192.168.60.10',
      sshPort: process.env.HOME_ASSISTANT_SSH_PORT || 2222
    },
    pbs: {
      host: process.env.PBS_HOST || '192.168.30.22'
    },
    storage: {
      truenas: {
        host: process.env.TRUENAS_HOST || '192.168.30.21'
      }
    },
    network: {
      opnsense: {
        host: process.env.OPNSENSE_HOST || '192.168.30.120'
      },
      gateway: {
        host: process.env.GATEWAY_HOST || '192.168.10.1'
      }
    }
  }
};

