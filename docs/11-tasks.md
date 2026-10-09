# 11. Kế hoạch Triển khai & Tiêu chuẩn Nghiệm thu Chi tiết (Roadmap & DoD Matrix)

Kế hoạch được chia nhỏ thành 7 Milestone tuần tự với các Ticket/Task độc lập, vừa vặn với Context Window của AI Agent (< 100k tokens/task). Mỗi nhiệm vụ đều đi kèm **Tiêu chuẩn Nghiệm thu (Definition of Done - DoD)** rõ ràng với các lệnh kiểm thử (cURL, CLI, Cypher) có thể xác minh tự động.

---

## 🎯 Milestone 1: Hạ tầng Dự án, CSDL & Môi trường (Foundation & Schemas)

### [TASK-101] Khởi tạo Turborepo Monorepo & Cấu hình Docker
* **Mục tiêu:** Thiết lập khung sườn dự án chuẩn với pnpm workspaces.
* **Chi tiết công việc:**
  * Tạo cấu trúc thư mục: `apps/web`, `apps/agent-worker`, `packages/database`, `packages/core`, `packages/channels`.
  * Cấu hình `turbo.json`, `pnpm-workspace.yaml`, và root `package.json`.
  * Viết `docker-compose.yml` chạy: PostgreSQL 16, Neo4j 5, Redis 7.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Chạy lệnh kiểm tra build toàn dự án thành công không lỗi:
     ```bash
     pnpm install && pnpm build
     ```
  2. Khởi động các container CSDL ở chế độ nền:
     ```bash
     docker compose up -d
     ```
  3. Kiểm tra cổng mạng: Postgres (`5432`), Neo4j (`7474`, `7687`), Redis (`6379`) đều ở trạng thái `LISTEN`.

---

### [TASK-102] Xây dựng Database Package & Prisma Schema
* **Mục tiêu:** Thiết lập tầng CSDL PostgreSQL cho toàn bộ hệ thống.
* **Chi tiết công việc:**
  * Khởi tạo Prisma trong `packages/database`.
  * Khai báo toàn bộ các bảng: `workspaces`, `channel_accounts`, `channel_chats`, `tool_groups`, `tools`, `skills`, `workspace_tool_configs`, `audit_logs`, `contacts`.
  * Viết hàm mã hóa/giải mã AES-256-GCM trong `packages/database/src/encryption.ts`.
  * Chạy `prisma db push` hoặc migration cập nhật DB.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. File `schema.prisma` đầy đủ toàn bộ models và enums (`PlatformType`, `ToolAuthType`, `ContactRole`).
  2. Unit test mã hóa AES-256-GCM pass 100%:
     ```bash
     npx tsx -e "import { encrypt, decrypt } from './packages/database/src/encryption'; const t = 'secret_test'; const enc = encrypt(t); console.assert(enc.split(':').length === 3); console.assert(decrypt(enc) === t); console.log('PASS');"
     ```
  3. Xuất thành công `@omniagent/database` client và query thử được bản ghi từ Node.js script.

---

### [TASK-103] Xây dựng Neo4j Driver & Graph Constraints Seed
* **Mục tiêu:** Thiết lập kết nối Neo4j và tạo các ràng buộc duy nhất (Constraints).
* **Chi tiết công việc:**
  * Viết `packages/database/src/neo4j.ts` tạo singleton driver kết nối Neo4j.
  * Viết script chạy các câu lệnh `CREATE CONSTRAINT` cho các node `Workspace`, `ChannelChat`, `ToolGroup`, `Tool`, `Skill`, `Contact`.
  * Viết các helper Cypher queries cơ bản.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Chạy script seed constraints thành công không vấp lỗi:
     ```bash
     npx tsx packages/database/src/seed-constraints.ts
     ```
  2. Kiểm tra trong Neo4j bằng Cypher:
     ```cypher
     SHOW CONSTRAINTS YIELD name, type, entityType, properties;
     ```
     Kết quả trả về đủ 6 constraints: `unique_workspace_id`, `unique_channel_chat_id`, `unique_tool_group_id`, `unique_tool_id`, `unique_skill_id`, `unique_contact_id`.

---

## 🎯 Milestone 2: Core Tool Engine & Dynamic Variable Injection

