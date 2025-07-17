# Flow Đăng Nhập Zalo Web Interface

## 🔄 **Flow Mới (Event-driven)**

### 1. **Tạo QR Code**
```
Frontend: Nhấn "Tạo mã QR"
    ↓
Frontend: Gọi POST /api/create-qr
    ↓
Backend: Tạo Zalo instance
    ↓
Backend: Gọi zalo.loginQR() → Tạo file qr.png
    ↓
Backend: Khởi động zaloApi.listener.start()
    ↓
Backend: Setup event listeners:
    - listener.on('login_success', callback)
    - listener.on('error', callback)
    ↓
Backend: Trả về response success
    ↓
Frontend: Hiển thị QR code từ /qr.png
```

### 2. **Quét QR Code**
```
User: Quét QR bằng ứng dụng Zalo
    ↓
Zalo Server: Xác thực QR
    ↓
Backend Listener: Nhận event 'login_success'
    ↓
Backend: Tự động thực hiện:
    - Cập nhật loginStatus = 'success'
    - Lưu thông tin vào auth.json
    - Gọi zaloApi.getContext() → Lấy danh sách chat
    - Emit socket 'status' với redirect: '/chats'
    - Emit socket 'chats' với danh sách chat
    ↓
Frontend: Nhận socket event 'status'
    ↓
Frontend: Tự động redirect đến /chats
```

### 3. **Làm Mới QR**
```
Frontend: Nhấn "Làm mới QR"
    ↓
Frontend: Gọi POST /api/refresh-qr
    ↓
Backend: Xóa file qr.png cũ
    ↓
Backend: Tạo Zalo instance mới
    ↓
Backend: Gọi zalo.loginQR() → Tạo file qr.png mới
    ↓
Backend: Khởi động listener mới
    ↓
Backend: Setup event listeners mới
    ↓
Frontend: Hiển thị QR mới
```

## 🔧 **Các API Endpoints**

### POST /api/create-qr
- **Mục đích**: Tạo QR code và khởi động listener
- **Response**: `{"success": true, "message": "QR code đã được tạo"}`
- **Side effects**: 
  - Tạo file qr.png
  - Khởi động listener
  - Setup event handlers

### POST /api/refresh-qr  
- **Mục đích**: Làm mới QR code
- **Response**: `{"success": true, "message": "Đã tạo mã QR mới thành công"}`
- **Side effects**:
  - Xóa qr.png cũ
  - Tạo qr.png mới
  - Khởi động listener mới

### GET /api/status
- **Mục đích**: Kiểm tra trạng thái đăng nhập
- **Response**: `{"status": "waiting|success|error", "hasQR": boolean}`

## 📡 **Socket.io Events**

### Server → Client

#### status
```json
{
  "status": "generating_qr|waiting|success|error|logged_out",
  "message": "Thông báo cho user",
  "redirect": "/chats" // (optional, chỉ khi success)
}
```

#### chats
```json
{
  "chats": [
    {"id": "chat_id", "name": "Chat Name"},
    ...
  ]
}
```

#### error
```json
{
  "message": "Chi tiết lỗi"
}
```

### Client → Server

#### refresh_chats
- Yêu cầu làm mới danh sách chat

## 🎯 **Ưu điểm của Flow Mới**

1. **Không cần polling**: Frontend không cần liên tục gọi API kiểm tra trạng thái
2. **Real-time**: Phản hồi ngay lập tức khi QR được quét
3. **Event-driven**: Backend tự động xử lý khi có sự kiện đăng nhập
4. **Hiệu quả**: Giảm tải server, không cần nhiều request HTTP
5. **UX tốt hơn**: User không cần nhấn nút gì thêm sau khi quét QR

## 🔒 **Session Management**

- **File auth.json**: Lưu thông tin đăng nhập với timestamp
- **Thời hạn**: 24 giờ
- **Auto cleanup**: Tự động xóa khi hết hạn
- **Logout**: Xóa auth.json + reset state + xóa qr.png
