// Mission Control - Phase 4: Infrastructure Monitoring & Activity Logging
// Data models and services for operational dashboard

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const telegram = require('./telegram-service');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INFRA_FILE = path.join(DATA_DIR, 'infra_assets.json');
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity_log.jsonl');
const BOT_STATUS_FILE = path.join(DATA_DIR, 'bot_status.json');

// Infrastructure asset definitions
const INFRA_ASSETS = {
  proxmox_primary: {
    id: 'proxmox_primary',
    name: 'Proxmox Primary',
    icon: '🖥️',
    host: '192.168.10.150',
    type: 'proxmox',
    ssh_user: 'root',
    ssh_key: '~/.ssh/openclaw_infra',
    owner_bot: 'proxmox',
    metrics: {
      reachability: { type: 'ping', port: 22 },
      load: { type: 'ssh_command', command: 'uptime && free -h && df -h' },
      vms: { type: 'ssh_command', command: 'qm list' },
      backups: { type: 'ssh_command', command: 'cat /etc/pve/jobs.cfg 2>/dev/null || echo "NO_BACKUP_JOBS"' }
    },
    severity_thresholds: {
      cpu: { warn: 80, serious: 95 },
      ram: { warn: 80, serious: 95 },
      disk: { warn: 85, serious: 95 }
    }
  },
  
  proxmox_secondary: {
    id: 'proxmox_secondary',
    name: 'Proxmox Secondary',
    icon: '🖥️',
    host: '192.168.10.100',
    type: 'proxmox',
    ssh_user: 'root',
    ssh_key: '~/.ssh/openclaw_infra',
    owner_bot: 'proxmox',
    metrics: {
      reachability: { type: 'ping', port: 22 },
      load: { type: 'ssh_command', command: 'uptime && free -h && df -h' },
      vms: { type: 'ssh_command', command: 'qm list' }
    },
    severity_thresholds: {
      cpu: { warn: 80, serious: 95 },
      ram: { warn: 80, serious: 95 },
      disk: { warn: 85, serious: 95 }
    }
  },
  
  home_assistant: {
    id: 'home_assistant',
    name: 'Home Assistant',
    icon: '🏠',
    host: '192.168.60.10',
    ssh_port: 2222,
    type: 'haos',
    ssh_user: 'root',
    ssh_key: '~/.ssh/openclaw_infra',
    owner_bot: 'home',
    metrics: {
      reachability: { type: 'ping', port: 2222 },
      core_status: { type: 'ssh_command', command: 'ha core info' },
      supervisor_status: { type: 'ssh_command', command: 'ha supervisor info' },
      addons: { type: 'ssh_command', command: 'ha addons --raw-json 2>/dev/null | head -50' }
    }
  },
  
  pbs_dsm: {
    id: 'pbs_dsm',
    name: 'PBS-DSM',
    icon: '💾',
    host: '192.168.30.22',
    type: 'pbs',
    ssh_user: 'root',
    ssh_key: '~/.ssh/openclaw_infra',
    owner_bot: 'storage',
    metrics: {
      reachability: { type: 'ping', port: 22 },
      service: { type: 'ssh_command', command: 'systemctl is-active proxmox-backup-proxy' }
    }
  },
  
  pbs_legacy: {
    id: 'pbs_legacy',
    name: 'PBS Legacy',
    icon: '💾',
    host: '192.168.30.21',
    type: 'pbs',
    ssh_user: 'root',
    ssh_key: '~/.ssh/openclaw_infra',
    owner_bot: 'storage',
    metrics: {
      reachability: { type: 'ping', port: 22 },
      service: { type: 'ssh_command', command: 'systemctl is-active proxmox-backup-proxy' }
    }
  },
  
  truenas: {
    id: 'truenas',
    name: 'TrueNAS',
    icon: '💾',
    host: '192.168.30.120',
    type: 'truenas',
    https_port: 443,
    owner_bot: 'storage',
    metrics: {
      reachability: { type: 'https', port: 443 }
    }
  },
  
  network_summary: {
    id: 'network_summary',
    name: 'Network Health',
    icon: '🌐',
    host: '192.168.10.1',
    type: 'network',
    owner_bot: 'network',
    metrics: {
      reachability: { type: 'ping', port: 0 }, // port 0 = just ICMP ping
      gateway: { type: 'ping', host: '192.168.10.1' },
      dns: { type: 'ping', host: '8.8.8.8' }
    }
  }
};