### [TASK-201] Xây dựng Bộ nạp Biến Động (Dynamic Variable Injector)
* **Mục tiêu:** Thay thế các biến `{{KEY}}` trong URL, Header, Query và Body của Tool bằng giá trị từ Scoped Config của Workspace.
* **Chi tiết công việc:**
  * Viết `packages/core/src/tools/variable-injector.ts`.
  * Hỗ trợ cú pháp placeholder `{{VAR_NAME}}` đệ quy trong chuỗi và đối tượng JSON.
  * Báo lỗi rõ ràng nếu thiếu biến bắt buộc được khai báo trong `required_variables`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Test case thay thế chuỗi đơn: Input `"https://api.vn?key={{API_KEY}}"`, Biến `{ API_KEY: "123" }` $\to$ Output `"https://api.vn?key=123"`.
  2. Test case lồng trong Object/Header: Input `{ Authorization: "Bearer {{TOKEN}}" }` $\to$ Output `{ Authorization: "Bearer xyz" }`.
  3. Test case thiếu biến: Ném ngoại lệ `Error: Missing required variable [BRANCH_CODE]` khi thiếu key yêu cầu.

---

### [TASK-202] Xây dựng HTTP Tool Executor & SSRF Protection
* **Mục tiêu:** Thực thi gọi API thật đến hệ thống bên ngoài theo JSON Schema.
* **Chi tiết công việc:**
  * Viết `packages/core/src/tools/executor.ts` sử dụng `fetch` / `axios`.
  * Kiểm tra và ngăn chặn địa chỉ IP nội bộ (SSRF Filter).
  * Cho phép ngoại lệ `/api/mcp` nội bộ.
  * Tự động gắn Authentication (Bearer, API Key Header/Query, Basic Auth).
  * Đo đếm thời gian phản hồi (latency), bắt lỗi timeout (> 10s).
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Gọi URL `http://127.0.0.1:8080` hoặc `http://192.168.1.1` $\to$ Bắt buộc bị chặn với mã lỗi `SSRF_BLOCKED`.
  2. Gọi URL whitelist `http://localhost:3000/api/mcp` $\to$ Cho phép đi qua.
  3. Gọi một Mock Public Endpoint (ví dụ `https://httpbin.org/get`) $\to$ Trả về status 200 kèm latency đo được dạng integer (ms).

---

### [TASK-203] Xây dựng Tầng Phân quyền Đồ thị 2 tầng (Neo4j RBAC Resolver)
* **Mục tiêu:** Truy vấn quyền hạn Workspace đối với Tool và Skill từ Neo4j.
* **Chi tiết công việc:**
  * Viết hàm `getWorkspacePermissions(workspaceId)` thực thi câu lệnh Cypher 2 tầng (kế thừa từ ToolGroup và loại trừ `[:DISABLED]`).
  * Viết hàm `resolveWorkspaceFromChat(platform, platformChatId)`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Tạo dữ liệu mẫu trong Neo4j: `(WS)-[:CAN_USE]->(TG)-[:CONTAINS]->(T1, T2)` và `(WS)-[:DISABLED]->(T2)`.
  2. Chạy hàm kiểm tra:
     ```typescript
     const perms = await getWorkspacePermissions("ws_test");
     // Kết quả: perms.tools chứa T1, nhưng KHÔNG chứa T2
     console.assert(perms.tools.some(t => t.id === 'T1') && !perms.tools.some(t => t.id === 'T2'));
     ```
  3. Gửi chat ID chưa gán vào Workspace $\to$ Trả về `null`.

---

### [TASK-204] Xây dựng Native MCP Client Executor & Auto-Discovery
* **Mục tiêu:** Kết nối MCP Server qua SSE/HTTP bằng `@modelcontextprotocol/sdk`, bóc tách schema và thực thi tool.
* **Chi tiết công việc:**
  * Viết parser bóc tách cấu hình JSON `mcpServers` (format Claude Desktop).
  * Viết module `mcp-executor.ts` thực thi handshake và gọi `tools/list` để auto-discover tools.
  * Tích hợp gọi `callTool` trực tiếp với timeout 15s và xử lý lỗi ngắt kết nối an toàn cho Worker Agent.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Nạp endpoint SSE hoặc HTTP của một MCP server hợp lệ $\to$ Lấy về mảng danh sách tool có đúng chuẩn JSON Schema của `inputSchema`.
  2. Gọi thử một MCP Tool với arguments hợp lệ $\to$ Nhận về payload content định dạng text/json từ MCP Server.
  3. MCP Server bị ngắt kết nối $\to$ Bắt lỗi timeout sau 15s và trả về thông báo lỗi thân thiện, không làm sập tiến trình worker.

