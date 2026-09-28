# 03. Danh sách Màn hình, Bố cục & Thiết kế UI (Screens & Google Stitch Prompts)

## 1. Hệ thống Màn hình (Screen Hierarchy)

Toàn bộ ứng dụng Quản trị Web (Next.js App Router) tuân thủ Design System tối giản, hiện đại dựa trên **Tailwind CSS + Shadcn UI** với Dark/Light Mode.

```
/
├── /dashboard                    # Màn hình 1: Tổng quan hệ sinh thái & Thống kê
├── /channels                     # Màn hình 2: Quản lý Tài khoản & Kết nối Kênh (Telegram, Zalo)
│   └── /channels/[id]            # Chi tiết tài khoản & danh sách nhóm chat đã đồng bộ
├── /tools                        # Màn hình 3: Kho Tool Groups & Tool APIs Master
│   ├── /tools/groups/new         # Tạo mới Tool Group
│   └── /tools/groups/[id]        # Chi tiết Tool Group, cấu hình biến động & danh sách Tool con
├── /skills                       # Màn hình 4: Kho Kỹ năng (Skill Catalog & SOP)
│   └── /skills/[id]              # Chi tiết Skill, System Prompt, Tool Dependencies
├── /workspaces                   # Màn hình 5: Quản lý Không gian Làm việc (Workspace Hub)
│   └── /workspaces/[id]          # Cấu hình chi tiết Workspace (Tabs: Kênh, Skills, Scoped Tools)
└── /audit-logs                   # Màn hình 6: Giám sát Thực thi & Tracing Agent
```

---

## 2. Chi tiết Từng Màn hình & Layout Specifications

### Màn hình 1: Dashboard Tổng quan (`/dashboard`)
* **Layout:** Top Header (Stats ticker, Workspace Switcher, User Profile), Main Grid:
  * **Card Metrics (4 cột):** Tổng số Workspace hoạt động, Số kênh đang kết nối (Telegram/Zalo), Tổng số Tool APIs sẵn sàng, Lượng tin nhắn xử lý trong 24h.
  * **Live Activity Feed:** Bảng hiển thị 10 tin nhắn gần nhất qua các kênh, trạng thái xử lý (Success, Running, Error), độ trễ (latency).
  * **Quick Actions:** Nút "Thêm Kênh Chat Mới", "Tạo Tool Group", "Tạo Workspace Mới".

---

### Màn hình 2: Quản lý Tài khoản Kênh (`/channels`)
* **Layout:**
  * **Header:** Tiêu đề "Kênh Liên Lạc", nút "Thêm Tài Khoản Mới" (mở Modal chọn Telegram Bot hoặc Zalo).
  * **Modal Kết nối Telegram:** Input nhập `Bot Token`, nút "Kiểm tra & Kết nối", hiển thị tên Bot (@BotName) sau khi xác thực.
  * **Modal Kết nối Zalo:** Tabs: (1) Quét mã QR (hiển thị mã QR động tạo từ backend `zca-js`), (2) Nhập Zalo OA Token & Webhook Secret.
  * **Data Table Danh sách Tài khoản:** Cột Tên tài khoản, Nền tảng (Badge Telegram/Zalo), Trạng thái kết nối (Badge xanh Active / đỏ Disconnected), Số lượng nhóm chat đã tham gia, Nút "Đồng bộ nhóm mới (Refresh Groups)" và "Ngắt kết nối".

---

### Màn hình 3: Kho Tool Groups & Tool APIs (`/tools`)
* **Layout:**
  * **Trang danh sách Tool Groups:** Dạng lưới (Card Grid) hiển thị từng hệ thống tích hợp (ví dụ: "Haravan Order API", "KiotViet Inventory", "Internal CRM", "Google Sheets Integration").
  * **Chi tiết Tool Group (`/tools/groups/[id]`):**
    * *Thẻ Cấu hình Chung:* Tên nhóm, Key, Base URL (`https://api.example.com`), Phương thức Auth mặc định (`Bearer Token`), Danh sách biến động yêu cầu (Tags: `API_KEY`, `TENANT_ID`).
    * *Bảng Danh sách Tools Con:* Danh sách endpoint của hệ thống này (Badge HTTP Method: `GET`, `POST`, `PUT`, `DELETE`), Tên Tool, Đường dẫn (`/v1/orders`), Trạng thái hoạt động, Nút "Test Tool" (mở Drawer chạy thử với JSON input và xem kết quả API trả về thực tế).

---

### Màn hình 4: Kho Kỹ năng (`/skills`)
* **Layout:**
  * **Danh sách Skills:** Bảng quản lý các quy trình nghiệp vụ đã tạo (ví dụ: "Tra cứu Đơn hàng", "Tạo Báo giá Nhanh", "Hỗ trợ Kỹ thuật cấp 1").
  * **Trang Chi tiết / Tạo mới Skill:**
    * *Form thông tin:* Tên, Key, Mô tả ngắn.
    * *Bộ kích hoạt (Trigger Intents):* Nhập danh sách câu mẫu hoặc từ khóa để Router Agent nhận diện.
    * *System Prompt (SOP):* Code editor Monaco/Textarea cho phép định nghĩa cách Agent phản hồi, các bước suy nghĩ và tiêu chuẩn nghiệm thu câu trả lời.
    * *Required Tools:* Danh sách Checkbox chọn các Tool APIs mà Skill này được phép sử dụng.

---

