import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs/promises';
import { Zalo } from 'zca-js';
import { v4 as uuidv4 } from 'uuid';
import { ThreadType } from 'zca-js';
import multer from 'multer';


const QR_LOGIN_TIMEOUT = 30000; // 30 giây timeout cho loginWithQR
const QR_PROCESS_DELAY = 500; // 0.1 giây trì hoãn để tiếp tục xử lý
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const CORS_ORIGINS = ['http://localhost:3001'];
const PROCESS_GROUPS_INDIVIDUALLY = true;
const FILE_PATHS = {
  authFile: 'auth.json',
  qrFile: 'qr.png',
  publicDir: 'public',
  templateFile: 'templates.json',
  uploadsDir: 'uploads',
  failedMessagesFile: 'failed.json'
};
const API_ENDPOINTS = {
  status: '/api/status',
  qr: '/api/qr',
  chats: '/api/chats',
  refreshChats: '/api/chats/refresh',
  logout: '/api/logout',
  qrImage: '/qr.png',
  templates: '/api/templates',
  sendMessage: '/api/send-message',
  upload: '/api/upload',
  failedMessages: '/api/failed-messages'
};

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST']
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, FILE_PATHS.uploadsDir);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/', 'audio/'];
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Loại tệp không được hỗ trợ'));
    }
  }
});

// Middleware
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());
app.use(express.static(path.join(__dirname, FILE_PATHS.publicDir)));
app.use('/uploads', express.static(path.join(__dirname, FILE_PATHS.uploadsDir)));

// Session store
const session = {
  zaloApi: null,
  loginStatus: 'waiting',
  qrSessionId: null,
  chatList: []
};

// Zalo API utility functions
const zaloUtils = {
  async loginWithQR() {
    const zalo = new Zalo();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: Không nhận được phản hồi từ Zalo server')), QR_LOGIN_TIMEOUT);
    });
    return await Promise.race([zalo.loginQR(), timeoutPromise]);
  },
  async loginWithCookie(cookie, imei, agent) {
    const zalo = new Zalo();
    return await zalo.login({ cookie:cookie.cookies, imei:imei, userAgent:agent });
  },
  async getAllFriends(zaloApi) {
    return (await zaloApi.getAllFriends()) || [];
  },
  async getAllGroups(zaloApi) {
    return (await zaloApi.getAllGroups()) || [];
  },
  async getGroupInfo(zaloApi, groupIds) {
    return await zaloApi.getGroupInfo(groupIds);
  },
  async getContext(zaloApi) {
    return await zaloApi.getContext();
  },
  async sendMessage(zaloApi, content, chatId, chatType) {
    return await zaloApi.sendMessage(content, chatId, chatType);
  },
  stopListener(zaloApi) {
    try {
      if (zaloApi?.listener?.stop) {
        zaloApi.listener.stop();
        console.log('Stopped existing Zalo listener');
      }
    } catch (error) {
      console.warn('Error stopping Zalo listener:', error.message);
    }
  }
};

// Simple ChatEntity factory
const ChatEntityFactory = {
  createFromFriend(friend) {
    return {
      id: friend.userId || friend.id,
      name: friend.displayName || friend.zaloName || 'Unknown Friend',
      type: ThreadType.User,
      avatar: friend.avatar || '',
      timestamp: friend.timestamp || Date.now()
    };
  },
  createFromGroup(group) {
    return {
      id: group.groupId || group.id,
      name: group.name || 'Unknown Group',
      type: ThreadType.Group,
      avatar: group.avt || group.fullAvt || '',
      memberCount: group.totalMember || 0,
      timestamp: group.timestamp || Date.now()
    };
  }
};

