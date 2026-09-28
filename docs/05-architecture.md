# 05. Tổng quan Kiến trúc Kỹ thuật & Hạ tầng (System Architecture)

## 1. Sơ đồ Kiến trúc Tổng thể (High-Level Architecture)

Hệ thống được thiết kế theo mô hình **Event-Driven Micro-Monorepo**, phân tách rành mạch giữa **Control Plane** (Web UI, API Quản trị) và **Data/Execution Plane** (Agent Engine, Channel Adapters, Background Streams):

```mermaid
flowchart TB
    subgraph Channels["External Chat Channels"]
        TG[Telegram Groups / Directs]
        ZL[Zalo Groups / Directs]
    end

    subgraph ChannelAdapters["Channel Gateways (apps/agent-worker)"]
        TGA["Telegram Adapter (grammY)"]
        ZLA["Zalo Adapter (zca-js / OA)"]
    end

    TG <-->|Webhook / Polling| TGA
    ZL <-->|Websocket / Polling / Webhook| ZLA

    subgraph EventBus["Event & Message Streaming"]
        RIn[("Redis Stream: stream:inbound_messages")]
        ROut[("Redis Stream: stream:outbound_messages")]
    end

    TGA -->|XADD Inbound| RIn
    ZLA -->|XADD Inbound| RIn
    ROut -->|XREAD Outbound| TGA
    ROut -->|XREAD Outbound| ZLA

    subgraph AgentCore["Multi-Agent Engine (apps/agent-worker)"]
        Dispatcher[Message Dispatcher & Tenant Resolver]
        Router[Router Agent (Fast Model: Gemini 2.0 Flash)]
        Worker[Worker Agent (Think & Plan: Claude 3.5 Sonnet)]
        Executor[Tool HTTP Runner & Scoped Variable Injector]
    end

    RIn --> Dispatcher
    Dispatcher --> Router
    Router -->|Skill Matched / Tools Filtered| Worker
    Worker --> Executor
    Executor -->|Tool Result| Worker
    Worker -->|Final Response| ROut

    subgraph DataStorage["Data & Authorization Layer"]
        PG[("PostgreSQL\n(Storage, Relational, Audit Logs, Vault)")]
        N4J[("Neo4j Graph Database\n(Channel-Workspace-Skill-Tool RBAC)")]
    end

    Dispatcher <-->|Resolve Workspace| N4J
    Router <-->|Query Accessible Skills| N4J
    Worker <-->|Query Accessible Tools| N4J
    Executor <-->|Fetch Scoped Credentials| PG
    Worker -->|Write Logs & Trace| PG

    subgraph ControlPlane["Web Dashboard (apps/web)"]
        UI[Next.js 14 App Router + Shadcn UI]
        AdminAPI[Next.js API Routes / Server Actions]
    end

    Admin[System Administrator] <--> UI
    UI <--> AdminAPI
    AdminAPI <-->|Sync Relational Data| PG
    AdminAPI <-->|Sync Graph Nodes & Edges| N4J
    AdminAPI <-->|Publish Events / Healthcheck| RIn

    subgraph ExternalAPIs["Target Business Systems"]
        API1[ERP / Inventory APIs]
        API2[CRM APIs]
        API3[Custom Webhook Endpoints]
    end

    Executor <-->|HTTP Requests with Injected Auth| ExternalAPIs
```

---

## 2. Chi tiết Các Thành phần Kỹ thuật (Component Deep Dive)

### 2.1. Channel Gateways (`packages/channels`)
* **Telegram Gateway:** Sử dụng thư viện `grammY` (TypeScript native) với khả năng chạy song song Polling hoặc Webhook.
  * Hỗ trợ tự động filter bot mentions (trong nhóm chỉ phản hồi khi được `@bot` hoặc tin nhắn trả lời bot).
  * Hỗ trợ parsing markdown/HTML an toàn khi gửi tin nhắn về Telegram.
* **Zalo Gateway:** Sử dụng `zca-js` (cho tài khoản Zalo cá nhân qua mã QR / Cookie) kết hợp Zalo OA API (Official Account).
  * Lắng nghe sự kiện `message`, tự động trích xuất `thread_id`, `sender_id`, `text`.
  * Có cơ chế tự động gửi tin nhắn báo hiệu typing ("Đang suy nghĩ...").

---

### 2.2. Message Bus (`Redis Streams`)
* **Tại sao dùng Redis Streams thay vì Pub/Sub truyền thống:**
  * Redis Streams đảm bảo **Persistence** (tin nhắn không bị mất khi worker khởi động lại).
  * Hỗ trợ **Consumer Groups**: Cho phép scale ngang (horizontal scaling) nhiều Agent Workers xử lý song song mà không sợ xử lý trùng lặp tin nhắn.
  * Khả năng quản lý **ACK (Acknowledgment)**: Chỉ xác nhận xóa tin khỏi hàng đợi khi Agent đã gửi kết quả thành công về nhóm.