// Validation utilities
const VALID_SEVERITY = ['OK', 'WARN', 'SERIOUS'];
const VALID_RISK = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_BOTS = ['leader', 'proxmox', 'home', 'storage', 'network', 'security'];

function validateSeverity(severity) {
  if (!VALID_SEVERITY.includes(severity)) {
    throw new Error(`Invalid severity: ${severity}. Must be one of: ${VALID_SEVERITY.join(', ')}`);
  }
  return severity;
}

function validateRisk(risk) {
  if (!VALID_RISK.includes(risk)) {
    throw new Error(`Invalid risk: ${risk}. Must be one of: ${VALID_RISK.join(', ')}`);
  }
  return risk;
}

function validateOwnerBot(bot) {
  if (!VALID_BOTS.includes(bot)) {
    throw new Error(`Invalid owner_bot: ${bot}. Must be one of: ${VALID_BOTS.join(', ')}`);
  }
  return bot;
}

// Activity Logger (append-only)
class ActivityLogger {
  constructor() {
    this.logFile = ACTIVITY_LOG_FILE;
  }

  async log(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...event
    };
    
    // Validate required fields
    if (!entry.bot) throw new Error('Activity log entry must have "bot" field');
    if (!entry.action) throw new Error('Activity log entry must have "action" field');
    if (!entry.severity) throw new Error('Activity log entry must have "severity" field');
    
    validateSeverity(entry.severity);
    if (entry.risk) validateRisk(entry.risk);
    if (entry.owner_bot) validateOwnerBot(entry.owner_bot);
    
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.logFile, line, 'utf8');
    
    return entry;
  }

  async getTimeline(limit = 100, bot = null, severity = null) {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      const lines = data.trim().split('\n').filter(Boolean);
      
      let events = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
      
      // Filter by bot if specified
      if (bot) {
        events = events.filter(e => e.bot === bot);
      }
      
      // Filter by severity if specified
      if (severity) {
        events = events.filter(e => e.severity === severity);
      }
      
      // Sort by timestamp descending, then limit
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return events.slice(0, limit);
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  async getRecentByBot(bot, minutes = 60) {
    const events = await this.getTimeline(1000, bot);
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return events.filter(e => new Date(e.timestamp).getTime() > cutoff);
  }
}

// Bot Status Tracker
class BotStatusTracker {
  constructor() {
    this.statusFile = BOT_STATUS_FILE;
    this.defaultStatus = {
      idle: { icon: '⚪', label: 'Idle', color: '#6e7681' },
      working: { icon: '🔵', label: 'Working', color: '#58a6ff' },
      blocked: { icon: '🔴', label: 'Blocked', color: '#da3633' },
      active: { icon: '🟢', label: 'Active', color: '#238636' }
    };
  }

  async update(botId, status, details = {}) {
    validateOwnerBot(botId);
    
    const update = {
      bot: botId,
      status,
      lastUpdate: new Date().toISOString(),
      ...details
    };
    
    let statuses = {};
    try {
      const data = await fs.readFile(this.statusFile, 'utf8');
      statuses = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet
    }
    
    statuses[botId] = update;
    
    await fs.writeFile(this.statusFile, JSON.stringify(statuses, null, 2), 'utf8');
    return update;
  }