// Simple template manager
const templateManager = {
  async getAllTemplates() {
    try {
      const data = await fs.readFile(FILE_PATHS.templateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('No templates file found, returning empty array');
      return [];
    }
  },
  async getTemplateById(id) {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === id);
  },
  async createTemplate(displayName, content, attachments = []) {
    const templates = await this.getAllTemplates();
    const newTemplate = {
      id: uuidv4(),
      displayName,
      content,
      attachments,
      createdAt: new Date().toISOString()
    };
    templates.push(newTemplate);
    await fs.writeFile(FILE_PATHS.templateFile, JSON.stringify(templates, null, 2));
    return newTemplate;
  },
  async updateTemplate(id, displayName, content, attachments = []) {
    const templates = await this.getAllTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) return null;
    templates[index] = {
      id,
      displayName,
      content,
      attachments,
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(FILE_PATHS.templateFile, JSON.stringify(templates, null, 2));
    return templates[index];
  },
  async deleteTemplate(id) {
    const templates = await this.getAllTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) return false;
    templates.splice(index, 1);
    await fs.writeFile(FILE_PATHS.templateFile, JSON.stringify(templates, null, 2));
    return true;
  }
};

// Failed message manager
const failedMessageManager = {
  async getAllFailedMessages() {
    try {
      const data = await fs.readFile(FILE_PATHS.failedMessagesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('No failed messages file found, returning empty array');
      return [];
    }
  },
  async addFailedMessage(chatId, chatName, templateId, templateName) {
    const failedMessages = await this.getAllFailedMessages();
    const newFailedMessage = {
      id: uuidv4(),
      chatId,
      chatName,
      templateId,
      templateName,
      timestamp: new Date().toISOString()
    };
    failedMessages.push(newFailedMessage);
    await fs.writeFile(FILE_PATHS.failedMessagesFile, JSON.stringify(failedMessages, null, 2));
    return newFailedMessage;
  },
  async removeFailedMessage(id) {
    const failedMessages = await this.getAllFailedMessages();
    const index = failedMessages.findIndex(msg => msg.id === id);
    if (index === -1) return false;
    failedMessages.splice(index, 1);
    await fs.writeFile(FILE_PATHS.failedMessagesFile, JSON.stringify(failedMessages, null, 2));
    return true;
  },
  async getFailedMessageById(id) {
    const failedMessages = await this.getAllFailedMessages();
    return failedMessages.find(msg => msg.id === id);
  }
};

// File utilities
const fileUtils = {
  async checkAuth() {
    try {
      const authData = await fs.readFile(path.join(__dirname, FILE_PATHS.authFile), 'utf8');
      const { status, timestamp, cookie, imei, agent } = JSON.parse(authData);
      const sessionAge = Date.now() - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (status === 'success' && sessionAge < maxAge && cookie && imei && agent) {
        console.log('Valid session found in auth.json');
        try {
          if(session.zaloApi) return true;
          const zaloApi = await zaloUtils.loginWithCookie(cookie, imei, agent);
          session.zaloApi = zaloApi;
          session.loginStatus = 'success';
          return true;
        } catch (error) {
          console.warn('Failed to login with stored cookie:', error.message);
          await this.clearAuth();
          return false;
        }
      }
      await this.clearAuth();
      return false;
    } catch (error) {
      console.warn('Error checking auth.json:', error.message);
      return false;
    }
  },
  async clearAuth() {
    try {
      await fs.unlink(path.join(__dirname, FILE_PATHS.authFile));
      console.log('Cleared auth.json');
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Error clearing auth.json:', error.message);
    }
  },
  async clearQR() {
    try {
      await fs.unlink(path.join(__dirname, FILE_PATHS.qrFile));
      console.log('Cleared QR file');
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Error clearing QR file:', error.message);
    }
  },
  async saveAuth(zaloApi) {
    try {
      const context = await zaloUtils.getContext(zaloApi);
      const authData = {
        loginTime: new Date().toISOString(),
        status: 'success',
        timestamp: Date.now(),
        cookie: context.cookie || '',
        imei: context.imei || '',
        agent: context.userAgent || ''
      };
      await fs.writeFile(path.join(__dirname, FILE_PATHS.authFile), JSON.stringify(authData, null, 2));
      console.log('Saved auth.json with cookie, imei, and agent');
    } catch (error) {
      console.warn('Error saving auth.json:', error.message);
    }
  }
};

// Group processing utility
const groupUtils = {
  async processGroups(zaloApi, groupIds, logPrefix = '') {
    const groupEntities = [];
    if (PROCESS_GROUPS_INDIVIDUALLY) {
      console.log(`${logPrefix}Processing ${groupIds.length} groups individually...`);
      for (const groupId of groupIds) {
        try {
          console.log(`${logPrefix}Fetching info for group: ${groupId}`);
          const groupInfoResponse = await zaloUtils.getGroupInfo(zaloApi, [groupId]);
          const groupInfo = Object.values(groupInfoResponse.gridInfoMap)[0];
          if (groupInfo) {
            const groupEntity = ChatEntityFactory.createFromGroup(groupInfo);
            groupEntities.push(groupEntity);
            console.log(`${logPrefix}✓ Successfully processed group: ${groupInfo.name || groupId}`);
          } else {
            console.warn(`${logPrefix}⚠ No info returned for group: ${groupId}`);
          }
        } catch (error) {
          console.warn(`${logPrefix}✗ Failed to get info for group ${groupId}:`, error.message);
        }
      }
      console.log(`${logPrefix}Completed processing groups. Total: ${groupEntities.length}/${groupIds.length}`);
    } else {
      console.log(`${logPrefix}Processing ${groupIds.length} groups in batch...`);
      try {
        const groupInfoResponse = await zaloUtils.getGroupInfo(zaloApi, groupIds);
        const groups = Object.values(groupInfoResponse.gridInfoMap);
        groupEntities.push(...groups.map(group => ChatEntityFactory.createFromGroup(group)));
        console.log(`${logPrefix}✓ Successfully processed ${groupEntities.length} groups in batch`);
      } catch (error) {
        console.warn(`${logPrefix}✗ Failed to process groups in batch:`, error.message);
      }
    }
    return groupEntities;
  }
};

// Authentication middleware
app.use(async (req, res, next) => {
  const skipAuthPaths = ['/login', '/api/', '/qr.png', '/public/', '.css', '.js', '.html', '/templates'];
  const shouldSkipAuth = skipAuthPaths.some(path => req.path.startsWith(path) || req.path.includes(path));

  if (shouldSkipAuth) {
    return next();
  }

  const isAuthenticated = await fileUtils.checkAuth() && session.loginStatus === 'success';
  if (!isAuthenticated) {
    return res.redirect('/login');
  }

  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: `Server error: ${err.message}` });
});

