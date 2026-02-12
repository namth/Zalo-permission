# Thiết kế dữ liệu & Kế hoạch xây dựng Backend (Next.js)

## 1. Mục tiêu hệ thống

Backend có nhiệm vụ:

* Quản lý **quan hệ User – Workspace – Agent – Tool**
* Xác định **quyền và policy** khi có message từ Zalo
* Trả cấu hình chuẩn cho n8n (agent, tool, prompt)
* Lưu **một lượng nhỏ thông tin cá nhân user** và **config text**

Nguyên tắc:

* Quan hệ phức tạp → Graph DB
* Dữ liệu mô tả / text / ghi chú → SQL

---

## 2. Kiến trúc tổng thể

```
Zalo Webhook
   ↓
Resolve Channel (Zalo)
   ↓
Workspace
   ↓
Permission
   ↓
Systems (Hosting, Finance, Task)
```

---

## 3. Thiết kế dữ liệu

### 3.1 Neo4j – Graph DB (Policy Brain)

#### Node: User (ZaloUser)

```cypher
(:ZaloUser {
  zalo_user_id: STRING,     // unique
  name: STRING              // optional
})
```

#### Node: Workspace

```cypher
(:Workspace {
  id: STRING,               // unique
  name: STRING,
  type: STRING              // company | team | personal
})
```

#### Node: Channel (ZaloGroup)

```cypher
(:ZaloGroup {
  zalo_thread_id: STRING    // unique
})
```

#### Node: Agent (Service Identity)

```cypher
(:Agent {
  key: STRING,              // agent_support, agent_finance...
  type: "ai_agent"
})
```

#### Relationship: MEMBER_OF

```cypher
(:ZaloUser)-[:MEMBER_OF {
  role: STRING,             // admin, member
  joined_at: TIMESTAMP
}]->(:Workspace)
```

#### Relationship: USES

```cypher
(:Workspace)-[:USES]->(:Agent)
```

#### Relationship: BINDS_TO

```cypher
(:ZaloGroup)-[:BINDS_TO]->(:Workspace)
```

---

### 3.2 SQL Database (Postgres / SQLite)

#### Table: user_profile

```sql
id              SERIAL PRIMARY KEY
zalo_user_id    VARCHAR UNIQUE       -- optional metadata, no direct Workspace coupling
phone           VARCHAR
note            TEXT
created_at      TIMESTAMP
```

#### Table: workspace_config

```sql
id               SERIAL PRIMARY KEY
workspace_id     VARCHAR UNIQUE
default_agent    VARCHAR
system_prompt    TEXT
status           VARCHAR        -- active | disabled
created_at       TIMESTAMP
updated_at       TIMESTAMP
```

---

## 4. Luồng xử lý chính

### 4.1 Resolve Workspace & Permission khi có message Zalo

Input:

```json
{
  "workspace_id": "...",
  "zalo_user_id": "...",
  "message": "..."
}
```

Xử lý:

1. Resolve ZaloGroup → Workspace
2. Resolve ZaloUser → Workspace membership
3. Resolve Agent bound to Workspace
4. Check permission (agent + workspace + action)
5. Load workspace config from SQL

Output cho n8n:

```json
{
  "agent_key": "agent_support",
  "user_role": "member",
  "system_prompt": "...",
  "status": "active"
}
```

---

## 5. Thiết kế API (Next.js)

### 5.1 POST /api/resolve-workspace-context

Request:

```json
{
  "workspace_id": "w123",
  "zalo_user_id": "u456"
}
```

Response:

```json
{
  "allowed": true,
  "agent_key": "agent_support",
  "role": "admin",
  "system_prompt": "..."
}
```

---

### 5.2 POST /api/sync-user

Dùng khi Zalo webhook gửi danh sách thành viên workspace channel

---

## 6. Cấu trúc project Next.js (App Router)

```
/app
  /api
    /resolve-workspace-context
      route.ts
    /sync-user
      route.ts
/lib
  neo4j.ts
  db.ts
  policy.ts
/services
  user.service.ts
  workspace.service.ts
  policy.service.ts
```

---

## 7. Kế hoạch triển khai theo giai đoạn

### Phase 1 – MVP

* Neo4j schema tối thiểu
* resolve-workspace-context API
* 1 agent, 1 workspace

### Phase 2 – Mở rộng

* Nhiều agent
* Role chi tiết hơn
* Logging cơ bản

### Phase 3 – Tối ưu

* Cache policy
* Audit log
* Dashboard quản lý

---

## 8. Nguyên tắc thiết kế cần nhớ

* Graph DB chỉ trả lời: **AI CÓ ĐƯỢC PHÉP KHÔNG**
* SQL DB trả lời: **AI LÀ AI / CONFIG GÌ**
* Không lưu log chat vào Graph
* Role luôn nằm trên relationship
* Zalo chỉ là channel, không phải identity nghiệp vụ
* Workspace là đơn vị phân quyền cao nhất

---

## 9. Tóm tắt nhanh

* Kiến trúc: Graph + SQL
* Backend: Next.js (API-only)
* Dữ liệu gọn, không dư
* Scale tốt, dễ mở rộng

---

Tài liệu này dùng làm chuẩn để bắt đầu code backend.
