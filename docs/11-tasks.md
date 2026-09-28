# 11. Kế hoạch Triển khai & Chia nhỏ Nhiệm vụ (Roadmap & Implementation Tasks)

Kế hoạch được chia nhỏ thành 5 Milestone tuần tự với các Ticket/Task độc lập, vừa vặn với Context Window của AI Agent (< 100k tokens/task):

---

## 🎯 Milestone 1: Hạ tầng Dự án, CSDL & Môi trường (Foundation & Schemas)

### [TASK-101] Khởi tạo Turborepo Monorepo & Cấu hình Docker
* **Mục tiêu:** Thiết lập khung sườn dự án chuẩn với pnpm workspaces.
* **Chi tiết công việc:**
  * Tạo cấu trúc thư mục: `apps/web`, `apps/agent-worker`, `packages/database`, `packages/core`, `packages/channels`.
  * Cấu hình `turbo.json`, `pnpm-workspace.yaml`, và root `package.json`.
  * Viết `docker-compose.yml` chạy: PostgreSQL 16, Neo4j 5, Redis 7.
* **Tiêu chuẩn nghiệm thu (DoD):** Chạy `pnpm build` và `docker compose up -d` thành công, các dịch vụ DB hoạt động bình thường.

### [TASK-102] Xây dựng Database Package & Prisma Schema
* **Mục tiêu:** Thiết lập tầng CSDL PostgreSQL cho toàn bộ hệ thống.
* **Chi tiết công việc:**
  * Khởi tạo Prisma trong `packages/database`.
  * Khai báo toàn bộ các bảng: `workspaces`, `channel_accounts`, `channel_chats`, `tool_groups`, `tools`, `skills`, `workspace_tool_configs`, `audit_logs`.
  * Viết hàm mã hóa/giải mã AES-256-GCM trong `packages/database/src/encryption.ts`.
  * Chạy `prisma migrate dev` sinh migration đầu tiên.
* **Tiêu chuẩn nghiệm thu (DoD):** Unit test cho hàm mã hóa/giải mã pass 100%; Prisma Client import và query được.

### [TASK-103] Xây dựng Neo4j Driver & Graph Constraints Seed
* **Mục tiêu:** Thiết lập kết nối Neo4j và tạo các ràng buộc duy nhất (Constraints).
* **Chi tiết công việc:**
  * Viết `packages/database/src/neo4j.ts` tạo singleton driver kết nối Neo4j.
  * Viết script chạy các câu lệnh `CREATE CONSTRAINT` cho các node `Workspace`, `ChannelChat`, `ToolGroup`, `Tool`, `Skill`.
  * Viết các helper Cypher queries cơ bản.
* **Tiêu chuẩn nghiệm thu (DoD):** Script chạy thành công, mở Neo4j Browser thấy các constraints đã được kích hoạt.

---

## 🎯 Milestone 2: Core Tool Engine & Dynamic Variable Injection

### [TASK-201] Xây dựng Bộ nạp Biến Động (Dynamic Variable Injector)
* **Mục tiêu:** Thay thế các biến `{{KEY}}` trong URL, Header, Query và Body của Tool bằng giá trị từ Scoped Config của Workspace.
* **Chi tiết công việc:**
  * Viết `packages/core/src/tools/variable-injector.ts`.
  * Hỗ trợ cú pháp placeholder `{{VAR_NAME}}` đệ quy trong chuỗi và đối tượng JSON.
  * Báo lỗi rõ ràng nếu thiếu biến bắt buộc được khai báo trong `required_variables`.
* **Tiêu chuẩn nghiệm thu (DoD):** Unit test kiểm tra thay thế biến chính xác cho cả URL và Headers.

### [TASK-202] Xây dựng HTTP Tool Executor & SSRF Protection
* **Mục tiêu:** Thực thi gọi API thật đến hệ thống bên ngoài theo JSON Schema.
* **Chi tiết công việc:**
  * Viết `packages/core/src/tools/executor.ts` sử dụng `fetch` / `axios`.
  * Kiểm tra và ngăn chặn địa chỉ IP nội bộ (SSRF Filter).
  * Tự động gắn Authentication (Bearer, API Key Header/Query, Basic Auth).
  * Đo đếm thời gian phản hồi (latency), bắt lỗi timeout (> 10s).
* **Tiêu chuẩn nghiệm thu (DoD):** Test gọi thử một Mock API công khai trả về kết quả 200 OK và bắt được lỗi khi API chết.

### [TASK-203] Xây dựng Tầng Phân quyền Đồ thị 2 tầng (Neo4j RBAC Resolver)
* **Mục tiêu:** Truy vấn quyền hạn Workspace đối với Tool và Skill từ Neo4j.
* **Chi tiết công việc:**
  * Viết hàm `getWorkspacePermissions(workspaceId)` thực thi câu lệnh Cypher 2 tầng (kế thừa từ ToolGroup và loại trừ `[:DISABLED]`).
  * Viết hàm `resolveWorkspaceFromChat(platform, platformChatId)`.
