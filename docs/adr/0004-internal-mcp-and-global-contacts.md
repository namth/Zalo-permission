# ADR 0004: Kiến trúc Internal System MCP & Hợp nhất Danh bạ Người dùng (Global Contacts)

* **Trạng thái:** Chấp thuận (Accepted)
* **Ngày quyết định:** 2026-10-03
* **Người quyết định:** Principal System Architect & PO

---

## 1. Bối cảnh (Context)
Khi hệ thống phát triển, phát sinh 2 nhu cầu cấp thiết:
1. **Tự quản trị qua Kênh Chat:** Quản trị viên muốn ra lệnh cho Bot qua Telegram/Zalo để tạo nhanh Workspace mới, thêm bớt thành viên, hoặc tra cứu danh sách Workspace mà không cần phải mở laptop đăng nhập vào Web Dashboard.
2. **Định danh Người dùng Thống nhất:** Người dùng trong một tổ chức có thể nhắn tin cho Bot từ tài khoản Zalo cá nhân hoặc tài khoản Telegram cá nhân. Ban đầu hệ thống xem họ là 2 người lạ lẫm, không nhận diện được cùng một nhân sự, không duy trì được hồ sơ chung (email, số điện thoại, sở thích).

---

## 2. Quyết định (Decision)
1. **Thiết lập Internal MCP Server (`/api/mcp`):**
   * Đóng gói các hàm quản trị hệ thống thành các Tools chuẩn giao thức **Model Context Protocol (JSON-RPC 2.0)** tại endpoint `/api/mcp`.
   * Gắn cơ chế **Dynamic Authorization Guard**: Kiểm tra header `X-Caller-Role`. Các công cụ phá hủy/thay đổi trạng thái (`create_workspace`, `merge_contacts`, `assign_contact_to_workspace`, `remove_contact_from_workspace`) bắt buộc phải có `X-Caller-Role: SUPER_ADMIN`.
   * Whitelist đường dẫn `/api/mcp` trong module SSRF Protection để Worker Agent có thể gọi an toàn.
2. **Hệ thống Danh bạ Toàn cục (Global Contacts):**
   * Khởi tạo bảng `contacts` trong PostgreSQL và node `(:Contact)` trong Neo4j.
   * Cơ chế **Auto-upsert:** Tự động tạo bản ghi khi có tin nhắn đến; tự động liên kết (Auto-link) nếu phát hiện cùng tên trong cùng Workspace mà kênh tương ứng đang trống.
   * Cơ chế **Hợp nhất Danh bạ (Merge Contacts):** Cho phép SuperAdmin (hoặc AI thay mặt SuperAdmin) gộp 2 định danh Zalo và Telegram vào làm 1 bản ghi chính (Primary), chuyển giao toàn bộ liên kết đồ thị Neo4j và dọn dẹp bản ghi phụ (Secondary).
   * Quy định Persona Tiếng Việt: Bắt buộc xưng hô bằng `nickname` hoặc Tên chính (Given Name), tuyệt đối không gọi cả họ và tên đệm.

---

## 3. Các Phương án Đã Cân nhắc & Lý do Loại bỏ
1. **Viết Hard-coded logic trong Worker Agent để nhận diện câu lệnh quản trị:**
   * *Nhược điểm:* Khiến logic của Worker Agent bị phình to (bloated), khó mở rộng và không tận dụng được chuẩn giao tiếp công cụ MCP.
2. **Tách Internal MCP thành một Microservice / Process riêng:**
   * *Ưu điểm:* Cô lập hoàn toàn môi trường.
   * *Nhược điểm:* Đòi hỏi thêm tài nguyên máy chủ, thêm cổng mạng, làm phức tạp hóa triển khai cho các môi trường vừa và nhỏ. Việc tích hợp vào Next.js App Router API Route (`POST /api/mcp`) tận dụng được kết nối Prisma có sẵn mà vẫn đảm bảo tính chuẩn hóa.

---

## 4. Hệ quả & Đánh đổi (Consequences & Trade-offs)
* **Tích cực:**
  * Trải nghiệm người dùng đột phá: SuperAdmin có thể điều hành toàn bộ nền tảng chỉ bằng tin nhắn chat tự nhiên.
  * Tự động làm giàu dữ liệu cá nhân (Progressive Profiling) cho người dùng qua từng lượt chat.
  * Tuân thủ 100% chuẩn mở MCP.
* **Đánh đổi:**
  * Nguy cơ bảo mật nếu cơ chế kiểm tra `X-Caller-Role` bị bypass hoặc người gửi tin nhắn giả mạo ID. Đòi hỏi việc trích xuất ID người gửi từ webhook phải được ký số / kiểm tra chặt chẽ ở tầng Gateway.
