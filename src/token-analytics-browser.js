// Token Analytics Dashboard Module
(function() {
    'use strict';

    const SYSTEM_COLORS = {
        'Genie': '#800000',
        'PA': '#0066cc', 
        'Kali': '#00aa44',
        'openclaw-cloud': '#800000',
        'openclaw-lab': '#0066cc',
        'openclaw-pa': '#0066cc',
        'rp5kaliclaw': '#00aa44',
        'kali': '#00aa44'
    };

    const SYSTEM_NAMES = {
        'openclaw-cloud': 'Genie',
        'openclaw-lab': 'PA',
        'openclaw-pa': 'PA',
        'rp5kaliclaw': 'Kali',
        'kali': 'Kali'
    };

    let currentPieChart = null;
    let currentBarChart = null;
    let tokenData = {};

    async function loadTokenData() {
        try {
            const response = await fetch('/api/tokens/data');
            tokenData = await response.json();
            populateDateSelector();
            updateWeeklyBarChart(); // Update weekly chart on load
        } catch (e) {
            console.error('Failed to load token data:', e);
        }
    }

    async function loadAvailableDates() {
        try {
            const response = await fetch('/api/tokens/dates');
            return await response.json();
        } catch (e) {
            console.error('Failed to load dates:', e);
            return [];
        }
    }

    function populateDateSelector() {
        const selector = document.getElementById('token-date-selector');
        const dates = Object.keys(tokenData).sort().reverse();
        
        if (dates.length === 0) {
            selector.innerHTML = '<option value="">No data available</option>';
            return;
        }

        selector.innerHTML = dates.map(d => 
            `<option value="${d}">${d}</option>`
        ).join('');

        // Load most recent date
        if (dates.length > 0) {
            loadDateData(dates[0]);
        }

        // Add listener
        selector.addEventListener('change', (e) => {
            loadDateData(e.target.value);
        });
    }

    async function loadDateData(date) {
        if (!tokenData[date]) {
            showEmptyState();
            return;
        }

        const dayData = tokenData[date];
        updateSummaryCards(dayData);
        updatePieChart(dayData);
        updateActivitiesTable(dayData);
    }

    function updateSummaryCards(dayData) {
        let totalIn = 0, totalOut = 0, totalCost = 0;

        Object.values(dayData).forEach(sys => {
            totalIn += sys.in || 0;
            totalOut += sys.out || 0;
            totalCost += sys.cost || 0;
        });

        document.getElementById('token-total-in').textContent = totalIn.toLocaleString();
        document.getElementById('token-total-out').textContent = totalOut.toLocaleString();
        document.getElementById('token-total-cost').textContent = '$' + totalCost.toFixed(4);
        document.getElementById('token-system-count').textContent = Object.keys(dayData).length;
    }

    function updatePieChart(dayData) {
        const ctx = document.getElementById('token-pie-chart');
        if (!ctx) return;

        // Calculate totals per system
        const systemTotals = {};
        Object.entries(dayData).forEach(([system, data]) => {
            const name = SYSTEM_NAMES[system] || system;
            systemTotals[name] = (systemTotals[name] || 0) + (data.in || 0) + (data.out || 0);
        });

        const labels = Object.keys(systemTotals);
        const values = Object.values(systemTotals);
        const colors = labels.map(s => SYSTEM_COLORS[s] || '#666');

        if (currentPieChart) {
            currentPieChart.destroy();
        }

        currentPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#1e293b',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e2e8f0',
                            padding: 15,
                            usePointStyle: true,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = values.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.raw.toLocaleString()} tokens (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Calculate weekly data for bar chart
    function calculateWeeklyData() {
        const dates = Object.keys(tokenData).sort().slice(-7); // Last 7 days
        const systems = ['Genie', 'PA', 'Kali'];
        const systemKeys = ['openclaw-cloud', 'openclaw-lab', 'rp5kaliclaw'];
        
        const datasets = systems.map((sysName, idx) => {
            const data = dates.map(date => {
                const dayData = tokenData[date] || {};
                const sysData = dayData[systemKeys[idx]] || {};
                return (sysData.in || 0) + (sysData.out || 0);
            });
            
            return {
                label: sysName,
                data: data,
                backgroundColor: SYSTEM_COLORS[sysName],
                borderColor: SYSTEM_COLORS[sysName],
                borderWidth: 1
            };
        });

        return { labels: dates, datasets: datasets };
    }

    function updateWeeklyBarChart() {
        const ctx = document.getElementById('token-weekly-chart');
        if (!ctx) {
            console.log('Weekly chart canvas not found');
            return;
        }

        const weeklyData = calculateWeeklyData();

        if (currentBarChart) {
            currentBarChart.destroy();
        }

        currentBarChart = new Chart(ctx, {
            type: 'bar',
            data: weeklyData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e2e8f0',
                            padding: 10,
                            usePointStyle: true,
                            font: { size: 11 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Weekly Token Consumption',
                        color: '#e2e8f0',
                        font: { size: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.raw.toLocaleString()} tokens`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            color: '#e2e8f0',
                            font: { size: 10 },
                            maxRotation: 45
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.1)'
                        }
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            color: '#e2e8f0',
                            callback: function(value) {
                                if (value >= 1000) return (value/1000).toFixed(0) + 'k';
                                return value;
                            }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.1)'
                        }
                    }
                }
            }
        });
    }

    function updateActivitiesTable(dayData) {
        const tbody = document.getElementById('token-table-body');
        const theaders = document.getElementById('token-table-headers');
        
        // Get all systems and sort by display name
        const systems = Object.keys(dayData).sort((a, b) => {
            const nameA = SYSTEM_NAMES[a] || a;
            const nameB = SYSTEM_NAMES[b] || b;
            return nameA.localeCompare(nameB);
        });

        if (systems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No data for selected date</td></tr>';
            return;
        }

        // Update headers
        theaders.innerHTML = systems.map(sys => 
            `<th>${SYSTEM_NAMES[sys] || sys}</th>`
        ).join('');

        // Get activities for each system (sorted ascending)
        const systemActivities = {};
        systems.forEach(sys => {
            const acts = dayData[sys].activities || {};
            const sorted = Object.entries(acts)
                .sort((a, b) => a[1] - b[1])  // Ascending
                .slice(0, 10);
            systemActivities[sys] = sorted;
        });

        // Find max rows
        const maxRows = Math.max(...Object.values(systemActivities).map(a => a.length), 1);

        // Build rows
        let html = '';
        for (let i = 0; i < maxRows; i++) {
            html += '<tr>';
            systems.forEach(sys => {
                const acts = systemActivities[sys];
                if (i < acts.length) {
                    const [activity, tokens] = acts[i];
                    html += `<td><span class="token-badge">${tokens.toLocaleString()}</span><span class="token-activity-name">${activity}</span></td>`;
                } else {
                    html += '<td class="empty-cell">—</td>';
                }
            });
            html += '</tr>';
        }

        tbody.innerHTML = html;
    }

    function showEmptyState() {
        document.getElementById('token-total-in').textContent = '0';
        document.getElementById('token-total-out').textContent = '0';
        document.getElementById('token-total-cost').textContent = '$0.00';
        document.getElementById('token-system-count').textContent = '0';
        document.getElementById('token-table-body').innerHTML = 
            '<tr><td colspan="3" class="empty-cell">Select a date to view token consumption</td></tr>';
        
        if (currentPieChart) {
            currentPieChart.destroy();
            currentPieChart = null;
        }
        if (currentBarChart) {
            currentBarChart.destroy();
            currentBarChart = null;
        }
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Token Analytics: Initializing...');
        loadTokenData();
    });

    // Refresh periodically
    setInterval(loadTokenData, 60000); // Refresh every minute

})();