* **Tiêu chuẩn nghiệm thu (DoD):** Unit test với dữ liệu đồ thị mẫu xác nhận đúng các Tool được phép/bị cấm.

### [TASK-204] Xây dựng Native MCP Client Executor & Auto-Discovery
* **Mục tiêu:** Kết nối MCP Server qua SSE/HTTP bằng `@modelcontextprotocol/sdk`, bóc tách schema và thực thi tool.
* **Chi tiết công việc:**
  * Viết parser bóc tách cấu hình JSON `mcpServers` (format Claude Desktop).
  * Viết module `mcp-executor.ts` thực thi handshake và gọi `tools/list` để auto-discover tools.
  * Tích hợp gọi `callTool` trực tiếp với timeout 15s và xử lý lỗi ngắt kết nối an toàn cho Worker Agent.
* **Tiêu chuẩn nghiệm thu (DoD):** Kết nối thành công tới remote MCP SSE server, lấy đủ danh sách tool schema và chạy `callTool` trả về dữ liệu chuẩn.

---

## 🎯 Milestone 3: Channel Gateways & Hàng đợi Redis Streams

### [TASK-301] Tích hợp Adapter Telegram (grammY)
* **Mục tiêu:** Kết nối bot Telegram, đồng bộ nhóm và bắt tin nhắn.
* **Chi tiết công việc:**
  * Viết `packages/channels/src/telegram/index.ts`.
  * Xử lý xác thực Token qua Telegram API `getMe`.
  * Lắng nghe sự kiện thêm bot vào nhóm chat $\rightarrow$ tự động lưu nhóm vào `channel_chats`.
  * Filter tin nhắn: Chỉ tiếp nhận khi có mention `@bot` trong nhóm hoặc tin nhắn trực tiếp.
* **Tiêu chuẩn nghiệm thu (DoD):** Thêm bot vào nhóm Telegram, nhận diện được sự kiện và lấy được `chat_id`.

### [TASK-302] Tích hợp Adapter Zalo (`zca-js` / OA)
* **Mục tiêu:** Tạo cơ chế đăng nhập Zalo qua mã QR và nhận diện tin nhắn nhóm.
* **Chi tiết công việc:**
  * Viết `packages/channels/src/zalo/index.ts`.
  * Tạo API phát sinh QR Code cho Web Dashboard.
  * Lưu trữ session cookie đã mã hóa sau khi quét thành công.
  * Lắng nghe tin nhắn từ nhóm Zalo.
* **Tiêu chuẩn nghiệm thu (DoD):** Quét mã QR thành công, session kết nối được thiết lập.

### [TASK-303] Thiết lập Redis Streams Inbound/Outbound Engine
* **Mục tiêu:** Cầu nối trung gian giữa Chat Adapters và Agent Engine.
* **Chi tiết công việc:**
  * Viết `apps/agent-worker/src/consumers/inbound.ts`: Đọc `stream:inbound_messages`.
  * Viết `apps/agent-worker/src/consumers/outbound.ts`: Đọc `stream:outbound_messages` và gọi hàm gửi tin nhắn tương ứng của Telegram/Zalo.
* **Tiêu chuẩn nghiệm thu (DoD):** Đẩy một tin giả vào inbound stream, worker nhận được và chuyển tiếp sang outbound stream thành công.

---

## 🎯 Milestone 4: Multi-Agent Orchestration (Router & Worker Loop)

### [TASK-401] Xây dựng Router Agent (Intent Classifier via OpenRouter)
* **Mục tiêu:** Phân loại yêu cầu người dùng và tra cứu Skill/Tool danh mục nhanh.
* **Chi tiết công việc:**
  * Viết `packages/core/src/agents/router-agent.ts`.
  * Gọi OpenRouter với model `google/gemini-2.0-flash`.
  * Nạp danh sách Skills từ Neo4j $\rightarrow$ trích xuất Structured Output (Khớp Skill nào hoặc Đề xuất Tool Groups nào).
* **Tiêu chuẩn nghiệm thu (DoD):** Tin nhắn "Kiểm tra đơn hàng 123" trả về đúng Intent và danh mục Tool liên quan.

### [TASK-402] Xây dựng Worker Agent (Think/Plan/Act Execution Loop)
* **Mục tiêu:** Lập kế hoạch từng bước và gọi các Tool API để lấy dữ liệu thực tế.
* **Chi tiết công việc:**
  * Viết `packages/core/src/agents/worker-agent.ts`.
  * Gọi OpenRouter với model `anthropic/claude-3.5-sonnet`.
  * Chuyển đổi JSON Schema của các Tool thành định dạng OpenAI Tools Function Calling.
  * Triển khai vòng lặp tối đa 5 bước (Loop: Model Think $\rightarrow$ Call Tool via Executor $\rightarrow$ Feed Observation $\rightarrow$ Repeat/Final Answer).
