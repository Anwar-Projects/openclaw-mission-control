#!/usr/bin/env node
// Token Analytics Collection Script
// Run every 6 hours via cron to keep dashboard data fresh
// Collects from: openclaw-cloud (local), openclaw-lab (PA), rp5kaliclaw (Kali)

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'token_usage.json');

// System definitions
const SYSTEMS = {
  'openclaw-cloud': { host: 'localhost', name: 'Genie', local: true },
  'openclaw-lab': { host: '192.168.40.80', name: 'PA', local: false, sshKey: '~/.ssh/openclaw_infra' },
  'rp5kaliclaw': { host: '192.168.10.60', name: 'Kali', local: false, sshKey: '~/.ssh/openclaw_infra' }
};

async function loadTokenData() {
  try {
    const content = await fs.readFile(TOKEN_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

async function saveTokenData(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function estimateTokensFromOpenClawLog(logContent, date) {
  const lines = logContent.split('\n').filter(l => l.trim());
  let lineCount = 0;
  let toolCalls = 0;
  let sessions = 0;
  let webSearches = 0;
  let execCalls = 0;
  let browserCalls = 0;
  
  for (const line of lines) {
    lineCount++;
    if (line.includes('"output":"complete"')) sessions++;
    if (line.includes('web_search')) { toolCalls++; webSearches++; }
    if (line.includes('"exec"')) { toolCalls++; execCalls++; }
    if (line.includes('browser')) { toolCalls++; browserCalls++; }
    if (line.includes('canvas')) { toolCalls++; }
  }
  
  // More refined token estimation based on activity type
  // Sessions: ~2k input, 500 output
  // Tool calls: ~1k input, 500 output
  // Log lines: ~10 tokens each (minimal overhead)
  const sessionIn = sessions * 2000;
  const sessionOut = sessions * 500;
  const toolIn = toolCalls * 1000;
  const toolOut = toolCalls * 500;
  const logIn = lineCount * 10;
  
  const estimatedIn = Math.max(500, sessionIn + toolIn + logIn);
  const estimatedOut = Math.max(200, sessionOut + toolOut);
  const estimatedCost = ((estimatedIn + estimatedOut) * 0.0000004); // ~$0.40 per 1M tokens
  
  return {
    in: estimatedIn,
    out: estimatedOut,
    cost: parseFloat(estimatedCost.toFixed(4)),
    activities: {
      sessions: sessions,
      tool_calls: toolCalls,
      web_searches: webSearches,
      exec_calls: execCalls,
      browser_calls: browserCalls,
      log_lines: lineCount,
      estimated: true
    }
  };
}

async function collectFromSystem(systemId, systemConfig, date) {
  const logPath = `/tmp/openclaw/openclaw-${date}.log`;
  
  try {
    let logContent = '';
    
    if (systemConfig.local) {
      // Local collection
      try {
        logContent = await fs.readFile(logPath, 'utf8');
      } catch (e) {
        console.log(`    [${systemId}] No local log file for ${date}`);
        return null;
      }
    } else {
      // Remote collection via SSH
      const sshCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ${systemConfig.sshKey} root@${systemConfig.host} "cat ${logPath} 2>/dev/null || echo ''"`;
      try {
        logContent = execSync(sshCmd, { encoding: 'utf8', timeout: 30000, maxBuffer: 50 * 1024 * 1024 });
      } catch (e) {
        console.log(`    [${systemId}] Failed to reach host ${systemConfig.host}: ${e.message}`);
        return null;
      }
    }
    
    if (!logContent || logContent.trim().length === 0) {
      console.log(`    [${systemId}] Empty log for ${date}`);
      return null;
    }
    
    // Parse and estimate tokens
    const data = estimateTokensFromOpenClawLog(logContent, date);
    console.log(`    [${systemId}] Collected: ${data.in.toLocaleString()} in / ${data.out.toLocaleString()} out tokens`);
    return data;
    
  } catch (e) {
    console.error(`    [${systemId}] Error collecting data: ${e.message}`);
    return null;
  }
}

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  
  console.log(`[${new Date().toISOString()}] Starting distributed token analytics collection...`);
  console.log(`  Collecting for date: ${today}`);
  console.log(`  Systems: ${Object.keys(SYSTEMS).join(', ')}`);
  
  try {
    // Load existing data
    const data = await loadTokenData();
    
    // Ensure today's entry exists
    if (!data[today]) {
      data[today] = {};
    }
    
    // Collect from each system
    console.log(`  Fetching from systems...`);
    for (const [systemId, config] of Object.entries(SYSTEMS)) {
      const existingData = data[today][systemId];
      const hasExistingData = existingData && existingData.in > 0 && !existingData.activities?.estimated;
      
      if (hasExistingData) {
        console.log(`    [${systemId}] Preserving existing real data: ${existingData.in.toLocaleString()} tokens`);
        continue;
      }
      
      const systemData = await collectFromSystem(systemId, config, today);
      if (systemData) {
        data[today][systemId] = systemData;
      } else if (!data[today][systemId]) {
        // Mark as unreachable if no data and no existing entry
        data[today][systemId] = {
          in: 0,
          out: 0,
          cost: 0,
          activities: { unreachable: true }
        };
      }
    }
    
    // Save updated data
    await saveTokenData(data);
    
    // Show summary
    const todayData = data[today] || {};
    const systems = Object.keys(todayData);
    
    let totalIn = 0, totalOut = 0, totalCost = 0;
    console.log(`\n  Summary for ${today}:`);
    for (const sys of systems) {
      const sysData = todayData[sys];
      const displayName = SYSTEMS[sys]?.name || sys;
      totalIn += sysData.in || 0;
      totalOut += sysData.out || 0;
      totalCost += sysData.cost || 0;
      const estMarker = sysData.activities?.estimated ? ' (est)' : '';
      const unreachMarker = sysData.activities?.unreachable ? ' (unreachable)' : '';
      console.log(`    ${displayName}: ${(sysData.in || 0).toLocaleString()} in / ${(sysData.out || 0).toLocaleString()} out${estMarker}${unreachMarker}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n[${new Date().toISOString()}] Collection complete in ${duration}ms`);
    console.log(`  Total: ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out tokens`);
    console.log(`  Cost: $${totalCost.toFixed(4)}`);
    console.log(`  Systems: ${systems.length} / ${Object.keys(SYSTEMS).length} reporting`);
    
    process.exit(0);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Collection failed:`, e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
