# 🔐 Authentication & Authorization Policy

**Purpose:** Định nghĩa cách hệ thống kiểm tra quyền hạn khi nhận message từ Zalo

---

## 1. Architecture Overview

```
Zalo Message
    ↓
[Webhook] → Extract: zalo_thread_id, zalo_user_id
    ↓
[Backend] → resolveWorkspaceContext()
    ├─ PostgreSQL: Get ZaloGroup & agent_key (TRỰC TIẾP)
    ├─ Neo4j: Check ZaloUser & MEMBER_OF Workspace (optional)
    └─ PostgreSQL: Get ZaloGroup status
    ↓
[Response] → allowed, role, agent_key
    ↓
[n8n] → Execute Agent with workspace context
```

> **THAY ĐỔI:** Loại bỏ bước resolve Workspace để lấy Agent. Thay vào đó, agent_key được lưu trực tiếp trong bảng zalo_groups.

---

## 2. ZaloUser Identification & Creation

### 2.1 Identify ZaloUser

**Input:** `zalo_user_id` từ Zalo message

**Query (Neo4j):**

```cypher
MATCH (u:ZaloUser {zalo_user_id: $zalo_user_id})
RETURN u
```

### 2.2 Auto-Create ZaloUser (if not exists)

**Logic:**

```
IF zalouser exists
  THEN return existing user
ELSE
  CREATE new ZaloUser with:
    - zalo_user_id: from message
    - name: null (empty)
    - created_at: now()
  THEN return new user
```

**Create Query (Neo4j):**

```cypher
CREATE (u:ZaloUser {
  zalo_user_id: $zalo_user_id,
  name: $name,
  created_at: datetime()
})
RETURN u
```

**SQL:** Tạo record trong `user_profile` (optional, dùng khi user update profile)

---

## 3. Workspace Resolution & Membership Validation

### 3.1 Resolve ZaloGroup → Workspace

**Query (Neo4j):**

```cypher
MATCH (zg:ZaloGroup {zalo_thread_id: $zalo_thread_id})
       -[:BINDS_TO]->
       (w:Workspace)
RETURN w
```

**If not found:**
- Return `allowed: false`
- Error: `WORKSPACE_NOT_FOUND`

### 3.2 Check ZaloUser is Member of Workspace

**Query (Neo4j):**

```cypher
MATCH (u:ZaloUser {zalo_user_id: $zalo_user_id})
       -[rel:MEMBER_OF]->
       (w:Workspace)
RETURN rel.role, rel.joined_at
```

**Scenarios:**

| Case | Result | Action |
|------|--------|--------|
| ZaloUser + Workspace relationship exists | MEMBER | Continue |
| ZaloUser exists but not member | NOT MEMBER | Return allowed: false |
| ZaloUser doesn't exist | NOT EXISTS | Create user, then NOT MEMBER → false |

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Role Types

```
User
  ├─ admin
  │   └─ Full access to all tools & commands
  ├─ member
  │   └─ Access to limited tools
  └─ guest (future)
      └─ View-only access
```

### 4.2 Role from Relationship

**Query (Neo4j):**

```cypher
MATCH (u:User {zalo_id: $zalo_user_id})
       -[rel:MEMBER_OF]->
       (g:Group {zalo_thread_id: $zalo_thread_id})
RETURN rel.role
```

**Return in Response:**

```json
{
  "role": "admin"  // or "member"
}
```

### 4.3 Tool Access by Role (Passed to n8n)

n8n sẽ use `role` để filter tools & actions:

```
role = "admin"
  → Allow: agent_support, agent_finance, admin_tools, all actions
  
role = "member"
  → Allow: agent_support (limited features)
  → Deny: agent_finance, admin_tools, restricted actions
```

**Note:** Role luôn lưu trên MEMBER_OF relationship, không phải trên User node

---

## 5. Agent & Config Resolution (DIRECT FROM ZALO_GROUPS)

### 5.1 Get Agent Assigned to ZaloGroup

**Query (SQL):**

```sql
SELECT agent_key, status
FROM zalo_groups
WHERE thread_id = $zalo_thread_id
```

**Result:** `agent_key` = "agent_support" (or other agents), `status` = "active|disabled"

> **THAY ĐỔI:** Agent được lấy trực tiếp từ bảng zalo_groups, không cần resolve qua Workspace.

### 5.2 Check ZaloGroup Status

**Logic:**

```
IF status = "disabled"
  THEN return allowed: false, status: "disabled"
ELSE
  THEN return allowed: true, status: "active"
```

---

## 6. Complete Workspace Context Resolution Flow (SIMPLIFIED)