---

## 🎯 Milestone 3: Channel Gateways & Hàng đợi Redis Streams

### [TASK-301] Tích hợp Adapter Telegram (grammY)
* **Mục tiêu:** Kết nối bot Telegram, đồng bộ nhóm và bắt tin nhắn.
* **Chi tiết công việc:**
  * Viết `packages/channels/src/telegram/index.ts`.
  * Xử lý xác thực Token qua Telegram API `getMe`.
  * Lắng nghe sự kiện thêm bot vào nhóm chat $\rightarrow$ tự động lưu nhóm vào `channel_chats`.
  * Filter tin nhắn: Nhận diện tag `@bot`, mention, reply hoặc cờ `alwaysRespond`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Cung cấp Bot Token hợp lệ $\to$ In ra thông tin `username` và `id` của bot từ Telegram API.
  2. Bot được add vào nhóm Telegram mẫu $\to$ CSDL PostgreSQL bảng `channel_chats` tự động xuất hiện bản ghi mới với `platformChatId = group_chat_id` và `type = 'GROUP'`.
  3. Gửi tin nhắn có tag `@bot` trong nhóm $\to$ Sự kiện được kích hoạt và đẩy payload vào consumer.

---

### [TASK-302] Tích hợp Adapter Zalo (`zca-js` / OA)
* **Mục tiêu:** Tạo cơ chế đăng nhập Zalo qua mã QR và nhận diện tin nhắn nhóm.
* **Chi tiết công việc:**
  * Viết `packages/channels/src/zalo/index.ts`.
  * Tạo API phát sinh QR Code cho Web Dashboard.
  * Lưu trữ session cookie đã mã hóa sau khi quét thành công.
  * Lắng nghe tin nhắn từ nhóm Zalo.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. API sinh mã QR trả về `qrDataURL` hợp lệ hiển thị được trên ảnh.
  2. Quét mã QR thành công bằng app Zalo Mobile $\to$ Trạng thái chuyển thành `CONNECTED`, cookie được mã hóa AES-256-GCM và lưu vào bảng `channel_accounts`.
  3. Khi có tin nhắn trong nhóm Zalo có bot $\to$ Adapter nhận diện được `thread_id` và nội dung chat.

---

### [TASK-303] Thiết lập Redis Streams Inbound/Outbound Engine
* **Mục tiêu:** Cầu nối trung gian giữa Chat Adapters và Agent Engine.
* **Chi tiết công việc:**
  * Viết `apps/agent-worker/src/consumers/inbound.ts`: Đọc `stream:inbound_messages`.
  * Viết `apps/agent-worker/src/consumers/outbound.ts`: Đọc `stream:outbound_messages` và gọi hàm gửi tin nhắn tương ứng của Telegram/Zalo.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Đẩy một payload mẫu vào stream inbound:
     ```bash
     redis-cli XADD stream:inbound_messages * platform "TELEGRAM" platformChatId "-100123" text "Hello Agent"
     ```
  2. Worker Consumer đọc và log ra nội dung tin nhắn.
  3. Worker đẩy phản hồi vào outbound stream $\to$ Outbound Consumer tiếp nhận và gửi message thành công qua API tương ứng.

---

## 🎯 Milestone 4: Multi-Agent Orchestration (Router & Worker Loop)

### [TASK-401] Xây dựng Router Agent (Intent Classifier via OpenRouter)
* **Mục tiêu:** Phân loại yêu cầu người dùng và tra cứu Skill/Tool danh mục nhanh.
* **Chi tiết công việc:**
  * Viết `packages/core/src/agents/router-agent.ts`.
  * Gọi OpenRouter với model `google/gemini-2.0-flash`.
  * Nạp danh sách Skills từ Neo4j $\rightarrow$ trích xuất Structured Output (Khớp Skill nào hoặc Đề xuất Tool Groups nào).
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Input: `"Kiểm tra tồn kho sản phẩm Áo Polo mã AP01"` với Workspace có ToolGroup `ERP_INVENTORY`.
  2. Output trả về định dạng JSON:
     ```json
     {
       "intent": "CHECK_INVENTORY",
       "matchedSkill": null,
       "suggestedToolGroups": ["ERP_INVENTORY"],
       "confidence": 0.95
     }
     ```
  3. Thời gian phản hồi phân loại (Latency) $\le 1200\text{ms}$.