* **Stream Streams:**
  * `stream:inbound_messages`: Nhận tin thô từ các Adapter.
  * `stream:outbound_messages`: Nhận kết quả đã hoàn tất từ Agent để Adapter gửi về chat app.

---

### 2.3. Bộ não Multi-Agent (`packages/core`)

#### A. Router Agent (Intent Classifier & Dispatcher)
* **Mục tiêu:** Độ trễ cực thấp (< 500ms), chi phí token tối thiểu.
* **LLM:** `google/gemini-2.0-flash` hoặc `openai/gpt-4o-mini` qua OpenRouter.
* **Cơ chế:**
  1. Nạp danh sách `[ { id, name, description, trigger_intents } ]` của các Skills được cấp quyền trong Workspace hiện tại.
  2. Router LLM trả về JSON Schema:
     ```json
     {
       "intent": "check_inventory",
       "is_skill_matched": false,
       "matched_skill_id": null,
       "recommended_tool_groups": ["tg_inventory", "tg_product_catalog"],
       "confidence": 0.95
     }
     ```

#### B. Worker Agent (Planning & Tool Execution Loop)
* **Mục tiêu:** Suy luận sắc bén, lập kế hoạch rõ ràng, gọi tool chuẩn xác không hallucination.
* **LLM:** `anthropic/claude-3.5-sonnet` qua OpenRouter.
* **Cơ chế Vận hành (Inspiration từ Claude Code / Claw-code ReAct Loop):**
  * **Step 1 (Plan):** Đánh giá mục tiêu, lập danh sách hành động cần thiết.
  * **Step 2 (Tool Injection & Execution):** Khi Agent phát lệnh gọi hàm (Tool Call), `ToolExecutor` tự động:
    * Lấy cấu hình `workspace_tool_configs` từ PostgreSQL.
    * Giải mã AES-256 các biến bí mật (`{{API_KEY}}`, `{{ACCESS_TOKEN}}`).
    * Thay thế các placeholder `{{VAR}}` trong URL, Header, Query Parameters.
    * Gửi HTTP Request thực tế đến hệ thống bên ngoài.
  * **Step 3 (Observe):** Đọc Response Payload, rút gọn và nạp lại vào ngữ cảnh của Agent.
  * **Step 4 (Final Synthesis):** Trình bày kết quả dễ đọc, ngắn gọn, phù hợp với giao diện chat Zalo/Telegram.

---

### 2.4. Phân tầng Dữ liệu (Hybrid Database Architecture)

| Tính năng | PostgreSQL 16 | Neo4j Graph 5 |
| :--- | :--- | :--- |
| **Mục đích sử dụng** | Lưu trữ hồ sơ, cấu hình nhạy cảm, JSON Schema, Audit Logs | Kiểm tra phân quyền đa chiều, định tuyến đồ thị động |
| **Thực thể quản lý** | `workspaces`, `channel_accounts`, `tools`, `skills`, `workspace_tool_configs`, `audit_logs` | Nodes: `Workspace`, `ChannelChat`, `ToolGroup`, `Tool`, `Skill` |
| **Mã hóa dữ liệu** | Mã hóa AES-256-GCM các trường nhạy cảm | Không lưu trữ API keys nhạy cảm, chỉ lưu IDs và Metadata |
| **Tốc độ truy vấn** | Ghi log giao dịch ACID cực cao | Tra cứu quan hệ N-hops (Graph Traversal) trong < 2ms |

---

## 3. Công nghệ & Thư viện Lõi (Tech Stack Summary)

* **Ngôn ngữ:** TypeScript 5.4+ (End-to-End Type Safety).
* **Quản lý Monorepo:** Turborepo + pnpm workspaces.
* **Frontend Web Dashboard:** Next.js 14/15 App Router, React 18, Tailwind CSS, Shadcn UI, Lucide Icons, Monaco Editor (viết prompt/schema).
* **Backend Database Client:** Prisma ORM cho PostgreSQL; Neo4j JavaScript Driver (`neo4j-driver`) với Cypher Query Builder.
* **AI Orchestration:** Tự xây dựng Lightweight Agent Loop (lấy cảm hứng từ Claw-code & LangGraph State Machine), giao tiếp qua OpenAI SDK tương thích OpenRouter.
* **Channel SDKs:** `grammy` (Telegram), `zca-js` (Zalo Automation), Zalo OA Official SDK.
* **Hạ tầng Container:** Docker & Docker Compose (PostgreSQL, Neo4j, Redis, Web App, Agent Worker).
