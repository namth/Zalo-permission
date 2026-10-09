# 02. Các Phân hệ Hệ thống, Nghiệp vụ Chi tiết & Ma trận Phân quyền (Modules & RBAC)

## 1. Phân rã Các Phân hệ Hệ thống (System Modules)

Hệ thống được cấu thành từ 9 phân hệ nghiệp vụ chính:

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
| 7. Admin AI Copilot    | Trợ lý AI Drawer Quản trị Hệ thống bằng Ngôn ngữ Tự nhiên |
| 8. Webhook Gateway     | Inbound HTTP REST & Async Callback / Push Firebase FCM|
| 9. Internal MCP & Danh bạ | Tự Quản trị qua Chat, Quản lý & Hợp nhất Danh bạ    |
+-------------------------------------------------------------------------------+
```

---

### Phân hệ 1: Channel Hub (Quản lý Kênh Kết nối)

#### A. Mục tiêu & Phạm vi
Là cổng tiếp nhận và phát tin nhắn đa nền tảng, chịu trách nhiệm duy trì kết nối bền vững với Telegram Bot API và Zalo (Zalo Personal & Zalo Official Account - OA).

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Kết nối Telegram:**
   * **Xác thực Token:** Khi người dùng nhập Bot Token, hệ thống gọi ngay `getMe` tới Telegram API. Nếu thất bại, lập tức báo lỗi `INVALID_TELEGRAM_TOKEN` và không lưu vào CSDL.
   * **Cơ chế Lắng nghe:** Tự động đăng ký Webhook bảo mật (nếu có Public Domain / SSL) hoặc kích hoạt Polling Consumer chạy ngầm.
   * **Đồng bộ Nhóm chat Tự động:** Khi Bot được thêm vào nhóm mới, hệ thống tự động bắt sự kiện `my_chat_member` hoặc `new_chat_members`, trích xuất `chat_id`, `title`, `type` (`group`/`supergroup`) và lưu/cập nhật vào bảng `channel_chats`.
2. **Kết nối Zalo:**
   * **Zalo Personal (Zalo Cá nhân):** Tạo phiên đăng nhập thông qua mã QR động (thời gian sống 60 giây). Khi quét mã thành công qua ứng dụng Zalo Mobile, hệ thống mã hóa và lưu trữ `session_cookies` vào CSDL PostgreSQL (AES-256-GCM).
   * **Zalo Official Account (OA):** Quản lý qua `oa_id`, `access_token`, `refresh_token`. Tự động làm mới access token định kỳ trước khi hết hạn (TTL 25 giờ).
   * **Trạng thái Kết nối (Connection Lifecycle):**
     * `CONNECTED`: Kết nối bình thường, sẵn sàng nhận tin.
     * `EXPIRED`: Session cookie hoặc OAuth token hết hiệu lực; hệ thống tự động gửi thông báo cảnh báo lên UI Dashboard và ngừng nhận tin tạm thời.
     * `DISCONNECTED`: Quản trị viên chủ động ngắt kết nối.
3. **Xử lý Ngoại lệ & Trùng lặp Kênh:**
   * Một nhóm chat (`platform_chat_id`) chỉ thuộc về một tài khoản kết nối duy nhất tại một thời điểm.
   * Nếu nhóm chat bị xóa hoặc bot bị kích khỏi nhóm, trạng thái nhóm chat chuyển sang `INACTIVE` nhưng không xóa dữ liệu lịch sử Audit Log.

---

### Phân hệ 2: Tool & Skill Catalog (Kho Công cụ & Kỹ năng Master)

#### A. Mục tiêu & Phạm vi
Đóng vai trò là thư viện trung tâm lưu trữ toàn bộ các khả năng (Capabilities) của AI Agent, hỗ trợ hai chuẩn giao thức chính: **REST API truyền thống** và **Native MCP Server (Model Context Protocol)**.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Quản lý Tool Groups:**
   * **Cấu hình Master:** Định danh bằng `tool_group_key` (viết hoa dạng slug, ví dụ `ERP_INVENTORY`, `CRM_SALES`).
   * **Chuẩn Giao thức:**
     * `REST`: Khai báo Base URL, loại xác thực mặc định (`NONE`, `BEARER_TOKEN`, `API_KEY`, `BASIC_AUTH`, `CUSTOM_HEADERS`).
     * `MCP`: Khai báo SSE Endpoint URL hoặc stdio configuration JSON.
   * **Khai báo Biến Động (Dynamic Variables Schema):** Danh sách các khóa bí mật bắt buộc từng Workspace phải điền khi sử dụng (ví dụ: `["API_KEY", "TENANT_ID", "BRANCH_CODE"]`).
2. **Cơ chế Import & Đồng bộ MCP Nhanh (MCP Hub):**
   * **One-Click JSON Import:** Cho phép dán trực tiếp cấu hình `mcpServers` (format Claude Desktop / Cursor). Hệ thống tự động phân tích (parse) cú pháp và gửi request bắt tay (handshake) tới server MCP.
   * **Discovery & Schema Extraction:** Tự động gọi `tools/list` để bóc tách toàn bộ danh sách tools và `inputSchema` chuẩn JSON Schema Draft-07.
   * **Preview & Filter:** Hiển thị danh sách tools tìm được trên UI dạng bảng, cho phép tích chọn những tools muốn nạp vào hệ thống trước khi lưu.
   * **On-Demand Sync (Đồng bộ An toàn):** Cho phép bấm nút "Sync Tools" để cập nhật schema mới từ MCP server mà **tuyệt đối không làm mất** cấu hình biến riêng biệt (Scoped Vault) hay ma trận phân quyền đã cấp cho các Workspace.
3. **Phòng chống Tấn công SSRF (Server-Side Request Forgery):**
   * Mọi yêu cầu HTTP Tool Executor đều bắt buộc đi qua bộ lọc IP nội bộ (`SSRF Filter`).
   * Tự động chặn các dải IP riêng tư: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`.
   * **Ngoại lệ Duy nhất:** Whitelist rõ ràng cho điểm cuối nội bộ `/api/mcp` (Internal System MCP).
