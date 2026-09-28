# 04. Luồng Di chuyển của Người dùng & Xử lý Hệ thống (User Flows & System Sequence)

## 1. Luồng 1: Admin Thiết lập Kênh, Tool và Không gian làm việc (Setup Flow)

Luồng này mô tả các bước mà System Administrator thực hiện trên Web Dashboard để đưa một nhóm chat vào hoạt động với các công cụ cụ thể:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as System Administrator
    participant UI as Web Dashboard
    participant API as Next.js API Routes
    participant PG as PostgreSQL
    participant Neo as Neo4j Graph
    participant Chan as Channel Adapters (Zalo/Tele)

    %% Step 1: Connect Channel
    Admin->>UI: 1. Kết nối Telegram Bot (nhập Token) / Zalo (quét QR)
    UI->>API: Gửi thông tin xác thực
    API->>Chan: Kiểm tra kết nối với Telegram API / Zalo Gateway
    Chan-->>API: Kết nối thành công, trả về danh sách Chat Groups
    API->>PG: Lưu ChannelAccount (mã hóa token) & ChannelChats
    API->>Neo: Tạo Node (:ChannelChat {id, platform, platform_chat_id})

    %% Step 2: Register Tool Group & Tools
    Admin->>UI: 2. Tạo Tool Group (Base URL, Auth Type, Variable Keys) & Tools
    UI->>API: POST /api/tool-groups & POST /api/tools
    API->>PG: Lưu bảng tool_groups & tools
    API->>Neo: Tạo Node (:ToolGroup), (:Tool) & quan hệ (:Tool)-[:PART_OF]->(:ToolGroup)

    %% Step 3: Configure Workspace & Scoped Variables
    Admin->>UI: 3. Tạo Workspace, chọn Nhóm Chat, bật Tool Group & nhập API Key riêng
    UI->>API: PUT /api/workspaces/{id}/config
    API->>PG: Lưu workspace_tool_configs (mã hóa AES-256 các biến động)
    API->>Neo: Tạo quan hệ:
    Note over API,Neo: (:ChannelChat)-[:BELONGS_TO]->(:Workspace)<br/>(:Workspace)-[:CAN_USE]->(:ToolGroup)<br/>(:Workspace)-[:CAN_USE]->(:Skill)
    API-->>UI: Cấu hình hoàn tất!
```

---

## 2. Luồng 2: Xử lý Tin nhắn Đến & Định tuyến Multi-Agent (End-to-End Chat Routing Flow)

Đây là luồng cốt lõi vận hành khi có tin nhắn từ người dùng trong nhóm chat Zalo hoặc Telegram:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng trong Nhóm Chat
    participant Channel as Zalo / Telegram
    participant Gateway as Channel Gateway (Polling/Webhook)
    participant Redis as Redis Streams
    participant Worker as Agent Worker Engine
    participant Neo as Neo4j Graph
    participant PG as PostgreSQL
    participant LLMR as Router LLM (Gemini 2.0 Flash)
    participant LLMW as Worker LLM (Claude 3.5 Sonnet)
    participant ExtAPI as Third-party External API

    User->>Channel: Gửi tin nhắn: "Kiểm tra tồn kho sản phẩm ABC"
    Channel->>Gateway: Webhook / Polling nhận message
    Gateway->>Redis: XADD stream:inbound_messages (chat_id, platform, text, sender)
    
    Redis->>Worker: Consumer nhận message
    
    %% Step 1: Identify Workspace
    Worker->>Neo: MATCH (c:ChannelChat {platform_chat_id: $chat_id})-[:BELONGS_TO]->(w:Workspace) RETURN w
    alt Nhóm chat chưa được gán Workspace
        Neo-->>Worker: Không tìm thấy Workspace
        Worker->>Redis: XADD stream:outbound_messages ("Nhóm chat này chưa được kích hoạt.")
    else Tìm thấy Workspace
        Neo-->>Worker: Trả về workspace_id ("ws_hanoi")
        
        %% Step 2: Intent Classification & Skill Lookup
        Worker->>Neo: Lấy danh sách Skills được cấp quyền cho Workspace ws_hanoi
        Neo-->>Worker: Danh sách Skills (hoặc rỗng)
        Worker->>LLMR: Phân loại ý định từ prompt của user & so khớp với danh sách Skills
        LLMR-->>Worker: Kết quả: Không có Skill nào khớp! Intent: "Tra cứu kho"
        
        %% Step 3: Tool Extraction & Scoped Config Resolution
        Worker->>Neo: Lấy các Tool Groups & Tools được cấp quyền cho ws_hanoi
        Neo-->>Worker: ToolGroup "Inventory API" (Tool: search_product, get_stock)
        Worker->>PG: Lấy Scoped Variables của ws_hanoi cho "Inventory API"
        PG-->>Worker: Trả về { "API_KEY": "hn_secret_123", "BASE_URL": "https://hn-api.erp.vn" }
        
        %% Step 4: Worker Agent Thinking & Planning & Tool Execution
        Worker->>LLMW: Nạp prompt + Tool schemas (với URL & Headers đã inject key)
        LLMW-->>Worker: Output Plan: "Bước 1: Gọi Tool search_product với query=ABC"
        
        Worker->>ExtAPI: GET https://hn-api.erp.vn/api/products?name=ABC (Header: Authorization: Bearer hn_secret_123)
        ExtAPI-->>Worker: JSON: { "id": "P1", "name": "Sản phẩm ABC", "stock": 15 }
        
        Worker->>LLMW: Nạp Tool Observation: Kết quả tồn kho = 15
        LLMW-->>Worker: Final Answer: "Sản phẩm ABC hiện còn 15 chiếc trong kho chi nhánh."
        
        %% Step 5: Send Response & Audit Logging
        Worker->>Redis: XADD stream:outbound_messages (chat_id, platform, final_text)
        Worker->>PG: Ghi nhận audit_logs (trace, plan, tool_calls, latency)
        
        Redis->>Gateway: Nhận outbound message
        Gateway->>Channel: Gửi tin nhắn trả lời vào nhóm
        Channel-->>User: Hiển thị câu trả lời của AI Bot
    end
```