---

### [TASK-402] Xây dựng Worker Agent (Think/Plan/Act Execution Loop)
* **Mục tiêu:** Lập kế hoạch từng bước và gọi các Tool API để lấy dữ liệu thực tế.
* **Chi tiết công việc:**
  * Viết `packages/core/src/agents/worker-agent.ts`.
  * Gọi OpenRouter với model `anthropic/claude-3.5-sonnet`.
  * Chuyển đổi JSON Schema của các Tool thành định dạng OpenAI Tools Function Calling.
  * Triển khai vòng lặp tối đa 5 bước (Loop: Model Think $\rightarrow$ Call Tool via Executor $\rightarrow$ Feed Observation $\rightarrow$ Repeat/Final Answer).
  * Quy định Persona Tiếng Việt: Xưng hô bằng `nickname` hoặc Tên chính (Given Name).
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Agent tự động gọi Tool tra cứu kho khi người dùng hỏi về tồn kho.
  2. Nếu Tool trả về dữ liệu `{ stock: 45, unit: "cái" }`, Agent tổng hợp câu trả lời tự nhiên chứa con số 45.
  3. Bắt buộc dừng lại sau tối đa 5 vòng lặp, không bao giờ bị treo vô tận.
  4. Persona kiểm chứng: Người hỏi tên `"Trần Đức Huy"`, Agent mở đầu câu trả lời bằng `"Chào anh Huy"`.

---

### [TASK-403] Tích hợp Ghi Audit Log & Tracing
* **Mục tiêu:** Lưu vết đầy đủ quá trình ra quyết định của Agent vào PostgreSQL.
* **Chi tiết công việc:**
  * Ghi nhận `execution_plan`, `tool_calls` (với input, output đã mask bảo mật), `latency_ms` vào bảng `audit_logs`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Sau mỗi lượt xử lý tin nhắn, câu lệnh SQL kiểm tra:
     ```sql
     SELECT id, platform, session_id, execution_plan, tool_calls, latency_ms FROM audit_logs ORDER BY created_at DESC LIMIT 1;
     ```
     Trả về đầy đủ bản ghi có `latency_ms > 0` và `tool_calls` không bị rỗng.
  2. Các giá trị token/secret trong payload đều hiển thị dạng `***MASKED***`.

---

## 🎯 Milestone 5: Web Dashboard & Trải nghiệm Quản trị (Next.js & UI)

### [TASK-501] Xây dựng Phân hệ Quản lý Kênh (Channel Hub UI)
* **Mục tiêu:** Giao diện kết nối tài khoản Telegram/Zalo và hiển thị danh sách nhóm chat.
* **Chi tiết công việc:**
  * Modal nhập Telegram Bot Token và test kết nối.
  * Modal hiển thị QR Code động để quét Zalo.
  * Bảng danh sách các nhóm chat đã đồng bộ.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Truy cập `/channels` hiển thị đầy đủ danh sách tài khoản đã kết nối kèm badge trạng thái (`CONNECTED`, `EXPIRED`).
  2. Bấm "Thêm Bot Telegram", nhập token hợp lệ $\to$ Hiện thông báo thành công và tài khoản xuất hiện trong bảng.
  3. Bấm "Kết nối Zalo" $\to$ Modal hiện QR code cập nhật thời gian thực.

---

### [TASK-502] Xây dựng Kho Quản lý Tool Groups & Tool APIs (Tool Catalog UI)
* **Mục tiêu:** Tạo và quản lý Tool Groups, Tools con và Runner chạy thử.
* **Chi tiết công việc:**
  * Form tạo Tool Group (Base URL, Auth Type, Dynamic Variables).
  * Form tạo Tool API (HTTP Method, Path, JSON Schema builder).
  * Drawer chạy thử Tool (Test Tool) xem JSON Response thực tế.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Tạo Tool Group mới trên `/tools` thành công $\to$ Dữ liệu xuất hiện trong PostgreSQL và sinh node trong Neo4j.
  2. Thêm Tool con với schema input $\to$ Bấm nút "Test Tool" trong Drawer $\to$ Nhập param test $\to$ Nhận response 200 OK ngay trên giao diện.

