// Telegram Service - Clean Rebuild v1.0
// Phase 1: Polling-based, strict allowlist, Leader routing

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const NaturalLanguageRouter = require('./natural-language-router');

const CONFIG_PATH = path.join(__dirname, '.config', 'telegram.env');
const QUEUE_PATH = path.join(__dirname, 'data', 'telegram', 'message_queue.jsonl');
const DEDUPE_PATH = path.join(__dirname, 'data', 'telegram', 'dedupe.json');

class TelegramService {
  constructor() {
    this.token = null;
    this.allowedChatId = null;
    this.allowedUsername = 'anwar';
    this.pollingInterval = null;
    this.lastUpdateId = 0;
    this.isPolling = false;
    this.dedupeCache = {};
    this.dedupeTtlMinutes = 2;
    this.activityLogger = null;
    this.pollIntervalMs = 1500;
    
    this.baseUrl = 'https://api.telegram.org';
    this.dashboardUrl = 'http://192.168.40.70:3000';
  }

  setActivityLogger(logger) {
    this.activityLogger = logger;
  }

  async init() {
    await this.loadConfig();
    await this.loadDedupe();
    
    if (!this.token) {
      console.log('❌ Telegram: No token configured');
      return false;
    }
    
    console.log('✅ Telegram: Initialized @annugenie_bot');
    console.log(`   Allowed Chat: ${this.allowedChatId || 'ANY'}`);
    console.log(`   Allowed User: ${this.allowedUsername}`);
    return true;
  }

