# 🏗️ Zalo Permission System - Tổng Quan

**Hệ thống quản lý quyền hạn và phân quyền cho Zalo Bot**

**Phiên bản:** 1.0.0-MVP | **Trạng thái:** 73% Hoàn thành | **Cập nhật:** 28/01/2026

---

## 📋 Mục đích Hệ thống

Xây dựng một **hệ thống phân quyền tập trung (Workspace-based)** để:

- ✅ Quản lý **AI Agent** hoạt động trong các **Zalo Group**
- ✅ Tránh lặp dữ liệu Zalo User / Group ở nhiều hệ thống nghiệp vụ
- ✅ Cho phép **Admin** thao tác trực tiếp qua trang quản trị
- ✅ Cho phép **AI Agent** (qua API) thực hiện các hành động có kiểm soát
- ✅ Resolve workspace context & permission khi có message từ Zalo

---

## 🎯 Tính năng Chính

### 1. Permission Checking & Resolution
```
Zalo Message → Resolve ZaloGroup → Workspace → Check Permission → Response
```
- Xác định workspace khi message tới từ Zalo Group
- Kiểm tra quyền hạn của user trong workspace
- Trả về agent configuration & system prompt

### 2. User Management
- Quản lý danh sách user trong workspace
- Gán role (Admin, Member) cho user
- Lưu thông tin user (name, phone, note)

### 3. Workspace Management
- Tạo & quản lý workspace (đơn vị phân quyền)
- Gắn Zalo Group vào workspace
- Cấu hình agent cho workspace

### 4. Agent Configuration
- Quản lý danh sách AI Agent
- Gán agent & system prompt cho workspace
- Tạo cấu hình riêng cho từng workspace

### 5. User Synchronization
- Sync danh sách user từ Zalo Group
- Auto-create user nếu không tồn tại
- Cập nhật role & thông tin user

---

## 🏛️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────┐
│                  Zalo Webhook                          │
│         (zalo_thread_id, zalo_user_id, message)        │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│           Next.js Backend (Port 3000)                  │
├─────────────────────────────────────────────────────────┤
│  POST /api/resolve-workspace-context                   │
│  POST /api/sync-user                                   │
│  GET /api/health                                       │
└──────────────────────┬──────────────────────────────────┘
                       ↓
        ┌──────────────┴──────────────┐
        ↓                             ↓
┌──────────────────┐         ┌──────────────────┐
│   Neo4j (Graph)  │         │ PostgreSQL (SQL) │
├──────────────────┤         ├──────────────────┤
│ Permission Brain │         │ Config & Metadata│
│ - ZaloUser       │         │ - user_profile   │
│ - Workspace      │         │ - workspace_config
│ - ZaloGroup      │         │                  │
│ - Agent          │         │                  │
│ - Relationships  │         │                  │
└──────────────────┘         └──────────────────┘
        ↓
    n8n Workflows
    (AI Agent Execution)
```

---

## 📊 Cấu Trúc Dữ Liệu

### Neo4j Graph Database (Relationships & Permissions)

#### Nodes

| Node | Properties | Mục đích |
|------|-----------|---------|
| **ZaloUser** | `zalo_user_id`, `name` | Đại diện user Zalo |
| **Workspace** | `id`, `name`, `type` | Đơn vị phân quyền trung tâm |
| **ZaloGroup** | `zalo_thread_id` | Group/channel Zalo |
| **Agent** | `key`, `type` | AI Agent service identity |

#### Relationships

| From | To | Relationship | Properties | Ý nghĩa |
|------|----|-----------|---------|----|
| ZaloUser | Workspace | MEMBER_OF | `role` (admin/member), `joined_at` | User là thành viên workspace |
| ZaloGroup | Workspace | BINDS_TO | - | Group thuộc workspace này |
| Workspace | Agent | USES | - | Workspace sử dụng agent này |

#### Query Examples

```cypher
-- Resolve workspace từ ZaloGroup
MATCH (zg:ZaloGroup {zalo_thread_id: "g123"})
       -[:BINDS_TO]->(w:Workspace)
RETURN w

-- Check user membership & role
MATCH (u:ZaloUser {zalo_user_id: "u456"})
       -[r:MEMBER_OF]->(w:Workspace)
WHERE w.id = "w789"
RETURN u, r.role as role

-- Get workspace agents
MATCH (w:Workspace {id: "w789"})
       -[:USES]->(a:Agent)
