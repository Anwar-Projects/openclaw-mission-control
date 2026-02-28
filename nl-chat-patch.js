// Natural Language Chat Integration Patch
// Adds NL chat handlers to Mission Control

(function() {
    // Wait for Mission Control to initialize
    function initChatHandlers() {
        const control = window.missionControl;
        if (!control) {
            setTimeout(initChatHandlers, 100);
            return;
        }

        // Replace existing chat handlers with NL version
        const squadSend = document.getElementById('squad-chat-send');
        const dashboardSend = document.getElementById('dashboard-chat-send');
        
        if (squadSend) {
            squadSend.onclick = async () => {
                const input = document.getElementById('squad-chat-input');
                const text = input?.value?.trim();
                if (!text) return;
                
                // Show user message
                const messages = document.getElementById('squad-chat-messages');
                const userMsg = document.createElement('div');
                userMsg.className = 'chat-message';
                userMsg.innerHTML = `
                    <div class="chat-message-avatar">👤</div>
                    <div class="chat-message-content">
                        <div class="chat-message-header">
                            <span class="chat-message-author">Anwar</span>
                            <span class="chat-message-time">just now</span>
                        </div>
                        <div class="chat-message-text">${text}</div>
                    </div>
                `;
                messages.appendChild(userMsg);
                messages.scrollTop = messages.scrollHeight;
                input.value = '';
                
                // Show typing indicator
                const typingMsg = document.createElement('div');
                typingMsg.id = 'nl-typing';
                typingMsg.className = 'chat-message';
                typingMsg.innerHTML = `
                    <div class="chat-message-avatar">🎯</div>
                    <div class="chat-message-content">
                        <div class="chat-message-header">
                            <span class="chat-message-author">Leader</span>
                            <span class="chat-message-time">typing...</span>
                        </div>
                        <div class="chat-message-text">💬 Processing...</div>
                    </div>
                `;
                messages.appendChild(typingMsg);
                messages.scrollTop = messages.scrollHeight;
                
                try {
                    const response = await fetch(`${control.apiBase}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text, user: 'Anwar', platform: 'squad' })
                    });
                    const result = await response.json();
                    
                    // Remove typing indicator
                    const existingTyping = document.getElementById('nl-typing');
                    if (existingTyping) existingTyping.remove();
                    
                    if (result.success) {
                        const botMsg = document.createElement('div');
                        botMsg.className = 'chat-message';
                        botMsg.innerHTML = `
                            <div class="chat-message-avatar">${result.icon}</div>
                            <div class="chat-message-content">
                                <div class="chat-message-header">
                                    <span class="chat-message-author">${result.name}</span>
                                    <span class="chat-message-time">just now</span>
                                </div>
                                <div class="chat-message-text">${result.response.replace(/\n/g, '<br>')}</div>
                            </div>
                        `;
                        messages.appendChild(botMsg);
                        messages.scrollTop = messages.scrollHeight;
                        
                        // Trigger assignment if requested
                        if (result.action === 'trigger_assignment') {
                            control.showToast('🎯 Triggering task assignment...');
                            fetch(`${control.apiBase}/api/chat/assign-all`, { method: 'POST' });
                        }
                    }
                } catch (e) {
                    console.error('Chat API error:', e);
                    // Show error
                    const existingTyping = document.getElementById('nl-typing');
                    if (existingTyping) existingTyping.remove();
                    
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'chat-message';
                    errorMsg.innerHTML = `
                        <div class="chat-message-avatar">⚠️</div>
                        <div class="chat-message-content">
                            <div class="chat-message-header">
                                <span class="chat-message-author">System</span>
                                <span class="chat-message-time">just now</span>
                            </div>
                            <div class="chat-message-text">Chat service unavailable. Please try again.</div>
                        </div>
                    `;
                    messages.appendChild(errorMsg);
                    messages.scrollTop = messages.scrollHeight;
                }
            };
        }
        
        // Dashboard chat
        if (dashboardSend) {
            dashboardSend.onclick = async () => {
                const input = document.getElementById('dashboard-chat-input');
                const text = input?.value?.trim();
                if (!text) return;
                
                const messages = document.getElementById('dashboard-chat-messages');
                const userMsg = document.createElement('div');
                userMsg.className = 'chat-message';
                userMsg.innerHTML = `
                    <div class="chat-message-avatar">👤</div>
                    <div class="chat-message-content">
                        <div class="chat-message-header">
                            <span class="chat-message-author">Anwar</span>
                            <span class="chat-message-time">just now</span>
                        </div>
                        <div class="chat-message-text">${text}</div>
                    </div>
                `;
                messages.appendChild(userMsg);
                messages.scrollTop = messages.scrollHeight;
                input.value = '';
                
                // Show typing
                const typingMsg = document.createElement('div');
                typingMsg.id = 'nl-typing-dash';
                typingMsg.className = 'chat-message';
                typingMsg.innerHTML = `
                    <div class="chat-message-avatar">🎯</div>
                    <div class="chat-message-content">
                        <div class="chat-message-header">
                            <span class="chat-message-author">Leader</span>
                            <span class="chat-message-time">typing...</span>
                        </div>
                        <div class="chat-message-text">💬 Processing...</div>
                    </div>
                `;
                messages.appendChild(typingMsg);
                messages.scrollTop = messages.scrollHeight;
                
                try {
                    const response = await fetch(`${control.apiBase}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text, user: 'Anwar', platform: 'dashboard' })
                    });
                    const result = await response.json();
                    
                    const existingTyping = document.getElementById('nl-typing-dash');
                    if (existingTyping) existingTyping.remove();
                    
                    if (result.success) {
                        const botMsg = document.createElement('div');
                        botMsg.className = 'chat-message';
                        botMsg.innerHTML = `
                            <div class="chat-message-avatar">${result.icon}</div>
                            <div class="chat-message-content">
                                <div class="chat-message-header">
                                    <span class="chat-message-author">${result.name}</span>
                                    <span class="chat-message-time">just now</span>
                                </div>
                                <div class="chat-message-text">${result.response.replace(/\n/g, '<br>')}</div>
                            </div>
                        `;
                        messages.appendChild(botMsg);
                        messages.scrollTop = messages.scrollHeight;
                        
                        if (result.action === 'trigger_assignment') {
                            control.showToast('🎯 Triggering task assignment...');
                            fetch(`${control.apiBase}/api/chat/assign-all`, { method: 'POST' });
                        }
                    }
                } catch (e) {
                    console.error('Chat API error:', e);
                    const existingTyping = document.getElementById('nl-typing-dash');
                    if (existingTyping) existingTyping.remove();
                }
            };
        }
        
        console.log('[NL Chat] Natural language handlers initialized');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatHandlers);
    } else {
        initChatHandlers();
    }
})();
