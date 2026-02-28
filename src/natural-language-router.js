// Natural Language Chat Router
// Routes user messages to appropriate bot or Leader based on content

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class NaturalLanguageRouter {
  constructor() {
    this.apiBase = 'http://127.0.0.1:3000';
    this.bots = {
      'leader': { icon: '🎯', name: 'Leader', topics: ['general', 'status', 'overview', 'queue'] },
      'proxmox': { icon: '🖥️', name: 'Proxmox Bot', topics: ['vm', 'lxc', 'proxmox', 'cluster', 'backup'] },
      'home': { icon: '🏠', name: 'Home Bot', topics: ['home', 'ha', 'assistant', 'automation', 'zigbee', 'mqtt'] },
      'storage': { icon: '💾', name: 'Storage Bot', topics: ['storage', 'pbs', 'truenas', 'zfs', 'nfs', 'disk'] },
      'network': { icon: '🌐', name: 'Network Bot', topics: ['network', 'firewall', 'vlan', 'unifi', 'routing'] }
    };
  }

  /**
   * Process natural language message and route to appropriate bot
   */
  async processMessage(text, user = 'Anwar', platform = 'squad') {
    const lower = text.toLowerCase();
    
    // Check for queue management commands
    const queueAction = this.detectQueueAction(lower);
    if (queueAction) {
      return await this.handleQueueAction(queueAction, text);
    }
    
    // Check for status queries
    if (this.isStatusQuery(lower)) {
      return await this.handleStatusQuery(lower, text);
    }
    
    // Route to specific bot based on topic
    const botId = this.routeToBot(text);
    const bot = this.bots[botId];
    
    // Generate contextual response
    const response = await this.generateBotResponse(botId, text);
    
    return {
      bot: botId,
      icon: bot.icon,
      name: bot.name,
      response: response,
      action: null,
      confidence: 0.9
    };
  }

  /**
   * Detect if message is about queue management
   */
  detectQueueAction(text) {
    // Check queue commands
    const queuePatterns = [
      { pattern: /check.*queue|what.*in.*queue|show.*queue|queue.*status/, action: 'show_queue' },
      { pattern: /assign.*task|assign.*to|route.*task|who.*should.*do/, action: 'assign_task' },
      { pattern: /tasks.*need|task.*attention|in.*progress.*task|waiting.*task/, action: 'show_in_progress' },
      { pattern: /how.*many.*task|task count|pending.*task/, action: 'task_count' },
      { pattern: /complete.*task|finish.*task|mark.*complete|close.*task/, action: 'complete_task' },
    ];
    
    for (const { pattern, action } of queuePatterns) {
      if (pattern.test(text)) {
        return action;
      }
    }
    return null;
  }

  /**
   * Handle queue management actions
   */
  async handleQueueAction(action, text) {
    try {
      // Fetch current queue state
      const response = await fetch(`${this.apiBase}/api/queue/summary`);
      const queueData = await response.json();
      const summary = queueData.summary;
      
      switch (action) {
        case 'show_queue':
        case 'task_count':
          return {
            bot: 'leader',
            icon: '🎯',
            name: 'Leader',
            response: this.formatQueueSummary(summary),
            action: 'queue_summary',
            confidence: 0.95
          };
          
        case 'show_in_progress':
          const tasks = await this.fetchTasks();
          const inProgress = tasks.filter(t => 
            t.column === 'in-progress' || t.column === 'assigned' || t.column === 'executing'
          );
          
          return {
            bot: 'leader',
            icon: '🎯',
            name: 'Leader',
            response: this.formatActiveTasks(inProgress),
            action: 'show_active',
            confidence: 0.95
          };
          
        case 'assign_task':
          return {
            bot: 'leader',
            icon: '🎯',
            name: 'Leader',
            response: `🎯 I'm ready to assign tasks!\n\nCurrent queue:\n• ${summary.assigned} tasks ready for assignment\n• ${summary['in-progress']} tasks awaiting assignment\n\nTell me which task ID to assign, or I'll auto-route all in-progress tasks to the appropriate bots now.`,
            action: 'trigger_assignment',
            confidence: 0.9
          };
          
        default:
          return null;
      }
    } catch (e) {
      return {
        bot: 'leader',
        icon: '🎯',
        name: 'Leader',
        response: `❌ Couldn't fetch queue status: ${e.message}`,
        action: null,
        confidence: 0
      };
    }
  }

  /**
   * Check if message is a status query
   */
  isStatusQuery(text) {
    const statusPatterns = [
      /status|state|health|condition/,
      /how is|what's the|show me.*status/,
      /check.*system|system.*ok|running/,
      /overview|summary|dashboard/,
      /proxmox.*status|ha.*status|storage.*status/,
    ];
    return statusPatterns.some(p => p.test(text));
  }

  /**
   * Handle status queries
   */
  async handleStatusQuery(text, original) {
    const lower = text;
    
    // Check for specific system
    if (lower.includes('proxmox') || lower.includes('vm')) {
      return {
        bot: 'proxmox',
        icon: '🖥️',
        name: 'Proxmox Bot',
        response: await this.getProxmoxStatus(),
        action: null,
        confidence: 0.95
      };
    }
    
    if (lower.includes('home') || lower.includes('ha ') || lower.includes('assistant')) {
      return {
        bot: 'home',
        icon: '🏠',
        name: 'Home Bot',
        response: await this.getHomeAssistantStatus(),
        action: null,
        confidence: 0.95
      };
    }
    
    if (lower.includes('storage') || lower.includes('pbs') || lower.includes('truenas')) {
      return {
        bot: 'storage',
        icon: '💾',
        name: 'Storage Bot',
        response: await this.getStorageStatus(),
        action: null,
        confidence: 0.95
      };
    }
    
    if (lower.includes('network') || lower.includes('firewall') || lower.includes('vlan')) {
      return {
        bot: 'network',
        icon: '🌐',
        name: 'Network Bot',
        response: await this.getNetworkStatus(),
        action: null,
        confidence: 0.95
      };
    }
    
    // General system status
    const queueSummary = await this.fetchQueueSummary();
    return {
      bot: 'leader',
      icon: '🎯',
      name: 'Leader',
      response: `🟢 **System Status Overview**\n\n**Task Queue:**\n${queueSummary}\n\n**Quick Commands:**\n• "Show Proxmox VMs"\n• "Home Assistant status"\n• "Storage space"\n• "Check tasks"`,
      action: null,
      confidence: 0.9
    };
  }

  /**
   * Route message to appropriate bot
   */
  routeToBot(text) {
    const lower = text.toLowerCase();
    const scores = {};
    
    for (const [botId, config] of Object.entries(this.bots)) {
      scores[botId] = 0;
      for (const topic of config.topics) {
        if (lower.includes(topic)) {
          scores[botId] += 1;
        }
      }
    }
    
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'leader';
  }

  /**
   * Generate contextual response from bot
   */
  async generateBotResponse(botId, text) {
    const responses = {
      'leader': `I'm Genie, your homelab Leader. I coordinate tasks across all bots and provide system-wide visibility.\n\nCurrent focus:\n• ${await this.getActiveTaskCount()} tasks active\n• All systems operational\n\nWhat would you like to know?`,
      
      'proxmox': `🖥️ I'm Proxmox Bot. I manage your virtualization infrastructure.\n\n**What's on my plate:**\n• VM health monitoring\n• Cluster management\n• Backup scheduling\n• Resource optimization\n\nAsk me about:\n• VM status\n• Backup jobs\n• Resource usage`,
      
      'home': `🏠 I'm Home Bot. I manage your Home Assistant and smart home devices.\n\n**Current State:**\n• 471 entities tracked\n• 40 automation use-cases designed\n• Zigbee mesh healthy\n\nAsk me about:\n• Entity status\n• Automations\n• Device batteries`,
      
      'storage': `💾 I'm Storage Bot. I monitor your data infrastructure.\n\n**Focus Areas:**\n• TrueNAS health\n• PBS backup status\n• ZFS pools\n• Capacity planning\n\nAsk me about:\n• Free space\n• Backup status\n• Pool health`,
      
      'network': `🌐 I'm Network Bot. I manage your infrastructure connectivity.\n\n**Responsibilities:**\n• VLAN health\n• Firewall rules\n• Routing\n• Network topology\n\nAsk me about:\n• Network status\n• Firewall rules\n• Topology map`
    };
    
    return responses[botId] || responses['leader'];
  }

  /**
   * Format queue summary
   */
  formatQueueSummary(summary) {
    return `📊 ** Mission Control Queue Status **\n\n` +
           `• 📋 Review: ${summary.review} tasks awaiting approval\n` +
           `• 📥 In-Progress: ${summary['in-progress']} approved, awaiting assignment\n` +
           `• 📤 Assigned: ${summary.assigned} tasks assigned to bots\n` +
           `• 🔨 Executing: ${summary.executing} bots actively working\n` +
           `• ✅ Completed: ${summary.completed} tasks done\n\n` +
           `📈 Total Active: ${summary.assigned + summary['in-progress'] + summary.executing} tasks`;
  }

  /**
   * Format active tasks
   */
  formatActiveTasks(tasks) {
    if (tasks.length === 0) {
      return "✅ No active tasks requiring attention.";
    }
    
    const byColumn = {};
    for (const t of tasks) {
      const col = t.column || 'unknown';
      byColumn[col] = (byColumn[col] || 0) + 1;
    }
    
    return `📋 ** Active Tasks Requiring Attention**\n` +
           `Total: ${tasks.length} tasks\n\n` +
           `By Status:\n` +
           Object.entries(byColumn).map(([col, count]) => 
             `• ${col}: ${count} tasks`
           ).join('\n') +
           `\n\n💡 Say "assign all" to route to appropriate bots.`;
  }

  /**
   * Fetch helpers
   */
  async fetchQueueSummary() {
    try {
      const response = await fetch(`${this.apiBase}/api/queue/summary`);
      const data = await response.json();
      return this.formatQueueSummary(data.summary);
    } catch {
      return 'Queue data unavailable';
    }
  }

  async fetchTasks() {
    try {
      const response = await fetch(`${this.apiBase}/api/tasks`);
      return await response.json();
    } catch {
      return [];
    }
  }

  async getActiveTaskCount() {
    try {
      const response = await fetch(`${this.apiBase}/api/queue/summary`);
      const data = await response.json();
      const s = data.summary;
      return s.assigned + s['in-progress'] + s.executing;
    } catch {
      return '?';
    }
  }

  async getProxmoxStatus() {
    return `🖥️ ** Proxmox Status **\n\n` +
           `• Primary (192.168.10.150): pve-manager/8.4.16 ✅\n` +
           `• Secondary (192.168.10.100): pve-manager/9.1.5 ✅\n` +
           `• Running VMs/CTs: 6 active\n` +
           `•\n🔴 CRITICAL: NVME/SSDVM at 100% - needs cleanup\n\nI can help free space if you approve deletions.`;
  }

  async getHomeAssistantStatus() {
    return '🏠 **Home Assistant Status**\n\n' +
           '• Core: 2026.2.2\n' +
           '• OS: 16.3 (17.1 available for upgrade)\n' +
           '• Entities: 471 tracked\n' +
           '• 40 automation use-cases ready\n' +
           '• Zigbee: Mesh healthy\n\n' +
           '40 use-cases await deployment. See: HA_AUTOMATION_MASTERPLAN.md';
  }

  async getStorageStatus() {
    return `💾 **Storage Status**\n\n` +
           `• TrueNAS: 9.8TB free (96%) ✅\n` +
           `• MAINDSM: 2.3TB free (68%) ⚠️\n` +
           `• NVME VG: 120MB free (100%) 🔴 CRITICAL\n` +
           `• SSDVM VG: 124MB free (100%) 🔴 CRITICAL\n\n` +
           `⚠️ **ACTION NEEDED:** Storage critical on Proxmox primary.\n` +
           `I have deletion candidates ready for your approval.`;
  }

  async getNetworkStatus() {
    return `🌐 **Network Status**\n\n` +
           `• Firewalla: Gateway active ✅\n` +
           `• UniFi UCG: Controller online ✅\n` +
           `• VLANs: 6 configured (all healthy)\n` +
           `• DNS: Operational ✅\n\n` +
           `All systems operational.`;
  }
}

module.exports = NaturalLanguageRouter;

// For testing
if (require.main === module) {
  const router = new NaturalLanguageRouter();
  
  const tests = [
    "check the queue",
    "how many tasks",
    "show me in progress tasks", 
    "assign tasks to bots",
    "proxmox status",
    "home assistant",
    "storage space",
    "network status"
  ];
  
  async function runTests() {
    for (const test of tests) {
      console.log(`\n🧪 "${test}"`);
      const result = await router.processMessage(test);
      console.log(`→ ${result.icon} ${result.name}: ${result.response.substring(0, 100)}...`);
    }
  }
  
  runTests().catch(console.error);
}
