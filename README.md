# Zalo Web Interface

Ứng dụng web để đăng nhập Zalo và xem danh sách chat thông qua giao diện web hiện đại.

## Tính năng

- 🔐 Đăng nhập Zalo bằng QR code
- 💾 Lưu thông tin đăng nhập vào file `auth.json`
- 🔄 Tự động điều hướng sau khi đăng nhập thành công
- 🔒 Kiểm tra session và redirect tự động
- 💬 Hiển thị danh sách các đoạn chat
- 🔄 Tự động làm mới danh sách chat
- 🚪 Đăng xuất với xóa session
- 📱 Giao diện responsive, thân thiện với mobile
- ⚡ Real-time updates với Socket.io

## Cài đặt

1. Cài đặt dependencies:

```bash
npm install
```

2. Khởi động server:

```bash
npm start
```

3. Truy cập ứng dụng tại: http://localhost:3000

## Cách sử dụng

### 1. Đăng nhập

- Truy cập http://localhost:3000
- Nếu đã đăng nhập trước đó (có file `auth.json` hợp lệ), sẽ tự động chuyển đến trang chat
- Nhấn nút "Tạo mã QR" để tạo mã đăng nhập và khởi động listener
- Quét mã QR bằng ứng dụng Zalo trên điện thoại
- Backend sẽ tự động phát hiện khi QR được quét và xử lý đăng nhập
- Nếu QR hết hạn, nhấn "Làm mới QR" để xóa QR cũ và tạo mã hoàn toàn mới
- Sau khi đăng nhập thành công, thông tin sẽ được lưu vào `auth.json`
- Tự động chuyển hướng đến trang danh sách chat

### 2. Xem danh sách chat

- Sau khi đăng nhập thành công, bạn sẽ được tự động chuyển đến trang danh sách chat
- Nếu chưa đăng nhập, truy cập `/chats` sẽ redirect về trang đăng nhập
- Danh sách chat sẽ tự động tải và hiển thị
- Sử dụng nút "Làm mới" để cập nhật danh sách chat
- Nhấn "Đăng xuất" để xóa session và quay lại trang đăng nhập

## Cấu trúc dự án

```
├── server.js              # Server Express chính
├── index.js               # File thông báo (đã tích hợp vào server)
├── index-standalone.js    # Phiên bản console gốc
├── package.json           # Dependencies và scripts
├── auth.json              # Thông tin đăng nhập (tự động tạo)
├── public/                # Static files
│   ├── login.html         # Trang đăng nhập
│   ├── chats.html         # Trang danh sách chat
│   ├── login.js           # JavaScript cho trang đăng nhập
│   ├── chats.js           # JavaScript cho trang chat
│   └── style.css          # CSS styling
└── qr.png                 # QR code (tự động tạo)
```

## API Endpoints

- `GET /` - Trang đăng nhập
- `GET /chats` - Trang danh sách chat
- `GET /qr.png` - Hình ảnh QR code
- `GET /api/status` - Trạng thái đăng nhập
- `GET /api/chats` - Danh sách chat (JSON)
- `POST /api/create-qr` - Tạo mã QR và khởi động listener
- `POST /api/refresh-qr` - Làm mới mã QR (xóa file cũ và tạo mới)
- `POST /api/logout` - Đăng xuất và xóa session

## Socket.io Events

### Client → Server

- `refresh_chats` - Yêu cầu làm mới danh sách chat

### Server → Client

- `status` - Cập nhật trạng thái đăng nhập (waiting, success, error, logged_out)
- `chats` - Danh sách chat mới
- `error` - Thông báo lỗi

## Scripts

- `npm start` - Khởi động server production
- `npm run dev` - Khởi động server với nodemon (development)
- `node index-standalone.js` - Chạy phiên bản console gốc

## Lưu ý

- **Session Management**: Thông tin đăng nhập được lưu trong `auth.json` với thời hạn 24 giờ
- **Auto Redirect**: Tự động chuyển hướng dựa trên trạng thái đăng nhập
- **QR Refresh**: Nút "Làm mới QR" sẽ xóa file QR cũ và tạo QR hoàn toàn mới bằng `zaloApi = await zalo.loginQR()`
- **Event-driven Login**: Backend tự động lắng nghe sự kiện đăng nhập sau khi tạo QR
- **Individual Group Processing**: Xử lý thông tin từng group riêng biệt để tránh lỗi API
- **Auto Updates**: QR code tự động làm mới mỗi 2 phút, danh sách chat cập nhật mỗi 30 giây
- **Security**: File `auth.json` sẽ bị xóa khi đăng xuất hoặc hết hạn
- **Library**: Sử dụng thư viện `zca-js` để tương tác với Zalo
- **Group Processing**: Có thể chuyển đổi giữa xử lý từng group riêng biệt hoặc batch bằng `PROCESS_GROUPS_INDIVIDUALLY`
- **Port**: Server chạy trên port 3000 (có thể thay đổi bằng biến môi trường PORT)

## Troubleshooting

### Lỗi kết nối

- Kiểm tra xem server có đang chạy không
- Đảm bảo port 3000 không bị chiếm dụng

### QR code không hiển thị

- Kiểm tra file qr.png có tồn tại không
- Thử làm mới trang hoặc nhấn "Làm mới"

### Không thể lấy danh sách chat

- Đảm bảo đã đăng nhập thành công
- Kiểm tra console để xem lỗi chi tiết
- Thử nhấn nút "Làm mới" trong trang chat