// Function to generate QR code
async function generateQRCode() {
  try {
    // Hủy listener cũ nếu tồn tại
    if (session.zaloApi) {
      zaloUtils.stopListener(session.zaloApi);
    }

    session.loginStatus = 'waiting';
    session.chatList = [];
    session.zaloApi = null;
    session.qrSessionId = uuidv4();
    await fileUtils.clearQR();
    io.emit('status', { status: 'generating_qr', message: 'Đang tạo mã QR...' });

    // Gọi loginWithQR không chờ kết quả và tiếp tục sau 0.2 giây
    let zaloApi;
    // Gọi loginWithQR trong background, không await
    zaloUtils.loginWithQR().then(async result => {
      zaloApi = result;
      session.loginStatus = 'success';
      await fileUtils.saveAuth(zaloApi);
      io.emit('status', { status: 'success', message: 'Đăng nhập thành công! Đang chuyển hướng...', redirect: '/chats' });
    }).catch(error => {
      console.warn('loginWithQR failed:', error.message);
    });

    // Trì hoãn 0.1 giây để tiếp tục xử lý, không chờ listener
    await new Promise(resolve => setTimeout(resolve, QR_PROCESS_DELAY));

    // Thiết lập zaloApi nếu thành công, nếu không để null
    session.zaloApi = zaloApi || null;
    const qrUrl = `${API_ENDPOINTS.qrImage}?t=${Date.now()}`;
    io.emit('status', { status: 'waiting', message: 'Quét mã QR để đăng nhập', qrUrl, qrSessionId: session.qrSessionId });
    return { success: true, zaloApi, message: 'Đã tạo mã QR thành công', qrUrl, qrSessionId: session.qrSessionId };
  } catch (error) {
    console.error('Error generating QR:', error);
    session.loginStatus = 'error';
    session.qrSessionId = null;
    io.emit('status', { status: 'error', message: `Lỗi khi tạo QR: ${error.message}` });
    return { success: false, message: `Lỗi khi tạo QR: ${error.message}` };
  }
}

