document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const modal = document.getElementById('messageModal');
    const closeModal = document.querySelector('.close-modal');
    const markInProgressBtn = document.getElementById('markInProgress');
    const markResolvedBtn = document.getElementById('markResolved');
    const deleteMessageBtn = document.getElementById('deleteMessage');
    
    let currentMessageId = null;
    
    // Initialize SortableJS for drag and drop
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(column => {
        new Sortable(column.querySelector('.kanban-items'), {
            group: 'kanban',
            animation: 150,
            onEnd: async (evt) => {
                const messageId = evt.item.dataset.id;
                const newStatus = evt.to.closest('.kanban-column').dataset.status;
                
                try {
                    await updateMessageStatus(messageId, newStatus);
                    updateStats();
                } catch (error) {
                    console.error('Error updating message status:', error);
                    // Revert the UI on error
                    loadMessages();
                }
            }
        });
    });
    
    // Event Listeners
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    markInProgressBtn.addEventListener('click', () => updateStatusAndClose('in-progress'));
    markResolvedBtn.addEventListener('click', () => updateStatusAndClose('resolved'));
    
    deleteMessageBtn.addEventListener('click', async () => {
        if (!currentMessageId) return;
        
        if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
            try {
                await deleteMessage(currentMessageId);
                modal.style.display = 'none';
                loadMessages();
            } catch (error) {
                console.error('Error deleting message:', error);
                alert('Erro ao excluir a mensagem. Tente novamente.');
            }
        }
    });
    
    // Initial load
    loadMessages();
    
    // Functions
    async function loadMessages() {
        try {
            const response = await fetch('/api/contacts');
            const { data: messages } = await response.json();
            
            // Clear all columns
            document.querySelectorAll('.kanban-items').forEach(column => {
                column.innerHTML = '';
            });
            
            // Sort messages by date (newest first)
            messages.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Add messages to their respective columns
            messages.forEach(message => {
                const status = message.status || 'unread';
                const columnId = `${status}-column`; // Matches the HTML IDs: unread-column, in-progress-column, resolved-column
                const column = document.getElementById(columnId);
                
                if (column) {
                    const messageElement = createMessageElement(message);
                    column.appendChild(messageElement);
                } else {
                    console.warn(`Column not found for status: ${status} (tried ID: ${columnId})`);
                }
            });
            
            updateStats(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    function createMessageElement(message) {
        const messageDate = new Date(message.date);
        const formattedDate = messageDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const messageEl = document.createElement('div');
        messageEl.className = 'kanban-item';
        messageEl.dataset.id = message.id;
        messageEl.innerHTML = `
            <h4>${message.subject}</h4>
            <p>${message.name} &lt;${message.email}&gt;</p>
            <p>${message.message.substring(0, 60)}${message.message.length > 60 ? '...' : ''}</p>
            <div class="meta">
                <span>${formattedDate}</span>
            </div>
        `;
        
        messageEl.addEventListener('click', () => showMessageDetails(message));
        return messageEl;
    }
    
    function showMessageDetails(message) {
        currentMessageId = message.id;
        
        const messageDate = new Date(message.date);
        const formattedDate = messageDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        document.getElementById('detail-name').textContent = message.name;
        document.getElementById('detail-email').textContent = ` <${message.email}>`;
        document.getElementById('detail-date').textContent = formattedDate;
        document.getElementById('detail-subject').textContent = message.subject;
        document.getElementById('detail-message').textContent = message.message;
        
        // Update action buttons based on current status
        const status = message.status || 'unread';
        
        // Show mark as in progress button if message is unread or resolved
        markInProgressBtn.style.display = (status === 'unread' || status === 'resolved') ? 'block' : 'none';
        
        // Show mark as resolved button if message is unread or in progress
        markResolvedBtn.style.display = (status === 'unread' || status === 'in-progress') ? 'block' : 'none';
        
        modal.style.display = 'block';
    }
    
    async function updateStatusAndClose(newStatus) {
        if (!currentMessageId) return;
        
        try {
            modal.style.display = 'none';
            await updateMessageStatus(currentMessageId, newStatus);
            // Note: loadMessages() is now called inside updateMessageStatus
        } catch (error) {
            console.error('Error updating message status:', error);
            alert('Erro ao atualizar o status da mensagem. Tente novamente.');
            // Reload messages to restore consistent state
            loadMessages();
        }
    }
    
    async function updateMessageStatus(messageId, status) {
        try {
            const response = await fetch(`/api/contacts/${messageId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to update message status');
            }
            
            // Force a complete refresh of the messages to ensure consistency
            await loadMessages();
            return result;
        } catch (error) {
            console.error('Error in updateMessageStatus:', error);
            throw error; // Re-throw to be caught by the calling function
        }
    }
    
    async function deleteMessage(messageId) {
        const response = await fetch(`/api/contacts/${messageId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete message');
        }
        
        return response.json();
    }
    
    function updateStats(messages) {
        if (!messages) {
            // If messages not provided, fetch them
            fetch('/api/contacts')
                .then(response => response.json())
                .then(({ data }) => updateStats(data))
                .catch(console.error);
            return;
        }
        
        const stats = {
            total: messages.length,
            unread: messages.filter(m => !m.status || m.status === 'unread').length,
            inProgress: messages.filter(m => m.status === 'in-progress').length,
            resolved: messages.filter(m => m.status === 'resolved').length
        };
        
        document.getElementById('totalMessages').textContent = stats.total;
        document.getElementById('unreadCount').textContent = stats.unread;
        document.getElementById('inProgressCount').textContent = stats.inProgress;
        document.getElementById('resolvedCount').textContent = stats.resolved;
    }
    
    // Update stats every 30 seconds
    setInterval(updateStats, 30000);
});
