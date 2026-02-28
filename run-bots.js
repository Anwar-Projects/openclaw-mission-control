#!/usr/bin/env node
// Master Bot Runner - Starts and manages all bot workers

const HomeBot = require('./bots/home-bot');
const ProxmoxBot = require('./bots/proxmox-bot');
const StorageBot = require('./bots/storage-bot');
const NetworkBot = require('./bots/network-bot');
const LeaderBot = require('./bots/leader-bot');
const DashboardBot = require('./bots/dashboard-bot');
const SecurityBot = require('./bots/security-bot');

const bots = [];

console.log('╔════════════════════════════════════════╗');
console.log('║     MISSION CONTROL - BOT FLEET       ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

// Initialize all bots
const leaderBot = new LeaderBot();
const dashboardBot = new DashboardBot();
const homeBot = new HomeBot();
const proxmoxBot = new ProxmoxBot();
const storageBot = new StorageBot();
const networkBot = new NetworkBot();
const securityBot = new SecurityBot();

bots.push(leaderBot, dashboardBot, homeBot, proxmoxBot, storageBot, networkBot, securityBot);

// Start all bots
async function startAll() {
  for (const bot of bots) {
    try {
      await bot.start();
      await new Promise(r => setTimeout(r, 2000)); // Stagger starts
    } catch (e) {
      console.error(`Failed to start ${bot.name}:`, e.message);
    }
  }
  
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('All bots started. Press Ctrl+C to stop.');
  console.log('══════════════════════════════════════════');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down bot fleet...');
  for (const bot of bots) {
    bot.stop();
  }
  console.log('Goodbye!');
  process.exit(0);
});

// Start
startAll().catch(console.error);