// Function to wait for login and process chats
async function waitForLogin(zaloApi, qrSessionId) {
  if (!zaloApi) {
    console.warn('No zaloApi provided to waitForLogin, skipping');
    return;
  }
  try {
    zaloApi.listener.start();
    zaloApi.listener.onConnected(async () => {
      if (session.qrSessionId !== qrSessionId) {
        console.warn('Received onConnected for outdated QR session, ignoring');
        return;
      }
      session.loginStatus = 'success';
      await fileUtils.saveAuth(zaloApi);
      io.emit('status', { status: 'success', message: 'Đăng nhập thành công! Đang chuyển hướng...', redirect: '/chats' });
      try {
        const friends = await zaloUtils.getAllFriends(zaloApi);
        const friendEntities = friends.map(friend => ChatEntityFactory.createFromFriend(friend));
        const groupsResponse = await zaloUtils.getAllGroups(zaloApi);
        const groupIds = Object.keys(groupsResponse.gridInfoMap);
        const groupEntities = await groupUtils.processGroups(zaloApi, groupIds, '[Login] ');
        session.chatList = [...friendEntities, ...groupEntities];
        console.log(`Loaded ${session.chatList.length} chats (friends and groups)`);
      } catch (error) {
        console.error('Error loading chats:', error);
        session.chatList = [];
        io.emit('status', { status: 'error', message: `Lỗi khi tải danh sách chat: ${error.message}` });
      }
    });
    zaloApi.listener.on('error', (error) => {
      console.error('Listener error:', error);
      if(session.qrSessionId === qrSessionId) {
        session.loginStatus = 'error';
        session.qrSessionId = null;
        io.emit('status', { status: 'error', message: `Lỗi đăng nhập: ${error.message}` });
      }
    });
  } catch (error) {
    console.error('Error in login listener:', error);
    if (session.qrSessionId === qrSessionId) {
      session.loginStatus = 'error';
      session.qrSessionId = null;
      io.emit('status', { status: 'error', message: `Lỗi khi thiết lập đăng nhập: ${error.message}` });
    }
  }
}

// Function to create QR code
async function createQRCode() {
  const qrResult = await generateQRCode();
  if (!qrResult.success) {
    return qrResult;
  }
  // Chạy waitForLogin trong nền, không chờ hoàn tất
  if (qrResult.zaloApi) {
    waitForLogin(qrResult.zaloApi, qrResult.qrSessionId).catch(error => {
      console.error('Error in background login process:', error);
      if (session.qrSessionId === qrResult.qrSessionId) {
        session.loginStatus = 'error';
        session.qrSessionId = null;
        io.emit('status', { status: 'error', message: `Lỗi trong quá trình đăng nhập: ${error.message}` });
      }
    });
  }
  return qrResult;
}
// Function to send a message to a single chat
async function sendZaloMessage(zaloApi, chat, content) {
  try {
    await zaloUtils.sendMessage(zaloApi, content, chat.id, chat.type);
    return { success: true };
  } catch (error) {
    console.error(`Error sending message to chat ${chat.id}:`, error);
    return { success: false, message: error.message };
  }
}

