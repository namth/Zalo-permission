# 02. Các Phân hệ Hệ thống & Ma trận Phân quyền (Modules & RBAC)

## 1. Phân rã Các Phân hệ Hệ thống (System Modules)

Hệ thống được cấu thành từ 6 phân hệ nghiệp vụ chính:

```
+-------------------------------------------------------------------------------+
|                       OMNIAGENT CONTROL & RUNTIME                             |
+-------------------------------------------------------------------------------+
| 1. Channel Hub         | Kết nối & Quản lý Tài khoản (Telegram, Zalo)         |
| 2. Tool & Skill Hub    | Kho Quản lý Tool Groups, Tools và Skills Master      |
| 3. Workspace Engine    | Quản lý Không gian, Gán Nhóm chat, Bật/Tắt Tài nguyên|
| 4. Scoped Vault        | Cấu hình Biến Động (Dynamic Variables) per Workspace |
| 5. Multi-Agent Engine  | Router Agent (Intent) & Worker Agent (Plan & Act)    |
| 6. Audit & Tracing     | Theo dõi Luồng Tư duy, Log Gọi Tool, Lịch sử Chat    |
+-------------------------------------------------------------------------------+
```

---

### Phân hệ 1: Channel Hub (Quản lý Kênh Kết nối)
* **Kết nối Telegram:**
  * Nhập Bot Token $\rightarrow$ Kiểm tra thông tin Bot với Telegram API (`getMe`).
  * Tự động đăng ký Webhook hoặc kích hoạt Polling Consumer.
  * Lắng nghe và đồng bộ danh sách nhóm chat (`chat_id`, `title`, `type`) khi bot được thêm vào nhóm mới.
* **Kết nối Zalo:**
  * Hỗ trợ xác thực qua Zalo Personal (QR Code Login / Session Cookie via `zca-js`) hoặc Zalo OA (Access Token & Webhook).
  * Hiển thị trạng thái kết nối (`CONNECTED`, `EXPIRED`, `DISCONNECTED`).
  * Đồng bộ danh sách hội thoại/nhóm (`thread_id`, `group_name`).
* **Quản lý Vòng đời Tài khoản:** Bật/tắt trạng thái nhận tin nhắn, xóa/ngắt kết nối tài khoản.

---

### Phân hệ 2: Tool & Skill Catalog (Kho Công cụ & Kỹ năng)
* **Quản lý Tool Groups:**
  * Định danh nhóm công cụ (Key, Tên, Logo, Mô tả hệ thống).
  * Hỗ trợ 2 chuẩn giao thức: **REST API** truyền thống và **Native MCP Server (Model Context Protocol)**.
  * Cấu hình Base URL / Endpoint SSE và loại xác thực mặc định (`NONE`, `BEARER_TOKEN`, `API_KEY`, `BASIC_AUTH`, `CUSTOM_HEADERS`).
  * Định nghĩa danh sách các biến động (Dynamic Variables) mà hệ thống này yêu cầu, ví dụ: `API_KEY`, `TENANT_ID`, `BRANCH_CODE`.
* **Cơ chế Import & Đồng bộ MCP Nhanh (MCP Hub):**
  * Hỗ trợ dán trực tiếp cấu hình JSON chuẩn `mcpServers` (format Claude Desktop / Cursor) hoặc nhập URL endpoint SSE/HTTP.
  * Tự động handshake và bóc tách danh sách Tool (`tools/list`) cùng inputSchema.
  * Cho phép xem trước (Preview Table), lọc chọn Tool cần kích hoạt và bấm lưu vào kho Master.
  * Nút "Đồng bộ từ Server" (On-demand Sync) giúp cập nhật tool mới mà không làm mất phân quyền và cấu hình Scoped Vault của các Workspace.
* **Quản lý Tools con (APIs & MCP Tools):**
  * Định danh Tool (`tool_key`, `name`, `description`).
  * Phương thức: HTTP (`GET`, `POST`, ...) cho REST hoặc gọi trực tiếp giao thức MCP (`callTool`).
  * Đường dẫn tương đối (Path cho REST) hoặc Function Name (cho MCP).
  * Schema tham số đầu vào (JSON Schema cho Headers, Query, Path Parameters, Body hoặc MCP InputSchema).
  * Công cụ Test chạy thử (Interactive API Runner / MCP Tool Runner) ngay trên Dashboard.
* **Quản lý Skills:**
  * Định danh Skill (`skill_key`, `name`, `description`).
  * Cấu hình Intent Kích hoạt (Trigger Phrases / Keywords / Semantic Embedding).
  * System Prompt định hướng nghiệp vụ (SOP Rules).
  * Danh sách Tools phụ thuộc mà Skill này được phép sử dụng.

---