---

## 3. Luồng 3: Trường hợp Khớp Skill Chuyên biệt (Skill-First Flow)

Khi Router Agent xác định yêu cầu của người dùng khớp chính xác với một **Skill** đã được tạo sẵn trong Workspace:

```mermaid
flowchart TD
    Start([Tin nhắn đến từ nhóm chat]) --> ResolveWS[Tra cứu Workspace từ ChannelChat trong Neo4j]
    ResolveWS --> GetSkills[Lấy danh sách Skills của Workspace từ Neo4j]
    GetSkills --> RouterLLM[Router Agent phân tích ý định]
    
    RouterLLM --> IsSkillMatched{Có Skill nào khớp?}
    
    IsSkillMatched -- Có khớp Skill S --> LoadSOP[Nạp SOP / System Prompt & Required Tools của Skill S]
    LoadSOP --> InjectKeys[Inject Scoped Variables của Workspace vào Tools của Skill]
    InjectKeys --> RunSkill[Worker Agent thực thi theo kịch bản SOP chuẩn]
    RunSkill --> OutputSkill[Phản hồi kết quả chuẩn hóa về nhóm chat]
    
    IsSkillMatched -- Không khớp Skill nào --> GetTools[Lấy danh sách Tool Groups được cấp quyền trong Neo4j]
    GetTools --> FilterCategory[Lọc 1-3 Tool Groups liên quan nhất]
    FilterCategory --> DynamicPlan[Worker Agent lập kế hoạch ReAct / Plan-and-Solve]
    DynamicPlan --> ExecTools[Gọi các API tương ứng với Scoped Credentials]
    ExecTools --> OutputDynamic[Phản hồi câu trả lời tự nhiên về nhóm chat]
    
    OutputSkill --> LogAudit[(Lưu Audit Logs vào PostgreSQL)]
    OutputDynamic --> LogAudit
```

---

## 4. Cơ chế Xử lý Lỗi & Dự phòng (Fail-Safe & Edge Cases)
1. **API Bên thứ ba lỗi hoặc Timeout (> 10s):**
   * Worker Agent bắt ngoại lệ (Catch HTTP Error 5xx/Timeout).
   * Agent tự động đưa thông báo giải thích ngắn gọn, lịch sự cho người dùng ("Không thể kết nối đến hệ thống kho chi nhánh lúc này, vui lòng thử lại sau giây lát").
   * Ghi nhận trạng thái `FAILED` kèm mã lỗi chi tiết vào `audit_logs` để Admin kiểm tra trên Dashboard.
2. **Kênh Zalo/Telegram bị mất kết nối (Token hết hạn / Cookie bị logout):**
   * Background Healthcheck định kỳ 60s kiểm tra trạng thái các tài khoản.
   * Nếu phát hiện lỗi xác thực $\rightarrow$ Cập nhật `channel_accounts.status = 'EXPIRED'`.
   * Gửi cảnh báo lên UI Dashboard để Admin đăng nhập lại.
3. **Người dùng hỏi nội dung ngoài phạm vi Tool/Skill được cấp:**
   * Router Agent nhận thấy không có Skill hoặc Tool nào đáp ứng được câu hỏi nghiệp vụ.
   * Agent phản hồi câu trả lời trò chuyện tổng quát hoặc lịch sự từ chối: "Tôi chưa được phân quyền thực hiện tác vụ này trong không gian làm việc của bạn."
