# 09. Quy chuẩn Mã nguồn & Cấu trúc Thư mục (Engineering Conventions)

## 1. Cấu trúc Thư mục Toàn dự án (Turborepo Monorepo Layout)

Dự án áp dụng cấu trúc Monorepo chuẩn mực với Turborepo và pnpm workspaces:

```text
zalo-permission/
├── apps/
│   ├── web/                         # Ứng dụng Next.js Dashboard
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router (pages & API routes)
│   │   │   │   ├── (dashboard)/     # Route group giao diện quản trị
│   │   │   │   │   ├── channels/
│   │   │   │   │   ├── tools/
│   │   │   │   │   ├── skills/
│   │   │   │   │   ├── workspaces/
│   │   │   │   │   └── audit-logs/
│   │   │   │   └── api/             # REST API endpoints cho dashboard
│   │   │   ├── components/          # React Components (UI Kit & Features)
│   │   │   │   ├── ui/              # Shadcn primitive components (Button, Modal, Table...)
│   │   │   │   ├── channels/        # Channel connection modals, cards
│   │   │   │   ├── tools/           # Tool form, parameter builder, test runner
│   │   │   │   └── workspaces/      # Workspace tabs, scoped config form
│   │   │   └── lib/                 # Web specific utilities & hooks
│   │   └── package.json
│   │
│   └── agent-worker/                # Tiến trình Node.js chạy nền (Background Engine)
│       ├── src/
│       │   ├── consumers/           # Redis Streams Inbound/Outbound Consumers
│       │   ├── supervisor.ts        # Dispatcher & Tenant Resolver
│       │   └── index.ts             # Entrypoint khởi chạy Worker
│       └── package.json
│
├── packages/
│   ├── database/                    # Quản lý Kết nối Dữ liệu chung
│   │   ├── prisma/                  # Prisma Schema & Migrations (PostgreSQL)
│   │   ├── src/
│   │   │   ├── postgres.ts          # Prisma Client Singleton
│   │   │   ├── neo4j.ts             # Neo4j Driver & Cypher Helpers
│   │   │   ├── encryption.ts        # Hàm mã hóa/giải mã AES-256-GCM
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── core/                        # Bộ não Multi-Agent & Tool Engine
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   ├── router-agent.ts  # Phân loại intent & tra cứu Skill
│   │   │   │   └── worker-agent.ts  # Vòng lặp Think/Plan/Act/Tool-calling
│   │   │   ├── tools/
│   │   │   │   ├── executor.ts      # HTTP Request Runner với Dynamic Auth
│   │   │   │   └── variable-injector.ts # Thay thế {{VAR}} từ Scoped Config
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── channels/                    # Adapter Kết nối Zalo & Telegram
│       ├── src/
│       │   ├── telegram/            # grammY bot setup, group sync, webhook handler
│       │   ├── zalo/                # zca-js automation, QR login, OA webhook
│       │   └── index.ts
│       └── package.json
│
├── docs/                            # Bộ 11 tài liệu kiến trúc & vận hành
├── CONTEXT.md                       # Root Context cho AI Agents
├── docker-compose.yml               # Local infra: Postgres, Neo4j, Redis, Apps
├── turbo.json                       # Turborepo build pipeline
└── package.json                     # Root pnpm workspace config
```

---

## 2. Quy tắc Đặt tên (Naming Conventions)

1. **Thư mục & File:**
   * File mã nguồn TypeScript / React: `kebab-case.ts` hoặc `kebab-case.tsx` (ví dụ: `tool-executor.ts`, `workspace-card.tsx`).
   * Schema hoặc Type Definition: `kebab-case.schema.ts` hoặc `kebab-case.types.ts`.
2. **Biến & Hàm (Variables & Functions):**
   * Sử dụng `camelCase` (ví dụ: `resolveWorkspace`, `executeToolCall`, `encryptSecret`).
3. **Class, Interface & Type:**
   * Sử dụng `PascalCase` (ví dụ: `AgentOrchestrator`, `ToolDefinition`, `ChannelChatNode`).
4. **Hằng số & Biến Môi trường:**
   * Sử dụng `UPPER_SNAKE_CASE` (ví dụ: `REDIS_STREAM_INBOUND`, `ENCRYPTION_MASTER_KEY`).
5. **Cơ sở Dữ liệu:**
   * Tên bảng PostgreSQL: `snake_case` số nhiều (`workspaces`, `channel_accounts`, `tool_groups`).
   * Tên cột PostgreSQL: `snake_case` (`platform_chat_id`, `created_at`).
   * Tên Node Label Neo4j: `PascalCase` (`Workspace`, `ChannelChat`, `ToolGroup`).
   * Tên Quan hệ Neo4j: `UPPER_SNAKE_CASE` (`[:BELONGS_TO]`, `[:CAN_USE]`, `[:PART_OF]`).

---

## 3. UI Kit & Tiêu chuẩn Giao diện (UI Standards)

* **Design Framework:** Tailwind CSS v3.4+ kết hợp Shadcn UI (Radix UI primitives).
* **Bảng màu Chủ đạo (Color Palette):**
  * Slate / Zinc dark mode (`bg-zinc-950` cho nền, `bg-zinc-900` cho card, `border-zinc-800` cho đường viền).
  * Primary Accent: Indigo / Violet (`bg-indigo-600` hover `bg-indigo-500`) tạo phong cách công nghệ cao cấp (Linear-style).
  * Status Badges:
    * Xanh lá (`emerald-500`): Active, Connected, Success.
    * Đỏ (`rose-500`): Disconnected, Failed, Error.
    * Vàng cam (`amber-500`): Expired, Pending Input, Re-connecting.
* **Biểu tượng (Icons):** `lucide-react`.

---

## 4. Quy chuẩn State Management & Data Fetching

* **Web Dashboard:**
  * Sử dụng Server Components cho render dữ liệu ban đầu.
  * Dùng **TanStack Query (React Query)** cho Client Components cần polling trạng thái (như màn hình quét QR Code Zalo, Activity log feed).
  * Form Validation: **React Hook Form + Zod** cho tất cả các form nhập liệu (Tool Group, Parameters Schema, Workspace Config).
* **Background Worker:**
  * Luôn sử dụng `async/await` với error boundary `try/catch` bọc quanh từng bước để đảm bảo worker không bao giờ bị crash khi có tin nhắn lỗi hoặc API bên thứ ba chết.
