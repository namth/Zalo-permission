# PHÂN QUYỀN AI AGENT THEO WORKSPACE

## 1. Mô tả bài toán (Problem Statement)

Hệ thống gồm nhiều **AI Agent** chạy trong **n8n**, kết nối tới các **nhóm Zalo** để hỗ trợ vận hành (quản lý hosting, domain, công việc, tài chính, …).

Các vấn đề cần giải quyết:

- Một **user Zalo** có thể tham gia **nhiều group Zalo** khác nhau
- Mỗi **group Zalo** có thể:
  - dùng **Agent khác nhau**
  - bật / tắt **từng tool** của Agent
  - có **system prompt riêng**
- AI Agent **không lưu trạng thái**, mọi quyền truy cập phải kiểm tra qua backend
- Về lâu dài có **nhiều hệ thống nghiệp vụ**:
  - Hosting / Domain
  - Quản lý công việc
  - Quản lý tài chính
- Không muốn **lặp lại Zalo ID** ở mỗi hệ thống → cần một lớp **trung tâm phân quyền**

Giải pháp được chọn là **Workspace-based Permission**, kết hợp:
- **Neo4j**: quản lý quan hệ động (user ↔ group ↔ workspace ↔ agent ↔ permission)
- **Postgres**: lưu dữ liệu nghiệp vụ, cấu hình, log

---

## 2. Khái niệm cốt lõi (Core Concepts)

### Workspace

Workspace là **đơn vị trung tâm phân quyền**, đại diện cho:
- một khách hàng
- hoặc một team
- hoặc một doanh nghiệp

Workspace:
- gom nhiều **group Zalo**
- gom nhiều **Account nghiệp vụ** (hosting, finance, task…)
- định nghĩa **AI Agent được phép làm gì**

> Workspace **KHÔNG thay thế Account**, mà **quản lý & liên kết nhiều Account**

---

## 3. Thiết kế dữ liệu trong Neo4j (Quan hệ & phân quyền – DIRECT AGENT LINK)

### 3.1 Node Types

```text
(:User { id, zalo_id })
(:ZaloGroup { id, thread_id })
(:Workspace { id, name, status })
(:Agent { key, name })
(:Account { id, type })
```

> Neo4j **KHÔNG lưu thông tin profile chi tiết của user** (email, phone, gender)
> Những thông tin này nằm trong Postgres (`user_profile`)

---

### 3.2 Relationship Types

```text
(User)-[:MEMBER_OF]->(ZaloGroup)
(ZaloGroup)-[:BELONGS_TO]->(Workspace)

(User)-[:PART_OF]->(Workspace)
(User)-[:HAS_ROLE { role }]->(Workspace)

(ZaloGroup)-[:USES_AGENT]->(Agent)   // ← DIRECT: Zalo Group connects directly to Agent
(Workspace)-[:MANAGES]->(Account)
```

---

### 3.3 Luồng kiểm tra quyền (TRỰC TIẾP QUA ZALO GROUP)

**AI Agent nhận message từ Zalo**:

1. Nhận `thread_id` + `zalo_user_id`
2. Tìm `(ZaloGroup)` theo `thread_id`
3. **Truy vấn Agent từ `(ZaloGroup)-[:USES_AGENT]->(Agent)` TRỰC TIẾP**
4. Kiểm tra Workspace membership (nếu cần)
5. Cho phép hoặc từ chối action

> **THAY ĐỔI CHÍNH:** Loại bỏ bước resolve Workspace để lấy Agent. Thay vào đó, Agent được link trực tiếp tới ZaloGroup thông qua `USES_AGENT` relationship.

---

## 4. Thiết kế dữ liệu trong Postgres (Dữ liệu nghiệp vụ & cấu hình – AGENT DIRECT LINK)

### 4.1 Bảng user_profile (Danh bạ người dùng)

```sql
user_profile (
  id UUID PK,
  zalo_id VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  gender VARCHAR,
  note TEXT,
  status VARCHAR,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
)
```

---

### 4.2 Bảng workspaces

```sql
workspaces (
  id UUID PK,
  name VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

### 4.3 Bảng zalo_groups (LƯU TRỮ AGENT_KEY TRỰC TIẾP)

```sql
zalo_groups (
  id UUID PK,
  thread_id VARCHAR UNIQUE NOT NULL,
  workspace_id UUID NOT NULL,
  agent_key VARCHAR(100) NOT NULL,  -- ← THêm: Link trực tiếp tới Agent
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (agent_key) REFERENCES agents(key)
)
```

> **THAY ĐỔI:** Thêm cột `agent_key` để lưu agent được gán cho mỗi Zalo Group. Neo4j sẽ maintain thêm relationship `(ZaloGroup)-[:USES_AGENT]->(Agent)` tương ứng.

---

### 4.4 Bảng agents

```sql
agents (
  key VARCHAR(100) PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
)
```

---

### 4.5 Bảng accounts (Account nghiệp vụ chung)

```sql
accounts (
  id UUID PK,
  zalo_group_id UUID,
  type VARCHAR, -- hosting | finance | task | ...
  reference_id VARCHAR,
  created_at TIMESTAMP
)
```

> `reference_id` trỏ tới ID trong hệ thống nghiệp vụ tương ứng

```

> `reference_id` trỏ tới ID trong hệ thống nghiệp vụ tương ứng

---

## 5. Vì sao tách Neo4j & Postgres như vậy?

### Neo4j dùng cho:
- Quan hệ nhiều-nhiều
- Permission động
- Graph traversal (user → group → workspace → agent)

### Postgres dùng cho:
- Dữ liệu chuẩn hoá
- Giao dịch (transaction)
- Audit, log, config

---

## 6. Kiến trúc tổng thể (High-level)

```text
Zalo Group
   ↓
AI Agent (n8n)
   ↓ API
Workspace Permission Service (NextJS)
   ↓            ↓
 Neo4j       Postgres
```

---

## 7. Mở rộng trong tương lai

- Thêm Role-based Permission (ADMIN / MEMBER / VIEWER)
- Thêm giới hạn theo user trong workspace
- Thêm policy theo thời gian / quota
- Cho nhiều Agent cùng 1 Workspace

---

## 8. Kết luận

- Workspace là **lớp phân quyền trung tâm**
- Neo4j xử lý **quan hệ & permission động**
- Postgres giữ **dữ liệu nghiệp vụ ổn định**
- AI Agent chỉ là client, **không giữ state**

👉 Thiết kế này đủ linh hoạt để làm **AI Super App** mà không bị rối quyền về sau