### Màn hình 5: Quản lý Workspace (`/workspaces/[id]`)
* **Layout:** Header chứa thông tin Workspace (Tên, Mã định danh, Nút Lưu). Bên dưới chia thành 3 Tabs nghiệp vụ rõ ràng:
  * **Tab 1: Kênh & Nhóm Chat (Channels & Chat Groups):**
    * Cây danh mục phân theo từng tài khoản Telegram / Zalo.
    * Danh sách các nhóm chat (Group Name, Chat ID) kèm Checkbox.
    * Admin chỉ cần tích chọn nhóm nào sẽ thuộc về Workspace này.
  * **Tab 2: Phân quyền Kỹ năng (Skills):**
    * Danh sách tất cả Skills trong hệ thống kèm Switch Toggle Bật/Tắt cho Workspace.
  * **Tab 3: Phân quyền Công cụ & Scoped Data (Tools & Scoped Config):**
    * Danh sách các Tool Groups. Khi bật Switch kích hoạt một Tool Group:
      * Tự động mở rộng phần nhập liệu **Dynamic Variables Overrides** dành riêng cho Workspace này (ví dụ ô nhập `API_KEY`, `BRANCH_ID`).
      * Danh sách các Tool con bên trong kèm Checkbox để cho phép tắt/bật ngoại lệ từng API cụ thể.

---

### Màn hình 6: Giám sát Thực thi (`/audit-logs`)
* **Layout:**
  * Bảng lọc theo: Thời gian, Workspace, Kênh (Telegram/Zalo), Trạng thái.
  * Khi click vào một dòng log, mở **Side Drawer (Agent Trace Inspector)**:
    1. *User Prompt:* Tin nhắn gốc của người dùng.
    2. *Router Decision:* Intent phân loại được, Skill đã chọn (hoặc danh mục Tool đã gán).
    3. *Worker Reasoning:* Suy nghĩ từng bước (Chain-of-thought) của Worker Agent.
    4. *Tool Execution Steps:* Từng lệnh gọi Tool, URL đầy đủ (đã inject biến), Payload gửi đi, HTTP Response Status và Body nhận về.
    5. *Final Bot Output:* Câu trả lời cuối cùng đã gửi về nhóm chat.

---

## 3. Prompts Thiết kế cho Google Stitch (English Prompts)

Dưới đây là các prompt chi tiết sẵn sàng sử dụng với công cụ thiết kế **Google Stitch MCP**:

### Stitch Prompt 1: Workspace Management & Scoped Config View
```text
Design a modern, high-density SaaS dashboard screen for "Workspace Configuration" in dark mode. 
Clean aesthetic inspired by Linear and Vercel. 
Top section: Breadcrumbs (Workspaces / "Hanoi Sales Office"), Workspace title, status badge (Active), and a primary "Save Changes" button.
Tab navigation bar with 3 tabs: "Connected Chat Groups", "Enabled Skills", and "Tool Permissions & Scoped Credentials".
Active tab shows "Tool Permissions & Scoped Credentials":
A card list of Tool Groups. The first card is "KiotViet Inventory API" with a green enabled toggle.
Below the header of the card, an expandable "Workspace Scoped Variables" section containing two input fields with secure dot-masking: "API_KEY" (value: "kv_sec_********") and "BRANCH_ID" (value: "HN_STORE_01").
Inside the card, an indented table of individual endpoints: 
- Row 1: GET badge in green, "/api/products/search", Switch toggle ON.
- Row 2: POST badge in blue, "/api/orders/create", Switch toggle ON.
- Row 3: DELETE badge in red, "/api/products/{id}", Switch toggle OFF with a subtle "Restricted" tooltip.
Sidebar on the left with navigation items: Dashboard, Channels, Tool Catalog, Skill Catalog, Workspaces (active), Audit Logs.
```

### Stitch Prompt 2: Channel Hub & Account Connection Modal
```text
Design a sleek Channel Management screen for an AI Agent platform.
Top bar contains title "Channel Hub" and a prominent button "+ Connect Account".
Main content displays two categories: "Telegram Bots" and "Zalo Accounts".
Telegram card shows Bot avatar, "@SalesAssistantBot", connection status "Active (Polling)", and a list of 4 linked group chats with chat icon and member count.
Zalo card shows user avatar, "Zalo CSKH Office", status "Connected via Web Session", expiring in 12 days, with 3 linked group chats.
A centered modal overlay for "+ Connect New Channel":
Modal header has title "Connect Messaging Channel" with tabs "Telegram Bot" and "Zalo Personal / OA".
Active tab "Zalo Personal": Displays a crisp QR Code in a centered card with a 60-second animated refresh countdown ring, instruction text "Open Zalo app on your phone, navigate to QR scanner, and confirm login", and an alternative button "Or connect using Zalo OA Token".
```

### Stitch Prompt 3: Agent Execution Trace Inspector (Drawer View)
```text
Design an advanced AI Agent Execution Trace inspector drawer sliding from the right edge over an audit log data table.
Drawer title: "Execution Trace #TR-98421" with status badge "Success" in emerald and execution time "1.84s".
Metadata pill row: "Workspace: Marketing Team", "Channel: Zalo Group #growth-leads", "Model: Claude-3.5-Sonnet".
Content timeline:
1. Inbound Node: User avatar, text message "Check inventory for SKU-990 and notify if stock < 10".
2. Intent Classification Node: "Router: No matching skill found. Selected Tool Group: Inventory API".
3. Agent Thought Node: Collapsible card with icon of a lightbulb, containing monospace markdown text: "User requests stock verification for SKU-990. Calling Inventory API search endpoint with workspace scoped key...".
4. Tool Call Node: Expandable card titled "Call: GET /api/products/search?sku=SKU-990", Status 200 OK. Tabbed code viewer showing Request Headers (with injected bearer token) and JSON Response payload (`{ "sku": "SKU-990", "stock": 4 }`).
5. Outbound Response Node: Bot avatar, rich text preview: "Sản phẩm SKU-990 hiện chỉ còn 4 chiếc trong kho Hà Nội (dưới mức cảnh báo 10).".
```
