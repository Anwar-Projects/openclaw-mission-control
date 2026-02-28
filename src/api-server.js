const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const telegram = require('./telegram-service');
const { TelegramProcessor } = require('./telegram-processor');
const { DelegationRouter, DailyReports } = require('./delegation-service');
const { ActivityLogger, BotStatusTracker, InfraMonitor, ApprovalEngine, validateSeverity, validateRisk, validateOwnerBot } = require('./infra-service');
const { TokenAnalytics } = require('./token-analytics-module');
const tokenAnalytics = new TokenAnalytics();
const { ExecutionEngine } = require('./execution-engine');
const DashboardBot = require('./dashboard-bot');
const NaturalLanguageRouter = require('./natural-language-router');

const router = new DelegationRouter();
const nlRouter = new NaturalLanguageRouter();
const dailyReports = new DailyReports();
const activityLogger = new ActivityLogger();
const botTracker = new BotStatusTracker();
const infraMonitor = new InfraMonitor();
const approvalEngine = new ApprovalEngine();
const executionEngine = new ExecutionEngine();
const telegramProcessor = new TelegramProcessor();
const dashboardBot = new DashboardBot();

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks', 'tasks.json');
const TASKS_TMP  = path.join(DATA_DIR, 'tasks', 'tasks.json.tmp');

async function ensureDataDir() {
  await fs.mkdir(path.join(DATA_DIR, 'tasks'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'logs'),  { recursive: true });
}

