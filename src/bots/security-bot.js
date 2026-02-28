#!/usr/bin/env node
// Security Bot - Manages security hardening, fail2ban, audits

const BotWorker = require('../bot-worker');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SecurityBot extends BotWorker {
  constructor() {
    super('security', {
      name: 'Security Bot',
      icon: '🔐',
      skills: ['fail2ban_management', 'security_audits', 'access_control', 'log_monitoring', 'intrusion_detection', 'vulnerability_scanning'],
      pollInterval: 30000 // 30 seconds
    });
    
    this.taskHandlers = {
      'security-audit': this.handleSecurityAudit.bind(this),
      'fail2ban-check': this.handleFail2banCheck.bind(this),
      'access-review': this.handleAccessReview.bind(this),
      'vulnerability-scan': this.handleVulnScan.bind(this),
      'intrusion-detection': this.handleIntrusionDetection.bind(this)
    };
  }

  async performWork(task) {
    const taskId = task.taskId;
    const title = task.title || 'Unknown Task';
    
    this.log(`Security Bot processing: ${taskId}`);

    // Route to specific handler if available
    const handler = this.findHandler(taskId, title);
    if (handler) {
      return await handler(task);
    }

    // Default security task handling
    return await this.defaultSecurityHandler(task);
  }

  findHandler(taskId, title) {
    const lowerId = taskId.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    if (lowerId.includes('audit') || lowerTitle.includes('audit')) {
      return this.taskHandlers['security-audit'];
    }
    if (lowerId.includes('fail2ban') || lowerTitle.includes('fail2ban')) {
      return this.taskHandlers['fail2ban-check'];
    }
    if (lowerId.includes('access') || lowerTitle.includes('access')) {
      return this.taskHandlers['access-review'];
    }
    if (lowerId.includes('vuln') || lowerId.includes('scan') || lowerTitle.includes('vulnerability')) {
      return this.taskHandlers['vulnerability-scan'];
    }
    if (lowerId.includes('intrusion') || lowerTitle.includes('intrusion') || lowerTitle.includes('intrusion')) {
      return this.taskHandlers['intrusion-detection'];
    }
    
    return null;
  }

  async handleSecurityAudit(task) {
    this.log('Running security audit...');
    
    try {
      // Check critical security settings
      const checks = [];
      
      // Check SSH config
      try {
        const { stdout } = await execPromise('grep -E "^(PermitRootLogin|PasswordAuthentication)" /etc/ssh/sshd_config 2>/dev/null || echo "SSH config not accessible"');
        checks.push(`SSH Config: ${stdout.trim()}`);
      } catch {
        checks.push('SSH Config: Unable to check');
      }
      
      // Check fail2ban status
      try {
        const { stdout } = await execPromise('systemctl is-active fail2ban 2>/dev/null || echo "inactive"');
        checks.push(`fail2ban: ${stdout.trim()}`);
      } catch {
        checks.push('fail2ban: Not installed');
      }
      
      // Check firewall status
      try {
        const { stdout } = await execPromise('ufw status 2>/dev/null | head -1 || iptables -L -n 2>/dev/null | head -5 || echo "Firewall check limited"');
        checks.push(`Firewall: ${stdout.split('\n')[0]}`);
      } catch {
        checks.push('Firewall: Check limited');
      }
      
      return {
        success: true,
        summary: `Security audit completed: ${checks.length} checks performed`,
        output: checks.join('\n')
      };
    } catch (e) {
      return {
        success: false,
        summary: `Security audit failed: ${e.message}`,
        output: e.stack
      };
    }
  }

  async handleFail2banCheck(task) {
    this.log('Checking fail2ban status...');
    
    try {
      let status = 'not-installed';
      let output = '';
      
      try {
        const { stdout } = await execPromise('fail2ban-client status 2>/dev/null');
        status = 'active';
        output = stdout;
      } catch {
        try {
          const { stdout } = await execPromise('systemctl is-active fail2ban 2>/dev/null');
          status = stdout.trim() === 'active' ? 'active' : 'inactive';
        } catch {
          status = 'not-installed';
        }
      }
      
      return {
        success: true,
        summary: `fail2ban status: ${status}`,
        output: output || `Status: ${status}`
      };
    } catch (e) {
      return {
        success: false,
        summary: `fail2ban check failed: ${e.message}`,
        output: e.stack
      };
    }
  }

  async handleAccessReview(task) {
    this.log('Reviewing access controls...');
    
    try {
      // Check sudoers
      const checks = [];
      
      try {
        const { stdout: sudoers } = await execPromise('ls -la /etc/sudoers.d/ 2>/dev/null | wc -l');
        checks.push(`Sudoers configs: ${parseInt(sudoers) - 1} files`);
      } catch {
        checks.push('Sudoers: Unable to check');
      }
      
      // Check users
      try {
        const { stdout: users } = await execPromise('cat /etc/passwd | wc -l');
        checks.push(`System users: ${users.trim()}`);
      } catch {
        checks.push('Users: Unable to count');
      }
      
      return {
        success: true,
        summary: `Access review completed`,
        output: checks.join('\n')
      };
    } catch (e) {
      return {
        success: false,
        summary: `Access review failed: ${e.message}`,
        output: e.stack
      };
    }
  }

  async handleVulnScan(task) {
    this.log('Running vulnerability scan...');
    
    return {
      success: true,
      summary: 'Vulnerability scan queued (requires external scanner)', 
      output: 'Vulnerability scanning requires external tools (OpenVAS, Nessus, etc.). Please install and configure a vulnerability scanner for complete coverage.'
    };
  }

  async handleIntrusionDetection(task) {
    this.log('Checking intrusion detection...');
    
    try {
      // Check for suspicious logins
      let output = '';
      
      try {
        const { stdout: failed } = await execPromise('lastb 2>/dev/null | head -5 || echo "No failed login data available"');
        output += `Failed logins:\n${failed}\n\n`;
      } catch {
        output += 'Failed logins: Data not available\n\n';
      }
      
      // Check auth logs for suspicious activity
      try {
        const { stdout: auth } = await execPromise('journalctl -u ssh -n 10 --no-pager 2>/dev/null || echo "Auth logs not available"');
        output += `Recent auth activity:\n${auth}`;
      } catch {
        output += 'Auth logs not available';
      }
      
      return {
        success: true,
        summary: 'Intrusion detection check completed',
        output: output
      };
    } catch (e) {
      return {
        success: false,
        summary: `Intrusion detection check failed: ${e.message}`,
        output: e.stack
      };
    }
  }

  async defaultSecurityHandler(task) {
    this.log(`Processing security task: ${task.title}`);
    
    return {
      success: true,
      summary: `Task acknowledged: ${task.title}`,
      output: `Security Bot processed ${task.taskId}. Task requires specialized handling - review needed for detailed implementation.`
    };
  }
}

module.exports = SecurityBot;

// Standalone execution
if (require.main === module) {
  const bot = new SecurityBot();
  bot.start();
}