  async loadConfig() {
    try {
      const config = await fs.readFile(CONFIG_PATH, 'utf8');
      const lines = config.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('TELEGRAM_BOT_TOKEN=')) {
          this.token = line.split('=')[1].trim();
        }
        if (line.startsWith('TELEGRAM_ALLOWED_CHAT_ID=')) {
          this.allowedChatId = line.split('=')[1].trim();
        }
        if (line.startsWith('TELEGRAM_ALLOWED_USERNAME=')) {
          this.allowedUsername = line.split('=')[1].trim().toLowerCase();
        }
        if (line.startsWith('TELEGRAM_POLL_INTERVAL_MS=')) {
          this.pollIntervalMs = parseInt(line.split('=')[1].trim()) || 1500;
        }
        if (line.startsWith('DASHBOARD_URL=')) {
          this.dashboardUrl = line.split('=')[1].trim();
        }
      }
    } catch (e) {
      console.error('❌ Telegram config load failed:', e.message);
    }
  }

  async loadDedupe() {
    try {
      const data = await fs.readFile(DEDUPE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      this.dedupeCache = parsed.sent || {};
      this._cleanExpiredDedupe();
    } catch {
      this.dedupeCache = {};
    }
  }

  async saveDedupe() {
    try {
      await fs.mkdir(path.dirname(DEDUPE_PATH), { recursive: true });
      await fs.writeFile(DEDUPE_PATH, JSON.stringify({
        sent: this.dedupeCache,
        updatedAt: new Date().toISOString()
      }, null, 2));
    } catch (e) {
      console.error('Failed to save dedupe:', e.message);
    }
  }

  _cleanExpiredDedupe() {
    const now = Date.now();
    const ttlMs = this.dedupeTtlMinutes * 60 * 1000;
    for (const key of Object.keys(this.dedupeCache)) {
      if (now - this.dedupeCache[key].timestamp > ttlMs) {
        delete this.dedupeCache[key];
      }
    }
  }

  _shouldSend(key) {
    this._cleanExpiredDedupe();
    if (!key) return { shouldSend: true };
    
    const existing = this.dedupeCache[key];
    if (existing) {
      const ageMs = Date.now() - existing.timestamp;
      if (ageMs < this.dedupeTtlMinutes * 60 * 1000) {
        return { shouldSend: false, reason: `Sent ${Math.floor(ageMs/1000)}s ago` };
      }
    }
    return { shouldSend: true };
  }

  _markSent(key, metadata = {}) {
    if (!key) return;
    this.dedupeCache[key] = { timestamp: Date.now(), ...metadata };
    this.saveDedupe();
  }

  _hashText(text) {
    return crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
  }

  // ========== POLLING ==========
  
  start() {
    if (this.pollingInterval) {
      console.log('⚠️ Telegram polling already running');
      return;
    }
    
    if (!this.token) {
      console.log('❌ Cannot start: No token');
      return;
    }

    console.log(`🔄 Starting Telegram polling (${this.pollIntervalMs}ms)`);
    
    const poll = async () => {
      if (this.isPolling) return;
      this.isPolling = true;
      
      try {
        const updates = await this._getUpdates();
        for (const update of updates) {
          await this._handleUpdate(update);
          if (update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
          }
        }
      } catch (e) {
        console.error('Polling error:', e.message);
      } finally {
        this.isPolling = false;
      }
    };

    poll();
    this.pollingInterval = setInterval(poll, this.pollIntervalMs);
  }

  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 Telegram polling stopped');
    }
  }

  async _getUpdates(limit = 10) {
    const offset = this.lastUpdateId + 1;
    const url = `${this.baseUrl}/bot${this.token}/getUpdates?offset=${offset}&limit=${limit}`;
    
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result.result || []);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  // ========== MESSAGE HANDLING ==========
  
  async _handleUpdate(update) {
    if (!update.message) return;
    
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const username = msg.from?.username?.toLowerCase() || msg.from?.first_name?.toLowerCase() || 'unknown';
    const messageId = msg.message_id;
    
    // STRICT ALLOWLIST
    if (this.allowedChatId && chatId.toString() !== this.allowedChatId.toString()) {
      console.log(`🚫 Rejected: Chat ${chatId} not in allowlist`);
      return;
    }
    
    if (this.allowedUsername && username !== this.allowedUsername) {
      console.log(`🚫 Rejected: User ${username} not in allowlist`);
      return;
    }

    // Log inbound
    await this._logActivity('TELEGRAM_INBOUND_RECEIVED', `From ${username}: ${text.slice(0, 50)}`, {
      chatId, username, messageId, text: text.slice(0, 200)
    });

    // Handle commands
    if (text.startsWith('/')) {
      await this._handleCommand(chatId, username, text, messageId);
      return;
    }
    
    // Free-text to Leader
    await this._handleFreeText(chatId, username, text, messageId);
  }

  // ========== COMMANDS ==========
  
  async _handleCommand(chatId, username, text, messageId) {
    const parts = text.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch (cmd) {
      case '/start':
        await this._sendMessage(chatId, 
          `👋 Hello ${username}!\n\n` +
          `I'm Genie, your homelab assistant.\n\n` +
          `Commands:\n` +
          `/status — System overview\n` +
          `/approvals — Pending approvals\n` +
          `/help — All commands\n\n` +
          `Or just chat with me!`,
          { dedupeKey: `cmd:start:${username}` }
        );
        break;
        
      case '/help':
        await this._sendMessage(chatId,
          `📚 **Commands**\n\n` +
          `/status — Infrastructure summary\n` +
          `/approvals — Pending approvals\n` +
          `/approve <id> [reason] — Approve task\n` +
          `/deny <id> [reason] — Deny task\n` +
          `/defer <id> [reason] — Defer task\n` +
          `/help — This message\n\n` +
          `Send any message for Leader assistance.`,
          { dedupeKey: `cmd:help:${username}` }
        );
        break;
        
      case '/status':
        await this._sendMessage(chatId,
          `🟢 **System Status**\n\n` +
          `Dashboard: ${this.dashboardUrl}\n` +
          `Last update: ${new Date().toLocaleTimeString()}\n\n` +
          `View full status in dashboard.`,
          { dedupeKey: `cmd:status:${Math.floor(Date.now()/60000)}` }
        );
        break;
        
      case '/approvals':
        await this._sendMessage(chatId,
          `🚦 **Approvals**\n\n` +
          `Check dashboard for pending items:\n` +
          `${this.dashboardUrl}\n\n` +
          `Use /approve <task-id> to approve.`,
          { dedupeKey: `cmd:approvals:${Math.floor(Date.now()/60000)}` }
        );
        break;
        
      case '/approve':
        await this._handleApproval(chatId, username, args, 'APPROVED');
        break;
        
      case '/deny':
        await this._handleApproval(chatId, username, args, 'DENIED');
        break;
        
      case '/defer':
        await this._handleApproval(chatId, username, args, 'DEFERRED');
        break;
        
      default:
        await this._sendMessage(chatId, `❓ Unknown command: ${cmd}\nUse /help for commands.`);
    }
  }

  async _handleApproval(chatId, username, args, decision) {
    const taskId = args[0];
    const reason = args.slice(1).join(' ') || `${decision} via Telegram`;
    
    if (!taskId) {
      await this._sendMessage(chatId, `❓ Usage: /${decision.toLowerCase()} <task-id> [reason]`);
      return;
    }

    // Call approval API
    const result = await this._callApprovalAPI(taskId, decision, username, reason);
    
    if (result.success) {
      const emoji = decision === 'APPROVED' ? '✅' : decision === 'DENIED' ? '❌' : '⏸️';
      await this._sendMessage(chatId,
        `${emoji} **${decision} RECORDED**\n\n` +
        `Task: ${taskId}\n` +
        `By: ${username}\n` +
        `Reason: ${reason}`,
        { dedupeKey: `approval:${taskId}:${decision}` }
      );
      
      await this._logActivity(`APPROVAL_${decision}_BY_HUMAN`, 
        `${username} ${decision} ${taskId}`,
        { taskId, username, reason, source: 'telegram' }
      );
    } else {
      await this._sendMessage(chatId,
        `⚠️ **Approval failed**\n\n` +
        `Task: ${taskId}\n` +
        `Error: ${result.error || 'API error'}`,
        { dedupeKey: `approval-fail:${taskId}` }
      );
    }
  }

  async _callApprovalAPI(taskId, decision, approver, reason) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({ taskId, decision, approver, reason });
      
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/approval/decision',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({ success: res.statusCode === 200, data: response });
          } catch {
            resolve({ success: res.statusCode === 200, data: { raw: data } });
          }
        });
      });
      
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(payload);
      req.end();
    });
  }

  // ========== FREE-TEXT TO LEADER (NATURAL LANGUAGE) ==========

  async _handleFreeText(chatId, username, text, messageId) {
    // Log
    await this._logActivity('TELEGRAM_CHAT_MESSAGE',
      `${username}: ${text.slice(0, 120)}`,
      { chatId, username, messageId }
    );

    // Use Natural Language Router for intelligent response
    const nlRouter = new NaturalLanguageRouter();
    const result = await nlRouter.processMessage(text, username, 'telegram');

    // Format response with bot icon and name
    const response = `${result.icon} **${result.name}**\n\n${result.response}`;

    // Send reply immediately
    await this._sendMessage(chatId, response);

    await this._logActivity('TELEGRAM_OUTBOUND_SENT',
      `${result.name} replied via NL router`,
      { chatId, messageId, bot: result.bot, confidence: result.confidence }
    );

    // If action requested, execute it
    if (result.action === 'trigger_assignment') {
      // Trigger task assignment immediately
      await this._triggerAssignment(chatId);
    }
  }

  async _triggerAssignment(chatId) {
    try {
      // Call the assign-all endpoint
      const response = await this._callInternalAPI('/api/chat/assign-all', 'POST', {});

      if (response.success) {
        await this._sendMessage(
          chatId,
          `✅ **Assignment Triggered**\n\n${response.message}\n\nDashboard Bot will process these on the next cycle.`,
          { dedupeKey: 'assign:all' }
        );
      }
    } catch (e) {
      console.error('Assignment trigger failed:', e.message);
    }
  }

  async _callInternalAPI(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 3000,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ========== UTILITIES ==========
  
  async _sendMessage(chatId, text, options = {}) {
    const { dedupeKey } = options;
    
    if (dedupeKey) {
      const check = this._shouldSend(dedupeKey);
      if (!check.shouldSend) {
        console.log(`[Telegram] DEDUPE: ${dedupeKey}`);
        return { ok: false, dedupe: true };
      }
    }

    const url = `${this.baseUrl}/bot${this.token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };

    return new Promise((resolve) => {
      const data = JSON.stringify(payload);
      
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let response = '';
        res.on('data', chunk => response += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(response);
            if (result.ok && dedupeKey) {
              this._markSent(dedupeKey);
            }
            resolve({ ok: result.ok, messageId: result.result?.message_id });
          } catch {
            resolve({ ok: false });
          }
        });
      });
      
      req.on('error', () => resolve({ ok: false }));
      req.write(data);
      req.end();
    });
  }

  async _logActivity(action, message, details = {}) {
    if (!this.activityLogger) return;
    try {
      await this.activityLogger.log({
        bot: 'leader',
        action,
        severity: 'OK',
        risk: 'LOW',
        target: details.chatId ? `telegram:${details.chatId}` : 'telegram',
        message,
        details,
        owner_bot: 'leader'
      });
    } catch (e) {
      console.error('Activity log failed:', e.message);
    }
  }
}

module.exports = new TelegramService();