---

### [TASK-503] Xây dựng Quản lý Workspace & Scoped Config (Workspace Hub UI)
* **Mục tiêu:** Màn hình phân quyền trung tâm theo từng không gian làm việc.
* **Chi tiết công việc:**
  * Tab 1: Danh sách Checkbox gán các nhóm chat Zalo/Telegram vào Workspace.
  * Tab 2: Switch toggle bật/tắt Skills.
  * Tab 3: Bật/tắt Tool Groups kèm form nhập **Scoped Variables Overrides** (`{{API_KEY}}`) riêng cho Workspace.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Mở trang `/workspaces/[id]` $\to$ Bật Switch ToolGroup `ERP_INVENTORY` $\to$ Form sinh động các ô nhập `API_KEY` và `BRANCH_ID`.
  2. Nhập giá trị và bấm Lưu $\to$ Bản ghi trong `workspace_tool_configs` được cập nhật với trường `encrypted_config` là chuỗi mã hóa AES.
  3. Node Workspace trong Neo4j tạo quan hệ `[:CAN_USE]` tới node ToolGroup tương ứng.

---

### [TASK-504] Xây dựng Màn hình Giám sát Audit Logs & Agent Trace Inspector
* **Mục tiêu:** Quan sát luồng tư duy và lịch sử hội thoại của AI Agent.
* **Chi tiết công việc:**
  * Bảng lọc theo Kênh, Workspace, Trạng thái.
  * Drawer hiển thị trực quan sơ đồ luồng: Inbound Msg $\rightarrow$ Router Decision $\rightarrow$ Worker Thought $\rightarrow$ Tool Calls Payload $\rightarrow$ Bot Response.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Truy cập `/audit` $\to$ Danh sách log hiển thị phân trang mượt mà.
  2. Click vào 1 dòng log $\to$ Drawer mở ra hiển thị cây timeline các bước suy nghĩ (Thought) và mảng JSON input/output của các Tool đã gọi.

---

### [TASK-505] Xây dựng UI Import Cấu hình MCP & Nút Đồng bộ (Sync Tools)
* **Mục tiêu:** Giao diện Modal dán cấu hình JSON `mcpServers`, preview danh sách tool và nút đồng bộ thủ công.
* **Chi tiết công việc:**
  * Thêm Tab "Import MCP" trong form tạo Tool Group trên trang `/tools`.
  * Hiển thị bảng Preview Tools nhận diện được (Tên, Mô tả, Schema) kèm Checkbox chọn lọc.
  * Thêm nút "Sync Tools from Server" trên trang chi tiết ToolGroup `/tools/groups/[id]`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Dán JSON format: `{"mcpServers": {"server": {"url": "http://localhost:3000/api/mcp"}}}` $\to$ Bấm "Discover" $\to$ Bảng preview hiện đủ 8 tools.
  2. Bấm Lưu $\to$ Tạo ToolGroup loại MCP và lưu đủ 8 tools con vào DB.
  3. Bấm nút "Sync Tools" $\to$ Báo đồng bộ thành công mà không làm mất cấu hình biến trong các Workspace.

---

### [TASK-506] Xây dựng Admin AI Copilot Drawer (`FEAT-ADMIN-COPILOT`)
* **Mục tiêu:** Trợ lý ảo AI hoạt động dưới dạng slide-over drawer hỗ trợ quản trị hệ thống phân quyền Zalo/Telegram.
* **Chi tiết công việc:**
  * Core Agent Dispatcher tích hợp OpenRouter LLM với 4 nhóm function calling nội bộ (`mcp_management`, `workspace_permissions`, `skill_management`, `system_diagnostics`).
  * API endpoints: `/api/admin/copilot/chat` và `/api/admin/copilot/execute` (ghi Audit Log `COPILOT_ACTION`).
  * UI Component: Slide-over Right Sidebar Drawer (`w-[400px]`), trigger button góc phải, Action Preview Card kèm 1-Click Confirm.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Bấm nút Copilot góc phải màn hình $\to$ Drawer mở ra với avatar AI và khung chat.
  2. Gõ lệnh: `"Cấp quyền công cụ ERP cho Workspace Chi nhánh Hà Nội"` $\to$ AI hiển thị **Action Preview Card** yêu cầu xác nhận.
  3. Bấm "Xác nhận thực thi" $\to$ Hành động được chạy vào DB và hiển thị thông báo thành công.

