// login.js
// Configuration
const API_ENDPOINTS = {
  status: '/api/status',
  createQr: '/api/qr',
  chats: '/api/chats',
  logout: '/api/logout',
  qrImage: '/qr.png'
};
const QR_REFRESH_INTERVAL = 120000; // 2 minutes

// Socket.io connection
const socket = io();

// DOM elements
const elements = {
  loginBtn: document.getElementById('login-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  statusMessage: document.getElementById('status-message'),
  qrContainer: document.getElementById('qr-container'),
  qrImage: document.getElementById('qr-image'),
  loadingSpinner: document.getElementById('loading-spinner')
};

// State
const state = {
  isLoggingIn: false
};

// UI Utility
const ui = {
  showLoading(show) {
    elements.loadingSpinner.style.display = show ? 'block' : 'none';
  },
  showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `text-center p-2 mb-4 rounded ${type === 'error' ? 'bg-red-100 text-red-700' : 
                                     type === 'success' ? 'bg-green-100 text-green-700' : 
                                     'bg-blue-100 text-blue-700'}`;
    elements.statusMessage.style.display = 'block';
  },
  showQRCode(qrUrl = `${API_ENDPOINTS.qrImage}?t=${Date.now()}`) {
    elements.qrImage.src = qrUrl;
    elements.qrContainer.style.display = 'block';
    elements.refreshBtn.style.display = 'inline-block';
    elements.loginBtn.style.display = 'none';
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkStatus();
  setupEventListeners();
});

function setupEventListeners() {
  elements.loginBtn.addEventListener('click', () => requestQR('create'));
  elements.refreshBtn.addEventListener('click', () => requestQR('refresh'));
  
  socket.on('status', handleStatusUpdate);
  socket.on('connect', () => console.log('Connected to server'));
  socket.on('disconnect', () => ui.showStatus('Mất kết nối với server', 'error'));
}

async function checkStatus() {
  try {
    const response = await fetch(API_ENDPOINTS.status);
    const data = await response.json();
    
    if (data.status === 'success') {
      window.location.href = '/chats';
    } else if (data.hasQR) {
      ui.showQRCode();
    }
  } catch (error) {
    console.error('Error checking status:', error);
    ui.showStatus('Lỗi kết nối', 'error');
  }
}

async function requestQR(action) {
  if (state.isLoggingIn) return;

  state.isLoggingIn = true;
  elements.loginBtn.disabled = action === 'create';
  elements.refreshBtn.disabled = action === 'refresh';
  ui.showLoading(true);
  ui.showStatus(action === 'create' ? 'Đang tạo mã QR...' : 'Đang làm mới mã QR...', 'info');

  try {
    const response = await fetch(API_ENDPOINTS.createQr, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    const data = await response.json();
    if (data.success) {
      ui.showStatus(data.message, 'success');
      ui.showQRCode(data.qrUrl); // Cập nhật mã QR với qrUrl từ server
    } else {
      throw new Error(data.message || `Không thể ${action === 'create' ? 'tạo' : 'làm mới'} QR`);
    }
  } catch (error) {
    console.error(`${action} QR error:`, error);
    ui.showStatus(`Lỗi ${action === 'create' ? 'tạo' : 'làm mới'} QR: ${error.message}`, 'error');
  } finally {
    state.isLoggingIn = false;
    elements.loginBtn.disabled = false;
    elements.refreshBtn.disabled = false;
    ui.showLoading(false);
  }
}

function handleStatusUpdate(data) {
  console.log('Status update:', data);

  switch (data.status) {
    case 'generating_qr':
      ui.showStatus(data.message, 'info');
      ui.showLoading(true);
      break;
    case 'waiting':
      ui.showQRCode(data.qrUrl); // Cập nhật mã QR khi server thông báo trạng thái waiting
      ui.showStatus('Quét mã QR để đăng nhập', 'info');
      ui.showLoading(false);
      state.isLoggingIn = false;
      break;
    case 'qr_refreshed':
      ui.showQRCode(data.qrUrl); // Cập nhật mã QR khi server thông báo làm mới
      ui.showStatus(data.message, 'success');
      ui.showLoading(false);
      state.isLoggingIn = false;
      break;
    case 'success':
      ui.showStatus(data.message, 'success');
      ui.showLoading(false);
      setTimeout(() => window.location.href = data.redirect || '/chats', data.redirect ? 1000 : 2000);
      break;
    case 'error':
      ui.showStatus(data.message, 'error');
      ui.showLoading(false);
      state.isLoggingIn = false;
      elements.loginBtn.disabled = false;
      break;
    case 'logged_out':
      ui.showStatus(data.message, 'info');
      ui.showLoading(false);
      elements.qrContainer.style.display = 'none';
      elements.refreshBtn.style.display = 'none';
      elements.loginBtn.style.display = 'inline-block';
      break;
  }
}

// Auto-refresh QR code
setInterval(() => {
  if (elements.qrContainer.style.display === 'block' && !state.isLoggingIn) {
    requestQR('refresh');
  }
}, QR_REFRESH_INTERVAL);