4. **Quản lý Skills Master:**
   * Định danh bằng `skill_key` kèm System Prompt định hướng nghiệp vụ (SOP Rules).
   * Khai báo Trigger Phrases (Từ khóa kích hoạt) phục vụ bước nhận diện ý định của Router Agent.
   * Ràng buộc phụ thuộc: Skill phải chỉ định rõ danh sách Tool con mà nó phụ thuộc. Nếu Workspace chưa được cấp quyền các Tool con đó, Skill sẽ không thể thực thi trọn vẹn.

---

### Phân hệ 3: Workspace Engine (Quản lý Không gian Làm việc & Phân quyền)

#### A. Mục tiêu & Phạm vi
Đơn vị cô lập dữ liệu và phân quyền đa khách hàng (Multi-tenant Isolation). Mỗi Workspace đại diện cho một chi nhánh, phòng ban, hoặc dự án độc lập.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Ràng buộc Nhóm Chat (Channel Mapping):**
   * **Quan hệ N - 1:** Một Workspace có thể chứa nhiều nhóm chat Zalo/Telegram. Tuy nhiên, một nhóm chat tại một thời điểm **chỉ được thuộc về đúng 1 Workspace**.
   * Việc chuyển nhóm chat từ Workspace A sang Workspace B sẽ ngắt toàn bộ quyền hạn cũ và áp dụng quyền hạn mới của Workspace B ngay lập tức.
2. **Cơ chế Phân quyền 2 tầng trong Neo4j (2-Tier Graph RBAC):**
   * **Tầng 1 - Kế thừa Tool Group:** Khi gán `(:Workspace)-[:CAN_USE]->(:ToolGroup)`, toàn bộ các Tools con thuộc ToolGroup đó mặc định được phép gọi.
   * **Tầng 2 - Phủ quyết Đích danh (Override Exclusion):** Admin có thể tắt quyền của một Tool cụ thể bên trong ToolGroup. Hệ thống sẽ tạo quan hệ `(:Workspace)-[:DISABLED]->(:Tool)`. Khi truy vấn, Tool có quan hệ `[:DISABLED]` sẽ bị loại bỏ khỏi danh sách công cụ cấp cho AI Agent.
   * **Cấp quyền Đích danh:** Cho phép cấp quyền một Tool đơn lẻ mà không cần bật cả ToolGroup qua quan hệ trực tiếp `(:Workspace)-[:CAN_USE]->(:Tool)`.
3. **Quản lý Vòng đời Inbound Webhooks:**
   * Mỗi Workspace có thể tạo nhiều Inbound Webhook endpoint (`/api/v1/workspaces/{id}/webhooks/{wh_id}`).
   * Secret Token sinh ngẫu nhiên định dạng `whsec_...` (32 ký tự bảo mật cao), chỉ hiển thị đầy đủ một lần duy nhất lúc tạo mới.
   * Hỗ trợ tạo lại Secret (Regenerate Secret) ngay lập tức vô hiệu hóa token cũ.