---

## 🎯 Milestone 6: Inbound Webhooks & Async Callback Gateway (`FEAT-WORKSPACE-WEBHOOKS`)

### [TASK-601] Cập nhật Database & Neo4j Models cho Webhook
* **Mục tiêu:** Tạo các bảng và quan hệ phục vụ Webhooks, Firebase credentials và Webhook Sessions.
* **Chi tiết công việc:**
  * Thêm models `WorkspaceWebhook`, `WorkspaceFirebaseConfig`, `WebhookSession` vào `packages/database/prisma/schema.prisma`.
  * Cập nhật `AuditLog` với `callbackStatus`, `callbackType`, `callbackTarget`, `retryCount`.
  * Áp dụng migration vào CSDL.
  * Tạo node `(:WorkspaceWebhook)-[:BELONGS_TO]->(:Workspace)` trong Neo4j.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Kiểm tra CSDL Postgres có 3 bảng mới: `workspace_webhooks`, `workspace_firebase_configs`, `webhook_sessions`.
  2. Neo4j tạo node `WorkspaceWebhook` liên kết đúng tới node `Workspace`.

---

### [TASK-602] Xây dựng Inbound Webhook Gateway Endpoint
* **Mục tiêu:** Tiếp nhận HTTP request từ Mobile App / Web bên ngoài và đưa vào hàng đợi.
* **Chi tiết công việc:**
  * Tạo API Route `POST /api/v1/workspaces/[id]/webhooks/[webhook_id]`.
  * Xác thực Secret Token (Header `Authorization: Bearer ...` hoặc `X-Webhook-Secret`).
  * Chuẩn hóa `session_id` (tự sinh `wh_{wh_id}_{sender_id}` nếu thiếu).
  * Đẩy payload vào Redis Stream `stream:inbound_messages` với platform `WEBHOOK`.
  * Trả về ngay `202 Accepted` kèm `job_id`, `session_id`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Lệnh cURL xác thực đúng token:
     ```bash
     curl -X POST http://localhost:3000/api/v1/workspaces/ws_01/webhooks/wh_01 \
       -H "Authorization: Bearer whsec_valid_123" \
       -H "Content-Type: application/json" \
       -d '{"message": "Hello Webhook", "sender_id": "client_99"}'
     ```
     Trả về HTTP Status `202 Accepted` trong $\le 50\text{ms}$ với JSON: `{"status": "ACCEPTED", "job_id": "...", "session_id": "..."}`.
  2. Gửi sai secret token $\to$ Trả về `401 Unauthorized`.

---

### [TASK-603] Xây dựng Quản lý Ngữ cảnh Hội thoại Đa lượt (WebhookSession Service)
* **Mục tiêu:** Lưu và khôi phục lịch sử chat cho từng phiên gọi Webhook.
* **Chi tiết công việc:**
  * Tạo service `packages/core/src/sessions/webhook-session.ts`.
  * Hàm `getSessionHistory(webhookId, sessionId)` lấy $N$ tin nhắn gần nhất nạp vào prompt cho Router & Worker Agent.
  * Hàm `appendSessionMessage(webhookId, sessionId, senderId, message)` lưu hội thoại sau khi hoàn thành.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Gửi tin 1: `"Giá sản phẩm A là bao nhiêu?"` $\to$ Agent trả lời: `"100.000 VNĐ"`.
  2. Gửi tin 2 cùng `session_id`: `"Nếu mua 5 cái thì có giảm không?"` $\to$ Agent hiểu chủ ngữ là "sản phẩm A" từ lịch sử phiên chat và trả lời chính xác.
  3. Bảng `webhook_sessions` lưu đủ 2 lượt chat (4 messages) liên kết đúng `session_id`.

---