```
┌──────────────────────────────────────┐
│ Input: zalo_thread_id, zalo_user_id  │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ 1. Validate input parameters         │
│    - Exist & not empty               │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ 2. Query ZaloGroup by zalo_thread_id │
│    (PostgreSQL) - GET agent_key      │
└──────────────┬───────────────────────┘
               ↓
      ZaloGroup exists?
     /              \
   NO               YES
   ↓                ↓
 Error     ┌─────────────────────────┐
           │ 3. Get agent_key &      │
           │    status from table    │
           │ (PostgreSQL)            │
           └────────┬────────────────┘
                    ↓
           agent_key exists?
          /            \
        NO             YES
        ↓               ↓
    allowed:false   ┌──────────────────┐
                    │ 4. Get/Create    │
                    │    ZaloUser      │
                    │    (Neo4j)       │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ 5. Check MEMBER  │
                    │    _OF Workspace │
                    │    (Neo4j)       │
                    └────────┬─────────┘
                             ↓
                      Is Member?
                    /            \
                  NO             YES
                  ↓               ↓
             allowed:false    ┌──────────────┐
                              │ 6. Get Role  │
                              │ from rel attr│
                              └───────┬──────┘
                                      ↓
                              ┌──────────────┐
                              │ 7. Check     │
                              │ ZaloGroup    │
                              │ status       │
                              └───────┬──────┘
                                      ↓
                  Status = disabled?
                     /            \
                   YES            NO
                   ↓              ↓
              allowed:false   allowed:true
              status:disabled
                                  ↓
                    ┌──────────────────────────────┐
                    │ Return workspace context     │
                    │ {                            │
                    │   allowed: true,             │
                    │   agent_key,                 │
                    │   role,                      │
                    │   status: "active"           │
                    │ }                            │
                    └──────────────────────────────┘
```

> **CẢI THIỆN:** Loại bỏ 2 bước resolve Workspace, query ZaloGroup & agent_key trực tiếp từ PostgreSQL.

---

## 7. Database Schema - Relationships

### Neo4j Schema

```cypher
// ZaloUser Node
(:ZaloUser {
  zalo_user_id: STRING UNIQUE,  // Primary identifier
  name: STRING,
  created_at: TIMESTAMP
})

// ZaloGroup Node (Channel)
(:ZaloGroup {
  zalo_thread_id: STRING UNIQUE  // Primary identifier
})

// Workspace Node
(:Workspace {
  id: STRING UNIQUE,             // Primary identifier
  name: STRING,
  type: STRING,                  // company | team | personal
  created_at: TIMESTAMP
})

// Agent Node (Service Identity)
(:Agent {
  key: STRING UNIQUE,            // agent_support, agent_finance
  type: "ai_agent"
})

// BINDS_TO Relationship (Channel → Workspace)
(ZaloGroup)-[:BINDS_TO]->(Workspace)

// MEMBER_OF Relationship (User → Workspace)
(ZaloUser)-[:MEMBER_OF {
  role: STRING,       // "admin" | "member"
  joined_at: TIMESTAMP
}]->(Workspace)

// USES Relationship (Workspace → Agent)
(Workspace)-[:USES]->(Agent)
```

### SQL Schema

```sql
-- user_profile table (Optional metadata)
CREATE TABLE user_profile (
  id SERIAL PRIMARY KEY,
  zalo_user_id VARCHAR UNIQUE,
  phone VARCHAR,
  note TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- workspace_config table
CREATE TABLE workspace_config (
  id SERIAL PRIMARY KEY,
  workspace_id VARCHAR UNIQUE,
  default_agent VARCHAR,
  system_prompt TEXT,
  status VARCHAR,  -- "active" | "disabled"
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 8. Error Scenarios

### Scenario 1: ZaloUser is new

```
Input: zalo_user_id = "new_user_123", zalo_thread_id = "zalo_group_1"

Flow:
1. Resolve ZaloGroup → Workspace → FOUND (workspace_w1)
2. Query ZaloUser → NOT FOUND
3. Create ZaloUser (auto)
4. Check MEMBER_OF Workspace → NOT FOUND
5. Return: allowed: false, error: USER_NOT_MEMBER
```

### Scenario 2: ZaloUser is member but workspace is disabled

```
Input: zalo_user_id = "user_1", zalo_thread_id = "zalo_group_disabled"

Flow:
1. Resolve ZaloGroup → Workspace → FOUND (workspace_disabled)
2. Query ZaloUser → FOUND
3. Check MEMBER_OF → FOUND (role: member)
4. Get Agent → FOUND
5. Get Workspace Config → status: "disabled"
6. Return: allowed: false, status: "disabled"
```

### Scenario 3: Everything OK - Admin user

```
Input: zalo_user_id = "admin_user", zalo_thread_id = "zalo_group_1"

Flow:
1. Resolve ZaloGroup → Workspace → FOUND (workspace_w1)
2. Query ZaloUser → FOUND
3. Check MEMBER_OF → FOUND (role: admin)
4. Get Agent → FOUND (agent_support)
5. Get Workspace Config → status: "active", system_prompt: "..."
6. Return: 
   {
     "allowed": true,
     "role": "admin",
     "agent_key": "agent_support",
     "system_prompt": "...",
     "status": "active"
   }
```

---

## 9. Future Security Enhancements

- [ ] API Key authentication
- [ ] Rate limiting per group
- [ ] Audit logging (who accessed what)
- [ ] User permissions granularity (per-tool level)
- [ ] Session management
- [ ] IP whitelisting for Zalo webhook
- [ ] Signature verification (Zalo webhook)

---

## 10. Implementation Checklist

- [ ] Implement ZaloUser creation logic
- [ ] Implement ZaloGroup → Workspace resolution (BINDS_TO)
- [ ] Implement Workspace lookup
- [ ] Implement ZaloUser MEMBER_OF Workspace check
- [ ] Implement role extraction
- [ ] Implement Agent resolution (Workspace USES)
- [ ] Implement Workspace Config lookup (SQL)
- [ ] Implement status check
- [ ] Error handling for all cases
- [ ] Logging & monitoring
- [ ] Unit tests for each step
- [ ] Integration tests with Zalo webhook

---

**Last Updated:** 17/01/2026  
**Version:** 1.0.0  
**Author:** Design Phase - Implementation pending
