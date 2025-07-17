import { Zalo } from "zca-js";

async function main() {
  try {
    // Khởi tạo Zalo instance
    const zalo = new Zalo();
    
    // Đăng nhập bằng QR
    console.log("Đang tạo mã QR để đăng nhập...");
    const api = await zalo.loginQR();
    console.log("Đăng nhập thành công!");

    // Lấy danh sách chat (giả định phương thức getChats)
    const chats = await api.getContext(); // Thay 'getChats' bằng phương thức thực tế nếu khác
    console.log("Danh sách các đoạn chat hiện có:", chats);
    
    // Hiển thị danh sách chat
    chats.forEach(chat => {
      console.log(`Tên chat: ${chat.name}, ID: ${chat.id}`);
    });
  } catch (error) {
    console.error("Đã xảy ra lỗi:", error);
  }
}

main();
