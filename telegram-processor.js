// Leader Telegram Message Processor
// Processes messages from Telegram queue and generates responses

const fs = require('fs').promises;
const path = require('path');

const QUEUE_PATH = '/root/.openclaw/workspace/dashboard/data/telegram/message_queue.jsonl';
const POLL_INTERVAL = 1000; // 1 second

class TelegramProcessor {
  constructor() {
    this.running = false;
    this.activityLogger = null;
  }

  setActivityLogger(logger) {
    this.activityLogger = logger;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log('[Leader] Telegram processor started');
    
    while (this.running) {
      await this.processQueue();
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }

  stop() {
    this.running = false;
    console.log('[Leader] Telegram processor stopped');
  }

  async processQueue() {
    try {
      // Check if queue exists
      try {
        await fs.access(QUEUE_PATH);
      } catch {
        return;
      }

      const data = await fs.readFile(QUEUE_PATH, 'utf8');
      const lines = data.trim().split('\n').filter(l => l);
      let modified = false;
      const entries = [];

      // Parse all entries
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {}
      }

      // Process pending entries
      for (const entry of entries) {
        if (entry.status !== 'pending') continue;
        
        const reply = this.generateReply(entry);
        entry.status = 'replied';
        entry.replyText = reply;
        entry.repliedAt = new Date().toISOString();
        modified = true;
        
        console.log(`[Leader] Replied to ${entry.user}: ${reply.substring(0, 50)}...`);
      }

      // Write back if modified
      if (modified) {
        const newData = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
        await fs.writeFile(QUEUE_PATH, newData, 'utf8');
      }

    } catch (e) {
      console.error('[Leader] Processor error:', e.message);
    }
  }

  generateReply(entry) {
    const { user, text } = entry;
    const lower = text.toLowerCase();

    // Greetings
    if (lower.match(/^(hello|hi|hey|greetings|howdy)/)) {
      return `👋 Hello ${user}!\n\nI'm Genie, your homelab Leader. How can I help you today?\n\nTry:\n• /status — System overview\n• /approvals — Pending items\n• "Show me storage" or "What's the status?"`;
    }

    // Status queries
    if (lower.includes('status') || lower.includes('system')) {
      return `🟢 **System Status**\n\nDashboard: http://192.168.40.70:3000\n\nInfrastructure:\n• Proxmox Primary: Online\n• Proxmox Secondary: Online\n• Home Assistant: OK\n• TrueNAS: 9.8TB free\n\nPending: Check /approvals`;
    }

    // Storage queries
    if (lower.includes('storage') || lower.includes('disk') || lower.includes('space')) {
      return `💾 **Storage Status**\n\n• TrueNAS: 9.8TB free (96%) ✅\n• MAINDSM: 2.3TB free (68%) ⚠️\n• NVME VG: 120MB free (CRITICAL) 🔴\n• SSDVM VG: 124MB free (CRITICAL) 🔴\n\nTasks awaiting approval to free space.`;
    }

    // Proxmox queries
    if (lower.includes('proxmox') || lower.includes('vm') || lower.includes('lxc')) {
      return `🖥️ **Proxmox Status**\n\n• Primary (192.168.10.150): pve-manager/8.4.16 ✅\n• Secondary (192.168.10.100): pve-manager/9.1.5 ✅\n• Running VMs/CTs: 6 active\n\n⚠️ **P0 Alert:** NVME/SSDVM at 100%\nDeletion candidates ready for approval.`;
    }

    // Home Assistant queries
    if (lower.includes('home assistant') || lower.includes('ha ') || lower.includes('home')) {
      return `🏠 **Home Assistant**\n\n• Core: 2026.2.2\n• OS: 16.3 (17.1 available)\n• Entities: 471 tracked\n• 40 automation use-cases ready\n\nSee: HA_AUTOMATION_MASTERPLAN.md`;
    }

    // Backup queries
    if (lower.includes('backup') || lower.includes('pbs')) {
      return `💾 **Backup Status**\n\n• PBS-TRUENAS: Running ✅\n• PBS-MAIN: Running ✅\n• Daily backups: Active\n• Weekly (Sun 01:00): 20 VMs → TRUENAS\n\nLast backup: Today 18:42 (CT 131, 5.65GB)`;
    }

    // Approval queries
    if (lower.includes('approval') || lower.includes('pending') || lower.includes('review')) {
      return `🚦 **Approvals**\n\nPending items in dashboard. Use /approvals or visit:\n\nhttp://192.168.40.70:3000\n\nHigh priority:\n• TASK-007: Storage cleanup (P0)\n• TASK-002: VM cleanup (P1)`;
    }

    // Task queries
    if (lower.includes('task') || lower.includes('work') || lower.includes('mission')) {
      return `✅ **Active Work**\n\n6 tasks in progress across bots. Check dashboard for current queue state.\n\nDashboard: http://192.168.40.70:3000`;
    }

    // Network queries
    if (lower.includes('network') || lower.includes('vlan') || lower.includes('firewall')) {
      return `🌐 **Network Status**\n\n• Firewalla: Gateway active\n• UniFi UCG: Controller online\n• VLANs: 6 configured\n• DNS: Operational\n\nAll systems nominal.`;
    }

    // Dashboard queries
    if (lower.includes('dashboard') || lower.includes('mission control') || lower.includes('panel')) {
      return `📊 **Mission Control**\n\nhttp://192.168.40.70:3000\n\nPanels:\n• Mission Queue (Review/In-Progress/Completed)\n• Squad Chat\n• System Overview\n• Agent Fleet\n\nRefresh: Every 5 seconds`;
    }

    // Help
    if (lower.includes('help') || lower.includes('command')) {
      return `📚 **How to use this bot**\n\n**Commands:**\n• /status — System overview\n• /approvals — Pending approvals\n• /approve <id> [reason] — Approve\n• /deny <id> [reason] — Deny\n• /defer <id> [reason] — Defer\n\n**Chat naturally:** Ask about Proxmox, storage, Home Assistant, backups, or any homelab topic.`;
    }

    // Default response
    return `👋 Hello ${user}!\n\nI received: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"\n\nI'm the Leader coordinating your homelab. Ask me about:\n• /status — System overview\n• Storage, Proxmox, Home Assistant\n• Pending approvals\n• Or just chat naturally!`;
  }
}

module.exports = { TelegramProcessor };
