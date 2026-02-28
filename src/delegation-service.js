// Mission Control - Phase 3: Delegation Router
// Automatically assigns tasks to bots based on tags

const BOT_ROUTES = {
  // Proxmox Bot - Infrastructure
  'proxmox': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
  'vm': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
  'lxc': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
  'cluster': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
  'pve': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
  'vzdump': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
  
  // Home Bot - Home Assistant
  'ha': { agent: 'home', icon: '🏠', name: 'Home' },
  'home': { agent: 'home', icon: '🏠', name: 'Home' },
  'hass': { agent: 'home', icon: '🏠', name: 'Home' },
  'homeassistant': { agent: 'home', icon: '🏠', name: 'Home' },
  'mosquitto': { agent: 'home', icon: '🏠', name: 'Home' },
  'haos': { agent: 'home', icon: '🏠', name: 'Home' },
  
  // Storage Bot - PBS, TrueNAS, Storage
  'storage': { agent: 'storage', icon: '💾', name: 'Storage' },
  'pbs': { agent: 'storage', icon: '💾', name: 'Storage' },
  'truenas': { agent: 'storage', icon: '💾', name: 'Storage' },
  'zfs': { agent: 'storage', icon: '💾', name: 'Storage' },
  'nfs': { agent: 'storage', icon: '💾', name: 'Storage' },
  'iscsi': { agent: 'storage', icon: '💾', name: 'Storage' },
  'backup': { agent: 'storage', icon: '💾', name: 'Storage' },
  'gc': { agent: 'storage', icon: '💾', name: 'Storage' },
  'retention': { agent: 'storage', icon: '💾', name: 'Storage' },
  
  // Network Bot - VLANs, Firewall, Routing
  'network': { agent: 'network', icon: '🌐', name: 'Network' },
  'firewall': { agent: 'network', icon: '🌐', name: 'Network' },
  'firewalla': { agent: 'network', icon: '🌐', name: 'Network' },
  'vlan': { agent: 'network', icon: '🌐', name: 'Network' },
  'unifi': { agent: 'network', icon: '🌐', name: 'Network' },
  'routing': { agent: 'network', icon: '🌐', name: 'Network' },
  'dns': { agent: 'network', icon: '🌐', name: 'Network' },
  'dhcp': { agent: 'network', icon: '🌐', name: 'Network' },
  
  // Security Bot - Advisory only
  'security': { agent: 'security', icon: '🔐', name: 'Security' },
  'audit': { agent: 'security', icon: '🔐', name: 'Security' },
  'credential': { agent: 'security', icon: '🔐', name: 'Security' },
  'hardening': { agent: 'security', icon: '🔐', name: 'Security' },
  ' posture': { agent: 'security', icon: '🔐', name: 'Security' }
};

class DelegationRouter {
  constructor() {
    this.routes = BOT_ROUTES;
  }

  /**
   * Route a task to the appropriate bot based on title, tags, or description
   * @param {Object} task - The task object
   * @returns {Object} - { agent, icon, name, confidence, reason, ambiguous }
   */
  routeTask(task) {
    const tags = (task.tags || []).map(t => t.toLowerCase());
    const title = (task.title || '').toLowerCase();
    const desc = (task.description || '').toLowerCase();
    
    const scores = {};
    
    // Score each route
    for (const [keyword, route] of Object.entries(this.routes)) {
      let score = 0;
      
      // Tag match = highest score
      if (tags.includes(keyword)) score += 10;
      
      // Title match = high score
      if (title.includes(keyword)) score += 5;
      if (title.startsWith(keyword)) score += 3;
      
      // Description match = medium score
      if (desc.includes(keyword)) score += 2;
      
      if (score > 0) {
        const agent = route.agent;
        if (!scores[agent]) scores[agent] = { ...route, score: 0, matches: [] };
        scores[agent].score += score;
        scores[agent].matches.push(keyword);
      }
    }
    
    // No matches found
    if (Object.keys(scores).length === 0) {
      return {
        agent: 'leader',
        icon: '🎯',
        name: 'Leader',
        confidence: 0,
        reason: 'No matching tags found - requires manual assignment',
        ambiguous: true
      };
    }
    
    // Find best match(es)
    const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
    const best = sorted[0];
    
    // Check if there's ambiguity (tie or close scores)
    const ambiguous = sorted.length > 1 && (sorted[1].score / best.score) > 0.8;
    
    if (ambiguous) {
      return {
        agent: 'leader',
        icon: '🎯',
        name: 'Leader',
        confidence: best.score / 20, // Max score is ~20
        reason: `Ambiguity detected: ${best.name} (${best.score}) vs ${sorted[1].name} (${sorted[1].score}) - needs Anwar decision`,
        ambiguous: true,
        candidates: sorted.slice(0, 2).map(s => s.name)
      };
    }
    
    return {
      agent: best.agent,
      icon: best.icon,
      name: best.name,
      confidence: best.score / 20,
      reason: `Matched keywords: ${[...new Set(best.matches)].join(', ')}`,
      ambiguous: false
    };
  }

