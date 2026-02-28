#!/usr/bin/env node
// Squad Chat Evaluation Orchestrator - Runs every 6 hours
// Analyzes suggestions from all agents, selects best, creates implementation plan

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const API_BASE = 'http://127.0.0.1:3000';
const SQUAD_CHAT_FILE = path.join(__dirname, '..', 'data', 'squad_chat.jsonl');
const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks', 'tasks.json');

class SquadChatEvaluator {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.reportId = `squad-eval-${Date.now()}`;
  }

  async runEvaluation() {
    console.log(`[${this.timestamp}] Squad Chat Evaluation Started`);
    
    try {
      // 1. Read Squad Chat history (last 6 hours)
      const suggestions = await this.readRecentSuggestions(6);
      console.log(`Found ${suggestions.length} recent suggestions`);
      
      // 2. Analyze and categorize suggestions
      const analysis = this.analyzeSuggestions(suggestions);
      
      // 3. Select best suggestion based on criteria
      const bestSuggestion = this.selectBestSuggestion(analysis);
      
      // 4. Create implementation plan
      const plan = this.createImplementationPlan(bestSuggestion);
      
      // 5. Submit for user approval
      await this.submitForApproval(plan, analysis);
      
      // 6. Log completion
      console.log('✅ Squad Chat evaluation complete');
      
    } catch (e) {
      console.error('❌ Evaluation failed:', e.message);
    }
  }

  async readRecentSuggestions(hoursBack) {
    try {
      const data = await fs.readFile(SQUAD_CHAT_FILE, 'utf8');
      const lines = data.split('\n').filter(l => l.trim());
      const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
      
      const suggestions = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.timestamp && new Date(entry.timestamp).getTime() > cutoff) {
            suggestions.push(entry);
          }
        } catch {}
      }
      return suggestions;
    } catch {
      return [];
    }
  }

  analyzeSuggestions(suggestions) {
    const byAgent = {};
    const byCategory = {};
    
    for (const s of suggestions) {
      // Group by agent
      const agent = s.agent || 'unknown';
      if (!byAgent[agent]) byAgent[agent] = [];
      byAgent[agent].push(s);
      
      // Detect category from content
      const category = this.detectCategory(s.message);
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(s);
    }
    
    return {
      total: suggestions.length,
      byAgent,
      byCategory,
      timestamp: this.timestamp
    };
  }

  detectCategory(message) {
    if (!message) return 'other';
    const m = message.toLowerCase();
    
    if (m.includes('backup') || m.includes('storage') || m.includes('pbs') || m.includes('truenas')) {
      return 'storage_backup';
    }
    if (m.includes('vm') || m.includes('proxmox') || m.includes('lxc') || m.includes('container')) {
      return 'infrastructure';
    }
    if (m.includes('ha ') || m.includes('home assistant') || m.includes('automation') || m.includes('sensor')) {
      return 'home_automation';
    }
    if (m.includes('security') || m.includes('fail2ban') || m.includes('vulnerability') || m.includes('audit')) {
      return 'security';
    }
    if (m.includes('network') || m.includes('vlan') || m.includes('firewall') || m.includes('wifi')) {
      return 'network';
    }
    return 'other';
  }

  selectBestSuggestion(analysis) {
    // Priority: P0 risks > storage issues > home automation > security > infrastructure
    const priorities = ['security', 'storage_backup', 'home_automation', 'infrastructure', 'network', 'other'];
    
    for (const cat of priorities) {
      if (analysis.byCategory[cat] && analysis.byCategory[cat].length > 0) {
        // Get most recent from this category
        const sorted = analysis.byCategory[cat].sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        return {
          category: cat,
          suggestion: sorted[0],
          count: sorted.length
        };
      }
    }
    
    return {
      category: 'none',
      suggestion: null,
      count: 0
    };
  }

  createImplementationPlan(selected) {
    if (!selected.suggestion) {
      return {
        hasPlan: false,
        message: 'No actionable suggestions found in Squad Chat (last 6h)'
      };
    }
    
    const { category, suggestion, count } = selected;
    const catNames = {
      security: 'Security Hardening',
      storage_backup: 'Storage & Backup',
      home_automation: 'Home Automation',
      infrastructure: 'Infrastructure',
      network: 'Network',
      other: 'General Improvement'
    };
    
    return {
      hasPlan: true,
      priority: category === 'security' ? 'P0' : category === 'storage_backup' ? 'P1' : 'P2',
      category: catNames[category] || category,
      suggestion: suggestion,
      relatedCount: count,
      proposedTitle: `🎯 Squad Recommendation: ${suggestion.message?.substring(0, 60)}...`,
      agent: this.routeToAgent(category),
      estimatedEffort: this.estimateEffort(category),
      benefits: this.listBenefits(category),
      executionPlan: [
        `Phase 1: Analysis by ${this.routeToAgent(category)} Agent`,
        'Phase 2: Implementation planning',
        'Phase 3: Execution with safety checks',
        'Phase 4: Validation and documentation'
      ].join('\n'),
      timestamp: this.timestamp
    };
  }

  routeToAgent(category) {
    const routes = {
      security: 'security',
      storage_backup: 'storage',
      home_automation: 'home',
      infrastructure: 'proxmox',
      network: 'network',
      other: 'leader'
    };
    return routes[category] || 'leader';
  }

  estimateEffort(category) {
    const efforts = {
      security: '2-4 hours',
      storage_backup: '30-60 minutes',
      home_automation: '1-2 hours',
      infrastructure: '1-3 hours',
      network: '30-90 minutes',
      other: 'TBD'
    };
    return efforts[category] || 'TBD';
  }

  listBenefits(category) {
    const benefits = {
      security: 'Reduced attack surface, compliance, intrusion detection',
      storage_backup: 'Data protection, disaster recovery, peace of mind',
      home_automation: 'Convenience, energy savings, comfort',
      infrastructure: 'Reliability, performance, resource optimization',
      network: 'Connectivity, security, management visibility',
      other: 'Operational efficiency'
    };
    return benefits[category] || 'To be determined';
  }

  async submitForApproval(plan, analysis) {
    if (!plan.hasPlan) {
      console.log('No plan to submit - skipping approval request');
      return;
    }
    
    // Create approval task
    const approvalTask = {
      id: `squad-approval-${Date.now()}`,
      title: plan.proposedTitle,
      description: `📊 SQUAD CHAT EVALUATION - ${new Date().toLocaleString('en-AE', {hour12: false})}

🏆 SELECTED SUGGESTION:
Source: ${plan.suggestion?.agent || 'Unknown'} Agent
Category: ${plan.category}
Priority: ${plan.priority}

SUGGESTION DETAILS:
${plan.suggestion?.message || 'N/A'}

IMPLEMENTATION PLAN:
${plan.executionPlan}

ESTIMATED EFFORT: ${plan.estimatedEffort}
ASSIGNED AGENT: ${plan.agent}

KEY BENEFITS:
${plan.benefits}

STATISTICS:
- Total suggestions analyzed: ${analysis.total}
- In same category: ${plan.relatedCount}
- Evaluation time: ${this.timestamp}

AGENT DISTRIBUTION (last 6h):
${Object.entries(analysis.byAgent).map(([k,v]) => `- ${k}: ${v.length}`).join('\n')}

CATEGORY BREAKDOWN:
${Object.entries(analysis.byCategory).map(([k,v]) => `- ${k}: ${v.length}`).join('\n')}

⏰ APPROVAL DEADLINE: Next evaluation in 6 hours.`,
      agent: 'leader',
      priority: plan.priority,
      status: 'inbox',
      column: 'inbox',
      type: 'squad-recommendation',
      agentIcon: '🎯',
      tags: ['squad-chat', 'approval-required', plan.category],
      createdAt: this.timestamp,
      requiresConfirmation: true,
      proposedAgent: plan.agent,
      sourceSquadChat: true
    };
    
    // Add to tasks
    const tasks = JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));
    tasks.unshift(approvalTask);
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
    
    // Try to notify via Telegram (if configured)
    try {
      await this.sendTelegramNotification(approvalTask);
    } catch (e) {
      console.log('Telegram notification failed:', e.message);
    }
    
    console.log(`✅ Created approval task: ${approvalTask.id}`);
  }

  async sendTelegramNotification(task) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log('Telegram not configured - skipping notification');
      return;
    }
    
    // This would be actual Telegram API call
    console.log(`Would send Telegram: ${task.title}`);
  }
}

// Run if called directly
if (require.main === module) {
  const evaluator = new SquadChatEvaluator();
  evaluator.runEvaluation();
}

module.exports = SquadChatEvaluator;
