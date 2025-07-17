// No Socket.IO connection needed - using HTTP API calls only

// DOM elements
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const sendTemplateBtn = document.getElementById('send-template-btn');
const statusMessage = document.getElementById('status-message');
const entityList = document.getElementById('entity-list');
const filterInput = document.getElementById('filter-input');
const templateSelect = document.getElementById('template-select');

// State
let entities = [];
let filteredEntities = [];
let searchTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    setupEventListeners();
    loadChats();
    loadTemplates();
});

function setupEventListeners() {
    refreshBtn.addEventListener('click', refreshChats);
    logoutBtn.addEventListener('click', logout);

    // Template functionality
    templateSelect.addEventListener('change', updateSendButtonState);

    sendTemplateBtn.addEventListener('click', sendTemplate);

    // Search functionality with debounce
    filterInput.addEventListener('input', handleSearch);

    // No Socket.IO event listeners needed - using HTTP API calls only
}

async function checkLoginStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.status !== 'success') {
            // Redirect to login page if not logged in
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        window.location.href = '/';
    }
}

async function loadChats() {
    showStatus('Đang tải danh sách chat...', 'info', true);

    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        console.log('Chats loaded:', data);
        entities = data.chats || [];
        filteredEntities = entities;
        renderEntities(filteredEntities);

        if (entities.length === 0) {
            showStatus('Không có đoạn chat nào', 'info');
        } else {
            showStatus(`Đã tải ${entities.length} chats (groups và friends)`, 'success');
        }

    } catch (error) {
        console.error('Error loading chats:', error);
        showStatus('Lỗi khi tải danh sách chat', 'error');
    }
}

async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        handleTemplatesUpdate(data);
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

async function refreshChats() {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="loading"></span> Đang làm mới...';
    showStatus('Đang làm mới danh sách...', 'info', true);

    try {
        // Call refresh API first
        const refreshResponse = await fetch('/api/chats/refresh', { method: 'POST' });
        const refreshData = await refreshResponse.json();

        if (refreshData.success) {
            // Then reload the page data
            await loadChats();
            await loadTemplates();
            showStatus('Đã làm mới danh sách thành công', 'success');
        } else {
            showStatus('Lỗi khi làm mới: ' + refreshData.message, 'error');
        }
    } catch (error) {
        console.error('Error refreshing chats:', error);
        showStatus('Lỗi khi làm mới danh sách', 'error');
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Làm mới';
    }
}

async function logout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showStatus('Đăng xuất thành công', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showStatus('Lỗi đăng xuất: ' + data.message, 'error');
        }
    } catch (error) {
        showStatus('Lỗi đăng xuất: ' + error.message, 'error');
    }
}

function handleChatsUpdate(data) {
    console.log('Chats update:', data);
    entities = data.chats || [];

    // If there's an active search, re-perform it, otherwise show all entities
    const currentSearch = filterInput.value.trim();
    if (currentSearch) {
        performSearch();
    } else {
        filteredEntities = entities;
        renderEntities(filteredEntities);

        if (entities.length === 0) {
            showStatus('Không có đoạn chat nào', 'info');
        } else {
            showStatus(`Đã tải ${entities.length} chats (groups và friends)`, 'success');
        }
    }
}

function handleTemplatesUpdate(data) {
    templateSelect.innerHTML = '<option value="">Chọn mẫu tin nhắn</option>';
    const templates = data.templates || [];
    templates.forEach((template) => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.displayName;
        templateSelect.appendChild(option);
    });
}

// Socket event handlers removed - using HTTP API calls only

// Search functionality
function handleSearch() {
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Debounce search to avoid too many API calls
    searchTimeout = setTimeout(() => {
        performSearch();
    }, 300);
}