RETURN a
```

### PostgreSQL Database (Configuration & Metadata)

#### Table: `user_profile`

```sql
id              SERIAL PRIMARY KEY
zalo_user_id    VARCHAR UNIQUE
name            VARCHAR
phone           VARCHAR
note            TEXT
created_at      TIMESTAMP DEFAULT now()
updated_at      TIMESTAMP DEFAULT now()
```

**Mục đích:** Lưu thông tin bổ sung về user (phone, note). Có thể để trống.

#### Table: `workspace_config`

```sql
id               SERIAL PRIMARY KEY
workspace_id     VARCHAR UNIQUE
agent_key        VARCHAR
system_prompt    TEXT
status           VARCHAR (active|disabled)
created_at       TIMESTAMP DEFAULT now()
updated_at       TIMESTAMP DEFAULT now()
```

**Mục đích:** Cấu hình text cho workspace (prompt AI, trạng thái, etc.)

---

## 🔄 Luồng Xử Lý Chính

### Luồng 1: Resolve Workspace Context (Khi message từ Zalo)

**Input:**
```json
{
  "zalo_thread_id": "g123456789",
  "zalo_user_id": "u987654321"
}
```

**Xử lý:**
1. **Neo4j:** Tìm Workspace từ ZaloGroup (BINDS_TO)
2. **Neo4j:** Kiểm tra User có MEMBER_OF Workspace không
3. **Neo4j:** Lấy Agent mà Workspace USES
4. **PostgreSQL:** Lấy workspace_config (system_prompt, status)
5. **Kết hợp:** Trả response

**Output (Success):**
```json
{
  "allowed": true,
  "agent_key": "agent_support",
  "role": "admin",
  "system_prompt": "Bạn là customer support agent...",
  "status": "active"
}
```

**Output (Error):**
```json
{
  "allowed": false,
  "error": "WORKSPACE_NOT_FOUND|USER_NOT_MEMBER|WORKSPACE_DISABLED",
  "message": "Mô tả lỗi"
}
```

### Luồng 2: Sync User (Khi Zalo gửi danh sách thành viên)

**Input:**
```json
{
  "zalo_thread_id": "g123",
  "workspace_id": "w789",
  "users": [
    {"zalo_user_id": "u1", "name": "User 1", "role": "admin"},
    {"zalo_user_id": "u2", "name": "User 2", "role": "member"}
  ]
}
```

**Xử lý:**
1. **Neo4j:** Tìm hoặc tạo mới ZaloUser
2. **PostgreSQL:** Lưu user_profile (optional)
3. **Neo4j:** Tạo MEMBER_OF relationship nếu chưa tồn tại
4. **Neo4j:** Cập nhật role nếu thay đổi

---

## 👥 Vai trò (Roles)

### 1. Admin
- Quản trị toàn bộ Workspace
- Có quyền chỉnh sửa cấu trúc, user, group, agent
- Có thể thực thi các API mutation

### 2. Member
- User bình thường trong workspace
- Không được thay đổi phân quyền
- Chỉ được truy cập theo cấu hình workspace

### 3. AI Agent (Non-User)
- Không phải user con người
- Chỉ gọi API để thực thi nghiệp vụ được phép
- Không được tự ý thay đổi cấu trúc

---

## 🔗 API Endpoints

| Endpoint | Method | Mục đích |
|----------|--------|---------|
| `/api/resolve-workspace-context` | POST | Resolve permission khi có message Zalo |
| `/api/sync-user` | POST | Đồng bộ danh sách user |
| `/api/health` | GET | Health check |

**Chi tiết:** Xem [API.md](./API.md)

---

## 🗃️ Tech Stack

| Thành phần | Công nghệ | Phiên bản |
|-----------|-----------|---------|
| **Framework** | Next.js (App Router) | 14+ |
| **Language** | TypeScript | 5.3+ |
| **Graph DB** | Neo4j | 5+ |
| **SQL DB** | PostgreSQL | 15+ |
| **Runtime** | Node.js | 18+ |
| **Drivers** | neo4j-driver, pg | Latest |

---

## 📂 Cấu Trúc Project

```
/Users/namtran/Local Apps/Zalo-permission/
├── backend/                      # Next.js Backend
│   ├── src/
│   │   ├── app/api/             # API Routes
│   │   │   ├── resolve-workspace-context/route.ts
│   │   │   ├── sync-user/route.ts
│   │   │   └── health/route.ts
│   │   ├── lib/                 # Utilities & Drivers
│   │   │   ├── neo4j.ts         # Neo4j connection
│   │   │   ├── db.ts            # PostgreSQL connection
│   │   │   └── policy.ts        # Permission logic
│   │   ├── services/            # Business Logic
│   │   │   ├── user.service.ts
│   │   │   ├── workspace.service.ts
│   │   │   └── policy.service.ts
│   │   └── types/               # TypeScript Interfaces
│   └── package.json
├── workspace-api/               # (Optional) Additional workspace APIs
├── docker-compose.yml           # Docker services (Neo4j, PostgreSQL)
├── init-db.sh                   # PostgreSQL initialization
├── init-neo4j.sh                # Neo4j initialization
├── neo4j-init.cypher            # Neo4j schema setup
├── README.md                    # Quick start guide
├── API.md                       # API documentation
├── AUTH.md                      # Authentication & authorization
├── structure-design.md          # Data design & architecture
├── prd3.md                      # Product requirements
├── USER_API_QUICK_REFERENCE.md  # Quick API reference
└── SYSTEM_OVERVIEW.md           # This file
```

---

## 🚀 Quick Start

### 1. Setup Environment

```bash
cd "/Users/namtran/Local Apps/Zalo-permission"