### [TASK-604] Xây dựng Bộ điều phối Outbound Callback (HTTP POST & Firebase FCM)
* **Mục tiêu:** Gửi kết quả xử lý của Agent về phía ứng dụng bên ngoài một cách tin cậy.
* **Chi tiết công việc:**
  * HTTP POST Callback: Thực thi POST kết quả về `callback.url` kèm cơ chế Exponential Backoff Retry (3 lần: 2s, 10s, 30s) khi gặp lỗi kết nối/5xx.
  * Firebase FCM Push: Tích hợp Firebase Admin SDK, giải mã Service Account từ `WorkspaceFirebaseConfig` và gửi Data Message/Notification tới `callback.fcm_token`.
  * Cập nhật trạng thái `callbackStatus` vào `audit_logs`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Khởi tạo một Mock HTTP Server nhận POST $\to$ Agent hoàn thành xử lý $\to$ Mock server nhận đúng payload kết quả trong vòng 1s.
  2. Giả lập Mock Server trả về 503 Service Unavailable 2 lần đầu và 200 ở lần 3 $\to$ Callback Engine thử lại thành công sau các khoảng chờ 2s, 10s.
  3. CSDL `audit_logs.callback_status` chuyển thành `'SUCCESS'` và `retry_count = 2`.

---

### [TASK-605] Xây dựng Giao diện Quản lý Webhooks & Firebase trên Web Dashboard
* **Mục tiêu:** Cung cấp UI quản trị Webhook và cấu hình Firebase cho từng Workspace.
* **Chi tiết công việc:**
  * Tạo tab "Webhooks" trong màn hình `/workspaces/[id]`.
  * Bảng danh sách Webhooks (URL, Secret Masked, Switch toggle, Regenerate Secret, Delete).
  * Modal "Tạo Webhook Mới" hiển thị Secret Token 1 lần duy nhất kèm snippet cURL mẫu.
  * Modal/Drawer "Cấu hình Firebase FCM" hỗ trợ drag & drop file `serviceAccountKey.json`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Admin tạo Webhook mới trên Web $\to$ Modal hiện đầy đủ Secret Token dạng `whsec_...` và nút "Copy cURL mẫu".
  2. Bấm nút Regenerate Secret $\to$ Cảnh báo xác nhận $\to$ Token mới được tạo, token cũ bị vô hiệu hóa.
  3. Tải lên file JSON Firebase credentials $\to$ Hệ thống mã hóa lưu vào DB và hiển thị badge "Firebase Đã Cấu Hình".

---

## 🎯 Milestone 7: Internal System MCP & Global Contacts (`FEAT-INTERNAL-MCP-CONTACTS`)

### [TASK-701] Xây dựng Cơ sở dữ liệu & Cập nhật Prisma Schema cho Contacts
* **Mục tiêu:** Thêm bảng Contact và Enum Role để lưu trữ danh bạ.
* **Chi tiết công việc:**
  * Bổ sung bảng `Contact` với các trường `id`, `name`, `nickname`, `zaloId`, `telegramId`, `role` (USER, SUPER_ADMIN), và các thông tin mở rộng (`gender`, `birthYear`, `email`, `phone`, `hobbies`).
  * Thực thi `prisma db push` cập nhật CSDL.
  * Cập nhật Neo4j Driver (tạo node `Contact`, quan hệ `BELONGS_TO` với `Workspace`).
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Lệnh kiểm tra Prisma schema hợp lệ:
     ```bash
     npx prisma validate --schema packages/database/prisma/schema.prisma
     ```
  2. Khởi chạy seed ràng buộc Neo4j:
     ```bash
     npx tsx packages/database/src/seed-constraints.ts
     ```
     Xác nhận `unique_contact_id` tồn tại trong Neo4j.

---

