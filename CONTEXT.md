# CONTEXT.md — OmniAgent Gateway & Workspace Platform (Root Context)

> **Dành cho mọi AI Agent:** Đọc tài liệu này đầu tiên trước khi thực hiện bất kỳ tác vụ đọc mã nguồn, sửa lỗi hoặc phát triển tính năng nào trong dự án này.

---

## 1. Định nghĩa Dự án & Bài toán Cốt lõi
* **Tên hệ thống:** OmniAgent Gateway & Workspace Platform (`zalo-permission`).
* **Mục tiêu:** Nền tảng trung tâm quản lý và điều phối Multi-Agent AI đa kênh (Zalo, Telegram, Webhooks).
* **Đặc tính độc đáo:**
  1. **Kho Tool Phân cấp & MCP Native:** Hỗ trợ cả REST API và Model Context Protocol (MCP) Server. `ToolGroup` (Base URL/SSE, Auth Type, System overview, Scoped Variables) $\rightarrow$ `Tool` (Endpoints/Functions con với JSON Schema tham số cụ thể).
  2. **Tách biệt Quản lý Kênh & Không gian:** Tài khoản Telegram Bot / Zalo được kết nối và xác thực ở trang riêng. Trong Workspace, người dùng chỉ cần chọn các **Nhóm chat cụ thể** để gán vào (Quan hệ N-1).
  3. **Scoped Data per Workspace:** Cùng 1 Tool nhưng khi gắn vào Workspace khác nhau thì sử dụng các biến cấu hình/credentials (`{{API_KEY}}`, `{{BRANCH_ID}}`) khác nhau được mã hóa AES-256-GCM riêng cho Workspace đó.
  4. **Multi-Agent 2 bước:**
     * Tin nhắn vào $\rightarrow$ Nhận diện Workspace qua Neo4j.
     * **Router Agent** (Mô hình nhanh: `google/gemini-2.0-flash`) phân loại ý định $\rightarrow$ Tìm Skill khớp trong Neo4j.
     * Nếu không có Skill $\rightarrow$ Lọc danh mục Tool được cấp quyền $\rightarrow$ Chuyển cho **Worker Agent** (Mô hình suy luận sâu: `anthropic/claude-3.5-sonnet`) lập kế hoạch (Plan) $\rightarrow$ Gọi API Tool $\rightarrow$ Trả kết quả về nhóm chat tương ứng.
  5. **Internal System MCP & Global Contacts:** Cho phép AI tự quản trị nền tảng (tạo workspace, gán thành viên) với xác thực quyền động `X-Caller-Role: SUPER_ADMIN`, cùng hệ thống danh bạ người dùng hợp nhất Zalo/Telegram tự động nhận diện và gộp dữ liệu (Merge Contacts).

---

## 2. Tech Stack Chuẩn hóa
* **Kiến trúc:** Turborepo Monorepo (Full TypeScript).
  * `apps/web`: Next.js 14 App Router, Tailwind CSS, Shadcn UI.
  * `apps/agent-worker`: Node.js Background Event Engine xử lý hàng đợi và điều phối Agent.
  * `packages/core`: Lõi Multi-Agent (Router, Worker, Tool Executor, Variable Injector, ContactService).
  * `packages/database`: Prisma ORM (PostgreSQL), Neo4j Driver (Graph RBAC), Module mã hóa AES-256-GCM.
  * `packages/channels`: Adapter Telegram (`grammY`), Adapter Zalo (`zca-js` / OA).
* **Cơ sở dữ liệu:**
  * **PostgreSQL:** Lưu trữ thực thể, JSON Schemas, cấu hình biến mã hóa, `contacts`, và `audit_logs`.
  * **Neo4j:** Phân quyền đồ thị tốc độ cao: `(ChannelChat)-[:BELONGS_TO]->(Workspace)-[:CAN_USE]->(ToolGroup/Tool/Skill)` và `(Contact)-[:BELONGS_TO]->(Workspace)`.
  * **Redis Streams:** Event streaming bất đồng bộ (`stream:inbound_messages`, `stream:outbound_messages`).