async function readTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function writeTasks(tasks) {
  await fs.writeFile(TASKS_TMP, JSON.stringify(tasks, null, 2), 'utf8');
  await fs.rename(TASKS_TMP, TASKS_FILE);
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200); res.end(); return;
  }

  // === TASKS API ===
  
  if (pathname === '/api/tasks' && req.method === 'GET') {
    try {
      const tasks = await readTasks();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tasks));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/save-tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const tasks = JSON.parse(body);
        await writeTasks(tasks);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: tasks.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // === TELEGRAM WEBHOOK ===
  
  if (pathname === '/api/telegram/webhook' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const result = await telegram.handleWebhook(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === NOTIFICATIONS API ===

  if (pathname === '/api/notify/serious' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const tasks = await readTasks();
      const task = tasks.find(t => t.id === body.taskId);
      
      if (!task) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      
      const result = await telegram.sendSeriousAlert(task);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/notify/approval' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const tasks = await readTasks();
      const task = tasks.find(t => t.id === body.taskId);
      
      if (!task) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      
      const result = await telegram.sendApprovalRequest(task);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/notify/broadcast' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { title, message, priority } = body;
      
      const result = await telegram.sendBroadcast(title, message, priority);
      
      // Log to activity_log with result
      if (result.dedupe) {
        await activityLogger.log({
          bot: 'leader',
          action: 'TELEGRAM_BROADCAST_SKIPPED_DEDUPE',
          severity: 'OK',
          risk: 'LOW',
          target: title.substring(0, 50),
          message: `Broadcast deduped: ${result.reason}`,
          details: { title, reason: result.reason },
          owner_bot: 'leader'
        });
      } else if (result.ok) {
        await activityLogger.log({
          bot: 'leader',
          action: 'TELEGRAM_BROADCAST_SENT',
          severity: 'OK',
          risk: 'LOW',
          target: title.substring(0, 50),
          message: `Broadcast sent: ${title}`,
          details: { title, messageId: result.messageId },
          owner_bot: 'leader'
        });
      } else {
        await activityLogger.log({
          bot: 'leader',
          action: 'TELEGRAM_BROADCAST_FAILED',
          severity: 'WARN',
          risk: 'LOW',
          target: title.substring(0, 50),
          message: `Broadcast failed: ${result.error}`,
          details: { title, error: result.error },
          owner_bot: 'leader'
        });
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/notify/telegram-config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      enabled: telegram.enabled,
      chatId: telegram.chatId ? 'configured' : 'not_set',
      message: telegram.chatId 
        ? 'Telegram configured. Send /status for health check.'
        : 'Send /start to your bot to register chat ID'
    }));
    return;
  }

  // === APPROVALS API ===

  if (pathname === '/api/approvals' && req.method === 'GET') {
    try {
      const tasks = await readTasks();
      const approvals = tasks.filter(t => t.type === 'approval');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(approvals));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/approvals' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const tasks = await readTasks();
      const taskIndex = tasks.findIndex(t => t.id === body.taskId);
      
      if (taskIndex === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      
      const task = tasks[taskIndex];
      
      if (body.action === 'approve') {
        task.approvalState = {
          ...task.approvalState,
          approvedBy: body.approver || 'Anwar',
          approvedAt: new Date().toISOString(),
          deniedBy: null,
          deniedAt: null,
          reason: null
        };
        task.status = 'in_progress';
        task.column = 'in-progress';
        task.executionStatus = 'EXECUTION_APPROVED';
        task.updated = new Date().toISOString();
        
        await writeTasks(tasks);
        await telegram.sendApprovalGranted(task, body.approver || 'Anwar');
        
      } else if (body.action === 'deny') {
        task.approvalState = {
          ...task.approvalState,
          approvedBy: null,
          approvedAt: null,
          deniedBy: body.approver || 'Anwar',
          deniedAt: new Date().toISOString(),
          reason: body.reason || 'No reason provided'
        };
        task.status = 'inbox';
        task.column = 'inbox';
        task.updated = new Date().toISOString();
        
        await writeTasks(tasks);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, task }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === TELEGRAM TEST API ===

  if (pathname === '/api/telegram/test' && req.method === 'POST') {
    try {
      if (!telegram.chatId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          ok: false, 
          error: 'Chat ID not configured. Send /start to the bot first.',
          help: 'Send /start to @AutomyxBot on Telegram'
        }));
        return;
      }
      
      const body = await getRequestBody(req);
      const testMessage = body.message || '🧪 **Mission Control Test**\n\nTelegram integration is working correctly!';
      
      await telegram.sendMessage(testMessage);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true, 
        chatId: telegram.chatId,
        message: 'Test message sent'
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (pathname === '/api/telegram/polling' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      polling: telegram.pollingInterval !== null,
      enabled: telegram.enabled,
      chatId: telegram.chatId || null,
      lastUpdateId: telegram.lastUpdateId
    }));
    return;
  }

  // === DELEGATION API ===

  if (pathname === '/api/delegate' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const result = router.routeTask(body);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/delegate/auto-assign' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const tasks = await readTasks();
      
      // Find the task
      const taskIndex = tasks.findIndex(t => t.id === body.taskId);
      if (taskIndex === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      
      // Auto-assign via router
      const routed = router.autoAssign(tasks[taskIndex]);
      
      // Add comment about the routing decision
      if (!tasks[taskIndex].comments) tasks[taskIndex].comments = [];
      tasks[taskIndex].comments.push({
        author: 'Leader',
        authorIcon: '🎯',
        text: routed.ambiguous 
          ? `⚠️ Ambiguity detected: ${routed.note}`
          : `✅ Auto-assigned to ${routed.name}: ${routed.note}`,
        timestamp: new Date().toISOString()
      });
      
      await writeTasks(tasks);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        task: tasks[taskIndex],
        routing: routed
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === DAILY REPORTS API ===

  if (pathname === '/api/reports/daily' && req.method === 'GET') {
    try {
      const tasks = await readTasks();
      const botIds = ['leader', 'proxmox', 'home', 'storage', 'network', 'security'];
      
      const reports = botIds.map(id => dailyReports.generateBotReport(id, tasks));
      const summary = dailyReports.compileLeaderSummary(reports, tasks);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        reports,
        summary
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/reports/bot' && req.method === 'GET') {
    try {
      const tasks = await readTasks();
      const botId = parsedUrl.query.bot || 'leader';
      
      const report = dailyReports.generateBotReport(botId, tasks);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/reports/broadcast' && req.method === 'POST') {
    try {
      const tasks = await readTasks();
      const body = await getRequestBody(req);
      const botIds = ['leader', 'proxmox', 'home', 'storage', 'network', 'security'];
      
      const reports = botIds.map(id => dailyReports.generateBotReport(id, tasks));
      const summary = dailyReports.compileLeaderSummary(reports, tasks);
      
      // If serious items exist and Telegram is configured, send summary
      if (summary.serious && telegram.enabled) {
        await telegram.sendMessage(summary.message);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        serious: summary.serious,
        telegramSent: summary.serious && telegram.enabled,
        summary
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    try {
      const tasks = await readTasks();
      const workingTasks = tasks.filter(t => t.status !== 'reference');
      
      const stats = {
        total: workingTasks.length,
        byColumn: {
          inbox: workingTasks.filter(t => t.column === 'inbox').length,
          assigned: workingTasks.filter(t => t.column === 'assigned').length,
          'in-progress': workingTasks.filter(t => t.column === 'in-progress').length,
          review: workingTasks.filter(t => t.column === 'review').length,
          'waiting-approval': workingTasks.filter(t => t.column === 'waiting-approval').length,
          done: workingTasks.filter(t => t.column === 'done').length
        },
        byAgent: workingTasks.reduce((acc, t) => {
          acc[t.agent] = (acc[t.agent] || 0) + 1;
          return acc;
        }, {}),
        approvalsPending: workingTasks.filter(t => t.type === 'approval' && !t.approvalState?.approvedBy).length,
        critical: workingTasks.filter(t => t.priority === 'P0' && t.status !== 'done').length
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === PHASE 4: INFRASTRUCTURE & OPERATIONS API ===

  // GET /api/infra/status - Check all infrastructure assets
  if (pathname === '/api/infra/status' && req.method === 'GET') {
    try {
      const assetId = parsedUrl.query.asset; // Optional: check specific asset
      
      let results;
      if (assetId) {
        results = { [assetId]: await infraMonitor.checkAsset(assetId) };
      } else {
        results = await infraMonitor.checkAll();
      }
      
      const summary = infraMonitor.getSeveritySummary(results);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        summary,
        assets: results
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/infra/assets - List configured infrastructure assets
  if (pathname === '/api/infra/assets' && req.method === 'GET') {
    try {
      const { INFRA_ASSETS } = require('./infra-service');
      
      // Return sanitized asset list (no SSH keys)
      const sanitized = Object.entries(INFRA_ASSETS).map(([id, asset]) => ({
        id: asset.id,
        name: asset.name,
        icon: asset.icon,
        host: asset.host,
        type: asset.type,
        owner_bot: asset.owner_bot
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assets: sanitized }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/activity/timeline - Get activity log timeline
  if (pathname === '/api/activity/timeline' && req.method === 'GET') {
    try {
      const limit = parseInt(parsedUrl.query.limit) || 50;
      const bot = parsedUrl.query.bot || null;
      const severity = parsedUrl.query.severity || null;
      
      const events = await activityLogger.getTimeline(limit, bot, severity);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        count: events.length,
        events
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/activity/log - Log a new activity event
  if (pathname === '/api/activity/log' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      // Validate required fields
      if (!body.bot || !body.action || !body.severity) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: bot, action, severity' 
        }));
        return;
      }
      
      // Validate enums
      try {
        validateSeverity(body.severity);
        if (body.risk) validateRisk(body.risk);
        if (body.owner_bot) validateOwnerBot(body.owner_bot);
      } catch (validationError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validationError.message }));
        return;
      }
      
      const entry = await activityLogger.log(body);
      
      // If SERIOUS, also send Telegram alert
      if (body.severity === 'SERIOUS' && telegram.enabled && telegram.chatId) {
        try {
          await telegram.sendMessage(
            `🚨 **SERIOUS EVENT**\n\n` +
            `**Bot:** ${body.bot}\n` +
            `**Action:** ${body.action}\n` +
            `**Target:** ${body.target || 'N/A'}\n\n` +
            `${body.message || ''}\n\n` +
            `Dashboard: http://192.168.40.70:3000`
          );
        } catch (tgError) {
          console.error('Telegram alert failed:', tgError.message);
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, entry }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/bots/status - Get all bot statuses
  if (pathname === '/api/bots/status' && req.method === 'GET') {
    try {
      const statuses = await botTracker.getAll();
      const botId = parsedUrl.query.bot;
      
      if (botId) {
        const status = statuses[botId] || { bot: botId, status: 'unknown' };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(statuses));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/bots/status - Update bot status
  if (pathname === '/api/bots/status' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.bot || !body.status) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: bot, status' }));
        return;
      }
      
      try {
        validateOwnerBot(body.bot);
      } catch (validationError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validationError.message }));
        return;
      }
      
      const update = await botTracker.update(body.bot, body.status, body.details || {});
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status: update }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/approval/evaluate - Evaluate if action needs approval
  if (pathname === '/api/approval/evaluate' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.action_type || !body.risk || !body.target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: action_type, risk, target' 
        }));
        return;
      }
      
      const decision = await approvalEngine.evaluateAction(body);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(decision));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/approval/decision - Record approval/denial/defer
  if (pathname === '/api/approval/decision' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.taskId || !body.decision || !body.approver) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: taskId, decision, approver' 
        }));
        return;
      }
      
      // Validate decision value
      const validDecisions = ['APPROVED', 'DENIED', 'DEFERRED'];
      if (!validDecisions.includes(body.decision)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: `Invalid decision: ${body.decision}. Must be one of: ${validDecisions.join(', ')}` 
        }));
        return;
      }
      
      // Require reason for DENY or DEFER
      if ((body.decision === 'DENIED' || body.decision === 'DEFERRED') && !body.reason) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: `Reason required for ${body.decision} decisions` 
        }));
        return;
      }
      
      const result = await approvalEngine.recordDecision(
        body.taskId,
        body.decision,
        body.approver,
        body.reason,
        body.metadata || {}
      );
      
      // NOTE: Telegram notification moved to infra-service.js recordDecision() 
      // with idempotent dedupe key: approval:granted:{taskId}:{approver}
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, decision: result }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === DASHBOARD BOT API ===

  // GET /api/queue/summary - Get task counts by column
  if (pathname === '/api/queue/summary' && req.method === 'GET') {
    try {
      const summary = await dashboardBot.getQueueSummary();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        summary,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/bot/complete - Bot reports task completion
  if (pathname === '/api/bot/complete' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.taskId || !body.bot) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: taskId, bot' 
        }));
        return;
      }

      // Write to bot's completed queue
      const queueDir = path.join(DATA_DIR, 'queues');
      const completedFile = path.join(queueDir, body.bot, 'completed.jsonl');
      const entry = {
        taskId: body.taskId,
        completedBy: body.bot,
        completedAt: new Date().toISOString(),
        result: body.result || 'success',
        summary: body.summary || 'Task completed',
        output: body.output || null
      };

      await fs.mkdir(path.dirname(completedFile), { recursive: true });
      await fs.appendFile(completedFile, JSON.stringify(entry) + '\n');

      // Dashboard Bot will pick this up on next poll
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Completion recorded. Dashboard Bot will process on next cycle.',
        taskId: body.taskId
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/bot/queue/:botId - Get tasks assigned to specific bot
  if (pathname.startsWith('/api/bot/queue/') && req.method === 'GET') {
    try {
      const botId = pathname.replace('/api/bot/queue/', '');
      const tasks = await readTasks();
      const botTasks = tasks.filter(t => 
        t.agent === botId && 
        (t.column === 'assigned' || t.column === 'executing')
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        bot: botId,
        tasks: botTasks,
        count: botTasks.length
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/bot/start-execution - Bot marks task as executing
  if (pathname === '/api/bot/start-execution' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.taskId || !body.bot) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: taskId, bot' 
        }));
        return;
      }

      const tasks = await readTasks();
      const taskIndex = tasks.findIndex(t => t.id === body.taskId);
      
      if (taskIndex === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }

      const task = tasks[taskIndex];
      
      // Verify the bot owns this task
      if (task.agent !== body.bot) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Task not assigned to this bot',
          assignedTo: task.agent,
          requestedBy: body.bot
        }));
        return;
      }

      // Update task to executing
      task.column = 'executing';
      task.status = 'executing';
      task.executionStartedAt = new Date().toISOString();
      task.executedBy = body.bot;
      task.updated = new Date().toISOString();

      // Add comment
      if (!task.comments) task.comments = [];
      task.comments.push({
        author: body.bot,
        authorIcon: '🤖',
        text: '🔨 Started execution...',
        timestamp: new Date().toISOString()
      });

      await writeTasks(tasks);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        taskId: body.taskId,
        status: 'executing'
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === PHASE 5: EXECUTION ENGINE API ===

  // POST /api/run/start - Start a new execution run
  // HARD GATE: Live execution requires explicit ALLOW_LIVE_EXECUTION override
  if (pathname === '/api/run/start' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.taskId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required field: taskId' }));
        return;
      }
      
      // Leader-only check (can be extended with auth middleware)
      const proposedBy = body.proposedBy || 'leader';
      if (proposedBy !== 'leader') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Only Leader can dispatch executions',
          required: 'leader',
          received: proposedBy
        }));
        return;
      }
      
      // === HARD GATE: Live execution requires explicit override ===
      const requestedMode = body.dryRun === false ? 'LIVE' : 'SIMULATED';
      const allowLive = body.allowLive === 'ALLOW_LIVE_EXECUTION' || process.env.ALLOW_LIVE_EXECUTION === 'true';
      
      if (requestedMode === 'LIVE' && !allowLive) {
        await activityLogger.log({
          bot: 'leader',
          action: 'EXECUTION_BLOCKED_LIVE',
          severity: 'WARN',
          risk: 'MEDIUM',
          target: body.taskId,
          message: 'Live execution blocked: explicit approval required',
          details: { requested: requestedMode, blockedBy: 'hard_gate' },
          owner_bot: 'leader'
        });
        
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'LIVE EXECUTION NOT ALLOWED',
          details: 'To enable live execution, provide allowLive: "ALLOW_LIVE_EXECUTION" or set ALLOW_LIVE_EXECUTION=true',
          mode: 'SIMULATED',
          hint: 'Use dryRun: true (default) or say "ALLOW LIVE EXECUTION" to enable'
        }));
        return;
      }
      
      const run = await executionEngine.startRun(body.taskId, {
        proposedBy,
        dryRun: requestedMode !== 'LIVE', // Force simulated if not explicitly allowed
        metadata: body.metadata || {}
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        run: {
          run_id: run.run_id,
          task_id: run.task_id,
          status: run.status,
          mode: run.mode,
          started_at: run.started_at
        }
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // POST /api/run/simulate - Simulate a task execution (P5-1 testing)
  if (pathname === '/api/run/simulate' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.taskId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required field: taskId' }));
        return;
      }
      
      const run = await executionEngine.simulateTaskExecution(
        body.taskId,
        body.proposedBy || 'leader'
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        run: {
          run_id: run.run_id,
          task_id: run.task_id,
          status: run.status,
          mode: run.mode,
          step_count: run.steps.length,
          duration: executionEngine.calculateDuration(run)
        }
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // POST /api/run/finish - Finish a run
  if (pathname === '/api/run/finish' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.runId || !body.status) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: runId, status' }));
        return;
      }
      
      const run = await executionEngine.finishRun(body.runId, {
        status: body.status, // 'success', 'failed', 'cancelled'
        summary: body.summary,
        outputs: body.outputs || []
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, run }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/runs - List runs
  if (pathname === '/api/runs' && req.method === 'GET') {
    try {
      const filters = {
        taskId: parsedUrl.query.task,
        status: parsedUrl.query.status,
        limit: parseInt(parsedUrl.query.limit) || 20
      };
      
      const runs = await executionEngine.listRuns(filters);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        count: runs.length,
        runs: runs.map(r => ({
          run_id: r.run_id,
          task_id: r.task_id,
          task_title: r.task_title,
          owner_bot: r.owner_bot,
          status: r.status,
          mode: r.mode,
          started_at: r.started_at,
          ended_at: r.ended_at,
          duration: executionEngine.calculateDuration(r),
          step_count: r.steps?.length || 0
        }))
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/runs/:id - Get run detail
  if (pathname.startsWith('/api/runs/') && req.method === 'GET') {
    try {
      const runId = pathname.split('/')[3];
      const run = await executionEngine.loadRun(runId);
      
      if (!run) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Run not found' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(run));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/run/stats - Execution statistics
  if (pathname === '/api/run/stats' && req.method === 'GET') {
    try {
      const stats = await executionEngine.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/health/integrity - Approval state consistency check
  if (pathname === '/api/health/integrity' && req.method === 'GET') {
    try {
      const tasks = await readTasks();
      const issues = [];
      
      let tasksWithPendingButCanExecute = 0;
      let tasksWithApprovedMissingEval = 0;
      let tasksWithStateMismatch = 0;
      let tasksWithDomainInvalidAfterApproval = 0;
      
      for (const task of tasks) {
        const approvalState = task.approvalState || {};
        const approvalEval = task.approvalEvaluation || {};
        
        // Check: approved but can_execute=false
        if (approvalState.approvedBy && approvalEval.can_execute === false) {
          tasksWithPendingButCanExecute++;
          issues.push({
            taskId: task.id,
            type: 'approved_but_blocked',
            approvedBy: approvalState.approvedBy,
            reason: approvalEval.reason || 'can_execute=false'
          });
        }
        
        // Check: approved in state but missing evaluation
        if (approvalState.approvedBy && !approvalEval.decision) {
          tasksWithApprovedMissingEval++;
          issues.push({
            taskId: task.id,
            type: 'approved_missing_eval'
          });
        }
        
        // Check: state vs eval mismatch
        const stateApproved = !!approvalState.approvedBy;
        const evalApproved = approvalEval.decision === 'APPROVED' || approvalEval.decision === 'AUTO_APPROVED';
        if (stateApproved !== evalApproved && (stateApproved || evalApproved)) {
          tasksWithStateMismatch++;
          issues.push({
            taskId: task.id,
            type: 'state_eval_mismatch',
            stateApproved,
            evalDecision: approvalEval.decision
          });
        }
        
        // Check: approved but domain_check invalid
        if (approvalState.approvedBy && approvalEval.domain_check && !approvalEval.domain_check.valid) {
          tasksWithDomainInvalidAfterApproval++;
          issues.push({
            taskId: task.id,
            type: 'approved_but_domain_invalid',
            domainReason: approvalEval.domain_check.reason
          });
        }
      }
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTasks: tasks.length,
        issuesFound: issues.length,
        byType: {
          approvedButBlocked: tasksWithPendingButCanExecute,
          approvedMissingEval: tasksWithApprovedMissingEval,
          stateEvalMismatch: tasksWithStateMismatch,
          approvedButDomainInvalid: tasksWithDomainInvalidAfterApproval
        },
        issues: issues.slice(0, 10) // Return first 10 only
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/daily-summary/send - Send daily summary (morning or evening)
  if (pathname === '/api/daily-summary/send' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const schedule = body.schedule || 'morning'; // 'morning' or 'evening'
      
      const result = await telegram.sendDailySummary(schedule, body.summaryData || {});
      
      // Log to activity_log
      if (result.dedupe) {
        await activityLogger.log({
          bot: 'leader',
          action: 'DAILY_SUMMARY_SKIPPED_DEDUPE',
          severity: 'OK',
          risk: 'LOW',
          target: schedule,
          message: `Daily ${schedule} summary deduped: ${result.reason}`,
          details: { schedule, reason: result.reason },
          owner_bot: 'leader'
        });
      } else if (result.ok) {
        await activityLogger.log({
          bot: 'leader',
          action: 'DAILY_SUMMARY_SENT',
          severity: 'OK',
          risk: 'LOW',
          target: schedule,
          message: `Daily ${schedule} summary sent via Telegram`,
          details: { schedule, messageId: result.messageId },
          owner_bot: 'leader'
        });
      } else {
        await activityLogger.log({
          bot: 'leader',
          action: 'DAILY_SUMMARY_FAILED',
          severity: 'WARN',
          risk: 'LOW',
          target: schedule,
          message: `Daily ${schedule} summary failed: ${result.error}`,
          details: { schedule, error: result.error },
          owner_bot: 'leader'
        });
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: result.ok || result.dedupe, result }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === NATURAL LANGUAGE CHAT API ===
  
  // POST /api/chat - Natural language chat with bots
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      
      if (!body.message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing message' }));
        return;
      }
      
      const result = await nlRouter.processMessage(
        body.message, 
        body.user || 'Anwar', 
        body.platform || 'dashboard'
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        bot: result.bot,
        icon: result.icon,
        name: result.name,
        response: result.response,
        action: result.action,
        confidence: result.confidence
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  
  // Trigger task assignment (for "assign all" type commands)
  if (pathname === '/api/chat/assign-all' && req.method === 'POST') {
    try {
      // Trigger Dashboard Bot to immediately process queue
      const tasks = await readTasks();
      const inProgress = tasks.filter(t => t.column === 'in-progress');
      
      // Dashboard Bot will pick these up on next poll
      // But let's provide immediate feedback
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: `Triggered assignment for ${inProgress.length} tasks`,
        tasks: inProgress.map(t => ({ id: t.id, title: t.title, agent: t.agent }))
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // === TOKEN ANALYTICS API ===
  
  // GET /api/tokens/data - Get token usage data for all dates
  if (pathname === '/api/tokens/data' && req.method === 'GET') {
    try {
      const data = await tokenAnalytics.getAllData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  
  // GET /api/tokens/dates - Get available dates
  if (pathname === '/api/tokens/dates' && req.method === 'GET') {
    try {
      const dates = await tokenAnalytics.getAvailableDates();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(dates));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  
  // GET /api/tokens/report/:date - Get report for specific date
  if (pathname.startsWith('/api/tokens/report/') && req.method === 'GET') {
    try {
      const date = pathname.split('/')[4];
      const report = await tokenAnalytics.getReportForDate(date);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  
  // POST /api/tokens/collect - Trigger manual collection
  if (pathname === '/api/tokens/collect' && req.method === 'POST') {
    try {
      await tokenAnalytics.collectFromLogs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Token data collected' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    if (e.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(500);
      res.end(e.message);
    }
  }
});

async function startServer() {
  await ensureDataDir();
  
  // === TELEGRAM DISABLED ===
  // Telegram now handled by OpenClaw native channel on port 18789
  // Dashboard web UI operates independently
  console.log('📱 Telegram: Using OpenClaw native channel (port 18789)');
  console.log('📱 Dashboard: Web UI only (port 3000)');
  
  // Skip Telegram initialization - let OpenClaw handle it
  const telegramOk = false;
  
  // === DAILY SUMMARY SCHEDULER DISABLED ===
  // Uses OpenClaw native cron instead
  console.log('📅 Daily summaries: Handled by OpenClaw native cron');
  const TIMEZONE = 'Asia/Dubai';
  const SCHEDULES = [
    { name: 'morning', time: '08:30', cron: '30 8 * * *' },
    { name: 'evening', time: '20:30', cron: '30 20 * * *' }
  ];
  
  // Simple scheduler using setTimeout for next occurrence, then setInterval
  function scheduleDailySummary(schedule) {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':');
    let nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                          parseInt(hours), parseInt(minutes), 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const delayMs = nextRun.getTime() - now.getTime();
    const delayHours = Math.floor(delayMs / 3600000);
    const delayMins = Math.floor((delayMs % 3600000) / 60000);
    
    console.log(`📅 ${schedule.name.toUpperCase()} summary scheduled: ${schedule.time} ${TIMEZONE}`);
    console.log(`   Next run: ${nextRun.toISOString()} (${delayHours}h ${delayMins}m)`);
    
    // Schedule first run
    setTimeout(async () => {
      console.log(`⏰ Sending ${schedule.name} summary...`);
      try {
        const result = await telegram.sendDailySummary(schedule.name);
        console.log(`   Result: ${result.ok ? '✅ sent' : result.dedupe ? '⏭️ deduped' : '❌ failed'}`);
      } catch (e) {
        console.error(`   Failed to send ${schedule.name} summary:`, e.message);
      }
      
      // Then set up daily interval (24 hours)
      setInterval(async () => {
        console.log(`⏰ Sending ${schedule.name} summary...`);
        try {
          const result = await telegram.sendDailySummary(schedule.name);
          console.log(`   Result: ${result.ok ? '✅ sent' : result.dedupe ? '⏭️ deduped' : '❌ failed'}`);
        } catch (e) {
          console.error(`   Failed to send ${schedule.name} summary:`, e.message);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, delayMs);
  }
  
  // Start both schedules - DISABLED (moved to OpenClaw native)
  // for (const schedule of SCHEDULES) {
  //   scheduleDailySummary(schedule);
  // }
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 Mission Control API Server on http://0.0.0.0:${PORT}`);
    console.log(`📁 Data: ${DATA_DIR}`);
    console.log(`📱 Telegram: Using OpenClaw native channel`);
    console.log(`📊 Dashboard Bot: Starting queue orchestration...`);

    // Start Dashboard Bot for task lifecycle management
    dashboardBot.start();

    // Telegram polling disabled - using OpenClaw native
    // if (telegram.enabled) {
    //   telegram.startPolling(2000);
    // }
  });
}

startServer();
