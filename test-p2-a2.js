// P2-A2 Test: Telegram Approval Commands → API → tasks.json
// Tests the end-to-end approval flow

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks', 'tasks.json');

// Simulates the Telegram service calling the API
async function callApi(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: result, statusCode: res.statusCode });
          } else {
            resolve({ success: false, error: result.error || `HTTP ${res.statusCode}`, statusCode: res.statusCode, data: result });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function readTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function ensureTestTaskExists() {
  const tasks = await readTasks();
  
  // Check if test task exists
  let testTask = tasks.find(t => t.id === 'task-001');
  
  if (!testTask) {
    // Create test task
    testTask = {
      id: 'task-001',
      title: 'Test Task for P2-A2',
      description: 'Test task for Telegram approval flow',
      status: 'inbox',
      column: 'inbox',
      type: 'approval',
      risk: 'MEDIUM',
      agent: 'Leader',
      agentIcon: '👑',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    tasks.push(testTask);
    
    await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true });
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
    console.log('✅ Created test task-001');
  } else {
    // Reset task to inbox for testing
    testTask.status = 'inbox';
    testTask.column = 'inbox';
    testTask.approvalState = {};
    testTask.updated = new Date().toISOString();
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
    console.log('✅ Reset test task-001 to inbox');
  }
  
  return testTask;
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  P2-A2: Telegram Approval Commands → API → tasks.json');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Ensure test task exists
  const testTask = await ensureTestTaskExists();
  console.log(`\n📋 Test Task: ${testTask.id} (${testTask.title})`);
  console.log(`   Initial status: ${testTask.status}, column: ${testTask.column}\n`);
  
  // Test 1: /approve command simulation
  console.log('─────────────────────────────────────────────────────────');
  console.log('TEST 1: /approve task-001');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const approveResult = await callApi('/api/approval/decision', 'POST', {
      taskId: 'task-001',
      decision: 'APPROVED',
      approver: 'testuser',
      reason: 'Approved via Telegram simulation',
      metadata: { source: 'telegram_test', test: 'P2-A2' }
    });
    
    console.log('API Response:', JSON.stringify(approveResult, null, 2));
    
    if (approveResult.success) {
      console.log('✅ /approve API call successful');
      
      // Verify task was updated
      const tasksAfter = await readTasks();
      const task = tasksAfter.find(t => t.id === 'task-001');
      
      if (task.status === 'assigned' && task.column === 'assigned') {
        console.log('✅ Task moved to assigned column');
      } else {
        console.log('❌ Task not moved to assigned column:', task.status, task.column);
      }
      
      if (task.approvalState?.approvedBy === 'testuser') {
        console.log('✅ approvalState.approvedBy set correctly');
      } else {
        console.log('❌ approvalState.approvedBy not set:', task.approvalState);
      }
    } else {
      console.log('❌ /approve API call failed:', approveResult.error);
    }
  } catch (e) {
    console.error('❌ /approve test failed:', e.message);
  }
  
  // Reset for deny test
  await ensureTestTaskExists();
  
  // Test 2: /deny command simulation  
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('TEST 2: /deny task-001');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const denyResult = await callApi('/api/approval/decision', 'POST', {
      taskId: 'task-001',
      decision: 'DENIED',
      approver: 'testuser',
      reason: 'Not needed right now',
      metadata: { source: 'telegram_test', test: 'P2-A2' }
    });
    
    console.log('API Response:', JSON.stringify(denyResult, null, 2));
    
    if (denyResult.success) {
      console.log('✅ /deny API call successful');
      
      // Verify task was updated
      const tasksAfter = await readTasks();
      const task = tasksAfter.find(t => t.id === 'task-001');
      
      if (task.status === 'inbox' && task.column === 'inbox') {
        console.log('✅ Task moved back to inbox');
      } else {
        console.log('❌ Task not in inbox:', task.status, task.column);
      }
      
      if (task.approvalState?.deniedBy === 'testuser') {
        console.log('✅ approvalState.deniedBy set correctly');
      } else {
        console.log('❌ approvalState.deniedBy not set:', task.approvalState);
      }
    } else {
      console.log('❌ /deny API call failed:', denyResult.error);
    }
  } catch (e) {
    console.error('❌ /deny test failed:', e.message);
  }
  
  // Reset for defer test
  await ensureTestTaskExists();
  
  // Test 3: /defer command simulation
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('TEST 3: /defer task-001');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const deferResult = await callApi('/api/approval/decision', 'POST', {
      taskId: 'task-001',
      decision: 'DEFERRED',
      approver: 'testuser',
      reason: 'Will review later this week',
      metadata: { source: 'telegram_test', test: 'P2-A2' }
    });
    
    console.log('API Response:', JSON.stringify(deferResult, null, 2));
    
    if (deferResult.success) {
      console.log('✅ /defer API call successful');
      
      // Verify task was updated
      const tasksAfter = await readTasks();
      const task = tasksAfter.find(t => t.id === 'task-001');
      
      if (task.approvalState?.deniedBy === 'testuser') {
        console.log('✅ approvalState.deniedBy set (deferred uses deny path)');
      } else {
        console.log('❌ approvalState not set for defer:', task.approvalState);
      }
      
      console.log(`ℹ️ Task remains in ${task.column} (defer keeps in inbox)`);
    } else {
      console.log('❌ /defer API call failed:', deferResult.error);
    }
  } catch (e) {
    console.error('❌ /defer test failed:', e.message);
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  P2-A2 Tests Complete');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Show final task state
  const finalTasks = await readTasks();
  const finalTask = finalTasks.find(t => t.id === 'task-001');
  if (finalTask) {
    console.log('📋 Final Task State:');
    console.log(JSON.stringify(finalTask, null, 2));
  }
}

// Check if server is running
async function checkServer() {
  try {
    const result = await callApi('/api/stats', 'GET');
    return result.success;
  } catch (e) {
    return false;
  }
}

// Main
(async () => {
  console.log('Checking if API server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ API server is not running on port 3000');
    console.log('   Please start the server first: node api-server.js');
    process.exit(1);
  }
  
  console.log('✅ API server is running');
  await runTests();
})();