* **AI Provider:** OpenRouter API (`OPENROUTER_API_KEY`).

---

## 3. Bản đồ Tài liệu Chuẩn hóa 13 File (`/docs`)
Khi cần tra cứu sâu từng phân hệ, vui lòng đọc các tài liệu tương ứng:
* [01. Tổng quan Dự án](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/01-overview.md)
* [02. Các Phân hệ & Ma trận Phân quyền](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/02-modules-and-features.md)
* [03. Danh sách Màn hình, Layout, Sơ đồ Điều hướng & UI States](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/03-screens-and-ui.md)
* [04. Luồng Người dùng & Sequence Diagrams](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/04-user-flows.md)
* [05. Kiến trúc Kỹ thuật & Hạ tầng](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/05-architecture.md)
* [06. Sơ đồ Cơ sở Dữ liệu (Prisma & Neo4j ERD)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/06-database-schema.md)
* [07. Hợp đồng Dữ liệu API (REST & Internal MCP Contracts)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/07-api-contracts.md)
* [08. Hướng dẫn Tích hợp Bên thứ ba (OpenRouter, Zalo, Telegram, MCP)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/08-integrations.md)
* [09. Quy chuẩn Mã nguồn & Naming Conventions](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/09-conventions.md)
* [10. Biến Môi trường & Chính sách Bảo mật (AES-256-GCM)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/10-env-and-security.md)
* [11. Kế hoạch Triển khai & Tiêu chuẩn Nghiệm thu Chi tiết (DoD)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/11-tasks.md)
* [12. Đặc tả Quy tắc Nghiệp vụ & Máy Trạng thái (Business Rules)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/12-business-rules.md)
* [13. Kế hoạch Kiểm thử & Ma trận Kiểm thử Chất lượng (QA Plan)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/13-test-cases-and-qa.md)

### Tài liệu Chuyên đề Tính năng & Sơ đồ Tương tác
* [Đặc tả Tính năng: Internal System MCP & Global Contacts](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/features/internal-mcp-and-contacts.md)
* [Sơ đồ Tương tác Toàn hệ thống (Excalidraw)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/diagrams/system-interaction.excalidraw)
* [Xem Sơ đồ Tương tác Dạng Web / SVG](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/diagrams/system-interaction.html)

### Nhật ký Quyết định Kiến trúc (Architecture Decision Records - ADR)
* [ADR 0001: Sử dụng Neo4j cho Phân quyền Đồ thị 2 tầng](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/adr/0001-use-neo4j-for-channel-graph-rbac.md)
* [ADR 0002: Kiến trúc Scoped Vault Mã hóa AES-256-GCM](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/adr/0002-aes-256-gcm-for-workspace-scoped-vault.md)
* [ADR 0003: Kiến trúc Multi-Agent Hai Tầng Router & Worker](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/adr/0003-two-tier-router-and-worker-agents.md)
* [ADR 0004: Internal System MCP & Hợp nhất Danh bạ Toàn cục](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/adr/0004-internal-mcp-and-global-contacts.md)

---

## 4. Hệ Sinh Thái 5 Kỹ Năng Tự Động Hóa (.agents/skills)
1. **`grill-master`**: Phỏng vấn kiến trúc tổng thể, khởi tạo dự án với bộ 13 file tài liệu chuẩn.
2. **`grill-feature`**: Phỏng vấn đặc tả tính năng mới 6 góc nhìn, tự động đề xuất UI và cross-update toàn bộ docs.
3. **`screen-designer`**: Thiết kế giao diện kết hợp `ui-ux-pro-max` + `generative_ui` (prototype trong chat) + `Stitch MCP`.
4. **`wayfinder`**: Định vị mã nguồn 4 tầng, khoanh vùng rủi ro (Blast Radius) và đối chiếu tiêu chuẩn nghiệm thu (DoD).
5. **`qa-master`**: Lập ma trận kiểm thử chuyên sâu, kiểm toán chất lượng độc lập, đo đếm SLA và xuất báo cáo GO/NO-GO kèm dashboard `generative_ui`.