### [TASK-702] Dịch vụ Auto-upsert & Nhận diện Danh bạ (Contact Identity Service)
* **Mục tiêu:** Tự động tạo và cập nhật danh bạ khi nhận tin nhắn.
* **Chi tiết công việc:**
  * Xây dựng `ContactService` trong `packages/core/src/contacts/contact-service.ts`.
  * Tại bước `Inbound Gateway`, bắt sự kiện nhận tin nhắn từ Zalo/Tele $\rightarrow$ check `zaloId` / `telegramId`.
  * Áp dụng quy tắc Auto-link thông minh: Nếu cùng tên trong cùng Workspace mà kênh còn trống $\to$ tự gán kênh. Nếu không $\to$ tạo mới.
  * Đính kèm `contact` và `role` vào ngữ cảnh `scopedVariablesMap` chuyển giao cho Agent.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Gọi hàm `ContactService.upsertFromMessage({ platform: "TELEGRAM", platformSenderId: "tg_999", senderName: "Đức Huy", workspaceId: "ws_01" })`.
  2. Bản ghi `Contact` được tạo thành công với `telegramId = 'tg_999'`, `role = 'USER'`.
  3. Gửi tiếp tin nhắn từ Zalo với tên `"Đức Huy"` trong cùng Workspace $\to$ Không tạo mới, cập nhật `zaloId` vào bản ghi có sẵn.

---

### [TASK-703] Phát triển Internal MCP Server Endpoint & Tools
* **Mục tiêu:** Cung cấp `/api/mcp` nội bộ và các lệnh quản trị cơ bản.
* **Chi tiết công việc:**
  * Khởi tạo Server MCP nội bộ chuẩn JSON-RPC 2.0 tại `apps/web/src/app/api/mcp/route.ts`.
  * Khai báo 8 Tools chuẩn: `create_workspace`, `list_workspaces`, `add_contact`, `list_contacts`, `update_contact_info`, `assign_contact_to_workspace`, `remove_contact_from_workspace`, `merge_contacts`.
  * Xây dựng Dynamic Guard kiểm tra `X-Caller-Role: SUPER_ADMIN`.
  * Whitelist SSRF cho `/api/mcp` trong `packages/core/src/tools/executor.ts` và `mcp-executor.ts`.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Test gọi `tools/list`:
     ```bash
     curl -s -X POST http://localhost:3000/api/mcp \
       -H "Content-Type: application/json" \
       -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
     ```
     Trả về mã 200 chứa mảng 8 công cụ quản trị.
  2. Test chặn quyền người dùng thường:
     ```bash
     curl -s -X POST http://localhost:3000/api/mcp \
       -H "Content-Type: application/json" \
       -H "X-Caller-Role: USER" \
       -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "create_workspace", "arguments": {"name": "Hacked WS"}}, "id": 2}'
     ```
     Trả về lỗi: `{"jsonrpc": "2.0", "error": {"code": -32001, "message": "Forbidden: Only SUPER_ADMIN can execute this action"}, "id": 2}`.
  3. Test gọi thành công với `X-Caller-Role: SUPER_ADMIN` $\to$ Tạo workspace thành công và trả về dữ liệu mới.

---

### [TASK-704] Xây dựng tính năng Hợp nhất Danh bạ (Merge Contacts)
* **Mục tiêu:** Gộp 2 định danh Zalo/Telegram vào làm 1 nếu phát hiện trùng lặp.
* **Chi tiết công việc:**
  * Viết hàm `ContactService.mergeContacts(primaryContactId, secondaryContactId)`.
  * Chuyển đổi ID kênh, kế thừa email, phone, gender, birthYear, hobbies, nickname từ Secondary sang Primary nếu Primary bị thiếu.
  * Kế thừa cờ `SUPER_ADMIN` nếu Secondary là admin.
  * Di chuyển toàn bộ các quan hệ `[:BELONGS_TO]` trong Neo4j sang Primary.
  * Xóa bản ghi Secondary trong Postgres và node trong Neo4j.
* **Tiêu chuẩn nghiệm thu (DoD):**
  1. Tạo 2 contact mẫu: Contact A (`id = 101`, `zaloId = "zl_101"`, `email = null`) và Contact B (`id = 102`, `telegramId = "tg_102"`, `email = "huy@gmail.com"`, `role = "SUPER_ADMIN"`).
  2. Gọi `mergeContacts(101, 102)` thành công.
  3. Kiểm tra DB:
     * Contact 101 có: `zaloId = "zl_101"`, `telegramId = "tg_102"`, `email = "huy@gmail.com"`, `role = "SUPER_ADMIN"`.
     * Contact 102 không còn tồn tại trong Postgres và Neo4j.
     * Neo4j node Contact 101 liên kết tới toàn bộ Workspace của cả 2 trước đây.
