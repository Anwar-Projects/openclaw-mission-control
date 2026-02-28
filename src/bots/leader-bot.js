#!/usr/bin/env node
// Leader Bot - Coordinates tasks assigned to leader and interfaces with human

const BotWorker = require('../bot-worker');

class LeaderBot extends BotWorker {
  constructor() {
    super('leader', {
      name: 'Leader Bot',
      icon: '🎯',
      skills: ['coordination', 'approval', 'bundling'],
      pollInterval: 5000 // 5 seconds - highest priority bot
    });
    
    this.taskHandlers = {
      // Approval bundle handling
      'approval-bundle-001': this.handleApprovalBundle.bind(this),
      // Default handler for unknown tasks
    };
  }

  async performWork(task) {
    const taskId = task.taskId;
    const title = task.title;
    
    this.log(`Leader processing: ${taskId}`);

    // Route to specific handler or default
    if (this.taskHandlers[taskId]) {
      return await this.taskHandlers[taskId](task);
    }

    return await this.defaultHandler(task);
  }

  async handleApprovalBundle(task) {
    this.log('Processing approval bundle...');
    
    // The approval bundle needs Anwar to review and approve
    // Generate a summary report
    const summary = {
      bundle: 'Infrastructure Fixes Bundle #1',
      items: [
        { name: 'Task 1', action: 'Requires approval' },
        { name: 'Task 2', action: 'Queued for review' }
      ],
      required: true
    };
    
    // Post to activity log that bundle needs attention
    await this.callAPI('/api/notify/activity', {
      action: 'LEADER_BUNDLE_REVIEW',
      bot: 'leader',
      message: '🎯 LEADER: Approval Bundle #1 needs Anwar review',
      details: summary,
      severity: 'INFO'
    });
    
    return {
      success: true,
      summary: 'Approval Bundle #1 ready - pending Anwar review via dashboard notifications',
      output: JSON.stringify(summary, null, 2)
    };
  }

  async defaultHandler(task) {
    // Leader coordinates human-facing tasks
    this.log(`Coordinating task: ${task.taskId}`);
    
    await this.callAPI('/api/notify/activity', {
      action: 'LEADER_COORDINATED',
      bot: 'leader',
      message: `[${task.taskId}] Coordinated by Leader`,
      severity: 'OK'
    });
    
    return {
      success: true,
      summary: `Task coordinated by Leader - ready for human approval`,
      output: `Task: ${task.title}`
    };
  }
}

module.exports = LeaderBot;

// Standalone execution
if (require.main === module) {
  const bot = new LeaderBot();
  bot.start();
}
