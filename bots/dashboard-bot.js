#!/usr/bin/env node
// Dashboard Bot Worker - Manages queue lifecycle and reports status to Leader

const BotWorker = require('../bot-worker');
const fs = require('fs').promises;
const path = require('path');

const STATUS_REPORT_INTERVAL = 60 * 1000; // 1 minute
const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks', 'tasks.json');

class DashboardBot extends BotWorker {
  constructor() {
    super('dashboard', {
      name: 'Dashboard Bot',
      icon: '📊',
      skills: ['queue_management', 'task_assignment', 'lifecycle_orchestration', 'completion_validation', 'timeout_handling', 'status_reporting'],
      pollInterval: 60000 // 1 minute - Dashboard Bot polls faster for queue management
    });
    
    this.statusReportTimer = null;
    this.currentTask = null;
    this.executionStartTime = null;
  }

  async start() {
    await super.start();
    
    // Start status reporting to Leader every 3 minutes
    this.statusReportTimer = setInterval(() => {
      this.reportStatusToLeader();
    }, STATUS_REPORT_INTERVAL);
    
    this.log('Status reporting active (every 3 minutes)');
  }

  stop() {
    if (this.statusReportTimer) {
      clearInterval(this.statusReportTimer);
    }
    super.stop();
  }

  async reportStatusToLeader() {
    try {
      const tasks = await this.readTasks();
      const summary = {
        timestamp: new Date().toISOString(),
        bot: 'dashboard',
        icon: '📊',
        status: this.currentTask ? 'executing' : 'idle',
        currentTask: this.currentTask,
        queueSummary: {
          inbox: tasks.filter(t => t.column === 'inbox').length,
          review: tasks.filter(t => t.column === 'review').length,
          'in-progress': tasks.filter(t => t.column === 'in-progress').length,
          assigned: tasks.filter(t => t.column === 'assigned').length,
          executing: tasks.filter(t => t.column === 'executing').length,
          completed: tasks.filter(t => t.column === 'completed').length
        },
        recentCompletions: tasks
          .filter(t => t.column === 'completed' && t.completedAt)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 5)
          .map(t => ({ id: t.id, agent: t.agent, completedAt: t.completedAt })),
        eta: this.calculateETA()
      };

      // Write status report for Leader to read
      const statusFile = path.join(__dirname, '..', 'data', 'queues', 'leader', 'bot_status_reports.jsonl');
      await fs.appendFile(statusFile, JSON.stringify(summary) + '\n');
      
      this.log(`Status reported to Leader: ${summary.queueSummary.assigned} assigned, ${summary.queueSummary.executing} executing`);
    } catch (e) {
      this.log(`Status report failed: ${e.message}`, 'ERROR');
    }
  }

  calculateETA() {
    if (!this.currentTask) return null;
    
    const elapsed = Date.now() - this.executionStartTime;
    const estimatedTotal = 5 * 60 * 1000; // Estimate 5 minutes per task
    const remaining = Math.max(0, estimatedTotal - elapsed);
    
    return {
      taskId: this.currentTask.taskId,
      elapsed: Math.floor(elapsed / 1000),
      remaining: Math.floor(remaining / 1000),
      percentComplete: Math.min(100, Math.floor((elapsed / estimatedTotal) * 100))
    };
  }

  async performWork(task) {
    this.currentTask = task;
    this.executionStartTime = Date.now();
    
    this.log(`Dashboard Bot processing: ${task.taskId}`);
    
    try {
      // Dashboard Bot manages queue - check for tasks needing assignment
      const tasks = await this.readTasks();
      const actions = [];
      
      // Find tasks in in-progress that need assignment
      const toAssign = tasks.filter(t => 
        t.column === 'in-progress' && 
        !t.assignedAt &&
        t.status !== 'completed'
      );
      
      if (toAssign.length > 0) {
        this.log(`Found ${toAssign.length} tasks to assign`);
        
        for (const t of toAssign) {
          // Route to appropriate bot
          const routing = await this.routeTask(t);
          actions.push(`Assigned ${t.id} → ${routing.agent}`);
          
          // Add to bot's queue
          await this.enqueueForBot(routing.agent, t);
        }
      }
      
      // Check for timeout tasks
      const executing = tasks.filter(t => 
        t.column === 'executing' && 
        t.executionStartedAt
      );
      
      const timeoutMs = 30 * 60 * 1000; // 30 minutes
      const now = Date.now();
      
      for (const t of executing) {
        const started = new Date(t.executionStartedAt).getTime();
        if (now - started > timeoutMs) {
          actions.push(`Timeout: ${t.id} (30min exceeded)`);
          // Would move back to assigned here
        }
      }
      
      // Send completion report
      const result = {
        success: true,
        summary: `Dashboard Bot: ${actions.length} actions processed`,
        output: JSON.stringify({
          actions,
          queueStats: {
            inbox: tasks.filter(t => t.column === 'inbox').length,
            review: tasks.filter(t => t.column === 'review').length,
            'in-progress': tasks.filter(t => t.column === 'in-progress').length,
            assigned: tasks.filter(t => t.column === 'assigned').length,
            executing: tasks.filter(t => t.column === 'executing').length,
            completed: tasks.filter(t => t.column === 'completed').length
          }
        }, null, 2)
      };
      
      return result;
      
    } catch (e) {
      this.log(`Task processing failed: ${e.message}`, 'ERROR');
      throw e;
    } finally {
      this.currentTask = null;
      this.executionStartTime = null;
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

  async routeTask(task) {
    // Simple routing based on task content
    const lower = (task.title + ' ' + (task.description || '')).toLowerCase();
    
    if (lower.includes('proxmox') || lower.includes('vm') || lower.includes('lxc') || lower.includes('backup')) {
      return { agent: 'proxmox', icon: '🖥️', name: 'Proxmox Bot', reason: 'VM/LXC infrastructure' };
    }
    if (lower.includes('home') || lower.includes('ha ') || lower.includes('automation') || lower.includes('zigbee')) {
      return { agent: 'home', icon: '🏠', name: 'Home Bot', reason: 'Home Assistant' };
    }
    if (lower.includes('storage') || lower.includes('pbs') || lower.includes('truenas') || lower.includes('zfs')) {
      return { agent: 'storage', icon: '💾', name: 'Storage Bot', reason: 'Storage infrastructure' };
    }
    if (lower.includes('network') || lower.includes('firewall') || lower.includes('vlan') || lower.includes('unifi')) {
      return { agent: 'network', icon: '🌐', name: 'Network Bot', reason: 'Network infrastructure' };
    }
    if (lower.includes('security') || lower.includes('fail2ban') || lower.includes('audit')) {
      return { agent: 'security', icon: '🔐', name: 'Security Bot', reason: 'Security hardening' };
    }
    
    return { agent: 'leader', icon: '🎯', name: 'Leader Bot', reason: 'Requires coordination' };
  }

  async enqueueForBot(botId, task) {
    const queueFile = path.join(__dirname, '..', 'data', 'queues', botId, 'incoming.jsonl');
    const entry = {
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      risk: task.risk,
      assignedAt: new Date().toISOString(),
      status: 'pending'
    };
    await fs.appendFile(queueFile, JSON.stringify(entry) + '\n');
  }
}

module.exports = DashboardBot;

// Standalone execution
if (require.main === module) {
  const bot = new DashboardBot();
  bot.start();
}
