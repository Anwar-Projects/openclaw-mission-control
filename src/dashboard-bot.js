// Mission Control - Enhanced Dashboard Bot
// Complete queue orchestration: inbox → review → in-progress → assigned → executing → completed

const fs = require('fs').promises;
const path = require('path');
const { DelegationRouter } = require('./delegation-service');

const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks', 'tasks.json');
const QUEUE_DIR = path.join(__dirname, '..', 'data', 'queues');
const ACTIVITY_LOG = path.join(__dirname, '..', 'data', 'activity_log.jsonl');

class DashboardBot {
  constructor() {
    this.router = new DelegationRouter();
    this.pollingInterval = null;
    this.pollMs = 60000; // 1 minute as requested
    this.processing = new Set();
    this.botIcons = {
      leader: '🎯',
      proxmox: '🖥️',
      home: '🏠',
      storage: '💾',
      network: '🌐',
      security: '🔐',
      dashboard: '📊'
    };
  }

  start() {
    console.log('📊 Enhanced Dashboard Bot started');
    console.log(`   Queue management interval: ${this.pollMs/1000}s (1 minute)`);
    console.log('   Managing full lifecycle: inbox → review → in-progress → assigned → executing → completed');

    this.ensureQueueDir();
    this.poll();
    this.pollingInterval = setInterval(() => this.poll(), this.pollMs);
  }

  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 Dashboard Bot stopped');
    }
  }

  async ensureQueueDir() {
    try {
      await fs.mkdir(QUEUE_DIR, { recursive: true });
      const bots = ['leader', 'proxmox', 'home', 'storage', 'network', 'security', 'dashboard'];
      for (const bot of bots) {
        await fs.mkdir(path.join(QUEUE_DIR, bot), { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create queue directories:', e.message);
    }
  }

  /**
   * Main polling loop - comprehensive queue management
   */
  async poll() {
    try {
      const tasks = await this.readTasks();
      const now = new Date().toISOString();
      
      console.log(`[${new Date().toLocaleTimeString()}] 📊 Dashboard Bot polling...`);

      for (const task of tasks) {
        if (this.processing.has(task.id)) continue;

        const col = task.column;
        const status = task.status;

        // State 1: inbox → review (needs triage)
        if (col === 'inbox') {
          await this.triageTask(task, tasks);
        }
        
        // State 2: review → in-progress (approved)
        if (col === 'review' && (task.approved || task.approval === 'APPROVED')) {
          await this.approveTask(task, tasks);
        }

        // State 3: in-progress → assigned (route to bot)
        if (col === 'in-progress' && !task.assignedAt) {
          await this.assignToBot(task, tasks);
        }

        // State 4: assigned → executing (bot picked up)
        if (col === 'assigned') {
          await this.checkBotStarted(task, tasks);
          await this.checkBotCompletion(task, tasks);
        }

        // State 5: executing → completed (bot finished)
        if (col === 'executing') {
          await this.checkExecutionComplete(task, tasks);
          await this.monitorExecutionTimeout(task, tasks);
        }

        // State 6: Handle completed with errors/stuck
        if (col === 'completed' && status !== 'completed') {
          task.status = 'completed';
          task.updated = now;
        }
      }

      console.log(`[${new Date().toLocaleTimeString()}] ✅ Dashboard Bot cycle complete`);

    } catch (e) {
      console.error('Dashboard Bot poll error:', e.message);
    }
  }

  /**
   * Triage new tasks from inbox
   */
  async triageTask(task, allTasks) {
    this.processing.add(task.id);
    try {
      // Auto-route if clear, else send to review
      const routing = this.router.routeTask(task);
      
      if (!routing.ambiguous) {
        // Clear routing - move to in-progress
        task.column = 'in-progress';
        task.status = 'in_progress';
        task.agent = routing.agent;
        task.agentIcon = this.botIcons[routing.agent] || '🤖';
        task.routingReason = routing.reason;
        task.routedBy = 'DashboardBot (auto-triage)';
        task.updated = new Date().toISOString();
        
        console.log(`[DashboardBot] Auto-triaged ${task.id} → ${routing.agent}`);
        
        await this.logActivity({
          bot: 'dashboard',
          action: 'TASK_AUTO_TRIAGED',
          severity: 'OK',
          risk: 'LOW',
          target: task.id,
          message: `Auto-triaged to ${routing.agent}: ${routing.reason}`,
          owner_bot: 'dashboard'
        });
      } else {
        // Ambiguous - needs Anwar review
        task.column = 'review';
        task.status = 'review';
        task.ambiguityNote = routing.reason;
        task.ambiguityCandidates = routing.candidates;
        task.updated = new Date().toISOString();
        
        console.log(`[DashboardBot] ${task.id} needs review: ${routing.reason}`);
        
        await this.logActivity({
          bot: 'dashboard',
          action: 'TASK_NEEDS_REVIEW',
          severity: 'INFO',
          risk: 'LOW',
          target: task.id,
          message: `Needs Anwar review: ${routing.reason}`,
          details: { candidates: routing.candidates },
          owner_bot: 'dashboard'
        });
      }
      
      await this.writeTasks(allTasks);
      
    } finally {
      this.processing.delete(task.id);
    }
  }

  /**
   * Handle approved tasks
   */
  async approveTask(task, allTasks) {
    this.processing.add(task.id);
    try {
      task.column = 'in-progress';
      task.status = 'in_progress';
      task.approved = true;
      task.approvedAt = task.approvedAt || new Date().toISOString();
      task.updated = new Date().toISOString();
      
      console.log(`[DashboardBot] Approved ${task.id} → in-progress`);
      
      await this.logActivity({
        bot: 'dashboard',
        action: 'TASK_APPROVED',
        severity: 'OK',
        risk: 'LOW',
        target: task.id,
        message: `Task approved and moved to in-progress`,
        owner_bot: 'dashboard'
      });
      
      await this.writeTasks(allTasks);
      
    } finally {
      this.processing.delete(task.id);
    }
  }

  /**
   * Assign task to appropriate bot
   */
  async assignToBot(task, allTasks) {
    this.processing.add(task.id);
    try {
      const routing = this.router.routeTask(task);
      const targetBot = routing.agent;
      const botIcon = this.botIcons[targetBot] || '🤖';

      task.agent = targetBot;
      task.agentIcon = botIcon;
      task.column = 'assigned';
      task.status = 'assigned';
      task.assignedAt = new Date().toISOString();
      task.assignedBy = 'DashboardBot';
      task.routingReason = routing.reason;
      task.updated = new Date().toISOString();

      await this.enqueueForBot(targetBot, task);

      await this.logActivity({
        bot: 'dashboard',
        action: 'TASK_ASSIGNED',
        severity: 'OK',
        risk: 'LOW',
        target: task.id,
        message: `Assigned to ${targetBot}: ${task.title?.substring(0, 60)}`,
        details: { agent: targetBot, reason: routing.reason },
        owner_bot: 'dashboard'
      });

      await this.writeTasks(allTasks);
      console.log(`[DashboardBot] Assigned ${task.id} → ${targetBot}`);

    } catch (e) {
      console.error(`[DashboardBot] Failed to assign ${task.id}:`, e.message);
    } finally {
      this.processing.delete(task.id);
    }
  }

  /**
   * Check if bot started execution
   */
  async checkBotStarted(task, allTasks) {
    const executingFile = path.join(QUEUE_DIR, task.agent, 'executing.jsonl');
    try {
      const executing = await this.readQueueFile(executingFile);
      const execution = executing.find(e => e.taskId === task.id);
      
      if (execution && task.column === 'assigned') {
        task.column = 'executing';
        task.status = 'executing';
        task.executionStartedAt = execution.startedAt || new Date().toISOString();
        task.updated = new Date().toISOString();
        
        console.log(`[DashboardBot] ${task.id} started by ${task.agent}`);
        await this.writeTasks(allTasks);
      }
    } catch {
      // No executing file yet
    }
  }

  /**
   * Check if bot completed task
   */
  async checkBotCompletion(task, allTasks) {
    try {
      const botQueueFile = path.join(QUEUE_DIR, task.agent, 'completed.jsonl');
      const completed = await this.readQueueFile(botQueueFile);
      const record = completed.find(c => c.taskId === task.id);

      if (record) {
        task.column = 'completed';
        task.status = 'completed';
        task.completedAt = record.completedAt || new Date().toISOString();
        task.completedBy = record.completedBy || task.agent;
        task.result = record.result || 'success';
        task.resultSummary = record.summary || 'Task completed';
        task.updated = new Date().toISOString();

        if (!task.comments) task.comments = [];
        task.comments.push({
          author: task.agent,
          authorIcon: task.agentIcon || this.botIcons[task.agent] || '🤖',
          text: `✅ Completed: ${record.summary || 'Task finished'}`,
          timestamp: new Date().toISOString()
        });

        await this.logActivity({
          bot: 'dashboard',
          action: 'TASK_COMPLETED',
          severity: 'OK',
          risk: 'LOW',
          target: task.id,
          message: `Completed by ${task.agent}: ${record.summary || 'Success'}`,
          owner_bot: 'dashboard'
        });

        await this.writeTasks(allTasks);
        console.log(`[DashboardBot] ${task.id} completed by ${task.agent}`);
      }
    } catch (e) {
      // Bot hasn't completed yet
    }
  }

  /**
   * Check execution completion via executing.jsonl removal
   */
  async checkExecutionComplete(task, allTasks) {
    const executingFile = path.join(QUEUE_DIR, task.agent, 'executing.jsonl');
    try {
      const executing = await this.readQueueFile(executingFile);
      const stillExecuting = executing.find(e => e.taskId === task.id);
      
      // If was in executing but no longer there, check completed
      if (!stillExecuting && task.executionStartedAt) {
        await this.checkBotCompletion(task, allTasks);
      }
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Monitor for execution timeout
   * DISABLED: Agents complete tasks and update Leader when done
   */
  async monitorExecutionTimeout(task, allTasks) {
    // Timeout disabled - agents report completion themselves
    // Previous: 30 minute timeout
    // Now: No timeout - agents complete asynchronously
    return;
    
    /* Timeout logic disabled:
    const started = new Date(task.executionStartedAt || task.updated);
    const now = new Date();
    const timeoutMs = 30 * 60 * 1000; // 30 minutes

    if (now - started > timeoutMs) {
      console.log(`[DashboardBot] ${task.id} execution timeout`);
      ...
    }
    */
  }

  async enqueueForBot(botId, task) {
    const incomingFile = path.join(QUEUE_DIR, botId, 'incoming.jsonl');
    const executingFile = path.join(QUEUE_DIR, botId, 'executing.jsonl');
    
    const entry = {
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      risk: task.risk,
      assignedAt: new Date().toISOString(),
      status: 'pending'
    };

    // Add to incoming queue
    await fs.appendFile(incomingFile, JSON.stringify(entry) + '\n');
    
    // Also write to executing.jsonl as placeholder (will be removed when bot starts)
    await fs.appendFile(executingFile, JSON.stringify({
      ...entry,
      status: 'queued',
      queuedAt: new Date().toISOString()
    }) + '\n');
  }

  async readQueueFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return data.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  async readTasks() {
    try {
      const data = await fs.readFile(TASKS_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async writeTasks(tasks) {
    const tmpFile = TASKS_FILE + '.tmp';
    await fs.writeFile(tmpFile, JSON.stringify(tasks, null, 2), 'utf8');
    await fs.rename(tmpFile, TASKS_FILE);
  }

  async logActivity(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...event
    };
    await fs.appendFile(ACTIVITY_LOG, JSON.stringify(entry) + '\n', 'utf8');
  }

  async getQueueSummary() {
    const tasks = await this.readTasks();
    return {
      inbox: tasks.filter(t => t.column === 'inbox').length,
      review: tasks.filter(t => t.column === 'review').length,
      'in-progress': tasks.filter(t => t.column === 'in-progress').length,
      assigned: tasks.filter(t => t.column === 'assigned').length,
      executing: tasks.filter(t => t.column === 'executing').length,
      completed: tasks.filter(t => t.column === 'completed' || t.column === 'done').length
    };
  }
}

module.exports = DashboardBot;

// Standalone mode
if (require.main === module) {
  const bot = new DashboardBot();
  bot.start();
  
  process.on('SIGINT', () => {
    console.log('\nShutting down Dashboard Bot...');
    bot.stop();
    process.exit(0);
  });
}
