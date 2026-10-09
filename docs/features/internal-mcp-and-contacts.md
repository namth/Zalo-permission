# Specification: Internal System MCP & Global Contacts

## 1. Mục tiêu tính năng
Tính năng này nhằm mở rộng khả năng tự quản trị và quản lý danh bạ người dùng cho hệ thống OmniAgent Gateway:
*   **Internal System MCP:** Xây dựng một MCP Server nội bộ bọc (wrap) các API quản trị của nền tảng thành các công cụ (Tools). Từ đó, Agent có thể nhận lệnh chat để tự động tạo Workspace, thêm/xóa thành viên.
*   **Global Contacts (Danh bạ Toàn cầu):** Xây dựng một danh bạ lưu trữ thông tin người dùng từ các kênh (Zalo, Telegram). Giúp định danh duy nhất (Identity) một người dùng xuyên suốt các không gian làm việc (Workspaces), đồng thời cho phép thu thập dần các thông tin cá nhân (giới tính, năm sinh, email, sđt, sở thích...).

## 2. Luồng trải nghiệm (User Flow)

### 2.1 Luồng Internal MCP Server & Phân quyền
1.  Hệ thống cung cấp một điểm cuối `/api/mcp` nội bộ hoạt động như một máy chủ MCP (HTTP/SSE).
2.  Admin khai báo endpoint này như một `ToolGroup` trên Dashboard và gán vào các Workspace tùy ý.
3.  Khi có tin nhắn yêu cầu tạo Workspace hoặc quản lý thành viên (vd: *"Tạo dự án X và thêm anh Huy vào"*), LLM sẽ lên kế hoạch gọi Tool từ `ToolGroup` này.
4.  **Kiểm tra quyền động (Dynamic Role Check):** Tại thời điểm thực thi Tool, hệ thống sẽ xác định danh tính người gửi (thông qua bảng `Contact`). Nếu Contact này có role là `SUPER_ADMIN` thì lệnh mới được thực thi, ngược lại sẽ báo lỗi "Không đủ thẩm quyền".

### 2.2 Luồng Danh bạ & Hợp nhất tự động (Contacts & Merging)
1.  **Thu thập tự động (Auto-upsert):** Khi có tin nhắn bất kỳ từ Zalo/Telegram đẩy vào hệ thống, quá trình `Inbound Gateway` sẽ tự động tra cứu ID và lưu/cập nhật thông tin vào bảng `Contact`.
2.  **Lưu có chủ đích:** AI có Tool `add_contact` để chủ động lưu thông tin người dùng ngay cả khi họ chưa chat, thông qua lệnh của quản trị viên.
3.  **Thu thập thông tin:** Qua quá trình trò chuyện, AI có thể dùng Tool `update_contact_info` để bổ sung dữ liệu (giới tính, năm sinh, email, sđt, sở thích).
4.  **Hợp nhất danh bạ (Merge Contacts Edge Case):** Nếu cùng một người dùng tương tác qua cả Zalo (Tạo Contact A) và Telegram (Tạo Contact B). Dựa trên ngữ cảnh hoặc lệnh chat, AI (với quyền từ MCP) có thể sử dụng công cụ `merge_contacts` để hợp nhất 2 bản ghi thành một danh tính duy nhất (chứa cả Zalo_ID và Telegram_ID).

## 3. Tác động Cơ sở dữ liệu (Database Schema Diff)

### 3.1 PostgreSQL (Prisma Schema)
Bổ sung bảng `Contact` và Enum `Role`:
```prisma
enum ContactRole {
  USER
  SUPER_ADMIN
}

model Contact {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String
  zalo_id     String?     @unique
  telegram_id String?     @unique
  role        ContactRole @default(USER)
  
  // Thông tin mở rộng (Thu thập dần)
  gender      String?
  birth_year  Int?
  email       String?
  phone       String?
  hobbies     String?     // Có thể lưu JSON hoặc Text
  
  created_at  DateTime    @default(now())
  updated_at  DateTime    @updatedAt
  
  // Quan hệ nếu cần trong Postgres
}
```

### 3.2 Neo4j (Graph Database)
*   **Node mới:** `(Contact)`
*   **Quan hệ:** `(Contact)-[:BELONGS_TO]->(Workspace)` - Một Contact có thể được gán vào nhiều Workspace khác nhau để quản lý. Khi cần truy vấn danh bạ của một Workspace, quét qua quan hệ này.

## 4. API Contracts & MCP Tools Mới

### 4.1 Internal MCP Endpoint
*   **`GET/POST /api/mcp`**: Xử lý giao thức Model Context Protocol (hoặc SSE endpoint nếu dùng phương thức SSE).

### 4.2 Các Tools được MCP Server expose:
1.  `create_workspace(name, description)`: Tạo không gian làm việc mới.
2.  `add_contact(name, zalo_id, telegram_id)`: Thêm một người vào danh bạ (thủ công).
3.  `update_contact_info(contact_id, gender, birth_year, email, phone, hobbies)`: Cập nhật thông tin bổ sung.
4.  `assign_contact_to_workspace(contact_id, workspace_id)`: Thêm một Contact vào một Workspace.
5.  `remove_contact_from_workspace(contact_id, workspace_id)`: Rút quyền Contact khỏi Workspace.
6.  `merge_contacts(primary_contact_id, secondary_contact_id)`: Hợp nhất 2 tài khoản (Secondary sẽ bị xóa hoặc merge các ID/thông tin sang Primary).

## 5. Các Task Triển khai (Tasks)

- [ ] Tạo schema Prisma cho bảng `Contact` và `ContactRole`, chạy migration.
- [ ] Xây dựng service đồng bộ tự động tại `Inbound Gateway` để upsert thông tin vào bảng `Contact` mỗi khi nhận tin nhắn Zalo/Telegram.
- [ ] Thiết lập logic tạo Node `Contact` và liên kết `BELONGS_TO` Workspace trên Neo4j.
- [ ] Triển khai endpoint `/api/mcp` nội bộ trong `apps/web`.
- [ ] Khai báo và code xử lý (handlers) cho các tools: `create_workspace`, `add_contact`, `update_contact_info`, `assign_contact_to_workspace`, `merge_contacts`.
- [ ] Bổ sung middleware/interceptor tại các MCP Tool handlers để kiểm tra `ContactRole == SUPER_ADMIN`.
- [ ] Viết test nội bộ (Unit test) cho logic hợp nhất danh bạ (`merge_contacts`).