* **Tiêu chuẩn nghiệm thu (DoD):** Agent tự động gọi Tool tra cứu kho và trả về câu trả lời có chứa dữ liệu từ Tool.

### [TASK-403] Tích hợp Ghi Audit Log & Tracing
* **Mục tiêu:** Lưu vết đầy đủ quá trình ra quyết định của Agent vào PostgreSQL.
* **Chi tiết công việc:**
  * Ghi nhận `execution_plan`, `tool_calls` (với input, output đã mask bảo mật), `latency_ms` vào bảng `audit_logs`.
* **Tiêu chuẩn nghiệm thu (DoD):** Mỗi tin nhắn chat được xử lý đều có một bản ghi audit log hoàn chỉnh trong DB.

---

## 🎯 Milestone 5: Web Dashboard & Trải nghiệm Quản trị (Next.js & UI)

### [TASK-501] Xây dựng Phân hệ Quản lý Kênh (Channel Hub UI)
* **Mục tiêu:** Giao diện kết nối tài khoản Telegram/Zalo và hiển thị danh sách nhóm chat.
* **Chi tiết công việc:**
  * Modal nhập Telegram Bot Token và test kết nối.
  * Modal hiển thị QR Code động để quét Zalo.
  * Bảng danh sách các nhóm chat đã đồng bộ.
* **Tiêu chuẩn nghiệm thu (DoD):** Thao tác kết nối tài khoản thành công ngay trên Web UI.

### [TASK-502] Xây dựng Kho Quản lý Tool Groups & Tool APIs (Tool Catalog UI)
* **Mục tiêu:** Tạo và quản lý Tool Groups, Tools con và Runner chạy thử.
* **Chi tiết công việc:**
  * Form tạo Tool Group (Base URL, Auth Type, Dynamic Variables).
  * Form tạo Tool API (HTTP Method, Path, JSON Schema builder).
  * Drawer chạy thử Tool (Test Tool) xem JSON Response thực tế.
* **Tiêu chuẩn nghiệm thu (DoD):** Tạo Tool mới trên UI và bấm nút Test nhận được kết quả thành công.

### [TASK-503] Xây dựng Quản lý Workspace & Scoped Config (Workspace Hub UI)
* **Mục tiêu:** Màn hình phân quyền trung tâm theo từng không gian làm việc.
* **Chi tiết công việc:**
  * Tab 1: Danh sách Checkbox gán các nhóm chat Zalo/Telegram vào Workspace.
  * Tab 2: Switch toggle bật/tắt Skills.
  * Tab 3: Bật/tắt Tool Groups kèm form nhập **Scoped Variables Overrides** (`{{API_KEY}}`) riêng cho Workspace.
* **Tiêu chuẩn nghiệm thu (DoD):** Lưu cấu hình Workspace thành công, dữ liệu đồng bộ mượt mà vào cả Postgres và Neo4j.

### [TASK-504] Xây dựng Màn hình Giám sát Audit Logs & Agent Trace Inspector
* **Mục tiêu:** Quan sát luồng tư duy và lịch sử hội thoại của AI Agent.
* **Chi tiết công việc:**
  * Bảng lọc theo Kênh, Workspace, Trạng thái.
  * Drawer hiển thị trực quan sơ đồ luồng: Inbound Msg $\rightarrow$ Router Decision $\rightarrow$ Worker Thought $\rightarrow$ Tool Calls Payload $\rightarrow$ Bot Response.
* **Tiêu chuẩn nghiệm thu (DoD):** Admin xem được toàn bộ vết thực thi của một tin nhắn chat thực tế trên UI.

### [TASK-505] Xây dựng UI Import Cấu hình MCP & Nút Đồng bộ (Sync Tools)
* **Mục tiêu:** Giao diện Modal dán cấu hình JSON `mcpServers`, preview danh sách tool và nút đồng bộ thủ công.
* **Chi tiết công việc:**
  * Thêm Tab "Import MCP" trong form tạo Tool Group trên trang `/tools`.
  * Hiển thị bảng Preview Tools nhận diện được (Tên, Mô tả, Schema) kèm Checkbox chọn lọc.
  * Thêm nút "Sync Tools from Server" trên trang chi tiết ToolGroup `/tools/groups/[id]`.
* **Tiêu chuẩn nghiệm thu (DoD):** Dán đoạn JSON config của `simplefinance`, fetch danh sách tool thành công và lưu vào CSDL.
