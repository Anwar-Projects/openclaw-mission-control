const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

const DATA_DIR = path.join(__dirname, 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'token_usage.json');

// System display names mapping
const SYSTEM_NAMES = {
  'openclaw-cloud': 'Genie',
  'openclaw-lab': 'PA',
  'openclaw-pa': 'PA',
  'rp5kaliclaw': 'Kali',
  'kali': 'Kali'
};

class TokenAnalytics {
  constructor() {
    this.data = {};
    this.init();
  }

  async init() {
    await this.ensureDataDir();
    await this.loadData();
  }

  async ensureDataDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadData() {
    try {
      const content = await fs.readFile(TOKEN_FILE, 'utf8');
      this.data = JSON.parse(content);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('Error loading token data:', e.message);
      }
      this.data = {};
    }
  }

  async saveData() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(TOKEN_FILE, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async collectFromLogs() {
    const hostname = require('os').hostname();
    const today = new Date().toISOString().slice(0, 10);
    
    // Parse local OpenClaw logs
    const logFiles = await glob.glob('/tmp/openclaw/*.log');
    const dayData = {
      [today]: {
        [hostname]: { in: 0, out: 0, cost: 0, activities: {} }
      }
    };

    for (const logFile of logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const msg = String(entry[1] || '');
            
            // Look for embedded run end messages
            if (msg.includes('embedded run end')) {
              const date = (entry.time || '').slice(0, 10);
              if (!date) continue;
              
              if (!dayData[date]) {
                dayData[date] = { [hostname]: { in: 0, out: 0, cost: 0, activities: {} } };
              }
              if (!dayData[date][hostname]) {
                dayData[date][hostname] = { in: 0, out: 0, cost: 0, activities: {} };
              }

              // Extract token counts
              const inputMatch = msg.match(/input=(\d+)/);
              const outputMatch = msg.match(/output=(\d+)/);
              const costMatch = msg.match(/\$([\d.]+)/);
              
              let tokens = 0;
              const activity = this.detectActivity(msg);
              
              if (inputMatch) {
                const count = parseInt(inputMatch[1]);
                dayData[date][hostname].in += count;
                tokens += count;
              }
              if (outputMatch) {
                const count = parseInt(outputMatch[1]);
                dayData[date][hostname].out += count;
                tokens += count;
              }
              if (costMatch) {
                dayData[date][hostname].cost += parseFloat(costMatch[1]);
              }
              
              if (tokens > 0) {
                dayData[date][hostname].activities[activity] = 
                  (dayData[date][hostname].activities[activity] || 0) + tokens;
              }
            }
          } catch (e) {
            // Skip malformed entries
          }
        }
      } catch (e) {
        console.error(`Error reading ${logFile}:`, e.message);
      }
    }

    // Merge with existing data
    for (const [date, systems] of Object.entries(dayData)) {
      if (!this.data[date]) {
        this.data[date] = {};
      }
      for (const [system, metrics] of Object.entries(systems)) {
        this.data[date][system] = metrics;
      }
    }

    await this.saveData();
    return this.data;
  }

  detectActivity(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('heartbeat')) return 'heartbeat';
    if (lower.includes('telegram')) return 'telegram';
    if (lower.includes('webchat')) return 'webchat';
    if (lower.includes('canvas')) return 'canvas';
    return 'general';
  }

  async getAllData() {
    await this.loadData();
    return this.data;
  }

  async getAvailableDates() {
    await this.loadData();
    return Object.keys(this.data).sort().reverse();
  }

  async getReportForDate(date) {
    await this.loadData();
    
    if (!this.data[date]) {
      return {
        date,
        systems: {},
        totals: { in: 0, out: 0, cost: 0 },
        topActivities: {}
      };
    }

    const dayData = this.data[date];
    let totalIn = 0, totalOut = 0, totalCost = 0;
    
    for (const [system, metrics] of Object.entries(dayData)) {
      totalIn += metrics.in || 0;
      totalOut += metrics.out || 0;
      totalCost += metrics.cost || 0;
    }

    // Calculate percentages and prepare top activities
    const systemReport = {};
    for (const [system, metrics] of Object.entries(dayData)) {
      const sysTotal = (metrics.in || 0) + (metrics.out || 0);
      const percentage = (totalIn + totalOut) > 0 
        ? (sysTotal / (totalIn + totalOut) * 100).toFixed(1)
        : 0;
      
      // Sort activities ascending
      const activities = Object.entries(metrics.activities || {})
        .sort((a, b) => a[1] - b[1])
        .slice(0, 10);
      
      systemReport[system] = {
        ...metrics,
        percentage: parseFloat(percentage),
        activities
      };
    }

    return {
      date,
      systems: systemReport,
      totals: { in: totalIn, out: totalOut, cost: totalCost },
      systemNames: SYSTEM_NAMES
    };
  }
}

module.exports = { TokenAnalytics, SYSTEM_NAMES };