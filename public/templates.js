// No Socket.IO connection needed - using HTTP API calls only

// DOM elements
const statusMessage = document.getElementById('status-message');
const templateList = document.getElementById('template-list');
const templateIdInput = document.getElementById('template-id');
const templateNameInput = document.getElementById('template-name');
const templateContentInput = document.getElementById('template-content');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');

// File upload elements
const fileInput = document.getElementById('file-input');
const uploadZone = document.getElementById('upload-zone');
const filePreviewContainer = document.getElementById('file-preview-container');
const filePreviewList = document.getElementById('file-preview-list');
const fileCountSpan = document.getElementById('file-count');
const clearAllFilesBtn = document.getElementById('clear-all-files');

// State
let templates = [];
let isLoading = false;
let uploadedFiles = [];
let fileCounter = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    setupEventListeners();
    fetchTemplates();
});

function setupEventListeners() {
    saveBtn.addEventListener('click', saveTemplate);
    clearBtn.addEventListener('click', clearForm);

    // File upload event listeners
    fileInput.addEventListener('change', handleFileSelect);
    uploadZone.addEventListener('click', () => fileInput.click());
    clearAllFilesBtn.addEventListener('click', clearAllFiles);

    // Drag and drop events
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleFileDrop);

    // No Socket.IO event listeners needed - using HTTP API calls only

    // Form validation
    templateNameInput.addEventListener('input', validateForm);
    templateContentInput.addEventListener('input', validateForm);
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

async function fetchTemplates() {
    if (isLoading) return;
    
    isLoading = true;
    showStatus('Đang tải danh sách mẫu tin nhắn...', 'info', true);
    
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        
        if (data.success) {
            templates = data.templates || [];
            renderTemplates(templates);
            
            if (templates.length === 0) {
                showStatus('Chưa có mẫu tin nhắn nào', 'info');
            } else {
                showStatus(`Đã tải ${templates.length} mẫu tin nhắn`, 'success');
            }
        } else {
            showStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Error fetching templates:', error);
        showStatus('Lỗi khi tải danh sách mẫu tin nhắn', 'error');
    } finally {
        isLoading = false;
    }
}

