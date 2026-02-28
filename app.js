// Mission Control - Phase 3
// Kanban board, delegation router, daily reports

class MissionControl {
    constructor() {
        this.tasks = [];
        this.agents = [
            { id: 'leader', name: 'Leader', icon: '🎯', status: 'active', lastUpdate: Date.now(), mentionCount: 0, blockedCount: 0, role: 'Coordination & Approvals', skills: ['Planning', 'Delegation', 'Approval'], currentTaskId: 'approval-001-backup-jobs' },
            { id: 'dashboard', name: 'Dashboard', icon: '📊', status: 'active', lastUpdate: Date.now(), mentionCount: 0, blockedCount: 0, role: 'Queue Orchestration', skills: ['Queue', 'Assignment', 'Monitoring'], currentTaskId: null },
            { id: 'proxmox', name: 'Proxmox', icon: '🖥️', status: 'idle', lastUpdate: Date.now() - 300000, mentionCount: 0, blockedCount: 1, role: 'Infrastructure & VMs', skills: ['VMs', 'PBS', 'Clustering'], currentTaskId: null },
            { id: 'home', name: 'Home', icon: '🏠', status: 'idle', lastUpdate: Date.now() - 720000, mentionCount: 0, blockedCount: 0, role: 'Home Assistant', skills: ['HAOS', 'Add-ons', 'Automations'], currentTaskId: null },
            { id: 'storage', name: 'Storage', icon: '💾', status: 'idle', lastUpdate: Date.now() - 1800000, mentionCount: 0, blockedCount: 0, role: 'Storage & Backups', skills: ['PBS', 'TrueNAS', 'NFS'], currentTaskId: null },
            { id: 'network', name: 'Network', icon: '🌐', status: 'idle', lastUpdate: Date.now() - 30000, mentionCount: 1, blockedCount: 0, role: 'VLANs & Routing', skills: ['Firewalla', 'UniFi', 'Routing'], currentTaskId: null },
            { id: 'security', name: 'Security', icon: '🔐', status: 'idle', lastUpdate: Date.now() - 3600000, mentionCount: 0, blockedCount: 0, role: 'Advisory & Audit', skills: ['Posture', 'Credentials', 'Reviews'], currentTaskId: null }
        ];
        this.currentFilter = 'all';
        this.selectedTask = null;
        this.selectedAgent = null;
        this.draggedTask = null;
        this.storage = TaskStorage.init();
        this.apiBase = window.location.origin;
        
        // Full 5-column workflow: Review → In-Progress → Assigned → Executing → Completed
        this.columns = ['review', 'in-progress', 'assigned', 'executing', 'completed'];
        this.columnLabels = {
            'review': '📋 REVIEW',
            'in-progress': '📥 IN-PROGRESS',
            'assigned': '📤 ASSIGNED',
            'executing': '🔨 EXECUTING',
            'completed': '✅ COMPLETED'
        };
        
        // Infrastructure data cache
        this.infraAssets = {};
        this.lastAutoFixLog = {};
        
        // Delegation router keywords
        this.delegationRules = {
            'proxmox': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
            'vm': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
            'lxc': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
            'cluster': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
            'vzdump': { agent: 'proxmox', icon: '🖥️', name: 'Proxmox' },
            'ha': { agent: 'home', icon: '🏠', name: 'Home' },
            'home': { agent: 'home', icon: '🏠', name: 'Home' },
            'hass': { agent: 'home', icon: '🏠', name: 'Home' },
            'homeassistant': { agent: 'home', icon: '🏠', name: 'Home' },
            'storage': { agent: 'storage', icon: '💾', name: 'Storage' },
            'pbs': { agent: 'storage', icon: '💾', name: 'Storage' },
            'truenas': { agent: 'storage', icon: '💾', name: 'Storage' },
            'zfs': { agent: 'storage', icon: '💾', name: 'Storage' },
            'backup': { agent: 'storage', icon: '💾', name: 'Storage' },
            'network': { agent: 'network', icon: '🌐', name: 'Network' },
            'firewall': { agent: 'network', icon: '🌐', name: 'Network' },
            'vlan': { agent: 'network', icon: '🌐', name: 'Network' },
            'unifi': { agent: 'network', icon: '🌐', name: 'Network' },
            'security': { agent: 'security', icon: '🔐', name: 'Security' },
            'audit': { agent: 'security', icon: '🔐', name: 'Security' }
        };
    }

    async init() {
        await this.loadTasks();
        this.setupEventListeners();
        this.renderAgentList();
        this.renderAgentFleet();     // NEW: Agent Fleet panel
        this.renderKanban();
        this.updateCounters();
        this.renderCommandCenter(); // Phase 2: Command Center
        this.setupCounterModals();   // Phase 2: Clickable counters
        
        // Phase 4: Load infrastructure status
        await this.loadInfrastructureStatus();
        
        // Phase 4: Load bot activity
        await this.loadBotActivity();
        
        // Phase 2: Initialize watchdogs
        this.startWatchdogs();
        
        this.startPolling();
        this.updateClock();
        
        setInterval(() => this.updateClock(), 1000);
        
        // Check for new tasks that need delegation
        this.checkUnassignedTasks();
        
        // Initialize documentation learning simulation
        this.startDocumentationLearning();
    }

    // ========== DOCUMENTATION LEARNING SIMULATION ==========
    startDocumentationLearning() {
        // Agent learning topics
        this.learningTopics = {
            'proxmox': [
                { source: 'Proxmox Admin Guide', insight: 'vzdump --exclude-path can exclude /tmp and /var/log to reduce backup size', application: 'Update daily backup jobs to use --exclude-path' },
                { source: 'PBS Docs', insight: 'PBS uses chunked transfer for large backups, improving reliability', application: 'Verify PBS-MAIN (VM 200) is using latest PBS version' },
                { source: 'ZFS on Linux', insight: 'zpool list -v shows detailed vdev information including fragmentation', application: 'Check fragmentation on NVME and SSDVM pools monthly' }
            ],
            'home': [
                { source: 'HA REST API', insight: 'REST API supports blueprints for reusable automation patterns', application: 'Convert repetitive automations to blueprints' },
                { source: 'MQTT Integration', insight: 'MQTT birth/will messages enable device online/offline detection', application: 'Improve presence detection for Zigbee sensors' }
            ],
            'storage': [
                { source: 'OpenZFS', insight: 'zpool scrub -s stops active scrub if performance impact too high', application: 'Monitor scrub I/O and cancel if needed during work hours' },
                { source: 'TrueNAS Docs', insight: 'Cloud sync tasks support bandwidth limiting with --bwlimit', application: 'Add bwlimit to offsite sync if configured' }
            ],
            'network': [
                { source: 'Firewalla Guide', insight: 'Firewalla can create device groups for shared rules across VLANs', application: 'Group IoT devices across VLAN 60' },
                { source: 'UniFi UCG', insight: 'Firmware updates should be scheduled during maintenance window', application: 'Schedule UniFi updates for 02:00-05:00 window' }
            ],
            'security': [
                { source: 'Wazuh', insight: 'Syslog output enables correlation with firewall logs', application: 'Configure Wazuh to consume Firewalla syslog' },
                { source: 'fail2ban', insight: 'Maxretry=3 with findtime=10m is aggressive but blocks brute force quickly', application: 'Tune fail2ban jails for SSH and Proxmox' }
            ],
            'leader': [
                { source: 'Fleet Coordination', insight: 'Daily heartbeat checks can detect agent failures early', application: 'Implement agent health monitoring in next phase' }
            ]
        };
        
        // Post initial learning messages immediately
        setTimeout(() => {
            this.postLearningUpdate('proxmox', 0);
            this.simulateAgentLearning();
        }, 3000);
        
        // Continue learning every 3 minutes
        setInterval(() => {
            this.simulateAgentLearning();
        }, 180000);
        
        console.log('[DOC_LEARNING] Documentation learning system initialized');
        this.showToast('📚 Agents starting documentation learning...');
    }
    
    simulateAgentLearning() {
        const agents = Object.keys(this.learningTopics);
        // Pick random agent
        const agentId = agents[Math.floor(Math.random() * agents.length)];
        const topics = this.learningTopics[agentId];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        
        this.postLearningUpdate(agentId, topic);
    }
    
    postLearningUpdate(agentId, topicOrIndex) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        let topic;
        if (typeof topicOrIndex === 'number') {
            const topics = this.learningTopics[agentId];
            topic = topics[topicOrIndex % topics.length];
        } else {
            topic = topicOrIndex;
        }
        
        const messages = document.getElementById('dashboard-chat-messages');
        if (!messages) return;
        
        const msg = document.createElement('div');
        msg.className = 'chat-message';
        msg.innerHTML = `
            <div class="chat-message-avatar">${agent.icon}</div>
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-message-author">${agent.name}</span>
                    <span class="chat-message-time">just now</span>
                </div>
                <div class="chat-message-text">
                    <strong>📚 Learning Update:</strong><br/>
                    <strong>Source:</strong> ${topic.source}<br/>
                    <strong>💡 Key Insight:</strong> ${topic.insight}<br/>
                    <strong>🎯 Application:</strong> ${topic.application}
                </div>
            </div>
        `;
        
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        
        // Update agent last activity
        agent.lastUpdate = Date.now();
        this.renderAgentFleet();
        