  async getAll() {
    try {
      // First try to read status reports from Leader's queue (more real-time)
      const statusReportsFile = path.join(DATA_DIR, 'queues', 'leader', 'bot_status_reports.jsonl');
      let statuses = {};
      
      try {
        const reportsData = await fs.readFile(statusReportsFile, 'utf8');
        const reports = reportsData.split('\n').filter(line => line.trim()).map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(r => r);
        
        // Get most recent report for each bot
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000); // Consider stale after 5 minutes
        
        reports.forEach(report => {
          if (report.bot) {
            const reportTime = new Date(report.timestamp).getTime();
            const isStale = reportTime < fiveMinutesAgo;
            
            statuses[report.bot] = {
              bot: report.bot,
              status: isStale ? 'idle' : (report.status === 'executing' ? 'working' : 'idle'),
              lastUpdate: report.timestamp,
              currentTask: report.currentTask?.taskId || null,
              queueStats: report.queueStats,
              health: report.health
            };
          }
        });
      } catch (e) {
        // Queue file doesn't exist, fall back to bot_status.json
      }
      
      // Merge with existing bot_status.json for any bots not in reports
      try {
        const data = await fs.readFile(this.statusFile, 'utf8');
        const existing = JSON.parse(data);
        Object.entries(existing).forEach(([botId, status]) => {
          if (!statuses[botId]) {
            statuses[botId] = status;
          }
        });
      } catch (e) {
        // File doesn't exist
      }
      
      // Return merged statuses with defaults for any missing bots
      const defaultStatuses = {
        leader: { bot: 'leader', status: 'active', lastUpdate: new Date().toISOString() },
        dashboard: { bot: 'dashboard', status: 'idle', lastUpdate: new Date().toISOString() },
        proxmox: { bot: 'proxmox', status: 'idle', lastUpdate: new Date().toISOString() },
        home: { bot: 'home', status: 'idle', lastUpdate: new Date().toISOString() },
        storage: { bot: 'storage', status: 'idle', lastUpdate: new Date().toISOString() },
        network: { bot: 'network', status: 'idle', lastUpdate: new Date().toISOString() },
        security: { bot: 'security', status: 'idle', lastUpdate: new Date().toISOString() }
      };
      
      return { ...defaultStatuses, ...statuses };
    } catch (e) {
      // Return default statuses if everything fails
      return {
        leader: { bot: 'leader', status: 'active', lastUpdate: new Date().toISOString() },
        dashboard: { bot: 'dashboard', status: 'idle', lastUpdate: new Date().toISOString() },
        proxmox: { bot: 'proxmox', status: 'idle', lastUpdate: new Date().toISOString() },
        home: { bot: 'home', status: 'idle', lastUpdate: new Date().toISOString() },
        storage: { bot: 'storage', status: 'idle', lastUpdate: new Date().toISOString() },
        network: { bot: 'network', status: 'idle', lastUpdate: new Date().toISOString() },
        security: { bot: 'security', status: 'idle', lastUpdate: new Date().toISOString() }
      };
    }
  }

  async get(botId) {
    const all = await this.getAll();
    return all[botId] || { bot: botId, status: 'unknown', lastUpdate: null };
  }
}