### Phân hệ 3: Workspace Engine (Quản lý Không gian Làm việc)
* **Quản lý Không gian:** Tạo mới, chỉnh sửa thông tin Workspace (Tên, Mô tả, Slug, Trạng thái).
* **Gán Nhóm Chat (Channel Mapping):**
  * Hiển thị toàn bộ nhóm chat từ các tài khoản Telegram/Zalo đã kết nối.
  * Tích chọn nhóm chat gán vào Workspace (Quan hệ N-1: Nhiều nhóm chat có thể thuộc về 1 Workspace).
* **Cấp quyền Tài nguyên (Access Granting):**
  * Bật/tắt Skills cho Workspace.
  * Bật/tắt Tool Groups cho Workspace.
  * Bật/tắt ngoại lệ từng Tool đơn lẻ bên trong Tool Group.
* **Quản lý Inbound Webhooks & Firebase:**
  * Khởi tạo nhiều Webhook endpoint cho từng Workspace (`/api/v1/workspaces/{id}/webhooks/{wh_id}`).
  * Quản lý Secret Token xác thực Inbound cho Mobile App & Web bên thứ ba.
  * Cấu hình Firebase Cloud Messaging (FCM) credentials mã hóa AES-256-GCM ở cấp Workspace để đẩy thông báo về Mobile App.

---

### Phân hệ 4: Scoped Vault (Cấu hình Dữ liệu Riêng biệt)
* Khi bật một Tool Group trong Workspace, hệ thống tự động sinh form dựa trên danh sách biến động đã khai báo ở Tool Group Master.
* Cho phép Admin nhập giá trị thực tế của biến cho riêng Workspace đó:
  * Ví dụ Workspace "Chi nhánh Hà Nội": `{{API_KEY}} = "HN-SECRET-KEY"`.
  * Workspace "Chi nhánh TP.HCM": `{{API_KEY}} = "HCM-SECRET-KEY"`.
* Mọi giá trị nhạy cảm được tự động mã hóa AES-256-GCM trước khi lưu vào CSDL PostgreSQL.

---

### Phân hệ 5: Multi-Agent Engine (Bộ máy Điều phối & Thực thi)
* **Inbound Gateway:** Đưa tin nhắn từ Telegram/Zalo hoặc Inbound Webhooks HTTP POST vào hàng đợi Redis Streams `stream:inbound_messages`.
* **Tenant Resolver:** Truy vấn Neo4j từ `platform_chat_id` hoặc `webhook_id` $\rightarrow$ Xác định `workspace_id`.
* **Session Manager:** Quản lý ngữ cảnh hội thoại đa lượt qua `platform_chat_id` (Zalo/Tele) hoặc `session_id` (Webhook).
* **Router Agent:**
  * Dùng LLM nhẹ & nhanh (`google/gemini-2.0-flash` qua OpenRouter).
  * Phân loại ý định $\rightarrow$ So khớp với các Skill được kích hoạt trong Workspace.
  * Nếu khớp Skill $\rightarrow$ Gọi Worker Agent chạy theo SOP của Skill đó.
  * Nếu không khớp $\rightarrow$ Trích xuất danh mục Tool Group/Tools được phân quyền $\rightarrow$ Giao cho Worker Agent.
* **Worker Agent:**
  * Dùng LLM suy luận mạnh & tool-calling chuẩn (`anthropic/claude-3.5-sonnet` qua OpenRouter).
  * Triển khai vòng lặp Plan-and-Solve / ReAct:
    1. *Think:* Đọc yêu cầu & ngữ cảnh hội thoại.
    2. *Plan:* Lập kế hoạch từng bước cần làm.
    3. *Act:* Gọi Tool đã được resolve thông tin Auth & Scoped Variables.
    4. *Observe:* Đọc kết quả API trả về.
    5. *Final Answer:* Tổng hợp câu trả lời tự nhiên.
* **Outbound Gateway & Callback Engine:**
  * Kênh Chat: Đưa tin nhắn ra `stream:outbound_messages` và gửi về nhóm chat Zalo/Telegram gốc.
  * Kênh Webhook: Bắn HTTP POST Callback tới client với cơ chế Retry Exponential Backoff (3 lần), hoặc gửi Push Notification về Mobile App qua Firebase FCM.

---

### Phân hệ 6: Audit & Tracing
* Lưu vết toàn bộ chuỗi sự kiện: Tin nhắn vào $\rightarrow$ Ý định nhận diện $\rightarrow$ Skill/Tool đã cấp $\rightarrow$ Chuỗi suy nghĩ (Thought process) $\rightarrow$ Các API đã gọi kèm input/output $\rightarrow$ Thời gian phản hồi (Latency) $\rightarrow$ Trạng thái (Success/Error/Callback Failed).

---