// Routes
app.get('/', async (req, res) => {
  try {
    const isAuthenticated = await fileUtils.checkAuth();
    console.log('Root route accessed. isAuthenticated:', isAuthenticated, 'loginStatus:', session.loginStatus);
    if (isAuthenticated && session.loginStatus === 'success') {
      console.log('Redirecting to /chats');
      return res.redirect('/chats');
    }
    console.log('Redirecting to /login');
    return res.redirect('/login');
  } catch (error) {
    console.error('Error in root route:', error.message);
    res.status(500).send('Server error');
  }
});
app.get('/login', async (req, res) => {
  res.sendFile(path.join(__dirname, FILE_PATHS.publicDir, 'login.html'));
});

app.get('/chats', (req, res) => {
  res.sendFile(path.join(__dirname, FILE_PATHS.publicDir, 'chats.html'));
});

app.get('/templates', (req, res) => {
  res.sendFile(path.join(__dirname, FILE_PATHS.publicDir, 'templates.html'));
});

app.get('/failed-messages', (req, res) => {
  res.sendFile(path.join(__dirname, FILE_PATHS.publicDir, 'failed-messages.html'));
});

app.get(API_ENDPOINTS.qrImage, async (req, res) => {
  const qrPath = path.join(__dirname, FILE_PATHS.qrFile);
  try {
    await fs.access(qrPath);
    res.sendFile(qrPath);
  } catch {
    res.status(404).send('QR code not found');
  }
});

// API endpoints
app.get(API_ENDPOINTS.status, async (req, res) => {
  res.json({
    status: session.loginStatus,
    hasQR: await fs.access(path.join(__dirname, FILE_PATHS.qrFile)).then(() => true).catch(() => false)
  });
});

app.get(API_ENDPOINTS.chats, (req, res) => {
  const { search } = req.query;
  let chats = session.chatList;
  if (search && search.trim()) {
    const searchTerm = search.toLowerCase().trim();
    chats = session.chatList.filter(chat => {
      const name = (chat.name || chat.displayName || '').toLowerCase();
      return name.includes(searchTerm);
    });
  }
  res.json({ chats });
});

app.post(API_ENDPOINTS.refreshChats, async (req, res) => {
  if (!(await fileUtils.checkAuth()) || session.loginStatus !== 'success') {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  if (!session.zaloApi) {
    return res.status(500).json({ success: false, message: 'Zalo API không khả dụng' });
  }

  try {
    const friends = await zaloUtils.getAllFriends(session.zaloApi);
    const friendEntities = friends.map(friend => ChatEntityFactory.createFromFriend(friend));
    const groupsResponse = await zaloUtils.getAllGroups(session.zaloApi);
    const groupIds = Object.keys(groupsResponse.gridVerMap);
    const groupEntities = await groupUtils.processGroups(session.zaloApi, groupIds, '[Refresh] ');
    session.chatList = [...friendEntities, ...groupEntities];
    console.log(`Refreshed ${session.chatList.length} chats (friends and groups)`);
    res.json({ success: true, message: 'Đã làm mới danh sách chat thành công' });
  } catch (error) {
    console.error('Error refreshing chats:', error);
    res.status(500).json({ success: false, message: 'Không thể tải lại danh sách chat' });
  }
});

app.post(API_ENDPOINTS.logout, async (req, res) => {
  session.loginStatus = 'waiting';
  session.chatList = [];
  session.zaloApi = null;
  await fileUtils.clearAuth();
  await fileUtils.clearQR();
  io.emit('status', { status: 'logged_out', message: 'Đã đăng xuất' });
  res.json({ success: true, message: 'Đăng xuất thành công' });
});

app.post(API_ENDPOINTS.qr, async (req, res) => {
  const { action } = req.body;
  if (session.loginStatus === 'success') {
    return res.status(400).json({ success: false, message: 'Đã đăng nhập rồi' });
  }
  const qrResult = await createQRCode();
  res.status(qrResult.success ? 200 : 500).json(qrResult);
});

// Template API endpoints
app.get(API_ENDPOINTS.templates, async (req, res) => {
  try {
    const templates = await templateManager.getAllTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error fetching templates: ${error.message}` });
  }
});

app.post(API_ENDPOINTS.templates, async (req, res) => {
  const { displayName, content, attachments } = req.body;
  if (!displayName || !content) {
    return res.status(400).json({ success: false, message: 'Missing displayName or content' });
  }
  try {
    const newTemplate = await templateManager.createTemplate(displayName, content, attachments || []);
    res.json({ success: true, template: newTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error creating template: ${error.message}` });
  }
});

