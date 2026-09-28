# CONTEXT.md — OmniAgent Gateway & Workspace Platform (Root Context)

> **Dành cho mọi AI Agent:** Đọc tài liệu này đầu tiên trước khi thực hiện bất kỳ tác vụ đọc mã nguồn, sửa lỗi hoặc phát triển tính năng nào trong dự án này.

---

## 1. Định nghĩa Dự án & Bài toán Cốt lõi
* **Tên hệ thống:** OmniAgent Gateway & Workspace Platform (`zalo-permission`).
* **Mục tiêu:** Nền tảng trung tâm quản lý và điều phối Multi-Agent AI đa kênh (Zalo, Telegram).
* **Đặc tính độc đáo:**
  1. **Kho Tool Phân cấp:** `ToolGroup` (Base URL, Auth Type, System overview, Scoped Variables) $\rightarrow$ `Tool` (Endpoints con với JSON Schema tham số cụ thể).
  2. **Tách biệt Quản lý Kênh & Không gian:** Tài khoản Telegram Bot / Zalo được kết nối và xác thực ở trang riêng. Trong Workspace, người dùng chỉ cần chọn các **Nhóm chat cụ thể** để gán vào.
  3. **Scoped Data per Workspace:** Cùng 1 Tool nhưng khi gắn vào Workspace khác nhau thì sử dụng các biến cấu hình/credentials (`{{API_KEY}}`, `{{BRANCH_ID}}`) khác nhau được mã hóa riêng cho Workspace đó.
  4. **Multi-Agent 2 bước:**
     * Tin nhắn vào $\rightarrow$ Nhận diện Workspace qua Neo4j.
     * **Router Agent** (Mô hình nhanh: `google/gemini-2.0-flash`) phân loại ý định $\rightarrow$ Tìm Skill khớp trong Neo4j.
     * Nếu không có Skill $\rightarrow$ Lọc danh mục Tool được cấp quyền $\rightarrow$ Chuyển cho **Worker Agent** (Mô hình suy luận sâu: `anthropic/claude-3.5-sonnet`) lập kế hoạch (Plan) $\rightarrow$ Gọi API Tool $\rightarrow$ Trả kết quả về nhóm chat tương ứng.

---

## 2. Tech Stack Chuẩn hóa
* **Kiến trúc:** Turborepo Monorepo (Full TypeScript).
  * `apps/web`: Next.js 14 App Router, Tailwind CSS, Shadcn UI.
  * `apps/agent-worker`: Node.js Background Event Engine xử lý hàng đợi và điều phối Agent.
  * `packages/core`: Lõi Multi-Agent (Router, Worker, Tool Executor, Variable Injector).
  * `packages/database`: Prisma ORM (PostgreSQL), Neo4j Driver (Graph RBAC), Module mã hóa AES-256-GCM.
  * `packages/channels`: Adapter Telegram (`grammY`), Adapter Zalo (`zca-js` / OA).
* **Cơ sở dữ liệu:**
  * **PostgreSQL:** Lưu trữ thực thể, JSON Schemas, cấu hình biến mã hóa, và `audit_logs`.
  * **Neo4j:** Phân quyền đồ thị tốc độ cao: `(ChannelChat)-[:BELONGS_TO]->(Workspace)-[:CAN_USE]->(ToolGroup/Tool/Skill)`.
  * **Redis Streams:** Event streaming bất đồng bộ (`stream:inbound_messages`, `stream:outbound_messages`).
* **AI Provider:** OpenRouter API (`OPENROUTER_API_KEY`).

---

## 3. Bản đồ Tài liệu Tham chiếu Chi tiết (`/docs`)
Khi cần tra cứu sâu từng phân hệ, vui lòng đọc các tài liệu tương ứng:
* [01. Tổng quan Dự án](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/01-overview.md)
* [02. Các Phân hệ & Ma trận Phân quyền](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/02-modules-and-features.md)
* [03. Danh sách Màn hình, Layout & Google Stitch Prompts](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/03-screens-and-ui.md)
* [04. Luồng Người dùng & Sequence Diagrams](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/04-user-flows.md)
* [05. Kiến trúc Kỹ thuật & Hạ tầng](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/05-architecture.md)
* [06. Sơ đồ Cơ sở Dữ liệu (Prisma & Neo4j ERD)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/06-database-schema.md)
* [07. Hợp đồng Dữ liệu API (REST Contracts)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/07-api-contracts.md)
* [08. Hướng dẫn Tích hợp Bên thứ ba (OpenRouter, Zalo, Telegram)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/08-integrations.md)
* [09. Quy chuẩn Mã nguồn & Naming Conventions](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/09-conventions.md)
* [10. Biến Môi trường & Chính sách Bảo mật (AES-256-GCM)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/10-env-and-security.md)
* [11. Kế hoạch Triển khai & Chia nhỏ Nhiệm vụ (5 Milestones)](file:///Users/namtran/Local%20Apps/Zalo-permission/docs/11-tasks.md)