        console.log(`[LEARNING] ${agent.name}: ${topic.source}`);
    }

    // ========== DELEGATION ROUTER ==========
    
    /**
     * Auto-assign a task based on routing rules
     */
    routeTask(task) {
        const tags = (task.tags || []).map(t => t.toLowerCase());
        const title = (task.title || '').toLowerCase();
        const desc = (task.description || '').toLowerCase();
        
        const scores = {};
        
        for (const [keyword, route] of Object.entries(this.delegationRules)) {
            let score = 0;
            
            if (tags.includes(keyword)) score += 10;
            if (title.includes(keyword)) score += 5;
            if (title.startsWith(keyword)) score += 3;
            if (desc.includes(keyword)) score += 2;
            
            if (score > 0) {
                const agent = route.agent;
                if (!scores[agent]) scores[agent] = { ...route, score: 0, matches: [] };
                scores[agent].score += score;
                scores[agent].matches.push(keyword);
            }
        }
        
        // No matches - needs manual assignment
        if (Object.keys(scores).length === 0) {
            return {
                agent: 'leader',
                icon: '🎯',
                name: 'Leader',
                confidence: 0,
                reason: 'No matching keywords - requires manual assignment',
                ambiguous: true
            };
        }
        
        // Sort by score
        const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
        const best = sorted[0];
        
        // Check for ambiguity
        const ambiguous = sorted.length > 1 && (sorted[1].score / best.score) > 0.8;
        
        if (ambiguous) {
            return {
                agent: 'leader',
                icon: '🎯',
                name: 'Leader',
                confidence: best.score / 20,
                reason: `Ambiguity: ${best.name} vs ${sorted[1].name} (${best.score}/${sorted[1].score}) - needs Anwar decision`,
                ambiguous: true,
                candidates: [best.name, sorted[1].name]
            };
        }
        
        return {
            agent: best.agent,
            icon: best.icon,
            name: best.name,
            confidence: best.score / 20,
            reason: `Routed via: ${[...new Set(best.matches)].join(', ')}`,
            ambiguous: false
        };
    }
    
    /**
     * Check inbox for unassigned tasks and route them
     */
    async checkUnassignedTasks() {
        const unassigned = this.tasks.filter(t => 
            t.status === 'inbox' && 
            t.column === 'inbox' &&
            !t.routedBy
        );
        
        for (const task of unassigned) {
            const routing = this.routeTask(task);
            
            if (routing.ambiguous) {
                // Move to review with ambiguity note
                task.column = 'review';
                task.status = 'review';
                task.ambiguityNote = routing.reason;
                task.ambiguityCandidates = routing.candidates;
                task.updated = new Date().toISOString();
                
                // Add comment
                if (!task.comments) task.comments = [];
                task.comments.push({
                    author: 'Leader',
                    authorIcon: '🎯',
                    text: `⚠️ ${routing.reason}`,
                    timestamp: new Date().toISOString()
                });
                
                this.showToast(`⚠️ Task ${task.id} needs Anwar decision`);
            } else {
                // Auto-assign
                task.agent = routing.agent;
                task.agentIcon = routing.icon;
                task.column = 'assigned';
                task.status = 'assigned';
                task.routedBy = 'Leader (auto)';
                task.routingReason = routing.reason;
                task.routingConfidence = routing.confidence;
                task.updated = new Date().toISOString();
                
                // Add comment
                if (!task.comments) task.comments = [];
                task.comments.push({
                    author: 'Leader',
                    authorIcon: '🎯',
                    text: `✅ Assigned to ${routing.name}: ${routing.reason}`,
                    timestamp: new Date().toISOString()
                });
                
                this.showToast(`✅ ${task.title.substring(0, 30)}... → ${routing.name}`);
            }
        }
        
        if (unassigned.length > 0) {
            await this.saveTasks();
        }
    }

    // ========== DATA LOAD/SAVE ==========
    async loadTasks() {
        try {
            this.tasks = await this.storage.loadTasks();
            this.workingTasks = this.tasks.filter(t => t.status !== 'reference');
        } catch (e) {
            console.error('Failed to load tasks:', e);
            // Don't clear workingTasks on error - keep existing data
            if (!this.workingTasks || this.workingTasks.length === 0) {
                this.workingTasks = [];
            }
        }
    }

    async saveTasks() {
        try {
            await this.storage.saveTasks(this.tasks);
            this.workingTasks = this.tasks.filter(t => t.status !== 'reference');
            this.renderKanban();
            this.updateCounters();
        } catch (e) {
            console.error('Failed to save tasks:', e);
        }
    }

    // ========== DAILY REPORTS ==========
    
    async generateDailyReport(botId = null) {
        try {
            const url = botId 
                ? `${this.apiBase}/api/reports/bot?bot=${botId}`
                : `${this.apiBase}/api/reports/daily`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            return data;
        } catch (e) {
            console.error('Failed to fetch report:', e);
            return null;
        }
    }
    
    async showDailySummary() {
        const data = await this.generateDailyReport();
        if (!data) {
            this.showToast('❌ Failed to load daily summary');
            return;
        }
        
        const summary = data.summary;
        const content = document.getElementById('squad-chat-messages');
        
        // Add Leader's summary to chat
        const msg = document.createElement('div');
        msg.className = 'chat-message';
        msg.style.borderLeft = summary.serious ? '3px solid var(--accent-danger)' : 'none';
        msg.innerHTML = `
            <div class="chat-message-avatar">🎯</div>
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-message-author">Leader Bot</span>
                    <span class="chat-message-time">Daily Summary</span>
                </div>
                <div class="chat-message-text">
                    <pre style="white-space: pre-wrap; font-family: inherit;">${summary.message}</pre>
                </div>
                ${summary.serious ? '<div style="color: var(--accent-danger); font-size: 12px; margin-top: 8px;">🚨 Serious items detected - check dashboard</div>' : ''}
            </div>
        `;
        
        content.appendChild(msg);
        content.scrollTop = content.scrollHeight;
        
        // Open chat modal
        this.openModal('chat');
        
        if (summary.serious) {
            this.showToast('🚨 Daily Summary: Serious items detected!');
        }
    }

    // ========== RENDER AGENT LIST ==========
    renderAgentList() {
        const container = document.getElementById('agent-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.agents.forEach(agent => {
            const div = document.createElement('div');
            div.className = `agent-row ${agent.id === this.selectedAgent ? 'active' : ''}`;
            div.dataset.agent = agent.id;
            
            const statusClass = `status-${agent.status}`;
            const age = this.getTimeAgo(agent.lastUpdate);
            
            div.innerHTML = `
                <div class="agent-avatar">${agent.icon}</div>
                <div class="agent-info">
                    <div class="agent-name-row">
                        <span class="agent-name-text">${agent.name}</span>
                        ${agent.status !== 'idle' ? `<span class="agent-status-badge ${statusClass}">${agent.status}</span>` : ''}
                    </div>
                    <div class="agent-last-update">${age}</div>
                </div>
                <div class="agent-badges">
                    ${agent.mentionCount > 0 ? `<span class="badge badge-mention">${agent.mentionCount}</span>` : ''}
                    ${agent.blockedCount > 0 ? `<span class="badge badge-blocked">${agent.blockedCount}</span>` : ''}
                </div>
            `;
            
            div.addEventListener('click', () => this.openAgentDrawer(agent.id));
            container.appendChild(div);
        });
    }

    // ========== RENDER AGENT FLEET (NEW) ==========
    renderAgentFleet() {
        const container = document.getElementById('agent-fleet-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = `agent-fleet-card ${agent.status}`;
            card.dataset.agent = agent.id;
            
            const statusDotClass = agent.status;
            const age = this.getTimeAgo(agent.lastUpdate);
            
            // Skills (max 2 visible)
            const skillsHtml = agent.skills.slice(0, 2).map(skill => 
                `<span class="agent-skill-tag">${skill}</span>`
            ).join('');
            
            card.innerHTML = `
                <div class="agent-fleet-header">
                    <div class="agent-fleet-icon">${agent.icon}</div>
                    <div class="agent-fleet-info">
                        <div class="agent-fleet-name">${agent.name}</div>
                        <div class="agent-fleet-role">${agent.role}</div>
                    </div>
                </div>
                <div class="agent-fleet-status">
                    <span class="status-dot ${statusDotClass}"></span>
                    <span>${agent.status}</span>
                </div>
                <div class="agent-fleet-meta">
                    <span>Updated ${age}</span>
                    ${agent.currentTaskId ? '<span>📋 Task</span>' : ''}
                </div>
                <div class="agent-fleet-skills">
                    ${skillsHtml}
                </div>
            `;
            
            card.addEventListener('click', () => this.openAgentDrawer(agent.id));
            container.appendChild(card);
        });
        
        // Update count
        const countEl = document.getElementById('fleet-count');
        if (countEl) countEl.textContent = this.agents.length;
    }

    // ========== RENDER KANBAN ==========
    renderKanban() {
        this.columns.forEach(col => {
            const container = document.getElementById(`col-${col}`);
            if (container) container.innerHTML = '';
            
            const countEl = document.getElementById(`count-${col}`);
            if (countEl) countEl.textContent = '0';
        });
        
        const filtered = this.currentFilter === 'all' 
            ? this.workingTasks 
            : this.workingTasks.filter(t => t.priority === this.currentFilter);
        
        const columnCounts = {};
        this.columns.forEach(c => columnCounts[c] = 0);
        
        filtered.forEach(task => {
            // Normalize column values to match kanban columns
            const columnMap = {
                'inbox': 'review',
                'waiting': 'review',
                'assigned': 'in-progress',
                'in-progress': 'in-progress',
                'review': 'review',
                'done': 'completed',
                'completed': 'completed'
            };
            const rawCol = task.column || 'inbox';
            const col = columnMap[rawCol] || 'review';
            const container = document.getElementById(`col-${col}`);
            if (!container) return;
            
            columnCounts[col]++;
            
            const card = document.createElement('div');
            card.className = `task-card ${task.type === 'approval' ? 'approval' : ''} ${task.executionStatus === 'EXECUTION_APPROVED' ? 'approval-approved' : ''} ${task.ambiguityNote ? 'ambiguity' : ''}`;
            card.draggable = true;
            card.dataset.taskId = task.id;
            card.title = task.ambiguityNote || task.routingReason || '';
            
            const age = this.getTimeAgo(new Date(task.created).getTime());
            const approvalBadge = task.type === 'approval' ? `<span class="task-tag tag-type-${task.type}">${task.type}</span>` : '';
            const ambiguityBadge = task.ambiguityNote ? `<span class="task-tag" style="background: var(--accent-warning); color: black;">?!</span>` : '';
            
            const pendingApproval = task.column === 'review' || task.status === 'waiting_approval';
            const approverInfo = pendingApproval 
                ? `<span style="color: var(--accent-warning); font-size: 11px;">👤 <strong>Approver:</strong> Anwar ⏳</span>`
                : (task.approvalState?.approvedBy 
                    ? `<span style="color: var(--accent-success); font-size: 11px;">✓ <strong>Approved by:</strong> ${task.approvalState.approvedBy}</span>`
                    : '');
            
            card.innerHTML = `
                <div class="task-card-header">
                    <div class="task-card-title">${task.title}</div>
                </div>
                <div class="task-card-tags">
                    ${task.priority ? `<span class="task-tag tag-priority-${task.priority}">${task.priority}</span>` : ''}
                    ${approvalBadge}
                    ${ambiguityBadge}
                </div>
                <div class="task-card-meta">
                    <span class="task-card-owner">${task.agentIcon || ''} <strong>Owner:</strong> ${task.agent}</span>
                    ${approverInfo}
                    <span class="task-card-age">${age}</span>
                </div>
            `;
            
            card.addEventListener('click', () => this.openTaskDrawer(task.id));
            
            card.addEventListener('dragstart', (e) => this.handleDragStart(e, task));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            container.appendChild(card);
        });
        
        Object.entries(columnCounts).forEach(([col, count]) => {
            const el = document.getElementById(`count-${col}`);
            if (el) el.textContent = count;
        });
        
        // Phase 2: After rendering, enforce workflow rules
        this.enforceWorkflow();
    }

    // ========== DRAG AND DROP ==========
    handleDragStart(e, task) {
        this.draggedTask = task;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTask = null;
        
        document.querySelectorAll('.column-tasks').forEach(col => {
            col.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const column = e.target.closest('.column-tasks');
        if (column) column.classList.add('drag-over');
    }

    handleDragLeave(e) {
        const column = e.target.closest('.column-tasks');
        if (column) column.classList.remove('drag-over');
    }

    async handleDrop(e) {
        e.preventDefault();
        
        const columnEl = e.target.closest('.column-tasks');
        if (!columnEl || !this.draggedTask) return;
        
        const newColumn = columnEl.dataset.column;
        // Phase 2: Only 3 columns allowed
        const newStatus = newColumn === 'review' ? 'review' :
                         newColumn === 'in-progress' ? 'in_progress' :
                         newColumn === 'completed' ? 'completed' : 'review';
        
        const task = this.tasks.find(t => t.id === this.draggedTask.id);
        if (task) {
            // Phase 2: Validate approval before moving to IN-PROGRESS
            if (newColumn === 'in-progress' && task.approvalState?.decision !== 'APPROVED') {
                console.log(`[EXECUTION_BLOCKED_NO_APPROVAL] Task ${task.id} - approval required`);
                this.showToast('❌ Cannot move to IN-PROGRESS without approval');
                columnEl.classList.remove('drag-over');
                return;
            }
            
            task.column = newColumn;
            task.status = newStatus;
            task.updated = new Date().toISOString();
            await this.saveTasks();
            this.renderKanban();
            this.renderCommandCenter();
            this.updateCounters();
        }
        
        columnEl.classList.remove('drag-over');
    }

    // ========== DRAWERS ==========
    openTaskDrawer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.selectedTask = task;
        
        const drawer = document.getElementById('task-drawer');
        const content = document.getElementById('task-drawer-content');
        
        if (!drawer || !content) return;
        
        document.getElementById('agent-drawer').classList.add('hidden');
        
        const isApproval = task.type === 'approval';
        const approvalState = task.approvalState || {};
        
        let html = `
            <div class="task-detail-header">
                <div class="task-detail-id">${task.id} ${task.routedBy ? '🤖' : ''}</div>
                <div class="task-detail-title">${task.title}</div>
                <div class="task-detail-meta">
                    <span class="task-detail-status status-${task.status}">${task.status}</span>
                    ${task.priority ? `<span class="task-tag tag-priority-${task.priority}">${task.priority}</span>` : ''}
                    <span>${task.agentIcon || ''} ${task.agent}</span>
                </div>
                ${task.routingReason ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">✅ ${task.routingReason}</div>` : ''}
                ${task.ambiguityNote ? `<div style="font-size: 12px; color: var(--accent-warning); margin-top: 4px; padding: 8px; background: rgba(210,153,34,0.1); border-radius: 4px;">⚠️ ${task.ambiguityNote}</div>` : ''}
            </div>
            
            <div class="task-detail-description">
                <h4>Description</h4>
                <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6; color: var(--text-secondary); margin-top: 8px;">${task.description || 'No description'}</pre>
            </div>
        `;
        
        if (isApproval) {
            // Get approval evaluation data if available
            const approvalEval = task.approvalEvaluation || {};
            const intent = approvalEval.intent || 'CONFIG';
            const riskLevel = approvalEval.risk || task.risk || 'MEDIUM';
            const canExecute = approvalEval.can_execute !== undefined ? approvalEval.can_execute : false;
            const escalation = approvalEval.escalation || 'DASHBOARD';
            const domainCheck = approvalEval.domain_check || {};
            
            html += `
                <div class="approval-section">
                    <h4>Approval Status</h4>
                    
                    <!-- Phase 4: Approval Metadata -->
                    <div class="approval-metadata" style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius); margin-bottom: 12px;" >
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
                            <div>
                                <span style="color: var(--text-muted);">Owner:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${task.agentIcon || ''} ${task.agent}</span>
                            </div>
                            <div>
                                <span style="color: var(--text-muted);">Approver:</span>
                                ${approvalState.approvedBy 
                                    ? `<span style="color: var(--accent-success); font-weight: 600;">✓ ${approvalState.approvedBy}</span>`
                                    : approvalState.deniedBy
                                        ? `<span style="color: var(--accent-danger); font-weight: 600;">❌ Denied by ${approvalState.deniedBy}</span>`
                                        : approvalState.deferredBy
                                            ? `<span style="color: var(--accent-warning); font-weight: 600;">⏸️ Deferred by ${approvalState.deferredBy}</span>`
                                            : `<span style="color: var(--accent-warning); font-weight: 600;">👤 Anwar ⏳</span>`
                                }
                            </div>
                            <div>
                                <span style="color: var(--text-muted);">Risk:</span>
                                <span class="risk-badge risk-${riskLevel.toLowerCase()}">${riskLevel}</span>
                            </div>
                            <div>
                                <span style="color: var(--text-muted);">Intent:</span>
                                <span style="color: var(--text-primary);">${intent}</span>
                            </div>
                            <div>
                                <span style="color: var(--text-muted);">Can Execute:</span>
                                <span style="color: ${canExecute ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight: 600;">${canExecute ? '✅ Yes' : '❌ No'}</span>
                            </div>
                        </div>
                        
                        ${!domainCheck.valid ? `
                            <div class="domain-warning" style="margin-top: 8px; padding: 8px; background: rgba(210,153,34,0.1); border-radius: var(--radius-sm); border-left: 3px solid var(--accent-warning);">
                                <div style="font-size: 11px; color: var(--accent-warning);">⚠️ Domain Mismatch</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${domainCheck.reason || 'Proposed bot does not own this domain'}</div>
                                ${domainCheck.correctBot ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Correct bot: ${domainCheck.correctBot}</div>` : ''}
                            </div>
                        ` : ''}
                        
                        ${escalation === 'TELEGRAM' ? `
                            <div style="margin-top: 8px; padding: 6px 8px; background: rgba(218,54,51,0.1); border-radius: var(--radius-sm); font-size: 11px; color: var(--accent-danger);">
                                🚨 Telegram escalation triggered
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="approval-item">
                        <div class="approval-header">
                            <span class="approval-title">Review Required</span>
                            <span class="approval-status" style="background: ${approvalState.approvedBy ? 'var(--accent-success)' : approvalState.deniedBy ? 'var(--accent-danger)' : approvalState.deferredBy ? 'var(--accent-warning)' : 'var(--text-muted)'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                                ${approvalState.approvedBy ? '✅ Approved' : approvalState.deniedBy ? '❌ Denied' : approvalState.deferredBy ? '⏸️ Deferred' : '⏳ Pending'}
                            </span>
                        </div>
                        
                        <!-- Decision History -->
                        ${approvalState.approvedBy ? `
                            <div class="decision-history" style="margin: 8px 0; padding: 8px; background: rgba(35,134,54,0.1); border-radius: var(--radius-sm);">
                                <div style="font-size: 11px; color: var(--accent-success); font-weight: 600;">✅ APPROVED</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">By ${approvalState.approvedBy} at ${new Date(approvalState.approvedAt).toLocaleString()}</div>
                                <div style="font-size: 12px; color: var(--accent-success); margin-top: 4px;">Can execute: YES</div>
                            </div>
                        ` : ''}
                        
                        ${approvalState.deniedBy ? `
                            <div class="decision-history" style="margin: 8px 0; padding: 8px; background: rgba(218,54,51,0.1); border-radius: var(--radius-sm);">
                                <div style="font-size: 11px; color: var(--accent-danger); font-weight: 600;">❌ DENIED</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">By ${approvalState.deniedBy} at ${new Date(approvalState.deniedAt).toLocaleString()}</div>
                                ${approvalState.reason ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Reason: ${approvalState.reason}</div>` : ''}
                            </div>
                        ` : ''}
                        
                        ${approvalState.deferredBy ? `
                            <div class="decision-history" style="margin: 8px 0; padding: 8px; background: rgba(210,153,34,0.1); border-radius: var(--radius-sm);">
                                <div style="font-size: 11px; color: var(--accent-warning); font-weight: 600;">⏸️ DEFERRED</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">By ${approvalState.deferredBy} at ${new Date(approvalState.deferredAt).toLocaleString()}</div>
                                ${approvalState.reason ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Reason: ${approvalState.reason}</div>` : ''}
                            </div>
                        ` : ''}
                        
                        
                        ${!approvalState.approvedBy && !approvalState.deniedBy && !approvalState.deferredBy ? `
                            <div style="font-size: 12px; color: var(--text-muted); margin: 8px 0; padding: 8px; background: var(--bg-secondary); border-radius: var(--radius-sm);">
                                <div>⏳ Awaiting decision...</div>
                                ${approvalEval.reason ? `<div style="font-size: 11px; margin-top: 4px;">${approvalEval.reason}</div>` : ''}
                            </div>
                            
                            <div class="approval-actions" style="display: flex; gap: 8px; margin-top: 12px;">
                                <button class="btn-approve" style="flex: 1;" onclick="missionControl.approveTask('${task.id}')">✅ Approve</button>
                                <button class="btn-deny" style="flex: 1;" onclick="missionControl.denyTask('${task.id}')">❌ Deny</button>
                                <button class="btn-defer" style="flex: 1;" onclick="missionControl.deferTask('${task.id}')">⏸️ Defer</button>
                            </div>
                        ` : ''}
                        
                        ${approvalState.approvedBy ? `
                            <div style="margin-top: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius); border: 1px solid var(--border-color);">
                                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">🚀 Execution</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
                                    Status: ${task.lastRun ? task.lastRun.status === 'success' ? '✅ Last run succeeded' : task.lastRun.status === 'failed' ? '❌ Last run failed' : '⏳ Running...' : 'Not yet executed'}
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-simulate" style="flex: 1; background: var(--bg-hover); color: var(--text-secondary); border: 1px dashed var(--border-color); padding: 8px; border-radius: var(--radius-sm); cursor: pointer;" onclick="missionControl.executeTaskSimulated('${task.id}')">
                                        ▶️ Execute (Simulated)
                                    </button>
                                    ${task.lastRun ? `
                                        <button class="btn-view-run" style="background: var(--bg-secondary); color: var(--text-muted); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer;" onclick="missionControl.viewRunDetails('${task.lastRun.run_id}')">
                                            📄 Last Run
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // Comments section
        const comments = task.comments || [];
        html += `
            <div class="comments-section">
                <h4>Activity Log (${comments.length + 1})</h4>
        `;
        
        if (comments.length > 0) {
            comments.forEach(c => {
                html += `
                    <div class="comment-item">
                        <div class="comment-avatar">${c.authorIcon || '💬'}</div>
                        <div class="comment-content">
                            <div class="comment-header">
                                <span class="comment-author">${c.author}</span>
                                <span class="comment-time">${this.getTimeAgo(new Date(c.timestamp).getTime())}</span>
                            </div>
                            <div class="comment-text">${c.text}</div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                <div class="comment-item">
                    <div class="comment-avatar">🎯</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">Leader</span>
                            <span class="comment-time">just now</span>
                        </div>
                        <div class="comment-text">${task.status === 'waiting_approval' || task.column === 'review' ? `Proposed by Leader → awaiting <strong>your</strong> approval` : task.status === 'waiting-approval' ? 'Awaiting approval' : `Assigned to ${task.agent}`}</div>
                    </div>
                </div>
                <div class="comment-input">
                    <input type="text" placeholder="Add a comment..." id="comment-input-${task.id}">
                    <button onclick="missionControl.addComment('${task.id}')">Send</button>
                </div>
            </div>
        `;
        
        if (task.deliverables && task.deliverables.length > 0) {
            html += `
                <div class="deliverables-section">
                    <h4>Deliverables</h4>
                    ${task.deliverables.map(d => `
                        <div class="deliverable-item">
                            <span class="deliverable-icon">📎</span>
                            <span class="deliverable-name">${d.name}</span>
                            <a href="${d.url}" class="deliverable-link" target="_blank">View</a>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content.innerHTML = html;
        drawer.classList.remove('hidden');
    }

    closeTaskDrawer() {
        document.getElementById('task-drawer').classList.add('hidden');
        this.selectedTask = null;
    }

    openAgentDrawer(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        this.selectedAgent = agentId;
        document.getElementById('task-drawer').classList.add('hidden');
        
        document.getElementById('profile-icon').textContent = agent.icon;
        document.getElementById('profile-name').textContent = agent.name;
        document.getElementById('profile-role').textContent = agent.role;
        
        const statusEl = document.querySelector('.status-badge');
        statusEl.textContent = agent.status;
        statusEl.className = `status-badge status-${agent.status}`;
        
        document.getElementById('profile-tasks').textContent = this.tasks.filter(t => t.agent === agent.id && t.status !== 'done').length;
        document.getElementById('profile-mentions').textContent = agent.mentionCount;
        
        const skillsContainer = document.querySelector('.skills-list');
        skillsContainer.innerHTML = agent.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
        
        const currentTask = this.tasks.find(t => t.id === agent.currentTaskId);
        document.getElementById('profile-current-task').textContent = currentTask 
            ? `${currentTask.id}: ${currentTask.title}`
            : 'No active task';
        
        document.getElementById('agent-drawer').classList.remove('hidden');
        this.renderAgentList();
        this.renderAgentFleet();
    }

    closeAgentDrawer() {
        document.getElementById('agent-drawer').classList.add('hidden');
        this.selectedAgent = null;
        this.renderAgentList();
        this.renderAgentFleet();
    }
    
    // ========== AGENT MODALS ==========
    openAgentTasksModal(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        const agentTasks = this.workingTasks.filter(t => t.agent === agentId && t.status !== 'completed');
        
        // Create modal if not exists
        let modal = document.getElementById('agent-tasks-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'agent-tasks-modal';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📋 Tasks for <span id="agent-tasks-name"></span></h2>
                        <button class="modal-close" onclick="missionControl.closeModal('agent-tasks')">×</button>
                    </div>
                    <div class="modal-body" id="agent-tasks-body">
                        <div class="tasks-list" id="agent-tasks-list"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('agent-tasks-name').textContent = agent.name;
        const list = document.getElementById('agent-tasks-list');
        
        if (agentTasks.length === 0) {
            list.innerHTML = '<div class="counter-item"><div class="counter-item-title">No active tasks</div></div>';
        } else {
            list.innerHTML = agentTasks.map(t => `
                <div class="counter-item" onclick="missionControl.openTaskDrawer('${t.id}'); missionControl.closeModal('agent-tasks')">
                    <div class="counter-item-header">
                        <span class="task-tag tag-priority-${t.priority || 'P2'}">${t.priority || 'P2'}</span>
                        <span class="counter-item-title">${this.escapeHtml(t.title)}</span>
                    </div>
                    <div class="counter-item-meta">
                        <span>${t.column}</span>
                        <span>${t.approvalState?.approvedBy ? '✓ ' + t.approvalState.approvedBy : '⏳ pending'}</span>
                    </div>
                </div>
            `).join('');
        }
        
        this.openModal('agent-tasks');
    }
    
    openAgentMentionsModal(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        // Create modal if not exists
        let modal = document.getElementById('agent-mentions-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'agent-mentions-modal';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🔔 Mentions for <span id="agent-mentions-name"></span></h2>
                        <button class="modal-close" onclick="missionControl.closeModal('agent-mentions')">×</button>
                    </div>
                    <div class="modal-body" id="agent-mentions-body">
                        <div class="mentions-list" id="agent-mentions-list">
                            <div class="counter-item">
                                <div class="counter-item-title">No mentions yet</div>
                                <div class="counter-item-meta">Mentions will appear when other agents reference this agent</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('agent-mentions-name').textContent = agent.name;
        this.openModal('agent-mentions');
    }

    // ========== APPROVAL ACTIONS (Phase 2: 3-Column Workflow) ==========
    async approveTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        task.approvalState = {
            ...task.approvalState,
            approvedBy: 'Anwar',
            approvedAt: new Date().toISOString(),
            deniedBy: null,
            deniedAt: null,
            deferredBy: null,
            deferredAt: null,
            reason: null,
            decision: 'APPROVED'
        };
        // Phase 2: Move to IN-PROGRESS on approve
        task.status = 'in_progress';
        task.column = 'in-progress';
        task.executionStatus = 'EXECUTION_APPROVED';
        task.updated = new Date().toISOString();
        
        await this.saveTasks();
        this.renderKanban();
        this.renderCommandCenter();
        this.updateCounters();
        this.openTaskDrawer(taskId);
        this.showToast(`✅ APPROVED: ${task.title}`);
        
        // Log
        console.log(`[APPROVAL_GRANTED_BY_HUMAN] Task ${taskId} → IN-PROGRESS`);
    }

    async denyTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const reason = prompt('Denial reason:');
        if (reason === null) return;
        
        task.approvalState = {
            ...task.approvalState,
            approvedBy: null,
            approvedAt: null,
            deniedBy: 'Anwar',
            deniedAt: new Date().toISOString(),
            deferredBy: null,
            deferredAt: null,
            reason: reason || 'No reason provided',
            decision: 'DENIED'
        };
        // Phase 2: Move to REVIEW on deny
        task.status = 'review';
        task.column = 'review';
        task.updated = new Date().toISOString();
        
        await this.saveTasks();
        this.renderKanban();
        this.renderCommandCenter();
        this.updateCounters();
        this.openTaskDrawer(taskId);
        this.showToast(`❌ DENIED: ${task.title}`);
        
        // Log
        console.log(`[APPROVAL_DENIED_BY_HUMAN] Task ${taskId} → REVIEW`);
    }

    async deferTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const reason = prompt('Deferral reason:');
        if (reason === null) return;
        
        task.approvalState = {
            ...task.approvalState,
            approvedBy: null,
            approvedAt: null,
            deniedBy: null,
            deniedAt: null,
            deferredBy: 'Anwar',
            deferredAt: new Date().toISOString(),
            reason: reason || 'No reason provided',
            decision: 'DEFERRED'
        };
        // Phase 2: Move to REVIEW on defer
        task.status = 'review';
        task.column = 'review';
        task.updated = new Date().toISOString();
        
        await this.saveTasks();
        this.renderKanban();
        this.renderCommandCenter();
        this.updateCounters();
        this.openTaskDrawer(taskId);
        this.showToast(`⏸️ DEFERRED: ${task.title}`);
        
        // Log
        console.log(`[APPROVAL_DEFERRED_BY_HUMAN] Task ${taskId} → REVIEW`);
    }

    // ========== EXECUTION METHODS (Phase 5) ==========
    async executeTaskSimulated(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Check if already running
        if (task.lastRun?.status === 'running') {
            this.showToast('⚠️ Task already has a running execution');
            return;
        }
        
        this.showToast(`🚀 Starting simulated execution for ${task.title}...`);
        
        try {
            const response = await fetch(`${this.apiBase}/api/run/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    proposedBy: 'leader'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(`✅ Simulated execution complete: ${result.run.step_count} steps, ${result.run.duration}s`);
                // Refresh task drawer
                await this.loadTasks();
                this.openTaskDrawer(taskId);
            } else {
                this.showToast(`❌ Execution failed: ${result.error}`);
            }
        } catch (e) {
            this.showToast('❌ Execution error: ' + e.message);
            console.error('Execution error:', e);
        }
    }
    
    async viewRunDetails(runId) {
        try {
            const response = await fetch(`${this.apiBase}/api/runs/${runId}`);
            const run = await response.json();
            
            if (run.error) {
                this.showToast('❌ ' + run.error);
                return;
            }
            
            // Create a modal or drawer to show run details
            const html = `
                <div style="padding: 16px; max-width: 500px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px;">Run Details: ${run.run_id}</h3>
                    <div style="margin-bottom: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: var(--radius);">
                        <div style="font-size: 12px; color: var(--text-muted);">Task</div>
                        <div style="font-size: 13px; color: var(--text-primary);">${run.task_title}</div>
                    </div>
                    <div style="margin-bottom: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: var(--radius);">
                        <div style="font-size: 12px; color: var(--text-muted);">Status • Mode • Duration</div>
                        <div style="font-size: 13px; color: var(--text-primary);">
                            ${run.status === 'success' ? '✅' : run.status === 'failed' ? '❌' : '⏳'} ${run.status}
                            • ${run.mode}
                            • ${Math.floor((new Date(run.ended_at || run.started_at) - new Date(run.started_at)) / 1000)}s
                        </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Steps (${run.steps.length})</div>
                        ${run.steps.map(s => `
                            <div style="padding: 6px 8px; background: var(--bg-secondary); border-radius: var(--radius-sm); margin-bottom: 4px; font-size: 12px;">
                                <span style="color: ${s.status === 'completed' ? 'var(--accent-success)' : 'var(--accent-danger)'};">●</span> ${s.description}
                            </div>
                        `).join('')}
                    </div>
                    ${run.summary ? `
                        <div style="padding: 8px; background: rgba(88,166,255,0.1); border-radius: var(--radius); border-left: 3px solid var(--accent-primary);">
                            <div style="font-size: 11px; color: var(--text-muted);">Summary</div>
                            <div style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">${run.summary}</div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Show in a temporary modal-like div
            this.showRunModal(html);
        } catch (e) {
            this.showToast('❌ Failed to load run details: ' + e.message);
        }
    }
    
    showRunModal(html) {
        // Remove existing modal if any
        const existing = document.getElementById('run-details-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'run-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
        `;
        modal.innerHTML = `
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); max-width: 90%; max-height: 80%; overflow: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                    <span style="font-weight: 600;">Run Details</span>
                    <button onclick="document.getElementById('run-details-modal').remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px;">×</button>
                </div>
                ${html}
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
    }
    
    async loadRuns() {
        try {
            const response = await fetch(`${this.apiBase}/api/runs?limit=20`);
            const data = await response.json();
            return data.runs || [];
        } catch (e) {
            console.error('Failed to load runs:', e);
            return [];
        }
    }
    
    async renderRunsPanel() {
        const runs = await this.loadRuns();
        const panel = document.getElementById('runs-list');
        if (!panel) return;
        
        if (runs.length === 0) {
            panel.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No executions yet</div>';
            return;
        }
        
        panel.innerHTML = runs.map(run => `
            <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius); margin-bottom: 8px; cursor: pointer;" onclick="missionControl.viewRunDetails('${run.run_id}')">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 11px; padding: 2px 6px; border-radius: 10px; background: ${run.mode === 'SIMULATED' ? 'var(--bg-secondary)' : 'var(--accent-success)'};">
                        ${run.mode === 'SIMULATED' ? '🔮 SIM' : '⚡ LIVE'}
                    </span>
                    <span style="font-size: 12px; font-weight: 600; flex: 1;">${run.task_title.substring(0, 30)}${run.task_title.length > 30 ? '...' : ''}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted);">
                    <span>${run.status === 'success' ? '✅' : run.status === 'failed' ? '❌' : '⏳'} ${run.status}</span>
                    <span>•</span>
                    <span>${run.owner_bot}</span>
                    <span>•</span>
                    <span>${new Date(run.started_at).toLocaleTimeString()}</span>
                </div>
            </div>
        `).join('');
    }

    addComment(taskId) {
        const input = document.getElementById(`comment-input-${taskId}`);
        const text = input?.value?.trim();
        if (!text) return;
        
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        if (!task.comments) task.comments = [];
        task.comments.push({
            author: 'Anwar',
            authorIcon: '👤',
            text: text,
            timestamp: new Date().toISOString()
        });
        
        this.saveTasks();
        this.openTaskDrawer(taskId);
        
        if (input) input.value = '';
    }

    // ========== MODALS ==========
    openModal(modalId) {
        const modal = document.getElementById(`${modalId}-modal`);
        if (modal) modal.classList.remove('hidden');
    }

    closeModal(modalId) {
        const modal = document.getElementById(`${modalId}-modal`);
        if (modal) modal.classList.add('hidden');
    }

    async createTask() {
        const title = document.getElementById('new-task-title')?.value?.trim();
        const desc = document.getElementById('new-task-desc')?.value?.trim();
        const priority = document.getElementById('new-task-priority')?.value;
        const manualAgent = document.getElementById('new-task-agent')?.value;
        
        if (!title) {
            alert('Please enter a task title');
            return;
        }
        
        // Tag extraction from title/desc
        const tags = this.extractTags(title + ' ' + desc);
        
        const newTask = {
            id: `task-${Date.now()}`,
            title,
            description: desc,
            priority: priority || 'P3',
            status: 'inbox',
            column: 'inbox',
            type: 'task',
            tags: tags,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            agent: 'leader',
            agentIcon: '🎯'
        };
        
        // If manual agent selected, use it
        if (manualAgent && manualAgent !== 'auto') {
            const agent = this.agents.find(a => a.id === manualAgent);
            newTask.agent = manualAgent;
            newTask.agentIcon = agent?.icon || '🤖';
        } else if (manualAgent === 'auto') {
            // Auto-route via Leader
            const routing = this.routeTask(newTask);
            if (!routing.ambiguous) {
                newTask.agent = routing.agent;
                newTask.agentIcon = routing.icon;
                newTask.column = 'assigned';
                newTask.status = 'assigned';
                newTask.routedBy = 'Leader (auto)';
                newTask.routingReason = routing.reason;
                
                this.showToast(`✅ Assigned to ${routing.name}: ${routing.reason}`);
            } else {
                newTask.ambiguityNote = routing.reason;
                newTask.ambiguityCandidates = routing.candidates;
                newTask.column = 'review';
                newTask.status = 'review';
                
                this.showToast(`⚠️ Ambiguity detected - needs Anwar`);
            }
        }
        
        this.tasks.push(newTask);
        await this.saveTasks();
        
        this.closeModal('create-task');
        document.getElementById('new-task-title').value = '';
        document.getElementById('new-task-desc').value = '';
    }
    
    extractTags(text) {
        const textLower = text.toLowerCase();
        const tags = [];
        
        const patterns = [
            ['proxmox', 'proxmox'], ['vm', 'vm'], ['lxc', 'lxc'],
            ['ha', 'ha'], ['home', 'home'], ['hass', 'hass'],
            ['storage', 'storage'], ['pbs', 'pbs'], ['truenas', 'truenas'],
            ['network', 'network'], ['firewall', 'firewall'], ['vlan', 'vlan'],
            ['security', 'security'], ['audit', 'audit']
        ];
        
        patterns.forEach(([keyword, tag]) => {
            if (textLower.includes(keyword) && !tags.includes(tag)) {
                tags.push(tag);
            }
        });
        
        return tags;
    }

    async sendBroadcast() {
        const title = document.getElementById('broadcast-title')?.value?.trim();
        const message = document.getElementById('broadcast-message')?.value?.trim();
        const priority = document.getElementById('broadcast-priority')?.value;
        const recipients = document.getElementById('broadcast-recipients')?.value;
        
        if (!title || !message) {
            alert('Please fill in title and message');
            return;
        }
        
        if (priority === 'SERIOUS') {
            // Send via Telegram API
            try {
                const response = await fetch(`${this.apiBase}/api/notify/broadcast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, message, priority })
                });
                const result = await response.json();
                if (result.ok) {
                    this.showToast('🚨 SERIOUS broadcast sent via Telegram');
                } else {
                    this.showToast('⚠️ Telegram failed: ' + result.error);
                }
            } catch (e) {
                this.showToast('🚨 SERIOUS broadcast logged');
            }
        } else {
            this.showToast(`📢 ${priority} broadcast sent`);
        }
        
        this.closeModal('broadcast');
        document.getElementById('broadcast-title').value = '';
        document.getElementById('broadcast-message').value = '';
    }

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderKanban();
            });
        });
        
        document.querySelectorAll('.column-tasks').forEach(col => {
            col.addEventListener('dragover', (e) => this.handleDragOver(e));
            col.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            col.addEventListener('drop', (e) => this.handleDrop(e));
        });
        
        document.getElementById('close-task-drawer')?.addEventListener('click', () => this.closeTaskDrawer());
        document.getElementById('close-agent-drawer')?.addEventListener('click', () => this.closeAgentDrawer());
        
        // Agent profile stats - clickable
        document.getElementById('profile-tasks-stat')?.addEventListener('click', () => {
            if (this.selectedAgent) {
                this.closeAgentDrawer();
                // Show tasks for this agent
                this.openAgentTasksModal(this.selectedAgent);
            }
        });
        
        document.getElementById('profile-mentions-stat')?.addEventListener('click', () => {
            if (this.selectedAgent) {
                this.closeAgentDrawer();
                // Show mentions for this agent
                this.openAgentMentionsModal(this.selectedAgent);
            }
        });
        
        document.getElementById('btn-active-toggle')?.addEventListener('click', () => {
            const indicator = document.querySelector('.toggle-indicator');
            indicator.classList.toggle('active');
        });
        
        document.getElementById('btn-chat')?.addEventListener('click', () => this.openModal('chat'));
        document.getElementById('btn-broadcast')?.addEventListener('click', () => this.openModal('broadcast'));
        document.getElementById('btn-docs')?.addEventListener('click', () => {
            window.open('docs/PHASE-0-WIREFRAME-DATA-MODEL.md', '_blank');
        });
        
        // Phase 4: Infrastructure refresh button
        document.getElementById('btn-refresh-overview')?.addEventListener('click', () => {
            this.loadInfrastructureStatus();
            this.showToast('🔄 Refreshing system status...');
        });
        
        // Phase 4: Bot Activity panel filters
        document.getElementById('bot-filter')?.addEventListener('change', () => this.loadBotActivity());
        document.getElementById('severity-filter')?.addEventListener('change', () => this.loadBotActivity());
        document.getElementById('btn-refresh-overview')?.addEventListener('click', () => {
            this.loadInfrastructureStatus();
            this.showToast('🔄 Refreshing system status...');
        });
        
        // Add Daily Report button
        const toolbar = document.getElementById('top-center');
        if (toolbar) {
            const dailyBtn = document.createElement('button');
            dailyBtn.className = 'top-btn';
            dailyBtn.innerHTML = '📊 Daily';
            dailyBtn.onclick = () => this.showDailySummary();
            toolbar.insertBefore(dailyBtn, toolbar.firstChild);
        }
        
        document.getElementById('btn-new-task')?.addEventListener('click', () => this.openModal('create-task'));
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.dataset.modal;
                this.closeModal(modal);
            });
        });
        
        document.getElementById('btn-create-task-submit')?.addEventListener('click', () => this.createTask());
        document.getElementById('btn-send-broadcast')?.addEventListener('click', () => this.sendBroadcast());
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        });
        
        document.getElementById('squad-chat-send')?.addEventListener('click', () => {
            const input = document.getElementById('squad-chat-input');
            const text = input?.value?.trim();
            if (!text) return;
            
            const messages = document.getElementById('squad-chat-messages');
            const msg = document.createElement('div');
            msg.className = 'chat-message';
            msg.innerHTML = `
                <div class="chat-message-avatar">👤</div>
                <div class="chat-message-content">
                    <div class="chat-message-header">
                        <span class="chat-message-author">Anwar</span>
                        <span class="chat-message-time">just now</span>
                    </div>
                    <div class="chat-message-text">${text}</div>
                </div>
            `;
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;
            
            input.value = '';
        });
        
        // Phase 2: Dashboard Squad Chat
        document.getElementById('dashboard-chat-send')?.addEventListener('click', () => {
            const input = document.getElementById('dashboard-chat-input');
            const text = input?.value?.trim();
            if (!text) return;
            
            const messages = document.getElementById('dashboard-chat-messages');
            const msg = document.createElement('div');
            msg.className = 'chat-message';
            msg.innerHTML = `
                <div class="chat-message-avatar">👤</div>
                <div class="chat-message-content">
                    <div class="chat-message-header">
                        <span class="chat-message-author">Anwar</span>
                        <span class="chat-message-time">just now</span>
                    </div>
                    <div class="chat-message-text">${text}</div>
                </div>
            `;
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;
            
            input.value = '';
        });
        
        // Phase 2: Notification bell
        document.getElementById('btn-notifications')?.addEventListener('click', () => {
            this.openNotificationsModal();
        });
        
        // Phase 2: Command Center buttons
        document.querySelectorAll('.command-section .view-all-btn-small').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.command-section');
                const isApprovals = section?.id === 'section-approvals';
                if (isApprovals) {
                    this.openNotificationsModal();
                } else {
                    this.openAlertsModal();
                }
            });
        });
    }

    // ========== UTILITIES ==========
    updateCounters() {
        document.getElementById('active-agents').textContent = this.agents.filter(a => a.status !== 'idle').length;
        document.getElementById('tasks-count').textContent = this.workingTasks.filter(t => t.status !== 'done').length;
        document.getElementById('alerts-count').textContent = this.tasks.filter(t => t.priority === 'P0' && t.status !== 'done').length;
    }

    updateClock() {
        const el = document.getElementById('current-time');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            }) + ' GST+4';
        }
    }

    getTimeAgo(timestamp) {
        const seconds = (Date.now() - timestamp) / 1000;
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            padding: 12px 24px;
            border-radius: var(--radius);
            color: var(--text-primary);
            font-size: 13px;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }

    startPolling() {
        // Poll for updates every 30 seconds
        setInterval(async () => {
            await this.loadTasks();
            this.renderKanban();
            this.updateCounters();
            this.checkUnassignedTasks(); // Check for new tasks to route
        }, 30000);
        
        // Poll infrastructure status every 60 seconds
        setInterval(() => {
            this.loadInfrastructureStatus();
        }, 60000);
        
        // Poll bot activity every 30 seconds
        setInterval(() => {
            this.loadBotActivity();
        }, 30000);
        
        // Poll runs panel every 30 seconds
        setInterval(async () => {
            await this.loadExecutionStats();
            await this.renderRunsPanel();
        }, 30000);
    }
    
    async loadExecutionStats() {
        try {
            const response = await fetch(`${this.apiBase}/api/run/stats`);
            const stats = await response.json();
            
            const simEl = document.getElementById('stat-simulated');
            const okEl = document.getElementById('stat-success');
            const failEl = document.getElementById('stat-failed');
            
            if (simEl) simEl.textContent = `🔮 ${stats.by_mode?.simulated || 0} sim`;
            if (okEl) okEl.textContent = `✅ ${stats.by_status?.success || 0} ok`;
            if (failEl) failEl.textContent = `❌ ${stats.by_status?.failed || 0} fail`;
        } catch (e) {
            console.error('Failed to load execution stats:', e);
        }
    }

    // ========== INFRASTRUCTURE MONITORING (Phase 4) ==========
    
    async loadInfrastructureStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/infra/status`);
            if (!response.ok) throw new Error('Failed to fetch infra status');
            
            const data = await response.json();
            
            // Phase 2: Store assets for Command Center
            this.infraAssets = data.assets || {};
            
            this.renderInfrastructureCards(data.assets);
            
            // Update last updated timestamp
            const timestamp = new Date(data.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });
            document.getElementById('overview-last-updated').textContent = `Last updated: ${timestamp}`;
            
            // Update system status indicator
            const summary = data.summary;
            const statusEl = document.getElementById('system-status');
            if (summary.SERIOUS > 0) {
                statusEl.textContent = `🔴 ${summary.SERIOUS} critical issue(s)`;
            } else if (summary.WARN > 0) {
                statusEl.textContent = `🟡 ${summary.WARN} warning(s)`;
            } else {
                statusEl.textContent = '🟢 All systems operational';
            }
            
            // Phase 2: Update Command Center after infra loads
            this.renderCommandCenter();
        } catch (e) {
            console.error('Infrastructure check failed:', e);
            document.getElementById('overview-last-updated').textContent = 'Last updated: failed';
        }
    }
    
    renderInfrastructureCards(assets) {
        const grid = document.getElementById('overview-grid');
        if (!grid) return;
        
        const severityToStatus = {
            'OK': { icon: '🟢', label: 'OK', class: 'ok' },
            'WARN': { icon: '🟡', label: 'Warning', class: 'warn' },
            'SERIOUS': { icon: '🔴', label: 'Critical', class: 'serious' }
        };
        
        // Asset order and display config - Phase 2: includes IP, Uptime, CPU, RAM
        const assetConfig = {
            'proxmox_primary': { metrics: ['reachability', 'load', 'vms', 'backups'], ip: '192.168.10.150' },
            'proxmox_secondary': { metrics: ['reachability', 'load', 'vms'], ip: '192.168.10.100' },
            'home_assistant': { metrics: ['reachability', 'core'], ip: '192.168.60.10' },
            'pbs_dsm': { metrics: ['reachability', 'service'], ip: '192.168.30.22' },
            'pbs_legacy': { metrics: ['reachability', 'service'], ip: '192.168.30.21' },
            'truenas': { metrics: ['reachability'], ip: '192.168.30.120' },
            'network_summary': { metrics: ['reachability'], ip: '—' }
        };
        
        const assetOrder = Object.keys(assetConfig);
        
        grid.innerHTML = assetOrder.map(assetId => {
            const asset = assets[assetId];
            if (!asset) return '';
            
            const status = severityToStatus[asset.severity] || severityToStatus['OK'];
            const checkedAt = new Date(asset.checked_at).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });
            
            // Phase 2: Build expanded card with IP, Uptime, CPU, RAM
            const detailsHtml = this.buildInfraDetailsHtml(asset, assetConfig[assetId]);
            
            return `
                <div class="infra-card-expanded ${status.class}" data-asset="${assetId}">
                    <div class="infra-card-header">
                        <span class="infra-icon">${asset.icon}</span>
                        <span class="infra-name">${asset.name}</span>
                        <span class="infra-status ${status.class}" title="${status.label}">${status.icon}</span>
                    </div>
                    <div class="infra-details">
                        ${detailsHtml}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Phase 2: Build detailed infrastructure card with all required fields
    buildInfraDetailsHtml(asset, config) {
        if (!asset) return '';
        
        const ip = config.ip || '—';
        const uptime = asset.metrics?.uptime || '—';
        const cpu = asset.metrics?.load?.cpu !== undefined ? `${asset.metrics.load.cpu}%` : '—';
        const ram = asset.metrics?.load?.ram !== undefined ? `${asset.metrics.load.ram}%` : '—';
        const ramUsedTotal = asset.metrics?.load?.ram_used && asset.metrics?.load?.ram_total 
            ? `${this.formatBytes(asset.metrics.load.ram_used)} / ${this.formatBytes(asset.metrics.load.ram_total)}`
            : '—';
        const latency = asset.metrics?.reachability?.latency_ms 
            ? `${asset.metrics.reachability.latency_ms}ms` 
            : asset.metrics?.reachability?.status === 'up' ? 'online' : '—';
        
        // Additional metrics
        const vms = asset.metrics?.vms?.count !== undefined ? `${asset.metrics.vms.count}` : '—';
        const backups = asset.metrics?.backups?.configured !== undefined 
            ? (asset.metrics.backups.configured ? 'OK' : 'No backups')
            : '—';
        
        let html = `
            <div class="infra-detail-row">
                <span class="infra-detail-label">IP:</span>
                <span class="infra-detail-value">${ip}</span>
            </div>
            <div class="infra-detail-row">
                <span class="infra-detail-label">Uptime:</span>
                <span class="infra-detail-value ${uptime === '—' ? 'missing' : ''}">${uptime}</span>
            </div>
            <div class="infra-detail-row">
                <span class="infra-detail-label">CPU:</span>
                <span class="infra-detail-value ${cpu === '—' ? 'missing' : ''}">${cpu}</span>
            </div>
        `;
        
        // Show RAM with percentage if available
        if (asset.metrics?.load?.ram !== undefined && asset.metrics?.load?.ram_used) {
            html += `
                <div class="infra-detail-row">
                    <span class="infra-detail-label">RAM:</span>
                    <span class="infra-detail-value">${ramUsedTotal} (${ram})</span>
                </div>
            `;
        } else {
            html += `
                <div class="infra-detail-row">
                    <span class="infra-detail-label">RAM:</span>
                    <span class="infra-detail-value missing">—</span>
                </div>
            `;
        }
        
        // Additional info
        html += `
            <div class="infra-detail-row">
                <span class="infra-detail-label">Status:</span>
                <span class="infra-detail-value">${latency}</span>
            </div>
        `;
        
        if (vms !== '—') {
            html += `
                <div class="infra-detail-row">
                    <span class="infra-detail-label">VMs:</span>
                    <span class="infra-detail-value">${vms}</span>
                </div>
            `;
        }
        
        if (backups !== '—') {
            html += `
                <div class="infra-detail-row">
                    <span class="infra-detail-label">Backups:</span>
                    <span class="infra-detail-value ${asset.metrics.backups.configured ? 'ok' : 'warn'}">${backups}</span>
                </div>
            `;
        }
        
        return html;
    }
    
    formatBytes(bytes) {
        if (!bytes) return '—';
        const gb = bytes / (1024 * 1024 * 1024);
        return gb.toFixed(1) + ' GB';
    }
    
    buildMetricsHtml(asset, metricKeys) {
        if (!asset.metrics) return '<div class="infra-metric">No data</div>';
        
        const metrics = [];
        
        for (const key of metricKeys) {
            const value = asset.metrics[key];
            if (!value) continue;
            
            switch(key) {
                case 'reachability':
                    if (value.status === 'up') {
                        metrics.push(`<div class="infra-metric ok">● Online (${value.latency_ms || value.protocol || 'ping'}ms)</div>`);
                    } else {
                        metrics.push(`<div class="infra-metric serious">● Offline</div>`);
                    }
                    break;
                    
                case 'load':
                    if (value.cpu !== undefined) {
                        const cpuClass = value.cpu > 80 ? 'serious' : value.cpu > 50 ? 'warn' : 'ok';
                        metrics.push(`<div class="infra-metric ${cpuClass}">● CPU: ${value.cpu}%</div>`);
                    }
                    if (value.ram !== undefined && value.ram > 0) {
                        const ramClass = value.ram > 80 ? 'serious' : value.ram > 60 ? 'warn' : 'ok';
                        metrics.push(`<div class="infra-metric ${ramClass}">● RAM: ${value.ram}%</div>`);
                    }
                    break;
                    
                case 'vms':
                    if (value.count !== undefined) {
                        metrics.push(`<div class="infra-metric ok">● ${value.count} VMs</div>`);
                    }
                    break;
                    
                case 'backups':
                    if (value.configured !== undefined) {
                        const backupClass = value.configured ? 'ok' : 'warn';
                        const backupText = value.configured ? 'Backups: OK' : 'No backups';
                        metrics.push(`<div class="infra-metric ${backupClass}">● ${backupText}</div>`);
                    }
                    break;
                    
                case 'core':
                    if (value.version) {
                        const updateClass = value.update_available ? 'warn' : 'ok';
                        metrics.push(`<div class="infra-metric ${updateClass}">● HA: ${value.version.substring(0, 10)}</div>`);
                    }
                    break;
                    
                case 'service':
                    if (value.status) {
                        const serviceClass = value.status === 'active' ? 'ok' : 'warn';
                        metrics.push(`<div class="infra-metric ${serviceClass}">● Service: ${value.status}</div>`);
                    }
                    break;
            }
        }
        
        return metrics.slice(0, 4).join(''); // Max 4 metrics
    }

    // ========== BOT ACTIVITY PANEL (Phase 4) ==========
    
    async loadBotActivity() {
        try {
            // Load bot statuses
            const statusResponse = await fetch(`${this.apiBase}/api/bots/status`);
            if (!statusResponse.ok) throw new Error('Failed to fetch bot status');
            const botStatuses = await statusResponse.json();
            
            // Update agent fleet status from real bot statuses
            Object.entries(botStatuses).forEach(([botId, status]) => {
                const agent = this.agents.find(a => a.id === botId);
                if (agent) {
                    // Map bot status to agent status
                    let newStatus = status.status;
                    if (newStatus === 'executing') newStatus = 'working';
                    if (newStatus === 'unknown' || newStatus === 'error') newStatus = 'idle';
                    
                    agent.status = newStatus;
                    agent.lastUpdate = status.lastUpdate ? new Date(status.lastUpdate).getTime() : Date.now();
                    agent.currentTaskId = status.currentTask || null;
                }
            });
            
            // Re-render agent fleet with updated statuses
            this.renderAgentFleet();
            
            // Load activity timeline
            const botFilter = document.getElementById('bot-filter')?.value || '';
            const severityFilter = document.getElementById('severity-filter')?.value || '';
            
            let timelineUrl = `${this.apiBase}/api/activity/timeline?limit=20`;
            if (botFilter) timelineUrl += `&bot=${botFilter}`;
            if (severityFilter) timelineUrl += `&severity=${severityFilter}`;
            
            const timelineResponse = await fetch(timelineUrl);
            if (!timelineResponse.ok) throw new Error('Failed to fetch timeline');
            const timelineData = await timelineResponse.json();
            
            // Render
            this.renderBotStatusCards(botStatuses);
            this.renderActivityTimeline(timelineData.events);
            
        } catch (e) {
            console.error('Bot activity load failed:', e);
        }
    }
    
    renderBotStatusCards(botStatuses) {
        const grid = document.getElementById('bot-status-grid');
        if (!grid) return;
        
        const botConfig = {
            leader: { icon: '🎯', name: 'Leader' },
            dashboard: { icon: '📊', name: 'Dashboard' },
            proxmox: { icon: '🖥️', name: 'Proxmox' },
            home: { icon: '🏠', name: 'Home' },
            storage: { icon: '💾', name: 'Storage' },
            network: { icon: '🌐', name: 'Network' },
            security: { icon: '🔐', name: 'Security' }
        };
        
        // Count tasks per bot
        const botTaskCounts = {};
        this.workingTasks.forEach(t => {
            const agent = t.agent;
            if (!botTaskCounts[agent]) botTaskCounts[agent] = { total: 0, blocked: 0 };
            botTaskCounts[agent].total++;
            if (t.column === 'waiting-approval') botTaskCounts[agent].blocked++;
        });
        
        grid.innerHTML = Object.entries(botStatuses).map(([botId, status]) => {
            const config = botConfig[botId] || { icon: '⚪', name: botId };
            const statusClass = status.status || 'idle';
            const taskCount = botTaskCounts[botId] || { total: 0, blocked: 0 };
            const lastUpdate = status.lastUpdate ? this.getTimeAgo(new Date(status.lastUpdate).getTime()) : 'never';
            
            return `
                <div class="bot-status-card ${statusClass}" data-bot="${botId}" onclick="missionControl.showBotDetail('${botId}')">
                    <div class="bot-status-header">
                        <span class="bot-status-icon">${config.icon}</span>
                        <span class="bot-status-name">${config.name}</span>
                        <span class="bot-status-indicator ${statusClass}">${statusClass}</span>
                    </div>
                    <div class="bot-status-meta">Updated ${lastUpdate}</div>
                    <div class="bot-status-tasks">
                        ${taskCount.total} tasks${taskCount.blocked > 0 ? `, ${taskCount.blocked} blocked` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderActivityTimeline(events) {
        const list = document.getElementById('timeline-list');
        if (!list) return;
        
        if (!events || events.length === 0) {
            list.innerHTML = '<div class="timeline-empty">No recent activity</div>';
            return;
        }
        
        const botIcons = {
            leader: '🎯',
            dashboard: '📊',
            proxmox: '🖥️',
            home: '🏠',
            storage: '💾',
            network: '🌐',
            security: '🔐'
        };
        
        list.innerHTML = events.map(evt => {
            const time = new Date(evt.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });
            const icon = botIcons[evt.bot] || '⚪';
            
            return `
                <div class="timeline-entry ${evt.severity.toLowerCase()}" data-event="${evt.id}">
                    <div class="timeline-time">${time}</div>
                    <div class="timeline-content">
                        <div class="timeline-bot">${icon} ${evt.bot}</div>
                        <div class="timeline-action">${evt.action}</div>
                        ${evt.target ? `<div class="timeline-target">→ ${evt.target}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async showBotDetail(botId) {
        // Highlight selected card
        document.querySelectorAll('.bot-status-card').forEach(c => c.classList.remove('active'));
        document.querySelector(`.bot-status-card[data-bot="${botId}"]`)?.classList.add('active');
        
        // Get bot's assigned tasks
        const botTasks = this.workingTasks.filter(t => t.agent === botId && t.status !== 'done');
        
        // Get bot's recent activity (last 5 entries)
        const activityResponse = await fetch(`${this.apiBase}/api/activity/timeline?bot=${botId}&limit=5`);
        const activityData = await activityResponse.json();
        
        // Show in a modal or drawer (reuse agent drawer for now)
        const agent = this.agents.find(a => a.id === botId);
        if (agent) {
            this.openAgentDrawer(agent);
            
            // Enhance drawer content with activity
            const content = document.getElementById('agent-drawer-content');
            if (content && activityData.events) {
                const activityHtml = activityData.events.map(evt => `
                    <div class="bot-detail-task">
                        <div class="task-id">${new Date(evt.timestamp).toLocaleTimeString()} · ${evt.severity}</div>
                        <div class="task-title">${evt.action}${evt.target ? ` → ${evt.target}` : ''}</div>
                    </div>
                `).join('') || '<div class="bot-detail-task">No recent activity</div>';
                
                content.innerHTML += `
                    <div class="bot-detail-section">
                        <h4>📜 Recent Activity (5)</h4>
                        ${activityHtml}
                    </div>
                `;
            }
        }
    }
}

// Initialize
let missionControl;
document.addEventListener('DOMContentLoaded', () => {
    missionControl = new MissionControl();
    missionControl.init().catch(console.error);
});

window.missionControl = missionControl;

// ========== ATTENTION REQUIRED PANEL ==========

// Extend MissionControl with attention panel methods
MissionControl.prototype.initAttentionPanel = function() {
    this.setupAttentionPanelListeners();
    this.updateAttentionPanel();
    
    // Auto-refresh attention panel every 10 seconds
    setInterval(() => this.updateAttentionPanel(), 10000);
};

MissionControl.prototype.setupAttentionPanelListeners = function() {
    // Close button
    document.getElementById('attention-close')?.addEventListener('click', () => {
        document.getElementById('attention-panel').classList.add('hidden');
        document.getElementById('attention-minimized').classList.remove('hidden');
    });
    
    // Restore button
    document.getElementById('attention-restore')?.addEventListener('click', () => {
        document.getElementById('attention-panel').classList.remove('hidden');
        document.getElementById('attention-minimized').classList.add('hidden');
    });
    
    // Section header clicks - filter kanban
    document.querySelectorAll('.attention-section-header[data-action]').forEach(header => {
        header.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            if (action === 'filter-review') {
                // Scroll to review column
                document.querySelector('.kanban-column[data-column="review"]')?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                this.highlightColumn('review');
            } else if (action === 'filter-p0p1') {
                // Apply P0/P1 filter
                document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
                document.querySelector('.filter-pill[data-filter="P0"]')?.classList.add('active');
                this.currentFilter = 'P0';
                this.renderKanban();
            }
        });
    });
};

MissionControl.prototype.highlightColumn = function(columnName) {
    const column = document.querySelector(`.kanban-column[data-column="${columnName}"]`);
    if (column) {
        column.style.animation = 'none';
        column.offsetHeight; // Trigger reflow
        column.style.animation = 'pulse-column 1s ease-in-out';
        setTimeout(() => {
            column.style.animation = '';
        }, 1000);
    }
};

MissionControl.prototype.updateAttentionPanel = function() {
    // Find items needing attention
    const pendingApprovals = this.workingTasks.filter(t => 
        t.column === 'review' && t.status === 'waiting_approval'
    );
    
    const highRiskItems = this.workingTasks.filter(t => 
        (t.priority === 'P0' || t.priority === 'P1') && 
        t.status !== 'done'
    );
    
    // Open questions from Leader (tasks with ambiguity or comments from leader asking questions)
    const openQuestions = this.workingTasks.filter(t => {
        const hasAmbiguity = t.ambiguityNote || t.ambiguityCandidates;
        const leaderQuestions = t.comments?.some(c => 
            c.author === 'Leader' && 
            (c.text.includes('?') || c.text.includes('question') || c.text.includes('clarify'))
        );
        return (hasAmbiguity || leaderQuestions) && t.status !== 'done';
    });
    
    // Update counts
    this.updateAttentionCount('approvals', pendingApprovals.length, 'warning');
    this.updateAttentionCount('risk', highRiskItems.length, 'danger');
    this.updateAttentionCount('questions', openQuestions.length, 'info');
    
    // Update minimized badge
    const totalItems = pendingApprovals.length + highRiskItems.length + openQuestions.length;
    const badge = document.getElementById('minimized-badge');
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
    
    // Update timestamp
    const statusEl = document.getElementById('attention-status');
    if (statusEl) {
        statusEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Render items
    this.renderAttentionItems('approvals', pendingApprovals);
    this.renderAttentionItems('risk', highRiskItems);
    this.renderAttentionItems('questions', openQuestions);
};

MissionControl.prototype.updateAttentionCount = function(section, count, type) {
    const countEl = document.getElementById(`count-${section}`);
    if (countEl) {
        countEl.textContent = count;
        countEl.classList.toggle('attention-count-zero', count === 0);
    }
};

MissionControl.prototype.renderAttentionItems = function(section, items) {
    const container = document.getElementById(`items-${section}`);
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // Show max 5 items per section
    const displayItems = items.slice(0, 5);
    const remaining = items.length > 5 ? items.length - 5 : 0;
    
    let html = displayItems.map(item => {
        const agent = this.agents.find(a => a.id === item.agent);
        const agentIcon = agent?.icon || item.agentIcon || '🤖';
        const age = this.getTimeAgo(new Date(item.created || item.updated).getTime());
        
        let typeClass = 'attention-item-approval';
        if (section === 'risk') typeClass = 'attention-item-risk';
        if (section === 'questions') typeClass = 'attention-item-question';
        
        let actionsHtml = '';
        if (section === 'approvals' && item.column === 'review' && item.status === 'waiting_approval') {
            actionsHtml = `
                <div class="attention-item-actions">
                    <button class="attention-action-btn attention-action-approve" 
                            onclick="event.stopPropagation(); missionControl.quickApprove('${item.id}')"
                            title="Approve this task">
                        ✅ Approve
                    </button>
                    <button class="attention-action-btn attention-action-deny" 
                            onclick="event.stopPropagation(); missionControl.quickDeny('${item.id}')"
                            title="Deny this task">
                        ❌ Deny
                    </button>
                    <button class="attention-action-btn attention-action-defer" 
                            onclick="event.stopPropagation(); missionControl.quickDefer('${item.id}')"
                            title="Defer this task">
                        ⏸️ Defer
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="attention-item ${typeClass}" onclick="missionControl.openTaskDrawer('${item.id}')">
                <div class="attention-item-title">${this.escapeHtml(item.title)}</div>
                <div class="attention-item-meta">
                    <span class="attention-item-agent">${agentIcon} ${agent?.name || item.agent}</span>
                    ${item.priority ? `<span class="attention-item-priority ${item.priority.toLowerCase()}">${item.priority}</span>` : ''}
                    <span>${age}</span>
                </div>
                ${actionsHtml}
            </div>
        `;
    }).join('');
    
    if (remaining > 0) {
        html += `
            <div class="attention-item" style="text-align: center; color: var(--text-muted); font-size: 12px; cursor: default;">
                +${remaining} more items...
            </div>
        `;
    }
    
    container.innerHTML = html;
};

MissionControl.prototype.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

MissionControl.prototype.quickApprove = async function(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.approvalState = {
        ...task.approvalState,
        approvedBy: 'Anwar',
        approvedAt: new Date().toISOString(),
        deniedBy: null,
        deniedAt: null
    };
    task.executionStatus = 'EXECUTION_APPROVED';
    task.status = 'assigned';
    task.column = 'assigned';
    task.updated = new Date().toISOString();
    
    await this.saveTasks();
    this.updateAttentionPanel();
    this.showToast(`✅ Approved: ${task.title.substring(0, 30)}...`);
};

MissionControl.prototype.quickDeny = async function(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const reason = prompt('Denial reason:');
    if (reason === null) return;
    
    task.approvalState = {
        ...task.approvalState,
        approvedBy: null,
        approvedAt: null,
        deniedBy: 'Anwar',
        deniedAt: new Date().toISOString(),
        reason: reason || 'No reason provided'
    };
    task.status = 'inbox';
    task.column = 'inbox';
    task.updated = new Date().toISOString();
    
    await this.saveTasks();
    this.updateAttentionPanel();
    this.showToast(`❌ Denied: ${task.title.substring(0, 30)}...`);
};

MissionControl.prototype.quickDefer = async function(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const reason = prompt('Deferral reason:');
    if (reason === null) return;
    
    task.approvalState = {
        ...task.approvalState,
        deferredBy: 'Anwar',
        deferredAt: new Date().toISOString(),
        reason: reason || 'No reason provided'
    };
    task.status = 'review';
    task.column = 'review';
    task.updated = new Date().toISOString();
    
    await this.saveTasks();
    this.updateAttentionPanel();
    this.showToast(`⏸️ Deferred: ${task.title.substring(0, 30)}...`);
};

// ========== PHASE 2: COMMAND CENTER (ANWAR) ==========

MissionControl.prototype.renderCommandCenter = function() {
    // A1: Approvals Pending (Anwar) - FILTER OUT LEADER TASKS
    const pendingApprovals = this.workingTasks.filter(t => 
        t.agent !== 'leader' && // EXCLUDE leader tasks from Command Center
        t.approvalState && 
        !t.approvalState.approvedBy && 
        !t.approvalState.deniedBy && 
        !t.approvalState.deferredBy &&
        (t.column === 'review' || t.status === 'review' || t.status === 'waiting_approval')
    );
    
    const approvalsCountEl = document.querySelector('#command-approvals')?.parentElement?.querySelector('.command-count');
    if (approvalsCountEl) {
        approvalsCountEl.textContent = `Count: ${pendingApprovals.length}`;
    }
    
    const approvalsContainer = document.getElementById('command-approvals');
    if (approvalsContainer) {
        if (pendingApprovals.length === 0) {
            approvalsContainer.innerHTML = `
                <div class="command-placeholder-item">No pending approvals</div>
                <div class="command-placeholder-item">—</div>
                <div class="command-placeholder-item">—</div>
            `;
        } else {
            const top3 = pendingApprovals.slice(0, 3);
            const agent = this.agents.find(a => a.id === 'leader') || { icon: '🎯' };
            approvalsContainer.innerHTML = top3.map(item => {
                const age = this.getTimeAgo(new Date(item.created || item.updated).getTime());
                return `
                    <div class="command-item" onclick="missionControl.openTaskDrawer('${item.id}')">
                        <div class="command-item-row">
                            <span class="command-item-id">${item.id}</span>
                            <span class="command-item-priority ${(item.priority || 'P2').toLowerCase()}">${item.priority || 'P2'}</span>
                        </div>
                        <div class="command-item-title">${this.escapeHtml(item.title)}</div>
                        <div class="command-item-meta">
                            <span>${agent.icon} ${item.agent}</span>
                            <span>${age}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
    
    // A2: Critical Issues
    const criticalIssues = [
        // From current tasks
        ...this.workingTasks.filter(t => (t.priority === 'P0' || t.risk === 'HIGH') && t.column !== 'completed').map(t => ({
            type: 'task',
            name: t.title,
            severity: t.priority === 'P0' ? 'P0' : 'HIGH',
            lastSeen: t.updated
        })),
        // From infra assets (if available)
        ...Object.entries(this.infraAssets || {}).filter(([id, asset]) => asset.severity === 'SERIOUS' || asset.status === 'OFFLINE').map(([id, asset]) => ({
            type: 'asset',
            name: asset.name || id,
            severity: 'SERIOUS',
            lastSeen: asset.checked_at
        }))
    ];
    
    const criticalCountEl = document.querySelector('#command-critical')?.parentElement?.querySelector('.command-count');
    if (criticalCountEl) {
        criticalCountEl.textContent = `Count: ${criticalIssues.length}`;
    }
    
    const criticalContainer = document.getElementById('command-critical');
    if (criticalContainer) {
        if (criticalIssues.length === 0) {
            criticalContainer.innerHTML = `
                <div class="command-placeholder-item">No critical issues</div>
                <div class="command-placeholder-item">—</div>
                <div class="command-placeholder-item">—</div>
            `;
        } else {
            criticalContainer.innerHTML = criticalIssues.slice(0, 3).map(issue => `
                <div class="command-item risk-item">
                    <div class="command-item-row">
                        <span class="command-item-title">${this.escapeHtml(issue.name)}</span>
                        <span class="command-item-severity serious">${issue.severity}</span>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // A3: Network & Performance Snapshot
    const onlineCount = Object.values(this.infraAssets || {}).filter(a => a.status !== 'OFFLINE').length;
    const totalCount = Object.keys(this.infraAssets || {}).length;
    
    // Find top CPU/RAM from metrics
    let topCpu = { value: '—', name: '' };
    let topRam = { value: '—', name: '' };
    
    Object.entries(this.infraAssets || {}).forEach(([id, asset]) => {
        if (asset.metrics?.load?.cpu && topCpu.value === '—') {
            topCpu = { value: asset.metrics.load.cpu + '%', name: asset.name || id };
        }
        if (asset.metrics?.load?.ram && topRam.value === '—') {
            topRam = { value: asset.metrics.load.ram + '%', name: asset.name || id };
        }
    });
    
    const snapshotItems = document.querySelectorAll('.command-snapshot .snapshot-value');
    if (snapshotItems.length >= 3) {
        snapshotItems[0].textContent = totalCount > 0 ? `${onlineCount}/${totalCount}` : '—/—';
        snapshotItems[1].textContent = topCpu.value;
        snapshotItems[2].textContent = topRam.value;
    }
};

// ========== PHASE 2: WORKFLOW ENFORCEMENT ==========

MissionControl.prototype.enforceWorkflow = function() {
    // B: 3-Column Workflow Enforcement
    // REVIEW → IN-PROGRESS → COMPLETED
    
    let autoFixes = 0;
    
    this.tasks.forEach(task => {
        const approval = task.approvalState || {};
        
        // B4: Auto-fix rule - APPROVED tasks must be in IN-PROGRESS
        if ((approval.decision === 'APPROVED' || approval.approvedBy) && task.column === 'review') {
            task.column = 'in-progress';
            task.status = 'in_progress';
            autoFixes++;
            console.log(`[AUTO_COLUMN_CORRECTION] Task ${task.id}: REVIEW → IN-PROGRESS (approved)`);
        }
        
        // Completed tasks must be in COMPLETED column
        if (task.status === 'completed' && task.column !== 'completed') {
            task.column = 'completed';
            autoFixes++;
            console.log(`[AUTO_COLUMN_CORRECTION] Task ${task.id}: → COMPLETED (${task.status})`);
        }
        
        // DENIED/DEFERRED tasks go to REVIEW
        if ((approval.decision === 'DENIED' || approval.decision === 'DEFERRED') && task.column === 'in-progress') {
            task.column = 'review';
            task.status = 'review';
            autoFixes++;
            console.log(`[AUTO_COLUMN_CORRECTION] Task ${task.id}: IN-PROGRESS → REVIEW (${approval.decision.toLowerCase()})`);
        }
    });
    
    if (autoFixes > 0) {
        this.saveTasks().then(() => {
            this.renderKanban();
            this.renderCommandCenter();
        });
    }
};

/**
 * COMPLETE TASK with Summary + Evidence (Leader Steroids Rule)
 * On completion → move to COMPLETED with summary + evidence
 */
MissionControl.prototype.completeTask = async function(taskId, summary, evidence) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Ensure task is in IN-PROGRESS before completing
    if (task.column !== 'in-progress') {
        console.log(`[LEADER_COMPLETE_BLOCKED] Task ${taskId} not in IN-PROGRESS`);
        return;
    }
    
    // Mark as completed
    task.column = 'completed';
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.summary = summary || task.title;
    task.evidence = evidence || [];
    task.updated = new Date().toISOString();
    
    await this.saveTasks();
    
    // Post to Squad Chat
    const agent = this.agents.find(a => a.id === task.agent);
    this.postLeaderAction('leader', `✅ Task ${task.id} COMPLETED by ${agent?.name || task.agent}: ${task.summary}`);
    if (evidence?.length > 0) {
        this.postLeaderAction('leader', `📎 Evidence: ${evidence.map(e => e.name || e).join(', ')}`);
    }
    
    this.renderKanban();
    this.renderCommandCenter();
    this.updateCounters();
    this.renderAgentFleet();
    
    this.showToast(`✅ Task completed: ${task.title}`);
    console.log(`[LEADER_STEROIDS_COMPLETE] Task ${taskId}: IN-PROGRESS → COMPLETED`);
};

/**
 * Bulk auto-complete tasks that are done but stuck in wrong column
 */
MissionControl.prototype.bulkCompleteStuckTasks = async function() {
    const stuckTasks = this.workingTasks.filter(t => 
        (t.status === 'completed' || t.done === true) && 
        t.column !== 'completed'
    );
    
    if (stuckTasks.length === 0) return;
    
    console.log(`[LEADER_BULK_COMPLETE] Found ${stuckTasks.length} stuck completed tasks`);
    
    stuckTasks.forEach(task => {
        task.column = 'completed';
        task.status = 'completed';
        if (!task.completedAt) task.completedAt = new Date().toISOString();
        task.summary = task.summary || task.title;
    });
    
    await this.saveTasks();
    this.renderKanban();
    this.updateCounters();
    
    this.postLeaderAction('leader', `🤖 Auto-completed ${stuckTasks.length} tasks that were stuck`);
};

// ========== PHASE 2: COUNTER MODALS ==========

MissionControl.prototype.setupCounterModals = function() {
    // Active counter
    document.getElementById('active-agents')?.parentElement?.addEventListener('click', () => {
        this.openActiveTasksModal();
    });
    
    // Tasks counter
    document.getElementById('tasks-count')?.parentElement?.addEventListener('click', () => {
        this.openTasksModal();
    });
    
    // Alerts counter
    document.getElementById('alerts-count')?.parentElement?.addEventListener('click', () => {
        this.openAlertsModal();
    });
};

MissionControl.prototype.openActiveTasksModal = function() {
    const activeTasks = this.workingTasks.filter(t => t.column === 'in-progress' || t.status === 'in_progress');
    const container = document.getElementById('active-tasks-list');
    if (!container) return;
    
    container.innerHTML = activeTasks.length === 0 
        ? '<div class="counter-item"><div class="counter-item-title">No active tasks</div></div>'
        : activeTasks.map(t => `
            <div class="counter-item" onclick="missionControl.openTaskDrawer('${t.id}'); missionControl.closeModal('active')">
                <div class="counter-item-header">
                    <span class="task-tag tag-priority-${t.priority || 'P2'}">${t.priority || 'P2'}</span>
                    <span class="counter-item-title">${this.escapeHtml(t.title)}</span>
                </div>
                <div class="counter-item-meta">
                    <span>${t.agentIcon || ''} ${t.agent}</span>
                    <span>${t.approvalState?.approvedBy ? '✓ ' + t.approvalState.approvedBy : '⏳ pending'}</span>
                </div>
            </div>
        `).join('');
    
    this.openModal('active');
};

MissionControl.prototype.openTasksModal = function() {
    const container = document.getElementById('all-tasks-list');
    if (!container) return;
    
    // Count by column
    const byColumn = {
        review: this.workingTasks.filter(t => t.column === 'review').length,
        'in-progress': this.workingTasks.filter(t => t.column === 'in-progress').length,
        completed: this.workingTasks.filter(t => t.column === 'completed').length
    };
    
    let html = `
        <div class="tasks-summary">
            <div class="summary-row">
                <span class="summary-label">📋 REVIEW:</span>
                <span class="summary-value">${byColumn.review}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">⚡ IN-PROGRESS:</span>
                <span class="summary-value">${byColumn['in-progress']}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">✅ COMPLETED:</span>
                <span class="summary-value">${byColumn.completed}</span>
            </div>
        </div>
        <div class="tasks-list-divider"></div>
    `;
    
    const filtered = this.workingTasks.filter(t => t.column !== 'completed');
    html += filtered.length === 0 
        ? '<div class="counter-item"><div class="counter-item-title">No active tasks</div></div>'
        : filtered.slice(0, 20).map(t => `
            <div class="counter-item" onclick="missionControl.openTaskDrawer('${t.id}'); missionControl.closeModal('tasks')">
                <div class="counter-item-header">
                    <span class="task-tag tag-priority-${t.priority || 'P2'}">${t.priority || 'P2'}</span>
                    <span class="counter-item-title">${this.escapeHtml(t.title)}</span>
                </div>
                <div class="counter-item-meta">
                    <span>${t.agentIcon || ''} ${t.agent}</span>
                    <span class="column-badge ${t.column}">${t.column}</span>
                </div>
            </div>
        `).join('');
    
    container.innerHTML = html;
    this.openModal('tasks');
};

MissionControl.prototype.openAlertsModal = function() {
    const alerts = this.workingTasks.filter(t => 
        (t.priority === 'P0' || t.risk === 'HIGH') && 
        t.column !== 'completed'
    );
    
    const container = document.getElementById('alerts-list');
    if (!container) return;
    
    container.innerHTML = alerts.length === 0 
        ? '<div class="counter-item"><div class="counter-item-title">No alerts 🎉</div></div>'
        : alerts.map(t => `
            <div class="counter-item alert-item" onclick="missionControl.openTaskDrawer('${t.id}'); missionControl.closeModal('alerts')">
                <div class="counter-item-header">
                    <span class="task-tag tag-priority-P0">${t.priority || t.risk}</span>
                    <span class="counter-item-title">${this.escapeHtml(t.title)}</span>
                </div>
                <div class="counter-item-meta">
                    <span>${t.agentIcon || ''} ${t.agent}</span>
                    <span>${t.column}</span>
                </div>
            </div>
        `).join('');
    
    this.openModal('alerts');
};

// ========== PHASE 2: NOTIFICATIONS MODAL ==========

MissionControl.prototype.openNotificationsModal = function() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    // Pending approvals
    const pendingApprovals = this.workingTasks.filter(t => 
        t.approvalState && 
        !t.approvalState.approvedBy && 
        !t.approvalState.deniedBy && 
        !t.approvalState.deferredBy &&
        t.column === 'review'
    );
    
    if (pendingApprovals.length === 0) {
        container.innerHTML = '<div class="notification-item"><div class="notification-title">No pending notifications ✅</div></div>';
        setTimeout(() => this.closeModal('notifications'), 1000);
    } else {
        container.innerHTML = pendingApprovals.map(task => {
            const age = this.getTimeAgo(new Date(task.created || task.updated).getTime());
            const agent = this.agents.find(a => a.id === task.agent) || {};
            return `
                <div class="notification-item" onclick="missionControl.openTaskDrawer('${task.id}'); missionControl.closeModal('notifications')">
                    <div class="notification-header">
                        <span class="notification-type">⏳ Awaiting Approval</span>
                        <span class="notification-time">${age}</span>
                    </div>
                    <div class="notification-title">${this.escapeHtml(task.title)}</div>
                    <div class="notification-meta">
                        <span>${task.agentIcon || agent.icon || ''} ${task.agent || 'Unknown'}</span>
                        <span class="priority-badge ${(task.priority || 'P2').toLowerCase()}">${task.priority || 'P2'}</span>
                    </div>
                    <div class="notification-actions">
                        <button class="quick-approve-btn" onclick="event.stopPropagation(); missionControl.quickApprove('${task.id}'); missionControl.closeModal('notifications')">✅ Approve</button>
                        <button class="quick-deny-btn" onclick="event.stopPropagation(); missionControl.quickDeny('${task.id}')">❌ Deny</button>
                        <button class="quick-defer-btn" onclick="event.stopPropagation(); missionControl.quickDefer('${task.id}')">⏸️ Defer</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    this.openModal('notifications');
    
    // Update badge
    const badge = document.querySelector('#notifications .notification-badge');
    if (badge) badge.textContent = pendingApprovals.length;
};

// ========== LEADER "WORKS ON STEROIDS" WATCHDOG ==========

MissionControl.prototype.startWatchdogs = function() {
    // LEADER QUEUE CHECK: Every 5 minutes - REVIEW column processing
    setInterval(() => {
        this.leaderProcessReviewQueue();
    }, 300000); // 5 minutes
    
    // AUTO-CORRECTION: Every 30 seconds - fix workflow violations
    setInterval(() => {
        this.enforceWorkflow();
    }, 30000);
    
    // ESCALATION: Every 60 seconds - check for stale approvals
    setInterval(() => {
        this.leaderEscalationCheck();
    }, 60000);
    
    console.log('[WATCHDOG] Leader Steroids Mode activated: 5min REVIEW check, 30sec auto-correction, 60sec escalation');
};

/**
 * LEADER QUEUE BEHAVIOR (Works on Steroids)
 * Runs every 5 minutes
 * Processes REVIEW column items intelligently
 */
MissionControl.prototype.leaderProcessReviewQueue = async function() {
    const reviewTasks = this.workingTasks.filter(t => t.column === 'review');
    
    if (reviewTasks.length === 0) return;
    
    console.log(`[LEADER_STEROIDS] Processing ${reviewTasks.length} items in REVIEW`);
    
    let processedCount = 0;
    let movedToInProgress = 0;
    let needsApproval = 0;
    
    for (const task of reviewTasks) {
        // AUTO-CORRECTION: If already APPROVED, move to IN-PROGRESS
        if (task.approvalState?.decision === 'APPROVED') {
            task.column = 'in-progress';
            task.status = 'in_progress';
            task.updated = new Date().toISOString();
            processedCount++;
            movedToInProgress++;
            console.log(`[LEADER_AUTO_FIX] Task ${task.id}: APPROVED → IN-PROGRESS`);
            continue;
        }
        
        // CHECK: Does this task require Anwar approval?
        const needsAnwarApproval = this.taskNeedsApproval(task);
        
        if (needsAnwarApproval) {
            // Mark for Anwar approval
            if (!task.approvalState) {
                task.approvalState = {};
            }
            task.approvalState.decision = 'PENDING';
            task.approvalState.approver = 'Anwar';
            task.approvalState.pendingSince = new Date().toISOString();
            task.status = 'waiting_approval';
            needsApproval++;
            
            // Post to Squad Chat
            this.postLeaderAction('leader', `⏳ Task ${task.id} awaiting Anwar approval: ${task.title}`);
            console.log(`[LEADER_APPROVAL_PENDING] Task ${task.id} → Anwar approval queue`);
        } else {
            // NO approval needed - auto-route to IN-PROGRESS with agent assignment
            task.column = 'in-progress';
            task.status = 'in_progress';
            
            // Auto-assign owner if not assigned
            if (!task.agent || task.agent === 'leader') {
                const routing = this.routeTask(task);
                task.agent = routing.agent;
                task.agentIcon = routing.icon;
                task.routingReason = routing.reason;
            }
            
            task.updated = new Date().toISOString();
            movedToInProgress++;
            processedCount++;
            
            // Post to Squad Chat
            const agent = this.agents.find(a => a.id === task.agent);
            this.postLeaderAction('leader', `✅ Task ${task.id} auto-routed to IN-PROGRESS → ${agent?.name || task.agent}`);
            console.log(`[LEADER_AUTO_ROUTE] Task ${task.id}: REVIEW → IN-PROGRESS (${task.agent})`);
        }
    }
    
    if (processedCount > 0) {
        await this.saveTasks();
        this.renderKanban();
        this.renderCommandCenter();
        this.updateCounters();
        
        // Summary toast
        this.showToast(`🎯 Leader processed ${processedCount} REVIEW items: ${movedToInProgress}→IN-PROGRESS, ${needsApproval} awaiting approval`);
    }
};

/**
 * Determine if a task requires Anwar approval
 */
MissionControl.prototype.taskNeedsApproval = function(task) {
    // Tasks that ALWAYS need approval
    const approvalKeywords = [
        'delete', 'remove', 'destroy', 'shutdown', 'reboot', 
        'firewall', 'security policy', 'password', 'credential',
        'backup', 'restore', 'snapshot deletion', 'vm deletion',
        'network change', 'vlan', 'permission', 'access'
    ];
    
    const title = (task.title || '').toLowerCase();
    const desc = (task.description || '').toLowerCase();
    const tags = (task.tags || []).map(t => t.toLowerCase());
    
    // Check keywords
    for (const keyword of approvalKeywords) {
        if (title.includes(keyword) || desc.includes(keyword) || tags.includes(keyword)) {
            return true;
        }
    }
    
    // High priority tasks always need approval
    if (task.priority === 'P0' || task.risk === 'HIGH') {
        return true;
    }
    
    // Destructive operations
    if (task.type === 'approval' || task.needsApproval) {
        return true;
    }
    
    // Pure analysis/reporting/UI tasks don't need approval
    const noApprovalKeywords = [
        'report', 'analysis', 'summary', 'check', 'monitor',
        'status', 'view', 'list', 'display', 'query'
    ];
    
    for (const keyword of noApprovalKeywords) {
        if (title.includes(keyword) || desc.includes(keyword)) {
            return false;
        }
    }
    
    // Default: tasks without clear indicators go to approval
    return true;
};

/**
 * Post leader action to Squad Chat
 */
MissionControl.prototype.postLeaderAction = function(agentId, message) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;
    
    const messages = document.getElementById('dashboard-chat-messages');
    if (!messages) return;
    
    const msg = document.createElement('div');
    msg.className = 'chat-message leader-action';
    msg.innerHTML = `
        <div class="chat-message-avatar">${agent.icon}</div>
        <div class="chat-message-content">
            <div class="chat-message-header">
                <span class="chat-message-author">${agent.name}</span>
                <span class="chat-message-time">just now</span>
            </div>
            <div class="chat-message-text">${message}</div>
        </div>
    `;
    
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    
    // Update agent activity
    agent.lastUpdate = Date.now();
    this.renderAgentFleet();
};

/**
 * ESCALATION CHECK: Warn about stale approvals
 */
MissionControl.prototype.leaderEscalationCheck = function() {
    const now = Date.now();
    const pendingApprovals = this.workingTasks.filter(t => 
        t.column === 'review' &&
        t.approvalState?.decision === 'PENDING' &&
        t.approvalState?.approver === 'Anwar'
    );
    
    pendingApprovals.forEach(task => {
        const age = now - new Date(task.approvalState.pendingSince || task.updated).getTime();
        const hours = age / (1000 * 60 * 60);
        
        if (hours >= 2 && hours < 2.1) {
            // Only notify once at 2h mark
            this.postLeaderAction('leader', `🚨 ESCALATION: Task ${task.id} awaiting approval for ${hours.toFixed(0)} hours`);
            console.log(`[LEADER_ESCALATION] Task ${task.id} awaiting approval for ${hours.toFixed(1)}h`);
        }
    });
};

// Add CSS animation for column highlight
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse-column {
        0%, 100% { box-shadow: none; }
        50% { box-shadow: 0 0 20px rgba(88, 166, 255, 0.5); border-color: var(--accent-primary); }
    }
    
    .command-item {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 8px 10px;
        margin-bottom: 4px;
        cursor: pointer;
        transition: var(--transition);
    }
    
    .command-item:hover {
        border-color: var(--accent-primary);
        background: var(--bg-hover);
    }
    
    .command-item.risk-item {
        border-left: 3px solid var(--accent-danger);
    }
    
    .command-item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
    }
    
    .command-item-id {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
    }
    
    .command-item-priority {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
    }
    
    .command-item-priority.p0 { background: var(--accent-danger); color: white; }
    .command-item-priority.p1 { background: var(--accent-warning); color: black; }
    .command-item-priority.p2 { background: var(--accent-primary); color: white; }
    .command-item-priority.p3 { background: var(--bg-hover); color: var(--text-secondary); }
    
    .command-item-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .command-item-meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
    }
    
    .command-item-severity {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
    }
    
    .command-item-severity.serious {
        background: var(--accent-danger);
        color: white;
    }
    
    .tasks-summary {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 12px;
        margin-bottom: 12px;
    }
    
    .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--border-color);
    }
    
    .summary-row:last-child {
        border-bottom: none;
    }
    
    .summary-label {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .summary-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
        font-family: var(--font-mono);
    }
    
    .tasks-list-divider {
        height: 1px;
        background: var(--border-color);
        margin: 12px 0;
    }
    
    .column-badge {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        background: var(--bg-tertiary);
    }
    
    .column-badge.review { background: rgba(88, 166, 255, 0.2); color: var(--accent-primary); }
    .column-badge.in-progress { background: rgba(210, 153, 34, 0.2); color: var(--accent-warning); }
    .column-badge.completed { background: rgba(35, 134, 54, 0.2); color: var(--accent-success); }
    
    .counter-item.alert-item {
        border-left: 3px solid var(--accent-danger);
    }
    
    /* Notification Modal Styles */
    .notification-item {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 12px;
        margin-bottom: 8px;
        cursor: pointer;
    }
    
    .notification-item:hover {
        border-color: var(--accent-primary);
    }
    
    .notification-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
    }
    
    .notification-type {
        font-size: 11px;
        color: var(--accent-warning);
        font-weight: 500;
    }
    
    .notification-time {
        font-size: 10px;
        color: var(--text-muted);
    }
    
    .notification-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 6px;
    }
    
    .notification-meta {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 8px;
    }
    
    .priority-badge {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 9px;
        font-weight: 600;
    }
    
    .priority-badge.p0 { background: var(--accent-danger); color: white; }
    .priority-badge.p1 { background: var(--accent-warning); color: black; }
    .priority-badge.p2 { background: var(--accent-primary); color: white; }
    .priority-badge.p3 { background: var(--bg-tertiary); color: var(--text-secondary); }
    
    .notification-actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
    }
    
    .quick-approve-btn, .quick-deny-btn, .quick-defer-btn {
        padding: 4px 10px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 11px;
        cursor: pointer;
        font-weight: 500;
    }
    
    .quick-approve-btn {
        background: var(--accent-success);
        color: white;
    }
    
    .quick-deny-btn {
        background: var(--accent-danger);
        color: white;
    }
    
    .quick-defer-btn {
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
    }
`;
document.head.appendChild(style);

// Initialize attention panel after MissionControl is instantiated
document.addEventListener('DOMContentLoaded', () => {
    if (missionControl) {
        setTimeout(() => {
            missionControl.initAttentionPanel();
            missionControl.setupCounterModals(); // Phase 2
        }, 500); // Wait for main init to complete
    }
});
