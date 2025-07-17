// No Socket.IO connection needed - using HTTP API calls only

// DOM elements
const refreshBtn = document.getElementById('refresh-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const statusMessage = document.getElementById('status-message');
const failedMessagesList = document.getElementById('failed-messages-list');
const emptyState = document.getElementById('empty-state');
const failedCount = document.getElementById('failed-count');

// Modal elements
const confirmationModal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

// State
let failedMessages = [];
let currentAction = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    setupEventListeners();
    loadFailedMessages();
});

// Event listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadFailedMessages);
    clearAllBtn.addEventListener('click', () => showConfirmation(
        'Xóa tất cả tin nhắn thất bại',
        'Bạn có chắc chắn muốn xóa tất cả tin nhắn thất bại? Hành động này không thể hoàn tác.',
        clearAllFailedMessages
    ));
    
    // Modal event listeners
    modalClose.addEventListener('click', hideConfirmation);
    modalCancel.addEventListener('click', hideConfirmation);
    modalConfirm.addEventListener('click', executeCurrentAction);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            hideConfirmation();
        }
    });
}

// Check login status
function checkLoginStatus() {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'success') {
                window.location.href = '/';
            }
        })
        .catch(error => {
            console.error('Error checking login status:', error);
            showStatus('Lỗi khi kiểm tra trạng thái đăng nhập', 'error');
        });
}

// Load failed messages
async function loadFailedMessages() {
    try {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
        
        const response = await fetch('/api/failed-messages');
        const data = await response.json();
        
        if (data.success) {
            failedMessages = data.failedMessages;
            renderFailedMessages();
            updateFailedCount();
        } else {
            showStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Error loading failed messages:', error);
        showStatus('Lỗi khi tải danh sách tin nhắn thất bại', 'error');
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Làm mới';
    }
}

// Render failed messages
function renderFailedMessages() {
    if (failedMessages.length === 0) {
        failedMessagesList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    failedMessagesList.style.display = 'block';
    emptyState.style.display = 'none';
    
    failedMessagesList.innerHTML = failedMessages.map(message => `
        <div class="failed-message-item" data-id="${message.id}">
            <div class="message-header">
                <div class="message-info">
                    <h3>${escapeHtml(message.chatName)}</h3>
                    <div class="message-meta">
                        <span><i class="fas fa-id-card"></i> Chat ID: ${escapeHtml(message.chatId)}</span>
                        <span><i class="fas fa-file-alt"></i> Template: ${escapeHtml(message.templateName)}</span>
                        <span><i class="fas fa-hashtag"></i> Template ID: ${escapeHtml(message.templateId)}</span>
                        <span><i class="fas fa-clock"></i> Thời gian: ${formatDate(message.timestamp)}</span>
                    </div>
                </div>
                <div class="message-actions">
                    <button class="btn btn-success retry-btn" data-id="${message.id}" data-chat-id="${message.chatId}" data-template-id="${message.templateId}">
                        <i class="fas fa-redo"></i> Gửi lại
                    </button>
                    <button class="btn btn-danger delete-btn" data-id="${message.id}">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add event listeners to buttons
    document.querySelectorAll('.retry-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const button = e.target.closest('.retry-btn');
            const messageId = button.dataset.id;
            const chatId = button.dataset.chatId;
            const templateId = button.dataset.templateId;
            retryMessage(messageId, chatId, templateId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const messageId = e.target.closest('.delete-btn').dataset.id;
            const message = failedMessages.find(m => m.id === messageId);
            showConfirmation(
                'Xóa tin nhắn thất bại',
                `Bạn có chắc chắn muốn xóa tin nhắn thất bại gửi đến "${message.chatName}"?`,
                () => deleteFailedMessage(messageId)
            );
        });
    });
}

// Retry message
async function retryMessage(messageId, chatId, templateId) {
    const btn = document.querySelector(`.retry-btn[data-id="${messageId}"]`);
    const originalContent = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatIds: [chatId],
                templateId: templateId
            })
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Gửi lại tin nhắn thành công', 'success');
            // Xóa tin nhắn khỏi danh sách thất bại vì đã gửi thành công
            await deleteFailedMessage(messageId);
        } else {
            showStatus(data.message || 'Gửi lại tin nhắn thất bại', 'error');
        }
    } catch (error) {
        console.error('Error retrying message:', error);
        showStatus('Lỗi khi gửi lại tin nhắn', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// Delete failed message
async function deleteFailedMessage(messageId) {
    try {
        const response = await fetch(`/api/failed-messages/${messageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus('Đã xóa tin nhắn thất bại', 'success');
            loadFailedMessages();
        } else {
            showStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting failed message:', error);
        showStatus('Lỗi khi xóa tin nhắn thất bại', 'error');
    }
}

// Clear all failed messages
async function clearAllFailedMessages() {
    try {
        const deletePromises = failedMessages.map(message => 
            fetch(`/api/failed-messages/${message.id}`, { method: 'DELETE' })
        );
        
        await Promise.all(deletePromises);
        showStatus('Đã xóa tất cả tin nhắn thất bại', 'success');
        loadFailedMessages();
    } catch (error) {
        console.error('Error clearing all failed messages:', error);
        showStatus('Lỗi khi xóa tất cả tin nhắn thất bại', 'error');
    }
}

// Update failed count
function updateFailedCount() {
    failedCount.textContent = failedMessages.length;
}

// Show confirmation modal
function showConfirmation(title, message, action) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    currentAction = action;
    confirmationModal.style.display = 'flex';
}

// Hide confirmation modal
function hideConfirmation() {
    confirmationModal.style.display = 'none';
    currentAction = null;
}

// Execute current action
function executeCurrentAction() {
    if (currentAction) {
        currentAction();
        hideConfirmation();
    }
}

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// No Socket.IO event listeners needed - using HTTP API calls only