async function saveTemplate() {
    const id = templateIdInput.value;
    const displayName = templateNameInput.value.trim();
    const content = templateContentInput.value.trim();

    if (!displayName || !content) {
        showStatus('Vui lòng nhập tên và nội dung mẫu tin nhắn', 'error');
        return;
    }

    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading"></span> Đang lưu...';

    try {
        // First upload files if any
        let attachments = [];
        if (uploadedFiles.length > 0) {
            showStatus('Đang tải lên tệp đính kèm...', 'info', true);
            attachments = await uploadFiles();
        }

        const url = id ? `/api/templates/${id}` : '/api/templates';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName, content, attachments }),
        });

        const data = await response.json();

        if (data.success) {
            showStatus(
                id ? 'Cập nhật mẫu tin nhắn thành công' : 'Tạo mẫu tin nhắn thành công',
                'success'
            );
            clearForm();
            fetchTemplates(); // Refresh the list
        } else {
            showStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showStatus(`Lỗi: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

function clearForm() {
    templateIdInput.value = '';
    templateNameInput.value = '';
    templateContentInput.value = '';
    clearAllFiles();
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Lưu';
    validateForm();
    showStatus('Đã xóa form', 'info');
}

function validateForm() {
    const hasName = templateNameInput.value.trim().length > 0;
    const hasContent = templateContentInput.value.trim().length > 0;
    saveBtn.disabled = !(hasName && hasContent);
}

function editTemplate(id, displayName, content, attachments = []) {
    templateIdInput.value = id;
    templateNameInput.value = displayName;
    templateContentInput.value = content;

    // Clear current files and load attachments
    clearAllFiles();
    if (attachments && attachments.length > 0) {
        loadAttachmentsForEdit(attachments);
    }

    saveBtn.innerHTML = '<i class="fas fa-edit"></i> Cập nhật';
    validateForm();
    showStatus('Đang chỉnh sửa mẫu tin nhắn', 'info');

    // Scroll to form
    document.querySelector('.form-container').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function loadAttachmentsForEdit(attachments) {
    attachments.forEach(attachment => {
        const fileData = {
            id: ++fileCounter,
            name: attachment.originalName,
            size: attachment.size,
            type: getFileTypeFromMime(attachment.mimetype),
            url: attachment.path,
            isExisting: true // Mark as existing file
        };

        uploadedFiles.push(fileData);
        addFilePreviewForExisting(fileData);
    });

    updateFileCounter();
    if (uploadedFiles.length > 0) {
        filePreviewContainer.style.display = 'block';
    }
}

function addFilePreviewForExisting(fileData) {
    const previewItem = document.createElement('div');
    previewItem.className = 'file-preview-item';
    previewItem.dataset.fileId = fileData.id;

    const thumbnail = createFileThumbnailForExisting(fileData);
    const fileInfo = createFileInfo(fileData);
    const fileActions = createFileActions(fileData.id);

    previewItem.appendChild(thumbnail);
    previewItem.appendChild(fileInfo);
    previewItem.appendChild(fileActions);

    filePreviewList.appendChild(previewItem);
}

function createFileThumbnailForExisting(fileData) {
    const thumbnail = document.createElement('div');
    thumbnail.className = `file-thumbnail ${fileData.type}`;

    if (fileData.type === 'image' && fileData.url) {
        const img = document.createElement('img');
        img.src = fileData.url;
        thumbnail.appendChild(img);
    } else {
        const icon = document.createElement('i');
        icon.className = getFileIcon(fileData.type);
        thumbnail.appendChild(icon);
    }

    return thumbnail;
}

function getFileTypeFromMime(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'unknown';
}

function renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';

    const attachmentIcons = attachments.map(att => {
        const type = getFileTypeFromMime(att.mimetype);
        const icon = getFileIcon(type);
        return `<i class="${icon}" title="${att.originalName}"></i>`;
    }).join(' ');

    return `<div class="template-attachments">
        <small><i class="fas fa-paperclip"></i> ${attachments.length} tệp đính kèm: ${attachmentIcons}</small>
    </div>`;
}

async function deleteTemplate(id) {
    if (!confirm('Bạn có chắc muốn xóa mẫu tin nhắn này?')) return;
    
    try {
        showStatus('Đang xóa mẫu tin nhắn...', 'info', true);
        
        const response = await fetch(`/api/templates/${id}`, {
            method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus('Xóa mẫu tin nhắn thành công', 'success');
            fetchTemplates(); // Refresh the list
        } else {
            showStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        showStatus(`Lỗi khi xóa mẫu: ${error.message}`, 'error');
    }
}

function renderTemplates(templates) {
    const emptyState = document.getElementById('empty-state');
    
    templateList.innerHTML = '';
    
    if (templates.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        } else {
            templateList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <h3>Chưa có mẫu tin nhắn nào</h3>
                    <p>Hãy tạo mẫu tin nhắn đầu tiên của bạn</p>
                </div>
            `;
        }
        return;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    templates.forEach((template) => {
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';

        const truncatedContent = template.content.length > 100
            ? template.content.substring(0, 100) + '...'
            : template.content;

        const attachmentsHtml = renderAttachments(template.attachments || []);

        templateItem.innerHTML = `
            <div class="template-header">
                <div class="template-info">
                    <div class="template-name">${escapeHtml(template.displayName)}</div>
                    <div class="template-content">${escapeHtml(truncatedContent)}</div>
                    ${attachmentsHtml}
                    <div class="template-id">ID: ${template.id}</div>
                </div>
                <div class="template-actions">
                    <button class="btn btn-secondary btn-small" onclick="editTemplate('${template.id}', '${escapeHtml(template.displayName)}', '${escapeHtml(template.content)}', ${JSON.stringify(template.attachments || []).replace(/"/g, '&quot;')})">
                        <i class="fas fa-edit"></i> Sửa
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteTemplate('${template.id}')">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        `;

        templateList.appendChild(templateItem);
    });
}

// Socket event handlers removed - using HTTP API calls only

function showStatus(message, type = 'info', showLoading = false) {
    if (showLoading) {
        statusMessage.innerHTML = `<span class="loading"></span> ${message}`;
    } else {
        statusMessage.textContent = message;
    }
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    // Auto hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// File Upload Functions
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    processFiles(files);
    event.target.value = ''; // Reset input
}

function handleDragOver(event) {
    event.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragover');

    const files = Array.from(event.dataTransfer.files);
    processFiles(files);
}

