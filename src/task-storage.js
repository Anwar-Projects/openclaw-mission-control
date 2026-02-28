/**
 * Task Storage Module - Disk Persistence via API
 * Replaces localStorage with JSON file storage via /api/* endpoints
 */

const TaskStorage = {
    API_BASE: './api',
    _memoryCache: null,
    
    init() {
        console.log('TaskStorage: Initialized with API persistence');
        this._memoryCache = [];
        return this;
    },
    
    async loadTasks() {
        try {
            const response = await fetch(`${this.API_BASE}/tasks?t=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const tasks = Array.isArray(data) ? data : [];
            this._memoryCache = JSON.parse(JSON.stringify(tasks));
            console.log('TaskStorage: Loaded', tasks.length, 'tasks');
            return tasks;
        } catch (error) {
            console.warn('TaskStorage: Failed to load from API:', error);
            const legacy = localStorage.getItem('openclaw_tasks');
            if (legacy) {
                console.log('TaskStorage: Migrating from localStorage');
                const tasks = JSON.parse(legacy);
                await this.saveTasks(tasks);
                localStorage.removeItem('openclaw_tasks');
                return tasks;
            }
            return [];
        }
    },
    
    async saveTasks(tasks) {
        try {
            const response = await fetch(`${this.API_BASE}/save-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tasks)
            });
            if (!response.ok) throw new Error(`Save failed: ${response.status}`);
            const result = await response.json();
            this._memoryCache = JSON.parse(JSON.stringify(tasks));
            console.log('TaskStorage: Saved', result.count, 'tasks');
            return true;
        } catch (error) {
            console.error('TaskStorage: Failed to save:', error);
            this._memoryCache = JSON.parse(JSON.stringify(tasks));
            localStorage.setItem('openclaw_tasks_backup', JSON.stringify(tasks));
            return false;
        }
    },
    
    getCache() { return this._memoryCache || []; },
    setCache(tasks) { this._memoryCache = JSON.parse(JSON.stringify(tasks)); }
};