---

### Phân hệ 4: Scoped Vault (Cấu hình Dữ liệu Riêng biệt per Workspace)

#### A. Mục tiêu & Phạm vi
Cung cấp giải pháp lưu trữ an toàn các thông tin cấu hình nhạy cảm (API Keys, Client Secrets, Tenant IDs, Branch Codes) của từng Workspace mà không bị lẫn lộn giữa các chi nhánh.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Sinh Form Động (Dynamic Form Generation):**
   * Khi bật một Tool Group trong Workspace, hệ thống tự động đọc danh sách `required_variables` từ ToolGroup Master và sinh ra các trường nhập liệu tương ứng trên UI.
2. **Mã hóa Cực hạn (AES-256-GCM Encryption):**
   * Mọi giá trị biến nhạy cảm trước khi lưu vào bảng `workspace_tool_configs` đều bắt buộc phải được mã hóa chuẩn **AES-256-GCM**.
   * Cấu trúc lưu trữ: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`. Khóa mã hóa `ENCRYPTION_KEY` 256-bit được nạp từ biến môi trường máy chủ.
3. **Cơ chế Nạp Biến Động (Dynamic Variable Injection):**
   * Khi Worker Agent chuẩn bị gọi Tool API, hệ thống giải mã Scoped Config của Workspace tương ứng.
   * Quét và thay thế toàn bộ các placeholder `{{VAR_NAME}}` xuất hiện trong: Base URL, Path, Headers, Query Parameters và Body JSON.
   * **Quy tắc Kiểm tra Nghiêm ngặt (Strict Validation):** Nếu Tool API yêu cầu biến `{{API_KEY}}` nhưng Workspace chưa cấu hình giá trị, hệ thống lập tức hủy lệnh gọi và thông báo lỗi rõ ràng: `MISSING_SCOPED_VARIABLE: Workspace [Tên] chưa cấu hình biến API_KEY`.
4. **Bảo mật Chống Lộ Khóa (Secret Masking):**
   * Giá trị giải mã chỉ tồn tại trong bộ nhớ RAM trong suốt thời gian thực thi HTTP Request và bị hủy sau đó.
   * Toàn bộ dữ liệu ghi vào `audit_logs` đều tự động bóc tách và thay thế các chuỗi bí mật bằng `***MASKED***`.

---

### Phân hệ 5: Multi-Agent Engine (Bộ máy Điều phối & Thực thi Hai Tầng)

#### A. Mục tiêu & Phạm vi
Bộ não trung tâm điều khiển luồng suy nghĩ và hành động của AI Agent, kết hợp giữa tốc độ phân loại intent và khả năng suy luận công cụ phức tạp.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Tenant Resolver:**
   * Nhận message từ Redis Streams $\to$ Truy vấn Neo4j từ `platform_chat_id` hoặc `webhook_id` để lấy `workspace_id`.
   * Nếu không tìm thấy Workspace $\to$ Hủy xử lý hoặc gửi phản hồi báo nhóm chat chưa được cấu hình.
2. **Máy Trạng thái Hội thoại (Cold / Warm Session State):**
   * **COLD (Mặc định):** Bot im lặng lắng nghe. Chỉ phản hồi khi được Tag tên (@Bot), nhắc đến tên định danh hoặc Reply tin nhắn cũ của Bot.
   * **WARM (Hoạt động):** Duy trì TTL 300 giây (5 phút) trong Redis. Trong khoảng thời gian này, mọi tin nhắn liên quan đều được Bot phân tích và đối đáp đa lượt mà không cần tag lại tên.
   * **Cờ Luôn Phản hồi (`alwaysRespond`):** Nếu bật, nhóm chat luôn ở trạng thái WARM.
3. **Router Agent (Tầng 1 - Intent Classification):**
   * Sử dụng LLM tốc độ cao: `google/gemini-2.0-flash` qua OpenRouter.
   * Nạp danh sách Skills và ToolGroups khả dụng của Workspace lấy từ Neo4j.
   * Trả về JSON có cấu trúc:
     * Khớp Skill $\to$ Chuyển giao SOP nghiệp vụ cho Worker Agent.
     * Không khớp Skill $\to$ Trích xuất danh sách Tools phù hợp nhất trong phân quyền để giao cho Worker.
     * Hỏi xã giao / Ngoài phạm vi $\to$ Phản hồi nhanh không cần gọi Tool.
4. **Worker Agent (Tầng 2 - ReAct Execution Loop):**
   * Sử dụng LLM suy luận mạnh: `anthropic/claude-3.5-sonnet` qua OpenRouter.
   * Thực hiện vòng lặp **Think $\to$ Plan $\to$ Act $\to$ Observe**:
     * Tối đa **5 bước (5 steps)** cho một tác vụ để tránh vòng lặp vô tận (Infinite Loop Protection).
     * Mỗi bước gọi Tool đều được bảo vệ bởi SSRF filter và Variable Injector.
     * Nhận diện và xưng hô chuẩn Persona Tiếng Việt: Ưu tiên dùng `nickname`, nếu không có thì dùng Tên chính (Given Name), tuyệt đối không gọi cả họ và tên đệm.
5. **Outbound Gateway & Callback Engine:**
   * Kênh Chat: Đẩy tin nhắn phản hồi về `stream:outbound_messages` gửi lại nhóm Zalo/Telegram gốc.
   * Kênh Webhook: Thực hiện HTTP POST Callback bất đồng bộ với cơ chế **Exponential Backoff Retry 3 lần** (2s, 10s, 30s) khi gặp lỗi kết nối/5xx, hoặc gửi thông báo Push Notification qua Firebase FCM.

---

### Phân hệ 6: Audit & Tracing (Giám sát & Lưu vết Toàn diện)

#### A. Mục tiêu & Phạm vi
Cung cấp khả năng quan sát (Observability) và truy vết chi tiết từng quyết định của AI phục vụ việc debug và tuân thủ an toàn thông tin.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Cấu trúc Dữ liệu Lưu vết (Trace Log Structure):**
   * `session_id`, `platform`, `sender_id`, `workspace_id`.
   * `user_message`: Nội dung tin nhắn gốc của người dùng.
   * `router_decision`: Intent nhận diện, Skill được chọn hoặc lý do từ chối.
   * `execution_plan`: Chuỗi suy nghĩ (Thought process) của Worker Agent.
   * `tool_calls`: Mảng các API/Tool đã gọi kèm payload input, response output và thời gian thực thi (latency từng tool).
   * `final_response`: Câu trả lời cuối cùng gửi cho người dùng.
   * `total_latency_ms`: Tổng thời gian từ lúc nhận tin đến khi phản hồi xong.
2. **Quy tắc Bảo mật Dữ liệu Audit (Data Sanitization):**
   * Tự động lọc sạch các trường nhạy cảm (`token`, `password`, `secret`, `authorization`, `api_key`) trước khi ghi vào bảng `audit_logs`.
   * Dữ liệu log được lưu trữ tối thiểu 90 ngày phục vụ tra cứu kiểm toán.

---

### Phân hệ 7: Admin AI Copilot Drawer (`FEAT-ADMIN-COPILOT`)

#### A. Mục tiêu & Phạm vi
Trợ lý AI slide-over drawer hỗ trợ quản trị viên cấu hình hệ thống bằng ngôn ngữ tự nhiên ngay trên giao diện Web Dashboard mà không cần thao tác thủ công từng màn hình.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Kiến trúc Tương tác An toàn (Human-in-the-Loop):**
   * Mọi câu lệnh làm thay đổi trạng thái hệ thống (tạo MCP, cấp quyền Workspace, dạy Skill mới) **không được tự ý thực thi ngầm**.
   * AI bắt buộc phải trả về một **Action Preview Card** hiển thị chi tiết các thay đổi dự kiến (Tên tài nguyên, Workspace bị ảnh hưởng, Quyền hạn thay đổi).
   * Thao tác chỉ được kích hoạt vào CSDL khi Quản trị viên bấm nút **"Xác nhận thực thi" (Confirm)**.
2. **4 Nhóm Công cụ Quản trị Nội bộ:**
   * `mcp_management`: Quét link/JSON MCP server, bóc tách tools và import vào kho master.
   * `workspace_permissions`: Tra cứu quyền hiện tại và gán/thu hồi Tool/ToolGroup cho Workspace.
   * `skill_management`: Tạo và tinh chỉnh System Prompt nghiệp vụ cho Skill mới bằng ngôn ngữ tự nhiên.
   * `system_diagnostics`: Phân tích Audit Log tìm lỗi và kiểm tra trạng thái sống của các kênh kết nối.
3. **Ghi vết Kiểm toán:**
   * Mọi hành động được thực thi qua Copilot đều được ghi nhận vào `audit_logs` với `action_type = 'COPILOT_ACTION'` kèm ID của Admin ra lệnh.

---

### Phân hệ 8: Inbound Webhooks & Async Callback Gateway (`FEAT-WORKSPACE-WEBHOOKS`)

#### A. Mục tiêu & Phạm vi
Mở rộng khả năng của Agent ra ngoài phạm vi Zalo/Telegram, cung cấp giao diện lập trình HTTP RESTful cho ứng dụng Mobile, Website thương mại điện tử hoặc hệ thống bên thứ ba.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Cơ chế Tiếp nhận Bất đồng bộ (Async Ingestion):**
   * Endpoint `POST /api/v1/workspaces/[id]/webhooks/[webhook_id]` nhận payload.
   * Xác thực Secret Token qua Header `Authorization: Bearer <secret>` hoặc `X-Webhook-Secret`. Nếu sai $\to$ Trả về ngay `401 Unauthorized`.
   * Nếu hợp lệ $\to$ Đẩy payload vào hàng đợi Redis Streams `stream:inbound_messages` và trả về ngay **`202 Accepted`** kèm `job_id` trong vòng $\le 50\text{ms}$.
2. **Duy trì Ngữ cảnh Phiên Đa lượt (Webhook Session Memory):**
   * Hỗ trợ tham số `session_id` từ client gửi lên. Nếu client không gửi, hệ thống tự sinh fallback `wh_{wh_id}_{sender_id}`.
   * Lưu trữ lịch sử hội thoại trong bảng `webhook_sessions` tối đa 10 lượt chat gần nhất để Agent có thể trả lời tiếp nối ngữ cảnh câu hỏi trước.
3. **Phản hồi Đích (Callback & Push Notification):**
   * **HTTP POST Callback:** Gửi kết quả về `callback.url` cung cấp trong payload ban đầu. Cơ chế retry: Lần 1 (sau 2s), Lần 2 (sau 10s), Lần 3 (sau 30s).
   * **Firebase Cloud Messaging (FCM):** Nếu client cung cấp `callback.fcm_token`, hệ thống sử dụng Firebase Admin SDK giải mã từ `WorkspaceFirebaseConfig` để gửi Silent Data Push hoặc Thông báo nổi (High Priority Push Notification).

---

### Phân hệ 9: Internal System MCP & Global Contacts (`FEAT-INTERNAL-MCP-CONTACTS`)

#### A. Mục tiêu & Phạm vi
Cho phép AI Agent tự quản trị nền tảng qua kênh chat (tạo workspace, thêm thành viên, phân quyền) đồng thời thiết lập cơ sở dữ liệu danh bạ người dùng thống nhất trên toàn hệ thống.

#### B. Quy tắc Nghiệp vụ Cốt lõi (Business Logic & Constraints):
1. **Kiểm soát Quyền Hạn Động (Dynamic Permission Guard):**
   * Điểm cuối nội bộ `POST /api/mcp` cung cấp 8 công cụ quản trị chuẩn JSON-RPC 2.0.
   * Mọi lệnh gọi tới các công cụ quản trị thay đổi cấu trúc (`create_workspace`, `add_contact`, `merge_contacts`, `assign_contact_to_workspace`, `remove_contact_from_workspace`) đều bắt buộc phải có header:
     $$\text{X-Caller-Role: SUPER\_ADMIN}$$
   * Nếu người gửi tin nhắn có `role == USER`, hệ thống lập tức từ chối và trả về lỗi JSON-RPC `-32001 Forbidden`.
2. **Dịch vụ Tự Động Thu Thập Danh Bạ (Auto-upsert Contact Service):**
   * Khi có tin nhắn đến từ Zalo/Telegram, hệ thống tra cứu theo `zalo_id` hoặc `telegram_id`.
   * **Nếu chưa tồn tại:** Kiểm tra trong cùng Workspace có Contact nào trùng Tên (Case-insensitive) và trường ID kênh tương ứng đang trống hay không:
     * Nếu có $\to$ **Auto-link thông minh:** Gán ID kênh mới vào Contact cũ.
     * Nếu không có $\to$ Tạo Contact mới với vai trò mặc định là `USER`.
3. **Quy tắc Persona Tiếng Việt & Tên Chính (Given Name & Nickname):**
   * Agent **tuyệt đối không bao giờ** gọi đầy đủ cả họ và tên đệm của người dùng (ví dụ: cấm gọi *"anh Nam Trần"*, *"chị Nguyễn Phương Thảo"*).
   * Luôn trích xuất tên chính: *"Nam Trần"* $\to$ *"anh Nam"*; *"Thu Trang"* $\to$ *"chị Trang"*.
   * Nếu bản ghi Contact có trường **`nickname`**, Agent bắt buộc ưu tiên dùng nickname để xưng hô (ví dụ: *"anh Nam Béo"*).
4. **Quy tắc Hợp nhất Danh bạ (Merge Contacts Rule):**
   * Chỉ `SUPER_ADMIN` mới có quyền ra lệnh gộp 2 danh bạ.
   * Giao dịch thực hiện hợp nhất:
     1. Khóa 2 bản ghi: `PrimaryContact` và `SecondaryContact`.
     2. Di chuyển `zaloId` / `telegramId` từ Secondary sang Primary (Báo lỗi nếu cả 2 đều đã có ID của cùng 1 kênh).
     3. Kế thừa thông tin cá nhân: Điền các trường còn thiếu (`email`, `phone`, `gender`, `birthYear`, `hobbies`, `nickname`) từ Secondary sang Primary.
     4. Kế thừa quyền hạn: Nếu Secondary có `role == SUPER_ADMIN`, Primary tự động được nâng cấp lên `SUPER_ADMIN`.
     5. Cập nhật Đồ thị Neo4j: Chuyển toàn bộ các cạnh `[:BELONGS_TO]` từ node Secondary sang node Primary.
     6. Xóa bỏ hoàn toàn bản ghi `SecondaryContact` trong PostgreSQL và node tương ứng trong Neo4j.

---

## 2. Ma trận Phân quyền Toàn diện (RBAC Matrix)

Dự án áp dụng mô hình kết hợp giữa **Admin Web Dashboard RBAC** và **Channel Graph RBAC** cho người dùng cuối qua tin nhắn:

| Đối tượng / Nghiệp vụ | SuperAdmin (Web & Chat) | Admin Workspace (Web) | End-user (Nhóm chat Zalo/Tele) | Webhook Caller (Third-party) |
| :--- | :---: | :---: | :---: | :---: |
| **Quản lý Kênh kết nối (Zalo/Tele)** | Toàn quyền | Chỉ xem trạng thái | Không có quyền | Không có quyền |
| **Quản lý Tool Groups & MCP Hub** | Toàn quyền nạp / sửa | Chỉ xem danh mục | Không có quyền | Không có quyền |
| **Quản lý Skills Master** | Toàn quyền định nghĩa SOP | Xem SOP | Không có quyền | Không có quyền |
| **Tạo Workspace Mới** | Toàn quyền (Web & Chat MCP) | Không có quyền | Không có quyền | Không có quyền |
| **Cấu hình Scoped Vault (API Keys)** | Toàn quyền | Nhập key cho WS được giao | Không có quyền | Không có quyền |
| **Quản lý Webhooks & Firebase** | Toàn quyền | Tạo/xóa Webhook trong WS | Không có quyền | Không có quyền |
| **Gán/Xóa Contact vào Workspace** | Toàn quyền (Web & Chat MCP) | Thêm vào WS của mình | Không có quyền | Không có quyền |
| **Hợp nhất Danh bạ (Merge Contacts)**| Toàn quyền (Web & Chat MCP) | Không có quyền | Không có quyền | Không có quyền |
| **Xem Toàn bộ Audit Logs** | Toàn quyền | Chỉ xem log trong WS | Không có quyền | Không có quyền |
| **Kích hoạt Gọi Skill & Tool** | Gián tiếp qua Test Runner | Gián tiếp qua Test Runner | Được gọi Tool/Skill **được cấp cho WS chứa nhóm chat** | Được gọi Tool/Skill **được cấp cho WS chứa Webhook** |

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
4. **Rule 4 (Contact Workspace Membership Rule):** Một người dùng (`Contact`) được công nhận là thành viên của Workspace nếu:
   $$\text{(Contact)} \to \text{[:BELONGS\_TO]} \to \text{(Workspace)}$$
   HOẶC gửi tin nhắn từ một nhóm chat đã thuộc về Workspace đó:
   $$\text{(Contact)} \to \text{[:SENT\_IN]} \to \text{(ChannelChat)} \to \text{[:BELONGS\_TO]} \to \text{(Workspace)}$$