function processFiles(files) {
    const validFiles = [];
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['image/', 'video/', 'audio/'];

    files.forEach(file => {
        // Check file type
        const isValidType = allowedTypes.some(type => file.type.startsWith(type));
        if (!isValidType) {
            showStatus(`Loại tệp không được hỗ trợ: ${file.name}`, 'error');
            return;
        }

        // Check file size
        if (file.size > maxSize) {
            showStatus(`Tệp quá lớn (tối đa 100MB): ${file.name}`, 'error');
            return;
        }

        // Check if file already exists
        const existingFile = uploadedFiles.find(f => f.name === file.name && f.size === file.size);
        if (existingFile) {
            showStatus(`Tệp đã tồn tại: ${file.name}`, 'error');
            return;
        }

        validFiles.push(file);
    });

    if (validFiles.length > 0) {
        validFiles.forEach(file => {
            const fileData = {
                id: ++fileCounter,
                file: file,
                name: file.name,
                size: file.size,
                type: getFileType(file.type),
                url: null // Will be set after upload
            };

            uploadedFiles.push(fileData);
            addFilePreview(fileData);
        });

        updateFileCounter();
        showStatus(`Đã thêm ${validFiles.length} tệp`, 'success');
    }
}

function getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'unknown';
}

function addFilePreview(fileData) {
    const previewItem = document.createElement('div');
    previewItem.className = 'file-preview-item';
    previewItem.dataset.fileId = fileData.id;

    const thumbnail = createFileThumbnail(fileData);
    const fileInfo = createFileInfo(fileData);
    const fileActions = createFileActions(fileData.id);

    previewItem.appendChild(thumbnail);
    previewItem.appendChild(fileInfo);
    previewItem.appendChild(fileActions);

    filePreviewList.appendChild(previewItem);
    filePreviewContainer.style.display = 'block';
}

function createFileThumbnail(fileData) {
    const thumbnail = document.createElement('div');
    thumbnail.className = `file-thumbnail ${fileData.type}`;

    if (fileData.type === 'image') {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(fileData.file);
        img.onload = () => URL.revokeObjectURL(img.src);
        thumbnail.appendChild(img);
    } else {
        const icon = document.createElement('i');
        icon.className = getFileIcon(fileData.type);
        thumbnail.appendChild(icon);
    }

    return thumbnail;
}

function createFileInfo(fileData) {
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';

    fileInfo.innerHTML = `
        <div class="file-name">${escapeHtml(fileData.name)}</div>
        <div class="file-details">
            <span class="file-size">${formatFileSize(fileData.size)}</span>
            <span class="file-type">${fileData.type}</span>
        </div>
    `;

    return fileInfo;
}

function createFileActions(fileId) {
    const actions = document.createElement('div');
    actions.className = 'file-actions';

    actions.innerHTML = `
        <button type="button" class="btn-file-action btn-remove" onclick="removeFile(${fileId})">
            <i class="fas fa-trash"></i>
        </button>
    `;

    return actions;
}

function getFileIcon(type) {
    const icons = {
        image: 'fas fa-image',
        video: 'fas fa-video',
        audio: 'fas fa-music'
    };
    return icons[type] || 'fas fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(fileId) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
    const previewItem = document.querySelector(`[data-file-id="${fileId}"]`);
    if (previewItem) {
        previewItem.remove();
    }

    updateFileCounter();

    if (uploadedFiles.length === 0) {
        filePreviewContainer.style.display = 'none';
    }

    showStatus('Đã xóa tệp', 'info');
}

function clearAllFiles() {
    uploadedFiles = [];
    filePreviewList.innerHTML = '';
    filePreviewContainer.style.display = 'none';
    updateFileCounter();
}

function updateFileCounter() {
    fileCountSpan.textContent = uploadedFiles.length;
}

async function uploadFiles() {
    if (uploadedFiles.length === 0) return [];

    const attachments = [];
    const newFiles = uploadedFiles.filter(f => !f.isExisting);
    const existingFiles = uploadedFiles.filter(f => f.isExisting);

    // Add existing files to attachments
    existingFiles.forEach(fileData => {
        attachments.push({
            originalName: fileData.name,
            filename: fileData.url.split('/').pop(),
            path: fileData.url,
            size: fileData.size,
            mimetype: getMimeTypeFromExtension(fileData.name)
        });
    });

    // Upload new files
    if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach(fileData => {
            formData.append('files', fileData.file);
        });

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                attachments.push(...data.files);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Upload error:', error);
            throw new Error(`Lỗi tải lên tệp: ${error.message}`);
        }
    }

    return attachments;
}

function getMimeTypeFromExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        // Images
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        // Videos
        'mp4': 'video/mp4',
        'avi': 'video/avi',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        // Audio
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// Make functions global for onclick handlers
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.removeFile = removeFile;