### Phân hệ 7: Admin AI Copilot Drawer (`FEAT-ADMIN-COPILOT`)
* **Giao diện:** Slide-over Right Sidebar Drawer (`w-[400px]`) cố định trên toàn bộ `/admin/*`.
* **Trí tuệ nhân tạo:** Tích hợp LLM qua OpenRouter Gateway (`OPENROUTER_API_KEY`) với cơ chế Function Calling nội bộ.
* **4 Nhóm Công cụ Quản trị:**
  1. `mcp_management`: Nhận diện URL/JSON MCP server, handshake và nạp công cụ vào kho.
  2. `workspace_permissions`: Tra cứu quyền và gán/thu hồi Tool/ToolGroup cho Workspace.
  3. `skill_management`: Dạy skill mới bằng ngôn ngữ tự nhiên, tạo System Prompt và liên kết Tool.
  4. `system_diagnostics`: Tra cứu Audit log và kiểm tra trạng thái kênh Zalo/Telegram.
* **Cơ chế An toàn (Human-in-the-Loop):** Render Action Preview Card yêu cầu Admin bấm xác nhận trước khi thực thi mọi thao tác thay đổi dữ liệu; tự động ghi vết `audit_logs` với `action_type = 'COPILOT_ACTION'`.

---

### Phân hệ 8: Inbound Webhooks & Async Callback Gateway (`FEAT-WORKSPACE-WEBHOOKS`)
* **Mở rộng Kênh Giao tiếp:** Cung cấp Endpoint RESTful cho Mobile App, Website hoặc hệ thống vệ tinh bên thứ ba gọi vào Agent.
* **Xác thực Bảo mật:** Secret Token sinh tự động theo từng Webhook, hỗ trợ xác thực Bearer Token / Header `X-Webhook-Secret`.
* **Hội thoại Đa lượt:** Hỗ trợ `session_id` để Agent duy trì bộ nhớ ngữ cảnh hỏi đáp liên tục, tự sinh session nếu client không cung cấp.
* **Dynamic Callback Delivery:** Hỗ trợ callback bất đồng bộ linh hoạt qua HTTP POST (kèm retry) hoặc Firebase FCM Push Notification.


---

## 2. Ma trận Phân quyền (RBAC Matrix)

Dự án áp dụng mô hình **Single-tenant Internal Admin** (Toàn quyền quản trị Dashboard) kết hợp **Phân quyền Đồ thị theo Kênh (Channel Graph RBAC)** cho người dùng cuối:

| Đối tượng / Thực thể | Admin Dashboard | End-user (Nhóm chat Telegram/Zalo) |
| :--- | :---: | :---: |
| **Quản lý Tài khoản (Zalo, Telegram)** | Toàn quyền (Thêm, Xóa, Kết nối) | Không có quyền truy cập |
| **Quản lý Tool Groups & Tools** | Toàn quyền (Thêm, Sửa, Xóa, Test) | Không có quyền truy cập |
| **Quản lý Skills** | Toàn quyền (Định nghĩa SOP, Prompt) | Không có quyền truy cập |
| **Tạo / Cấu hình Workspace** | Toàn quyền (Tạo, Sửa, Gán Kênh) | Không có quyền truy cập |
| **Cấu hình Scoped API Keys** | Toàn quyền (Nhập Key cho từng WS) | Không có quyền truy cập |
| **Xem Audit Logs & Tracing** | Toàn quyền xem mọi log | Không có quyền truy cập |
| **Sử dụng Skill & Tool** | Gián tiếp qua chức năng Test Tool | Chỉ được sử dụng các Skill & Tool **đã được cấp quyền cho Workspace chứa nhóm chat của mình** |

---

## 3. Quy tắc Kiểm tra Quyền hạn trong Neo4j (Graph Authorization Rules)
1. **Rule 1 (Routing Rule):** Một nhóm chat `ChannelChat` bắt buộc phải có quan hệ `[:BELONGS_TO]` tới đúng 1 `Workspace`. Nếu không có, hệ thống từ chối xử lý hoặc báo tin nhắn chưa được cấu hình.
2. **Rule 2 (Skill Access Rule):** Người dùng trong nhóm chỉ được kích hoạt Skill $S$ nếu tồn tại đường dẫn:
   $$\text{(ChannelChat)} \to \text{[:BELONGS\_TO]} \to \text{(Workspace)} \to \text{[:CAN\_USE]} \to \text{(Skill)}$$
3. **Rule 3 (Tool Access Rule - 2 tầng):** Tool $T$ thuộc ToolGroup $G$ được phép gọi nếu:
   $$\text{(Workspace)} \to \text{[:CAN\_USE]} \to \text{(ToolGroup)}$$
   VÀ không tồn tại quan hệ phủ quyết:
   $$\text{NOT } (\text{Workspace}) \to \text{[:DISABLED]} \to \text{(Tool)}$$
   HOẶC tồn tại quan hệ cấp quyền đích danh:
   $$\text{(Workspace)} \to \text{[:CAN\_USE]} \to \text{(Tool)}$$
