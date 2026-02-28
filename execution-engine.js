// Mission Control - Phase 5: Execution Engine (Leader-driven, Gated)
// Simulated/dry-run mode by default. Real execution requires explicit toggle.

const fs = require('fs').promises;
const path = require('path');
const { ActivityLogger } = require('./infra-service');

const DATA_DIR = path.join(__dirname, 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const TASKS_FILE = path.join(DATA_DIR, 'tasks', 'tasks.json');

class ExecutionEngine {
  constructor() {
    this.logger = new ActivityLogger();
    this.runsDir = RUNS_DIR;
    this.simulationMode = true; // Default: dry-run for safety
    this.ensureRunsDir();
  }
  
  async ensureRunsDir() {
    try {
      await fs.mkdir(this.runsDir, { recursive: true });
    } catch (e) {
      // Directory may already exist
    }
  }
  
  /**
   * Validate if task can execute (approval gate)
   * Rules:
   * 1. Must be in APPROVED or AUTO_APPROVED state
   * 2. domain_check.valid must be true
   * 3. can_execute must be true
   * 4. Task status must be "assigned" or "in-progress"
   */
  canExecute(task) {
    const checks = {
      eligible: false,
      reason: null,
      approvalState: null,
      domainValid: false,
      ready: false
    };
    
    // Check task exists and has approval evaluation
    if (!task) {
      checks.reason = 'Task not found';
      return checks;
    }
    
    const approvalEval = task.approvalEvaluation || {};
    const approvalState = task.approvalState || {};
    
    // Check approval state
    const isApproved = approvalState.approvedBy !== null && approvalState.approvedBy !== undefined;
    const isAutoApproved = approvalEval.decision === 'AUTO_APPROVED';
    
    if (!isApproved && !isAutoApproved) {
      checks.reason = `Task not approved. Current state: ${approvalState.approvedBy ? 'approved' : approvalState.deniedBy ? 'denied' : approvalState.deferredBy ? 'deferred' : 'pending'}`;
      checks.approvalState = approvalState;
      return checks;
    }
    
    checks.approvalState = isAutoApproved ? 'AUTO_APPROVED' : 'APPROVED';
    
    // Check domain validation
    const domainCheck = approvalEval.domain_check || {};
    if (!domainCheck.valid) {
      checks.reason = `Domain check failed: ${domainCheck.reason || 'No domain validation recorded'}`;
      checks.approvalState = checks.approvalState;
      return checks;
    }
    
    checks.domainValid = true;
    
    // Check can_execute flag
    if (approvalEval.can_execute === false && !isAutoApproved) {
      checks.reason = 'Task flagged as non-executable (can_execute: false)';
      return checks;
    }
    
    // Check task status
    const executableStatuses = ['assigned', 'in-progress'];
    if (!executableStatuses.includes(task.status) && !executableStatuses.includes(task.column)) {
      checks.reason = `Task not in executable state. Current: ${task.status}/${task.column}. Required: assigned or in-progress`;
      return checks;
    }
    
    checks.ready = true;
    checks.eligible = true;
    return checks;
  }
  
  /**
   * Start a new run for a task
   * Only Leader can dispatch (enforced by API auth check)
   */
  async startRun(taskId, options = {}) {
    const { proposedBy = 'leader', dryRun = true, metadata = {} } = options;
    
    // Load task
    const tasks = await this.loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Validate execution eligibility
    const eligibility = this.canExecute(task);
    if (!eligibility.eligible) {
      await this.logger.log({
        bot: proposedBy,
        action: 'EXECUTION_BLOCKED',
        severity: 'WARN',
        risk: 'MEDIUM',
        target: taskId,
        message: `Execution blocked for ${taskId}: ${eligibility.reason}`,
        details: { eligibility, task: { id: taskId, title: task.title } },
        owner_bot: 'leader'
      });
      
      throw new Error(`Execution blocked: ${eligibility.reason}`);
    }
    
    // Create run record
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const approvalRef = task.approvalState?.approvedBy 
      ? `approved-by-${task.approvalState.approvedBy}-${task.approvalState.approvedAt}`
      : task.approvalEvaluation?.decision === 'AUTO_APPROVED' 
        ? 'auto-approved'
        : 'unknown';
    
    const run = {
      run_id: runId,
      task_id: taskId,
      task_title: task.title,
      owner_bot: task.agent,
      proposed_by: proposedBy,
      started_at: new Date().toISOString(),
      ended_at: null,
      status: 'running',
      mode: dryRun ? 'SIMULATED' : 'LIVE',
      approval_ref: approvalRef,
      eligibility: {
        approved: eligibility.approvalState,
        domain_valid: eligibility.domainValid,
        ready: eligibility.ready
      },
      steps: [],
      outputs: [],
      summary: null,
      metadata
    };
    
    // Persist run
    await this.saveRun(run);
    
    // Log run start
    await this.logger.log({
      bot: task.agent,
      action: 'RUN_STARTED',
      severity: 'OK',
      risk: dryRun ? 'LOW' : 'MEDIUM',
      target: taskId,
      message: `${dryRun ? 'Simulated' : 'Live'} run ${runId} started for ${task.title}`,
      details: { runId, mode: run.mode, proposedBy },
      owner_bot: task.agent
    });
    
    return run;
  }
  
  /**
   * Add a step to a running execution
   */
  async addStep(runId, stepData) {
    const run = await this.loadRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }
    
    if (run.status !== 'running') {
      throw new Error(`Run ${runId} is not running (status: ${run.status})`);
    }
    
    const step = {
      step_id: `step-${run.steps.length + 1}`,
      timestamp: new Date().toISOString(),
      type: stepData.type || 'command',
      description: stepData.description,
      command: stepData.command || null,
      status: stepData.status || 'pending',
      output: stepData.output || null,
      duration_ms: stepData.duration_ms || 0,
      simulated: run.mode === 'SIMULATED'
    };
    
    run.steps.push(step);
    await this.saveRun(run);
    
    return step;
  }
  
  /**
   * Append output to run logs
   */
  async appendOutput(runId, output) {
    const run = await this.loadRun(runId);
    if (!run) return;
    
    const truncated = output.length > 1000 
      ? output.substring(0, 1000) + '\n... [truncated]' 
      : output;
    
    run.outputs.push({
      timestamp: new Date().toISOString(),
      data: truncated
    });
    
    await this.saveRun(run);
  }
  
  /**
   * Finish a run
   */
  async finishRun(runId, result) {
    const run = await this.loadRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }
    
    const { status, summary, outputs = [] } = result;
    
    run.ended_at = new Date().toISOString();
    run.status = status; // 'success', 'failed', 'cancelled'
    run.summary = summary;
    
    // Append final outputs
    for (const output of outputs) {
      run.outputs.push({
        timestamp: new Date().toISOString(),
        data: output
      });
    }
    
    await this.saveRun(run);
    
    // Log completion
    await this.logger.log({
      bot: run.owner_bot,
      action: `RUN_${status.toUpperCase()}`,
      severity: status === 'success' ? 'OK' : status === 'failed' ? 'WARN' : 'OK',
      risk: run.mode === 'LIVE' ? 'MEDIUM' : 'LOW',
      target: run.task_id,
      message: `Run ${runId} ${status}: ${summary || 'No summary'}`,
      details: { runId, status, duration: this.calculateDuration(run) },
      owner_bot: run.owner_bot
    });
    
    // Update task with last run reference
    await this.updateTaskRun(run.task_id, runId, status);
    
    return run;
  }
  
  /**
   * Simulate a task execution (for P5-1 testing)
   */
  async simulateTaskExecution(taskId, proposedBy = 'leader') {
    // Start run
    const run = await this.startRun(taskId, { 
      proposedBy, 
      dryRun: true,
      metadata: { simulation_reason: 'P5-1 testing' }
    });
    
    // Simulate steps
    const steps = [
      { type: 'validate', description: 'Validating task configuration...', duration_ms: 150 },
      { type: 'check', description: 'Checking prerequisites...', duration_ms: 300 },
      { type: 'execute', description: 'Executing task (SIMULATED - no actual changes)', duration_ms: 500 },
      { type: 'verify', description: 'Verifying results (dry-run check)...', duration_ms: 200 }
    ];
    
    for (const stepDef of steps) {
      const step = await this.addStep(run.run_id, {
        ...stepDef,
        status: 'completed',
        output: `[SIMULATED] ${stepDef.description}\nStatus: Success (dry-run)\nNo actual changes made.`
      });
      
      // Small delay for realism
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Finish
    const finishedRun = await this.finishRun(run.run_id, {
      status: 'success',
      summary: 'Task execution simulated successfully. All checks passed. Ready for live execution.',
      outputs: [
        '=== Simulation Summary ===',
        `Task: ${run.task_title}`,
        `Mode: DRY-RUN (no changes)`,
        `Steps: ${steps.length}`,
        `All validations: PASSED`,
        '',
        'To execute live: Toggle simulation mode OFF',
        'WARNING: Live execution requires explicit approval.',
        '',
        `Run ID: ${run.run_id}`
      ]
    });
    
    return finishedRun;
  }
  
  /**
   * Load runs list
   */
  async listRuns(filters = {}) {
    const { taskId, limit = 20, status } = filters;
    
    try {
      const files = await fs.readdir(this.runsDir);
      const runs = [];
      
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const data = await fs.readFile(path.join(this.runsDir, file), 'utf8');
          const run = JSON.parse(data);
          
          // Filter by task if specified
          if (taskId && run.task_id !== taskId) continue;
          
          // Filter by status if specified
          if (status && run.status !== status) continue;
          
          runs.push(run);
        } catch (e) {
          // Skip invalid files
        }
      }
      
      // Sort by started_at desc
      runs.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      
      return runs.slice(0, limit);
    } catch (e) {
      return [];
    }
  }
  
  /**
   * Load single run
   */
  async loadRun(runId) {
    try {
      const data = await fs.readFile(path.join(this.runsDir, `${runId}.json`), 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Save run to disk
   */
  async saveRun(run) {
    await fs.writeFile(
      path.join(this.runsDir, `${run.run_id}.json`),
      JSON.stringify(run, null, 2),
      'utf8'
    );
  }
  
  /**
   * Load tasks file
   */
  async loadTasks() {
    try {
      const data = await fs.readFile(TASKS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  
  /**
   * Update task with run reference
   */
  async updateTaskRun(taskId, runId, status) {
    try {
      const tasks = await this.loadTasks();
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.lastRun = {
          run_id: runId,
          status,
          timestamp: new Date().toISOString()
        };
        await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('Failed to update task run reference:', e);
    }
  }
  
  /**
   * Calculate run duration
   */
  calculateDuration(run) {
    if (!run.started_at) return 0;
    const end = run.ended_at ? new Date(run.ended_at) : new Date();
    const start = new Date(run.started_at);
    return Math.round((end - start) / 1000); // seconds
  }
  
  /**
   * Get execution stats
   */
  async getStats() {
    const runs = await this.listRuns({ limit: 1000 });
    
    return {
      total: runs.length,
      by_status: {
        success: runs.filter(r => r.status === 'success').length,
        failed: runs.filter(r => r.status === 'failed').length,
        running: runs.filter(r => r.status === 'running').length,
        cancelled: runs.filter(r => r.status === 'cancelled').length
      },
      by_mode: {
        simulated: runs.filter(r => r.mode === 'SIMULATED').length,
        live: runs.filter(r => r.mode === 'LIVE').length
      },
      recent: runs.slice(0, 5).map(r => ({
        run_id: r.run_id,
        task_id: r.task_id,
        status: r.status,
        mode: r.mode,
        started_at: r.started_at
      }))
    };
  }
}

module.exports = { ExecutionEngine };