  /**
   * Auto-assign a task via Leader (for API calls)
   * @param {Object} task - The task to auto-assign
   * @returns {Object} - Updated task with agent assignment
   */
  autoAssign(task) {
    const routing = this.routeTask(task);
    
    if (routing.ambiguous) {
      task.agent = 'leader';
      task.agentIcon = '🎯';
      task.column = 'review';
      task.status = 'review';
      task.ambiguityNote = routing.reason;
      task.ambiguityCandidates = routing.candidates;
      return { ...task, action: 'review', note: routing.reason };
    }
    
    task.agent = routing.agent;
    task.agentIcon = routing.icon;
    task.column = 'assigned';
    task.status = 'assigned';
    task.routedBy = 'Leader';
    task.routingReason = routing.reason;
    task.routingConfidence = routing.confidence;
    
    return { ...task, action: 'assigned', note: routing.reason };
  }
}

// Daily Report Generator
class DailyReports {
  constructor() {
    this.reportTime = '08:30'; // 8:30 AM GST+4 (daily ops briefing)
    this.timezone = 'Asia/Dubai';
  }

  /**
   * Generate a bot's daily status report
   * @param {string} botId - The bot ID
   * @param {Array} tasks - All tasks
   * @returns {Object} - Report object
   */
  generateBotReport(botId, tasks) {
    const botTasks = tasks.filter(t => t.agent === botId && t.status !== 'done');
    const todaysTasks = botTasks.filter(t => {
      const updated = new Date(t.updated);
      const today = new Date();
      return updated.toDateString() === today.toDateString();
    });
    
    const blocked = botTasks.filter(t => t.status === 'review' || t.column === 'review');
    const waitingApproval = botTasks.filter(t => t.column === 'waiting-approval');
    
    const botEmojis = {
      leader: '🎯',
      proxmox: '🖥️',
      home: '🏠',
      storage: '💾',
      network: '🌐',
      security: '🔐'
    };
    
    const botNames = {
      leader: 'Leader',
      proxmox: 'Proxmox',
      home: 'Home',
      storage: 'Storage',
      network: 'Network',
      security: 'Security'
    };
    
    return {
      botId,
      botName: botNames[botId],
      botIcon: botEmojis[botId],
      timestamp: new Date().toISOString(),
      summary: {
        totalActive: botTasks.length,
        updatedToday: todaysTasks.length,
        blocked: blocked.length,
        waitingApproval: waitingApproval.length,
        p0Tasks: botTasks.filter(t => t.priority === 'P0').length
      },
      topTasks: botTasks.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        age: Math.floor((Date.now() - new Date(t.created)) / 86400000)
      })),
      serious: botTasks.filter(t => t.priority === 'P0').length > 0,
      message: this.formatBotMessage(botId, botNames[botId], botEmojis[botId], botTasks, blocked, waitingApproval)
    };
  }

  formatBotMessage(botId, name, icon, tasks, blocked, waitingApproval) {
    const lines = [
      `${icon} **${name} Bot - Daily Status**`,
      '',
      `📊 **Active Tasks:** ${tasks.length}`,
      `🚧 Blocked: ${blocked.length}`,
      `🚦 Waiting Approval: ${waitingApproval.length}`,
    ];
    
    if (tasks.length > 0) {
      lines.push('', '📋 **Top Tasks:**');
      tasks.slice(0, 3).forEach(t => {
        const age = Math.floor((Date.now() - new Date(t.created)) / 86400000);
        lines.push(`  • ${t.title.substring(0, 40)}${t.title.length > 40 ? '...' : ''} (${t.priority}, ${age}d)`);
      });
    }
    
    if (blocked.length > 0) {
      lines.push('', '⚠️ **Blocked Tasks:**');
      blocked.slice(0, 2).forEach(t => {
        lines.push(`  • ${t.title.substring(0, 40)}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Compile all bot reports into Leader's Daily Summary
   * @param {Array} reports - Array of bot reports
   * @param {Array} allTasks - All tasks for improvements count
   * @returns {Object} - Compiled summary
   */
  compileLeaderSummary(reports, allTasks = []) {
    const seriousCount = reports.filter(r => r.serious).length;
    const totalActive = reports.reduce((sum, r) => sum + r.summary.totalActive, 0);
    const totalBlocked = reports.reduce((sum, r) => sum + r.summary.blocked, 0);
    const totalWaiting = reports.reduce((sum, r) => sum + r.summary.waitingApproval, 0);
    
    // P0 critical tasks
    const p0Tasks = [];
    reports.forEach(r => {
      r.topTasks.forEach(t => {
        if (t.priority === 'P0') {
          p0Tasks.push({ ...t, bot: r.botName, botIcon: r.botIcon });
        }
      });
    });
    
    // Infrastructure health check
    const proxmoxReport = reports.find(r => r.botId === 'proxmox');
    const homeReport = reports.find(r => r.botId === 'home');
    const storageReport = reports.find(r => r.botId === 'storage');
    const networkReport = reports.find(r => r.botId === 'network');
    
    const infraStatus = (report) => {
      if (!report) return '⚪ Unknown';
      if (report.summary.p0Tasks > 0) return '🔴 Critical';
      if (report.summary.blocked > 0) return '🟡 Issues';
      if (report.summary.totalActive > 5) return '🟡 Busy';
      return '🟢 OK';
    };
    
    // Improvements proposed today (P2/P3 tasks created today)
    const today = new Date().toDateString();
    const improvementsToday = allTasks.filter(t => {
      const created = new Date(t.created);
      return (t.priority === 'P2' || t.priority === 'P3') && 
             created.toDateString() === today &&
             t.status !== 'done';
    });
    
    // Bot status lines with detailed indicators
    const botStatusLines = reports.map(r => {
      const indicator = r.summary.p0Tasks > 0 ? '🔴' : 
                       r.summary.blocked > 0 ? '🟡' : 
                       r.summary.totalActive > 5 ? '🟡' : '🟢';
      return `  ${r.botIcon} ${r.botName}: ${indicator} (${r.summary.totalActive} tasks${r.summary.blocked > 0 ? `, ${r.summary.blocked} blocked` : ''})`;
    });
    
    // Next planned actions (top P1 items from each bot)
    const nextActions = [];
    reports.forEach(r => {
      const nextTask = r.topTasks.find(t => t.priority === 'P1');
      if (nextTask) {
        nextActions.push(`  • ${r.botIcon} ${nextTask.title.substring(0, 40)}${nextTask.title.length > 40 ? '...' : ''}`);
      }
    });
    
    const lines = [
      '📊 **DAILY HOMELAB SUMMARY** — Leader Bot',
      `📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}`,
      '',
      '🖥️ **Infrastructure**',
      `  • Proxmox: ${infraStatus(proxmoxReport)}`,
      `  • Home Assistant: ${infraStatus(homeReport)}`,
      `  • Storage: ${infraStatus(storageReport)}`,
      `  • Network: ${infraStatus(networkReport)}`,
      ''
    ];
    
    // Critical Risks
    if (p0Tasks.length === 0) {
      lines.push('🚨 **Critical Risks (P0):** None ✅');
    } else {
      lines.push(`🚨 **Critical Risks (P0):** ${p0Tasks.length} item(s)`);
      p0Tasks.slice(0, 3).forEach(t => {
        lines.push(`  🔴 ${t.botIcon} ${t.title.substring(0, 50)}${t.title.length > 50 ? '...' : ''}`);
      });
    }
    lines.push('');
    
    // Approval Queue
    lines.push(`🚦 **Awaiting Approval:** ${totalWaiting} item(s)`);
    if (totalWaiting > 0) {
      reports.filter(r => r.summary.waitingApproval > 0).slice(0, 3).forEach(r => {
        lines.push(`  • ${r.botIcon} ${r.botName}: ${r.summary.waitingApproval}`);
      });
    }
    lines.push('');
    
    // Improvements
    lines.push(`🛠️ **Improvements Proposed Today:** ${improvementsToday.length} total`);
    if (improvementsToday.length > 0) {
      improvementsToday.slice(0, 3).forEach(t => {
        lines.push(`  • ${t.title.substring(0, 45)}${t.title.length > 45 ? '...' : ''}`);
      });
    }
    lines.push('');
    
    // Bot Status
    lines.push('🤖 **Bot Status:**');
    lines.push(...botStatusLines);
    lines.push('');
    
    // Next Actions
    if (nextActions.length > 0) {
      lines.push('📌 **Next Planned Actions:**');
      lines.push(...nextActions.slice(0, 3));
    } else {
      lines.push('📌 **Next Planned Actions:** No P1 items queued');
    }
    
    lines.push('', '— End of Report');
    
    return {
      timestamp: new Date().toISOString(),
      serious: seriousCount > 0,
      summary: {
        totalAgents: reports.length,
        totalActive,
        totalBlocked,
        totalWaiting,
        p0Count: p0Tasks.length,
        improvementsToday: improvementsToday.length
      },
      infrastructure: {
        proxmox: infraStatus(proxmoxReport),
        homeAssistant: infraStatus(homeReport),
        storage: infraStatus(storageReport),
        network: infraStatus(networkReport)
      },
      botReports: reports.map(r => ({
        botId: r.botId,
        botName: r.botName,
        totalActive: r.summary.totalActive,
        blocked: r.summary.blocked,
        p0Tasks: r.summary.p0Tasks,
        status: r.summary.p0Tasks > 0 ? 'critical' : r.summary.blocked > 0 ? 'issues' : 'ok'
      })),
      p0Tasks,
      improvementsToday: improvementsToday.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority
      })),
      message: lines.join('\n')
    };
  }
}

module.exports = {
  DelegationRouter,
  DailyReports,
  BOT_ROUTES
};
