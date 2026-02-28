#!/usr/bin/env node
// Bot Worker Framework - Executes assigned tasks

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const API_BASE = 'http://127.0.0.1:3000';
const QUEUE_DIR = path.join(__dirname, '..', 'data', 'queues');

class BotWorker {
  constructor(botId, config = {}) {
    this.botId = botId;
    this.name = config.name || botId;
    this.icon = config.icon || '🤖';
    this.skills = config.skills || [];
    this.pollInterval = config.pollInterval || 30000; // 30 seconds
    this.running = false;
    this.currentTask = null;
    
    this.queueDir = path.join(QUEUE_DIR, botId);
    this.incomingFile = path.join(this.queueDir, 'incoming.jsonl');
    this.completedFile = path.join(this.queueDir, 'completed.jsonl');
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.icon} ${this.name}] ${level}: ${message}`);
  }

  async start() {
    this.running = true;
    this.log(`Bot worker started`);
    this.log(`Skills: ${this.skills.join(', ')}`);
    
    // Initial poll
    await this.poll();
    
    // Start polling loop
    this.interval = setInterval(() => this.poll(), this.pollInterval);
    
    // Start status reporting to Leader every 1 minute
    this.statusInterval = setInterval(() => this.reportStatusToLeader(), 60 * 1000);
    this.reportStatusToLeader(); // Initial report
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    this.log('Bot worker stopped');
  }

  async poll() {
    if (this.currentTask) {
      this.log(`Currently executing: ${this.currentTask.taskId}`);
      return;
    }

    try {
      const tasks = await this.readIncomingQueue();
      const pending = tasks.filter(t => t.status === 'pending');

      if (pending.length === 0) {
        return;
      }

      // Take highest priority task
      const task = this.selectHighestPriority(pending);
      await this.executeTask(task);

    } catch (e) {
      this.log(`Poll error: ${e.message}`, 'ERROR');
    }
  }

  selectHighestPriority(tasks) {
    const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    return tasks.sort((a, b) => {
      const pa = priorityOrder[a.priority] || 99;
      const pb = priorityOrder[b.priority] || 99;
      return pa - pb;
    })[0];
  }

  async readIncomingQueue() {
    try {
      const data = await fs.readFile(this.incomingFile, 'utf8');
      return data.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  async executeTask(task) {
    this.currentTask = task;
    this.log(`Starting execution: ${task.taskId} (${task.title})`);

    try {
      // 1. Mark as executing via API
      await this.callAPI('/api/bot/start-execution', {
        taskId: task.taskId,
        bot: this.botId
      });

      // 2. Execute the task logic
      const result = await this.performWork(task);

      // 3. Mark as completed via API
      await this.callAPI('/api/bot/complete', {
        taskId: task.taskId,
        bot: this.botId,
        result: result.success ? 'success' : 'failed',
        summary: result.summary,
        output: result.output
      });

      // 4. Update local queue
      await this.markTaskCompleted(task);

      this.log(`Completed: ${task.taskId} - ${result.summary}`);

    } catch (e) {
      this.log(`Execution failed: ${e.message}`, 'ERROR');
      
      // Report failure
      await this.callAPI('/api/bot/complete', {
        taskId: task.taskId,
        bot: this.botId,
        result: 'failed',
        summary: `Failed: ${e.message}`,
        output: e.stack
      });
    } finally {
      this.currentTask = null;
    }
  }

  async performWork(task) {
    // OVERRIDE: Each bot implements its own logic
    throw new Error(`performWork() not implemented for ${this.botId}`);
  }

  async callAPI(endpoint, data) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let response = '';
        res.on('data', chunk => response += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(response);
            resolve(result);
          } catch {
            resolve({ raw: response });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async markTaskCompleted(task) {
    // Update incoming queue
    const tasks = await this.readIncomingQueue();
    const updated = tasks.map(t => {
      if (t.taskId === task.taskId) {
        return { ...t, status: 'completed', completedAt: new Date().toISOString() };
      }
      return t;
    });
    
    await fs.writeFile(
      this.incomingFile,
      updated.map(t => JSON.stringify(t)).join('\n') + '\n'
    );
  }

  async reportStatusToLeader() {
    try {
      const tasks = await this.readIncomingQueue();
      const pending = tasks.filter(t => t.status === 'pending').length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      const total = tasks.length;
      
      const status = {
        timestamp: new Date().toISOString(),
        bot: this.botId,
        icon: this.icon,
        name: this.name,
        status: this.currentTask ? 'executing' : 'idle',
        currentTask: this.currentTask ? {
          taskId: this.currentTask.taskId,
          title: this.currentTask.title,
          eta: this.calculateETA ? this.calculateETA() : 'N/A'
        } : null,
        queueStats: {
          pending,
          completed,
          total
        },
        health: {
          lastPoll: new Date().toISOString(),
          nextPoll: new Date(Date.now() + this.pollInterval).toISOString()
        }
      };
      
      // Report to Leader via queue
      const leaderStatusFile = path.join(QUEUE_DIR, 'leader', 'bot_status_reports.jsonl');
      try {
        await fs.appendFile(leaderStatusFile, JSON.stringify(status) + '\n');
      } catch (e) {
        await fs.mkdir(path.dirname(leaderStatusFile), { recursive: true });
        await fs.appendFile(leaderStatusFile, JSON.stringify(status) + '\n');
      }
      
      // Also call API
      await this.callAPI('/api/bot/status-report', status);
      
    } catch (e) {
      this.log(`Failed to report status to Leader: ${e.message}`, 'ERROR');
    }
  }
}

module.exports = BotWorker;
