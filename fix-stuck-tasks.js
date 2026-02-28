// Fix Stuck Tasks - Emergency Repair Script
const fs = require('fs').promises;
const path = require('path');

const TASKS_FILE = path.join(__dirname, 'data', 'tasks', 'tasks.json');
const TASKS_TMP = path.join(__dirname, 'data', 'tasks', 'tasks.json.tmp');

async function fixTasks() {
  console.log('🔧 Fixing stuck tasks...');
  
  const data = await fs.readFile(TASKS_FILE, 'utf8');
  const tasks = JSON.parse(data);
  
  let fixes = 0;
  const log = [];
  
  for (const task of tasks) {
    const original = { column: task.column, status: task.status };
    let changed = false;
    
    // Fix 1: Tasks with status 'done' but wrong column
    if (task.status === 'done' && task.column !== 'completed' && task.column !== 'done') {
      task.column = 'completed';
      task.status = 'completed';
      changed = true;
      log.push(`✅ ${task.id}: ${task.column || 'unknown'} → completed`);
    }
    
    // Fix 2: Tasks in 'waiting' that should be 'in-progress' for assignment
    // (Waiting is for tasks approved but waiting for assignment trigger)
    if (task.column === 'waiting' && !task.assignedAt) {
      task.column = 'in-progress';
      task.status = 'in_progress';
      changed = true;
      log.push(`📥 ${task.id}: waiting → in-progress (ready for assignment)`);
    }
    
    // Fix 3: Tasks in 'inbox' that look like routine tasks (should be in-progress)
    if (task.column === 'inbox' && task.id?.includes('routine')) {
      task.column = 'in-progress';
      task.status = 'in_progress';
      changed = true;
      log.push(`📥 ${task.id}: inbox → in-progress`);
    }
    
    // Fix 4: Tasks with 'unknown' column - try to determine proper column
    if (!task.column || task.column === 'none' || task.column === 'unknown') {
      if (task.status === 'completed' || task.status === 'done') {
        task.column = 'completed';
      } else if (task.status === 'assigned') {
        task.column = 'assigned';
      } else if (task.assignedAt) {
        task.column = 'assigned';
      } else {
        task.column = 'in-progress';
        task.status = 'in_progress';
      }
      changed = true;
      log.push(`❓ ${task.id}: unknown → ${task.column}`);
    }
    
    // Fix 5: Tasks stuck in 'review' that have been approved
    if (task.column === 'review' && (task.approved || task.approvedAt)) {
      task.column = 'in-progress';
      task.status = 'in_progress';
      changed = true;
      log.push(`📤 ${task.id}: review → in-progress (approved)`);
    }
    
    // Fix 6: Ensure all tasks have proper status-column alignment
    if (task.column === 'in-progress' && task.status !== 'in_progress') {
      task.status = 'in_progress';
      changed = true;
    }
    if (task.column === 'assigned' && task.status !== 'assigned') {
      task.status = 'assigned';
      changed = true;
    }
    if (task.column === 'completed' && task.status !== 'completed') {
      task.status = 'completed';
      changed = true;
    }
    
    if (changed) {
      task.updated = new Date().toISOString();
      fixes++;
    }
  }
  
  // Write back
  await fs.writeFile(TASKS_TMP, JSON.stringify(tasks, null, 2), 'utf8');
  await fs.rename(TASKS_TMP, TASKS_FILE);
  
  console.log(`\n✅ Fixed ${fixes} tasks:`);
  for (const line of log) {
    console.log('  ' + line);
  }
  
  // Show final state
  const byCol = {};
  for (const t of tasks) {
    byCol[t.column || 'unknown'] = (byCol[t.column || 'unknown'] || 0) + 1;
  }
  
  console.log('\n📊 Final Column Distribution:');
  for (const [col, count] of Object.entries(byCol).sort()) {
    console.log(`  ${col}: ${count}`);
  }
}

fixTasks().catch(console.error);