app.put(`${API_ENDPOINTS.templates}/:id`, async (req, res) => {
  const { id } = req.params;
  const { displayName, content, attachments } = req.body;
  if (!displayName || !content) {
    return res.status(400).json({ success: false, message: 'Missing displayName or content' });
  }
  try {
    const updatedTemplate = await templateManager.updateTemplate(id, displayName, content, attachments || []);
    if (!updatedTemplate) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, template: updatedTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error updating template: ${error.message}` });
  }
});

app.delete(`${API_ENDPOINTS.templates}/:id`, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await templateManager.deleteTemplate(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error deleting template: ${error.message}` });
  }
});

app.post(API_ENDPOINTS.sendMessage, async (req, res) => {
  if (!(await fileUtils.checkAuth()) || session.loginStatus !== 'success') {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  if (!session.zaloApi) {
    return res.status(500).json({ success: false, message: 'Zalo API không khả dụng' });
  }
  const { chatIds, templateId } = req.body;
  if (!Array.isArray(chatIds) || chatIds.length === 0 || !templateId) {
    return res.status(400).json({ success: false, message: 'Thiếu chatIds hoặc templateId' });
  }
  try {
    const template = await templateManager.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu tin nhắn' });
    }
    const results = [];
    const zaloMessage = {
      msg: template.content,
      attachments: template.attachments.map(attachment => {
        return path.join(__dirname, attachment.path);
      })
    };
    for (const chatId of chatIds) {
      const chat = session.chatList.find(c => c.id === chatId);
      if (!chat) {
        results.push({ chatId, success: false, message: 'Không tìm thấy đoạn chat' });
        continue;
      }
      const result = await sendZaloMessage(session.zaloApi, chat, zaloMessage);
      results.push({ chatId, ...result });
      if (!result.success) {
        try {
          await failedMessageManager.addFailedMessage(
            chatId,
            chat.name || chat.displayName || 'Unknown',
            templateId,
            template.displayName
          );
        } catch (saveError) {
          console.error('Error saving failed message:', saveError);
        }
      }
    }
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      return res.status(500).json({
        success: false,
        message: `Gửi tin nhắn thất bại cho ${failed.length} đoạn chat`,
        results,
        failedCount: failed.length
      });
    }
    res.json({ success: true, message: 'Gửi tin nhắn thành công', results });
  } catch (error) {
    console.error('Error processing send message request:', error);
    res.status(500).json({ success: false, message: `Lỗi khi gửi tin nhắn: ${error.message}` });
  }
});

// File upload endpoint
app.post(API_ENDPOINTS.upload, upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên' });
    }
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString()
    }));
    res.json({
      success: true,
      files: uploadedFiles,
      message: `Đã tải lên ${uploadedFiles.length} tệp thành công`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: `Lỗi tải lên: ${error.message}` });
  }
});

// Failed messages API endpoints
app.get(API_ENDPOINTS.failedMessages, async (req, res) => {
  try {
    const failedMessages = await failedMessageManager.getAllFailedMessages();
    res.json({ success: true, failedMessages });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error fetching failed messages: ${error.message}` });
  }
});

app.delete(`${API_ENDPOINTS.failedMessages}/:id`, async (req, res) => {
  const { id } = req.params;
  try {
    const success = await failedMessageManager.removeFailedMessage(id);
    if (success) {
      res.json({ success: true, message: 'Đã xóa tin nhắn thất bại' });
    } else {
      res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn thất bại' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: `Error deleting failed message: ${error.message}` });
  }
});

// Socket.IO - Restricted to login functionality only
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('status', {
    status: session.loginStatus,
    hasQR: fs.access(path.join(__dirname, FILE_PATHS.qrFile)).then(() => true).catch(() => false)
  });
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});