# Install dependencies
cd backend && npm install

# Setup environment variables
cp .env.example .env.local
```

### 2. Start Databases

```bash
# Start Docker containers
docker-compose up -d

# Initialize databases
bash init-db.sh
bash init-neo4j.sh
```

### 3. Start Backend

```bash
npm run dev  # Development on http://localhost:3000
npm run build && npm start  # Production
```

### 4. Test API

```bash
# Health check
curl http://localhost:3000/api/health

# Resolve workspace
curl -X POST http://localhost:3000/api/resolve-workspace-context \
  -H "Content-Type: application/json" \
  -d '{
    "zalo_thread_id": "test_group_1",
    "zalo_user_id": "test_user_admin"
  }'
```

---

## 🔒 Security Features

- ✅ Input validation trên tất cả endpoints
- ✅ Type-safe TypeScript (strict mode)
- ✅ Connection pooling cho databases
- ✅ Prepared statements cho SQL
- ✅ Environment variables cho secrets

**Cần thêm:**
- JWT authentication
- Rate limiting
- HTTPS enforcement
- Audit logging
- Request signing (for AI Agent calls)

---

## 📝 Documentation Files

| File | Nội dung |
|------|---------|
| **[README.md](./README.md)** | Quick start & project overview |
| **[API.md](./API.md)** | All endpoints, request/response, error handling |
| **[AUTH.md](./AUTH.md)** | Permission logic, policy resolution |
| **[structure-design.md](./structure-design.md)** | Database design & architecture |
| **[prd3.md](./prd3.md)** | Product requirements & business logic |
| **[USER_API_QUICK_REFERENCE.md](./USER_API_QUICK_REFERENCE.md)** | Quick API reference |

---

## 📈 Project Status

| Phase | Task | Status |
|-------|------|--------|
| 1 | Setup & Installation | ✅ 83% |
| 2 | Database Layer | ✅ 100% |
| 3 | Services Layer | ✅ 100% |
| 4 | API Endpoints | ✅ 100% |
| 5 | Testing & Validation | ⏳ 35% |
| 6 | Documentation | ✅ 80% |

**Overall Completion:** 73%

### Completed ✅
- Backend code (Next.js, TypeScript)
- Database schema (Neo4j + PostgreSQL)
- All API endpoints
- Business logic (permission, policy)
- Comprehensive documentation

### In Progress ⏳
- PostgreSQL connection (development environment)
- Full API testing suite
- Production deployment

---

## 🔧 Configuration

### Environment Variables

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password

# PostgreSQL
DATABASE_URL=postgres://user:password@localhost:5432/dbname

# Node
NODE_ENV=development
PORT=3000
```

### Database Access

**Neo4j Browser:**
- URL: `http://localhost:7474`
- User: `neo4j`
- Password: `neo4j_password`

**PostgreSQL CLI:**
```bash
docker exec plutus-postgres psql -U plutusr plutusdb
\dt                           # List tables
SELECT * FROM user_profile;   # Check data
```

---

## ⚠️ Known Issues & Workarounds

### PostgreSQL Connection (macOS Development)
**Issue:** Cannot connect from localhost to Docker PostgreSQL

**Solutions:**
1. Run backend inside Docker container
2. Setup port-forward tunnel
3. Use managed PostgreSQL service (AWS RDS, etc.)

**See:** [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed workarounds

---

## 🎓 Learning Path

Nếu bạn là developer mới:

1. **Hiểu business logic** → Đọc [prd3.md](./prd3.md)
2. **Hiểu kiến trúc** → Đọc [structure-design.md](./structure-design.md)
3. **Hiểu permission** → Đọc [AUTH.md](./AUTH.md)
4. **Xem API spec** → Đọc [API.md](./API.md)
5. **Setup dev env** → Đọc [README.md](./README.md)
6. **Test API** → Dùng [USER_API_QUICK_REFERENCE.md](./USER_API_QUICK_REFERENCE.md)

---

## 🎯 Next Steps

1. **Stabilize PostgreSQL connection** (macOS)
2. **Write comprehensive test suite**
3. **Setup CI/CD pipeline**
4. **Deploy to production**
5. **Monitor & optimize**
6. **Add advanced features** (caching, audit log, etc.)

---

## 📞 Support

**Gặp vấn đề?** Kiểm tra tài liệu liên quan:

| Vấn đề | Tài liệu |
|--------|----------|
| Setup issues | [README.md](./README.md) |
| API issues | [API.md](./API.md) + [USER_API_QUICK_REFERENCE.md](./USER_API_QUICK_REFERENCE.md) |
| Permission issues | [AUTH.md](./AUTH.md) |
| Database issues | [structure-design.md](./structure-design.md) |
| Business logic | [prd3.md](./prd3.md) |

---

## 📄 License

Private Project - Zalo Permission Management

---

**Version:** 1.0.0-MVP  
**Last Updated:** 28/01/2026  
**Maintained by:** Development Team