// Infrastructure Monitor
class InfraMonitor {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60000; // 60 seconds
    this.logger = new ActivityLogger();
  }

  async checkAsset(assetId) {
    const asset = INFRA_ASSETS[assetId];
    if (!asset) throw new Error(`Unknown asset: ${assetId}`);
    
    // Check cache
    const cached = this.cache.get(assetId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.data;
    }
    
    const result = {
      id: asset.id,
      name: asset.name,
      icon: asset.icon,
      host: asset.host,
      type: asset.type,
      owner_bot: asset.owner_bot,
      checked_at: new Date().toISOString(),
      severity: 'OK',
      metrics: {},
      errors: []
    };
    
    // Check reachability
    try {
      const pingResult = await this.pingHost(asset.host, asset.metrics.reachability.port || 22);
      result.metrics.reachability = { status: 'up', latency_ms: pingResult.latency };
    } catch (e) {
      result.metrics.reachability = { status: 'down', error: e.message };
      result.severity = 'SERIOUS';
      result.errors.push(`Unreachable: ${e.message}`);
    }
    
    // If reachable, check other metrics
    if (result.metrics.reachability.status === 'up' && asset.metrics.load) {
      try {
        const loadData = await this.sshCheck(asset, asset.metrics.load.command);
        result.metrics.load = this.parseLoadData(loadData);
        
        // Check thresholds
        if (asset.severity_thresholds) {
          const { cpu, ram, disk } = result.metrics.load;
          if (cpu > asset.severity_thresholds.cpu.serious || 
              ram > asset.severity_thresholds.ram.serious || 
              disk > asset.severity_thresholds.disk.serious) {
            result.severity = 'SERIOUS';
          } else if (cpu > asset.severity_thresholds.cpu.warn || 
                     ram > asset.severity_thresholds.ram.warn || 
                     disk > asset.severity_thresholds.disk.warn) {
            if (result.severity === 'OK') result.severity = 'WARN';
          }
        }
      } catch (e) {
        result.errors.push(`Load check failed: ${e.message}`);
      }
    }
    
    // Check VMs for Proxmox
    if (asset.metrics.vms && result.metrics.reachability.status === 'up') {
      try {
        const vmData = await this.sshCheck(asset, asset.metrics.vms.command);
        result.metrics.vms = { count: vmData.split('\n').filter(l => l.trim() && !l.startsWith('VMID')).length };
      } catch (e) {
        result.metrics.vms = { error: e.message };
      }
    }
    
    // Check backups for Proxmox
    if (asset.metrics.backups && result.metrics.reachability.status === 'up') {
      try {
        const backupData = await this.sshCheck(asset, asset.metrics.backups.command);
        result.metrics.backups = { 
          configured: !backupData.includes('NO_BACKUP_JOBS'),
          raw: backupData.substring(0, 500)
        };
        if (!result.metrics.backups.configured && result.severity === 'OK') {
          result.severity = 'WARN';
        }
      } catch (e) {
        result.metrics.backups = { error: e.message };
      }
    }
    
    // Check HA core status
    if (asset.metrics.core_status && result.metrics.reachability.status === 'up') {
      try {
        const coreData = await this.sshCheck(asset, asset.metrics.core_status.command);
        result.metrics.core = this.parseHAInfo(coreData);
      } catch (e) {
        result.metrics.core = { error: e.message };
      }
    }
    
    // Check PBS service
    if (asset.metrics.service && result.metrics.reachability.status === 'up') {
      try {
        const serviceData = await this.sshCheck(asset, asset.metrics.service.command);
        result.metrics.service = { status: serviceData.trim() };
        if (serviceData.trim() !== 'active') {
          if (result.severity === 'OK') result.severity = 'WARN';
        }
      } catch (e) {
        result.metrics.service = { status: 'unknown', error: e.message };
      }
    }
    
    // Check TrueNAS HTTPS
    if (asset.metrics.reachability.type === 'https') {
      try {
        // Simple HTTPS check using curl
        await execPromise(`curl -sk -m 5 -o /dev/null -w "%{http_code}" https://${asset.host}:${asset.https_port || 443}`);
        result.metrics.reachability = { status: 'up', protocol: 'https' };
      } catch (e) {
        result.metrics.reachability = { status: 'down', protocol: 'https', error: e.message };
        result.severity = 'WARN'; // TrueNAS is less critical
      }
    }
    
    // Cache result
    this.cache.set(assetId, { timestamp: Date.now(), data: result });
    
    // Log significant events
    if (result.severity === 'SERIOUS') {
      await this.logger.log({
        bot: asset.owner_bot,
        action: 'INFRA_CHECK_FAILED',
        severity: 'SERIOUS',
        risk: 'HIGH',
        target: asset.name,
        message: `Infrastructure check failed for ${asset.name}`,
        details: result.errors,
        owner_bot: asset.owner_bot
      });
    }
    
    return result;
  }

  async pingHost(host, port) {
    const start = Date.now();
    try {
      await execPromise(`nc -z -w 5 ${host} ${port}`);
      return { latency: Date.now() - start };
    } catch (e) {
      throw new Error(`Port ${port} unreachable on ${host}`);
    }
  }

  async sshCheck(asset, command) {
    const sshCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ${asset.ssh_key} ${asset.ssh_user}@${asset.host} '${command}'`;
    const { stdout } = await execPromise(sshCmd);
    return stdout;
  }

  parseLoadData(data) {
    // Simple parsing - could be enhanced
    const lines = data.split('\n');
    let cpu = 0, ram = 0, disk = 0;
    
    for (const line of lines) {
      if (line.includes('load average')) {
        const match = line.match(/load average[s]?:\s*([\d.]+)/);
        if (match) cpu = parseFloat(match[1]) * 100 / 4; // Approximate % on 4-core
      }
      if (line.includes('Mem:')) {
        const match = line.match(/Mem:\s+(\d+)\s+(\d+)/);
        if (match) ram = (parseInt(match[2]) / parseInt(match[1])) * 100;
      }
      if (line.includes('/dev/') && line.includes('%')) {
        const match = line.match(/(\d+)%/);
        if (match) disk = Math.max(disk, parseInt(match[1]));
      }
    }
    
    return { cpu: Math.round(cpu), ram: Math.round(ram), disk };
  }

  parseHAInfo(data) {
    const lines = data.split('\n');
    const info = {};
    
    for (const line of lines) {
      if (line.includes('version:')) info.version = line.split(':')[1]?.trim();
      if (line.includes('state:')) info.state = line.split(':')[1]?.trim();
      if (line.includes('update_available:')) info.update_available = line.includes('true');
    }
    
    return info;
  }

  async checkAll() {
    const results = {};
    
    for (const [id, asset] of Object.entries(INFRA_ASSETS)) {
      try {
        results[id] = await this.checkAsset(id);
      } catch (e) {
        results[id] = {
          id,
          name: asset.name,
          icon: asset.icon,
          severity: 'SERIOUS',
          error: e.message,
          checked_at: new Date().toISOString()
        };
      }
    }
    
    return results;
  }

  getSeveritySummary(results) {
    const summary = { OK: 0, WARN: 0, SERIOUS: 0 };
    Object.values(results).forEach(r => {
      summary[r.severity] = (summary[r.severity] || 0) + 1;
    });
    return summary;
  }
}

// Approval Engine (Leader-only decision making)
class ApprovalEngine {
  constructor() {
    this.logger = new ActivityLogger();
    
    // Domain routing rules (which bot owns which domain)
    this.domainRules = {
      'proxmox': ['proxmox', 'vm', 'lxc', 'cluster', 'vzdump', 'backup-job'],
      'home': ['ha', 'home', 'hass', 'homeassistant', 'core', 'supervisor'],
      'storage': ['storage', 'pbs', 'truenas', 'zfs', 'backup', 'datastore'],
      'network': ['network', 'firewall', 'vlan', 'unifi', 'routing', 'gateway'],
      'security': ['security', 'audit', 'credential', 'auth', 'firewall-rule']
    };
    
    // Action intent classification
    this.readOnlyActions = ['check', 'monitor', 'report', 'query', 'status', 'inspect', 'view', 'list', 'get'];
    this.configActions = ['configure', 'config', 'set', 'update', 'enable', 'disable', 'modify', 'change'];
    this.destructiveActions = ['delete', 'remove', 'destroy', 'wipe', 'purge', 'drop', 'kill', 'stop', 'restart', 'reboot', 'shutdown'];
    this.upgradeActions = ['upgrade', 'update', 'patch', 'install', 'deploy'];
  }
  
  /**
   * Determine action intent category
   */
  classifyIntent(actionType) {
    const type = actionType.toLowerCase();
    if (this.readOnlyActions.includes(type)) return 'READ_ONLY';
    if (this.destructiveActions.includes(type)) return 'DESTRUCTIVE';
    if (this.upgradeActions.includes(type)) return 'UPGRADE';
    if (this.configActions.includes(type)) return 'CONFIG';
    return 'CONFIG'; // Default to config for unknown actions
  }
  
  /**
   * Validate if proposed_by matches the target domain
   */
  validateDomainOwnership(proposedBy, target, actionType) {
    // Leader can propose anything (coordination role)
    if (proposedBy === 'leader') return { valid: true, reason: 'Leader has cross-domain coordination authority' };
    
    // Check if target matches bot's domain
    const targetLower = target.toLowerCase();
    const allowedDomains = this.domainRules[proposedBy] || [];
    
    for (const domain of allowedDomains) {
      if (targetLower.includes(domain)) {
        return { valid: true, reason: `Target matches ${proposedBy} domain` };
      }
    }
    
    // Check for cross-domain keywords
    const allDomains = Object.values(this.domainRules).flat();
    for (const domain of allDomains) {
      if (targetLower.includes(domain) && !allowedDomains.includes(domain)) {
        return { 
          valid: false, 
          reason: `Domain mismatch: ${proposedBy} cannot act on ${target} (not in their domain)`,
          correctBot: this.findCorrectBot(targetLower)
        };
      }
    }
    
    return { valid: true, reason: 'No domain conflict detected' };
  }
  
  findCorrectBot(targetLower) {
    for (const [bot, domains] of Object.entries(this.domainRules)) {
      for (const domain of domains) {
        if (targetLower.includes(domain)) return bot;
      }
    }
    return 'leader';
  }

  /**
   * Evaluate if action requires approval
   * AUTO-APPROVE: LOW risk + READ-ONLY actions + domain match
   * REQUIRE APPROVAL: MEDIUM/HIGH risk OR CONFIG/UPGRADE/DESTRUCTIVE
   * SERIOUS (P0): Immediate Telegram alert, BLOCKED until approval
   */
  async evaluateAction(action) {
    const { risk, action_type, target, proposed_by } = action;
    
    validateRisk(risk);
    
    const intent = this.classifyIntent(action_type);
    const domainCheck = this.validateDomainOwnership(proposed_by, target, action_type);
    
    // Rule 1: AUTO-APPROVE
    // - risk=LOW AND intent=READ_ONLY AND domain matches
    if (risk === 'LOW' && intent === 'READ_ONLY' && domainCheck.valid) {
      await this.logger.log({
        bot: proposed_by,
        action: 'AUTO_APPROVED',
        severity: 'OK',
        risk: 'LOW',
        target,
        message: `Auto-approved: ${action_type} on ${target}`,
        details: { action, intent, domainCheck },
        owner_bot: proposed_by
      });
      
      return {
        decision: 'AUTO_APPROVED',
        approved_by: 'Leader (auto)',
        reason: `LOW risk + ${intent} + ${domainCheck.reason}`,
        requires_human: false,
        can_execute: true,
        intent,
        domain_check: domainCheck
      };
    }
    
    // Rule 2: DOMAIN MISMATCH - always requires approval
    if (!domainCheck.valid) {
      await this.logger.log({
        bot: proposed_by,
        action: 'DOMAIN_MISMATCH',
        severity: 'WARN',
        risk,
        target,
        message: `Domain mismatch: ${proposed_by} attempted ${action_type} on ${target}`,
        details: { action, domainCheck },
        owner_bot: 'leader'
      });
      
      return {
        decision: 'PENDING_APPROVAL',
        approved_by: null,
        reason: `Domain mismatch: ${domainCheck.reason}. Should be handled by ${domainCheck.correctBot}`,
        requires_human: true,
        can_execute: false,
        escalation: 'DASHBOARD',
        intent,
        domain_check: domainCheck
      };
    }
    
    // Rule 3: REQUIRE APPROVAL
    // - risk=MEDIUM or HIGH OR intent=CONFIG/DESTRUCTIVE/UPGRADE
    if (risk === 'MEDIUM' || risk === 'HIGH' || ['CONFIG', 'DESTRUCTIVE', 'UPGRADE'].includes(intent)) {
      const severity = risk === 'HIGH' || intent === 'DESTRUCTIVE' ? 'SERIOUS' : 'WARN';
      const escalation = severity === 'SERIOUS' ? 'TELEGRAM' : 'DASHBOARD';
      
      await this.logger.log({
        bot: proposed_by,
        action: 'APPROVAL_REQUIRED',
        severity,
        risk,
        target,
        message: `${intent} action ${action_type} on ${target} requires approval`,
        details: { action, intent, domainCheck },
        owner_bot: 'leader'
      });
      
      return {
        decision: 'PENDING_APPROVAL',
        approved_by: null,
        reason: `${risk} risk ${intent} action requires Anwar approval`,
        requires_human: true,
        can_execute: false,
        escalation,
        intent,
        domain_check: domainCheck
      };
    }
    
    // Fallback - should not reach here
    return {
      decision: 'REVIEW',
      reason: 'Unclear risk profile or intent',
      requires_human: true,
      can_execute: false,
      intent,
      domain_check: domainCheck
    };
  }

  /**
   * Record human approval/denial with full audit trail
   */
  async recordDecision(taskId, decision, approver, reason = null, metadata = {}) {
    // STRICT: Log as HUMAN-granted, not system-approved
    const actionName = decision === 'APPROVED' ? 'APPROVAL_GRANTED_BY_HUMAN' : `APPROVAL_${decision}_BY_HUMAN`;
    
    const entry = {
      bot: 'leader',
      action: actionName,
      severity: decision === 'APPROVED' ? 'OK' : decision === 'DENIED' ? 'WARN' : 'OK',
      risk: decision === 'APPROVED' ? 'LOW' : 'MEDIUM',
      target: taskId,
      message: `Task ${taskId} ${decision.toLowerCase()} by ${approver} via ${metadata.source || 'dashboard'}`,
      details: { 
        approver, 
        reason, 
        source: metadata.source || 'dashboard',
        timestamp: new Date().toISOString(),
        ...metadata
      },
      owner_bot: 'leader'
    };
    
    await this.logger.log(entry);
    
    // === FIX: Atomic update to tasks.json ===
    // Single source of truth: tasks.json holds approval state
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const TASKS_FILE = path.join(__dirname, '..', 'data/tasks/tasks.json');
      const TASKS_BACKUP = path.join(__dirname, '..', 'data/tasks/tasks.json.bak');
      
      const data = await fs.readFile(TASKS_FILE, 'utf8');
      const tasks = JSON.parse(data);
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex !== -1) {
        const task = tasks[taskIndex];
        
        if (!task.approvalState) task.approvalState = {};
        
        if (decision === 'APPROVED') {
          task.approvalState.approvedBy = approver;
          task.approvalState.approvedAt = new Date().toISOString();
          task.approvalState.deniedBy = null;
          task.approvalState.deniedAt = null;
          task.approvalState.deferredBy = null;
          task.approvalState.deferredAt = null;
          task.approvalState.reason = reason;
          // Also set the evaluation for execution engine
          if (!task.approvalEvaluation) task.approvalEvaluation = {};
          task.approvalEvaluation.decision = 'APPROVED';
          task.approvalEvaluation.can_execute = true;
          task.approvalEvaluation.approvedBy = approver;
          task.approvalEvaluation.timestamp = new Date().toISOString();
          // Domain check assumed valid (human reviewed)
          task.approvalEvaluation.domain_check = { 
            valid: true, 
            reason: 'Manually approved by ' + approver 
          };
          // Move task to in-progress state (awaiting execution)
          task.status = 'in_progress';
          task.column = 'in-progress';
          task.updated = new Date().toISOString();
        } else if (decision === 'DENIED') {
          task.approvalState.deniedBy = approver;
          task.approvalState.deniedAt = new Date().toISOString();
          task.approvalState.approvedBy = null;
          task.approvalState.approvedAt = null;
          task.approvalState.deferredBy = null;
          task.approvalState.deferredAt = null;
          task.approvalState.reason = reason;
          task.updated = new Date().toISOString();
        } else if (decision === 'DEFERRED') {
          task.approvalState.deferredBy = approver;
          task.approvalState.deferredAt = new Date().toISOString();
          task.approvalState.reason = reason;
          task.updated = new Date().toISOString();
        }
        
        // Backup before write
        await fs.copyFile(TASKS_FILE, TASKS_BACKUP);
        await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
        
        console.log(`[ApprovalEngine] Task ${taskId} ${decision.toLowerCase()}: tasks.json updated`);
      }
    } catch (e) {
      console.error('[ApprovalEngine] Failed to update tasks.json:', e.message);
      // Log but don't fail - audit trail is still recorded
      await this.logger.log({
        bot: 'leader',
        action: 'APPROVAL_STATE_UPDATE_FAILED',
        severity: 'WARN',
        risk: 'MEDIUM',
        target: taskId,
        message: `Failed to update tasks.json: ${e.message}`,
        owner_bot: 'leader'
      });
    }
    
    // === DEDUPE: Telegram notification for APPROVED (idempotent) ===
    // Only send for MEDIUM+ risk OR TELEGRAM-escalated tasks
    if (decision === 'APPROVED') {
      try {
        // Load task to check risk/escalation before sending Telegram
        let shouldSendTelegram = false;
        let taskRisk = 'LOW';
        let taskEscalation = null;
        
        try {
          const taskData = await fs.readFile(path.join(__dirname, '..', 'data/tasks/tasks.json'), 'utf8');
          const tasks = JSON.parse(taskData);
          const task = tasks.find(t => t.id === taskId);
          
          if (task) {
            taskRisk = task.risk || 'LOW';
            taskEscalation = task.approvalEvaluation?.escalation || null;
            
            // Send Telegram only if:
            // 1. Risk is MEDIUM or HIGH, OR
            // 2. Escalation was TELEGRAM
            if (taskRisk === 'MEDIUM' || taskRisk === 'HIGH' || taskEscalation === 'TELEGRAM') {
              shouldSendTelegram = true;
            }
          }
        } catch (e) {
          // If we can't read task, log but don't block
          console.error('[ApprovalEngine] Could not check task for Telegram filter:', e.message);
        }
        
        if (!shouldSendTelegram) {
          await this.logger.log({
            bot: 'leader',
            action: 'TELEGRAM_SKIPPED_LOW_RISK',
            severity: 'OK',
            risk: 'LOW',
            target: taskId,
            message: `Telegram skipped: LOW risk task without TELEGRAM escalation`,
            details: { risk: taskRisk, escalation: taskEscalation },
            owner_bot: 'leader'
          });
        } else {
          const tgResult = await telegram.sendApprovalGranted(taskId, approver);
          
          if (tgResult.dedupe) {
            await this.logger.log({
              bot: 'leader',
              action: 'TELEGRAM_SKIPPED_DEDUPE',
              severity: 'OK',
              risk: 'LOW',
              target: taskId,
              message: `Telegram approval notification deduped: ${tgResult.reason}`,
              details: { reason: tgResult.reason, existing: tgResult.existing },
              owner_bot: 'leader'
            });
          } else if (tgResult.ok) {
            await this.logger.log({
              bot: 'leader',
              action: 'TELEGRAM_SENT',
              severity: 'OK',
              risk: taskRisk,
              target: taskId,
              message: 'Approval notification sent via Telegram',
              details: { messageId: tgResult.messageId, risk: taskRisk, escalation: taskEscalation },
              owner_bot: 'leader'
            });
          } else {
            await this.logger.log({
              bot: 'leader',
              action: 'TELEGRAM_FAILED',
              severity: 'WARN',
              risk: 'LOW',
              target: taskId,
              message: `Telegram send failed: ${tgResult.error}`,
              owner_bot: 'leader'
            });
          }
        }
      } catch (tgError) {
        console.error('[ApprovalEngine] Telegram notification error:', tgError.message);
      }
    }
    
    return {
      taskId,
      decision,
      approver,
      reason,
      timestamp: new Date().toISOString(),
      can_execute: decision === 'APPROVED'
    };
  }
}

module.exports = {
  ActivityLogger,
  BotStatusTracker,
  InfraMonitor,
  ApprovalEngine,
  INFRA_ASSETS,
  VALID_SEVERITY,
  VALID_RISK,
  VALID_BOTS,
  validateSeverity,
  validateRisk,
  validateOwnerBot
};
