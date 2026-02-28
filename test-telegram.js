#!/usr/bin/env node
// Test Telegram bot connection
// Usage: node test-telegram.js

const telegram = require('./telegram-service');

async function test() {
  console.log('Testing Telegram Bot...\n');
  
  // Wait for config to load
  await new Promise(r => setTimeout(r, 500));
  
  console.log(`Enabled: ${telegram.enabled ? '✅ Yes' : '❌ No'}`);
  console.log(`Token: ${telegram.token ? telegram.token.substring(0, 10) + '...' : 'Not set'}`);
  console.log(`Chat ID: ${telegram.chatId || 'Not set'}`);
  
  if (!telegram.enabled) {
    console.log('\n⚠️  Telegram not configured. Check .config/telegram.env');
    process.exit(1);
  }
  
  if (!telegram.chatId) {
    console.log('\n⚠️  Chat ID not set. Message /start to your bot first.');
    console.log('   Then check the server logs for the chat ID.');
    process.exit(1);
  }
  
  console.log('\nSending test message...\n');
  
  const result = await telegram.sendMessage(
    `🧪 **Mission Control Test**\n\n` +
    `Bot is working correctly!\n` +
    `Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST+4\n\n` +
    `Dashboard: http://192.168.40.70:3000`,
    { disablePreview: false }
  );
  
  if (result.ok) {
    console.log('✅ Test message sent successfully!');
    console.log(`Message ID: ${result.messageId}`);
  } else {
    console.log('❌ Failed:', result.error);
  }
}

test().catch(console.error);