async function performSearch() {
    const query = filterInput.value.trim();

    try {
        showStatus('Đang tìm kiếm...', 'info', true);

        let url = '/api/chats';
        if (query) {
            url += `?search=${encodeURIComponent(query)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        filteredEntities = data.chats || [];
        renderEntities(filteredEntities);

        if (query) {
            if (filteredEntities.length === 0) {
                showStatus(`Không tìm thấy kết quả cho "${query}"`, 'info');
            } else {
                showStatus(`Tìm thấy ${filteredEntities.length} kết quả cho "${query}"`, 'success');
            }
        } else {
            entities = filteredEntities; // Update main entities list when no search
            if (filteredEntities.length === 0) {
                showStatus('Không có đoạn chat nào', 'info');
            } else {
                showStatus(`Đã tải ${filteredEntities.length} chats (groups và friends)`, 'success');
            }
        }

    } catch (error) {
        console.error('Error searching chats:', error);
        showStatus('Lỗi khi tìm kiếm', 'error');
    }
}

function applySearch() {
    const query = filterInput.value.toLowerCase().trim();

    if (query === '') {
        filteredEntities = entities;
    } else {
        filteredEntities = entities.filter((entity) => {
            const name = (entity.name || entity.displayName || '').toLowerCase();
            return name.includes(query);
        });
    }

    renderEntities(filteredEntities);
}

function renderEntities(entities) {
    const emptyState = document.getElementById('empty-state');

    entityList.innerHTML = '';

    if (entities.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    entities.forEach((entity) => {
        const entityItem = document.createElement('div');
        entityItem.className = 'entity-item';

        const entityName = entity.name || entity.displayName || 'Không có tên';
        const entityType = entity.type === 'group' ? 'Nhóm' : 'Bạn bè';
        const avatarSrc = entity.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(entityName)}&background=667eea&color=fff&size=50`;

        entityItem.innerHTML = `
            <input type="checkbox" class="chat-checkbox" value="${entity.id}">
            <img src="${avatarSrc}" alt="${entityName}'s avatar" class="entity-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(entityName)}&background=667eea&color=fff&size=50'">
            <div class="entity-info">
                <div class="entity-name">${escapeHtml(entityName)}</div>
                <div class="entity-type">
                    <span class="type-badge ${entity.type}">${entityType}</span>
                </div>
                <div class="entity-id">ID: ${entity.id}</div>
            </div>
        `;

        // Add event listeners for selection
        const checkbox = entityItem.querySelector('.chat-checkbox');
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                entityItem.classList.add('selected');
            } else {
                entityItem.classList.remove('selected');
            }
            updateSendButtonState();
        });

        // Allow clicking on the item to toggle checkbox
        entityItem.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        entityList.appendChild(entityItem);
    });
}

// Template sending functionality
async function sendTemplate() {
    const selectedChatIds = Array.from(
        document.querySelectorAll('.chat-checkbox:checked')
    ).map((checkbox) => checkbox.value);
    const templateId = templateSelect.value;

    if (!templateId) {
        showStatus('Vui lòng chọn một mẫu tin nhắn', 'error');
        return;
    }
    if (selectedChatIds.length === 0) {
        showStatus('Vui lòng chọn ít nhất một đoạn chat', 'error');
        return;
    }

    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatIds: selectedChatIds, templateId }),
        });
        const data = await response.json();
        if (data.success) {
            showStatus('Gửi tin nhắn thành công', 'success');
        } else {
            showStatus(data.message, 'error');
        }
    } catch (error) {
        showStatus(`Lỗi khi gửi tin nhắn: ${error.message}`, 'error');
    }
}

function showStatus(message, type = 'info', showLoading = false) {
    if (showLoading) {
        statusMessage.innerHTML = `<span class="loading"></span> ${message}`;
    } else {
        statusMessage.textContent = message;
    }
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
}

function hideStatus() {
    statusMessage.style.display = 'none';
}

function updateSendButtonState() {
    const selectedChats = document.querySelectorAll('.chat-checkbox:checked');
    const hasTemplate = templateSelect.value;
    sendTemplateBtn.disabled = !(selectedChats.length > 0 && hasTemplate);

    // Update button text with count
    if (selectedChats.length > 0) {
        sendTemplateBtn.innerHTML = `<i class="fas fa-paper-plane"></i> Gửi Template (${selectedChats.length})`;
    } else {
        sendTemplateBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Template';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
