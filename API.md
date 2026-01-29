# 📡 API Documentation

**Backend:** Next.js (App Router)  
**Base URL:** `http://localhost:3000` (local) | `https://your-domain.com` (production)

---

## 1. POST /api/resolve-workspace-context

**Purpose:** Resolve Zalo group → workspace, kiểm tra quyền & lấy cấu hình agent khi có message từ Zalo

**Request:**

```http
POST /api/resolve-workspace-context
Content-Type: application/json

{
  "zalo_thread_id": "g123456789",
  "zalo_user_id": "u987654321"
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zalo_thread_id` | string | Yes | Group/thread ID từ Zalo |
| `zalo_user_id` | string | Yes | User ID từ Zalo |

**Response (Success - 200):**

```json
{
  "allowed": true,
  "agent_key": "agent_support",
  "role": "admin",
  "system_prompt": "Bạn là một customer support agent. Hãy trả lời câu hỏi của khách hàng...",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | User có được phép sử dụng agent không |
| `agent_key` | string | Identifier của agent (e.g., agent_support, agent_finance) |
| `role` | string | Role của user trong group (admin, member) |
| `system_prompt` | string | System prompt cho agent |
| `status` | string | Trạng thái group (active, disabled) |
| `created_at` | timestamp | Thời gian tạo config |

**Response (Error Cases):**

### Case 1: ZaloGroup không map được với Workspace

```json
{
  "allowed": false,
  "error": "WORKSPACE_NOT_FOUND",
  "message": "Zalo group không được liên kết với workspace nào"
}
```

### Case 2: User không phải member của workspace

```json
{
  "allowed": false,
  "error": "USER_NOT_MEMBER",
  "message": "User không thuộc workspace này"
}
```

### Case 3: Workspace bị disable

```json
{
  "allowed": false,
  "error": "WORKSPACE_DISABLED",
  "message": "Workspace hiện đang bị vô hiệu hóa",
  "status": "disabled"
}
```

### Case 4: Server Error

```json
{
  "allowed": false,
  "error": "INTERNAL_ERROR",
  "message": "Lỗi hệ thống, vui lòng thử lại"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| `200` | Thành công - trả về policy |
| `400` | Bad request - thiếu/sai parameter |
| `404` | Resource not found |
| `500` | Server error |

**Logic Flow:**

```
1. Validate input (zalo_thread_id, zalo_user_id)
2. Query ZaloGroup by zalo_thread_id (Neo4j)
3. Query Workspace via BINDS_TO relationship (Neo4j)
4. If Workspace not found → return allowed: false
5. Check ZaloUser exists (Neo4j) → create if not exists
6. Check ZaloUser MEMBER_OF Workspace (Neo4j)
7. If not member → return allowed: false
8. Get role from MEMBER_OF relationship
9. Get Agent from Workspace (USES relationship)
10. Get config from SQL (workspace_config table)
11. Check workspace status (active | disabled)
12. Return full policy object
```

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/resolve-workspace-context \
  -H "Content-Type: application/json" \
  -d '{
    "zalo_thread_id": "g123456789",
    "zalo_user_id": "u987654321"
  }'
```

**Example Response (Success):**

```bash
{
  "allowed": true,
  "agent_key": "agent_support",
  "role": "admin",
  "system_prompt": "You are a customer support agent...",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## 2. POST /api/sync-user (Optional MVP)

**Purpose:** Đồng bộ danh sách thành viên từ Zalo webhook vào workspace

**Request:**

```http
POST /api/sync-user
Content-Type: application/json

{
  "zalo_thread_id": "g123456789",
  "workspace_id": "w123",
  "users": [
    {
      "zalo_user_id": "u111",
      "name": "Nguyễn Văn A",
      "role": "admin"
    },
    {
      "zalo_user_id": "u222",
      "name": "Trần Thị B",
      "role": "member"
    }
  ]
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zalo_thread_id` | string | Yes | Zalo group ID |
| `workspace_id` | string | Yes | Workspace ID |
| `users` | array | Yes | Danh sách user |
| `users[].zalo_user_id` | string | Yes | User ID |
| `users[].name` | string | No | User name |
| `users[].role` | string | Yes | admin, member |

**Response (Success - 200):**

```json
{
  "success": true,
  "synced_count": 2,
  "created_count": 1,
  "updated_count": 1,
  "errors": []
}
```

**Response (Error - 400/500):**

```json
{
  "success": false,
  "error": "SYNC_FAILED",
  "message": "Lỗi khi đồng bộ dữ liệu",
  "errors": [
    {
      "user_id": "u111",
      "error": "Invalid role"
    }
  ]
}
```

---

## 3. Error Handling

**Common Error Codes:**

| Code | Meaning |
|------|---------|
| `INVALID_REQUEST` | Request format không hợp lệ |
| `MISSING_PARAM` | Thiếu parameter bắt buộc |
| `GROUP_NOT_FOUND` | Group không tồn tại |
| `USER_NOT_MEMBER` | User không phải member của group |
| `GROUP_DISABLED` | Group bị disable |
| `AGENT_NOT_FOUND` | Agent không tồn tại |
| `DB_ERROR` | Lỗi database |
| `INTERNAL_ERROR` | Lỗi hệ thống |

---

## 4. Response Format Guidelines

Tất cả responses phải có format:

```json
{
  "success": true/false,
  "data": {},
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

hoặc (cho resolve-policy):

```json
{
  "allowed": true/false,
  "agent_key": "string",
  "role": "string",
  "system_prompt": "string",
  "status": "string",
  "error": "ERROR_CODE (if applicable)",
  "message": "string (if error)"
}
```

---

## 5. Rate Limiting (Future)

- 1000 requests/hour per IP
- 10000 requests/hour per API key (if authenticated)

---

## 6. Pagination (Future)

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

## 7. Webhook Integration (n8n)

Response từ `/api/resolve-workspace-context` được gửi trực tiếp tới n8n:

```
Zalo Webhook
  ↓
POST /api/resolve-workspace-context
  ↓
Return Workspace Context Object
  ↓
n8n (Agent, Tools, Prompt)
```

**n8n sẽ sử dụng:**
- `agent_key` - để chọn agent
- `system_prompt` - system context
- `role` - để filter tools (e.g., admin có access tool admin)
- `status` - để decide execute hoặc reject

---

## 6. POST /api/users - Create User (Contact List)

**Purpose:** AI Agent thêm user mới vào danh bạ (contact list) & tự động setup Neo4j relationships

**Request:**

```http
POST /api/users
Content-Type: application/json

{
  "zalo_group_id": "g123456789",
  "zalo_id": "u987654321",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+84 901234567",
  "address": "123 Main Street, HCM",
  "gender": "male"
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zalo_group_id` | string | Yes | Zalo group ID user will belong to |
| `zalo_id` | string | Yes | User's Zalo ID |
| `name` | string | Yes | User's full name |
| `email` | string | No | User's email |
| `phone` | string | No | User's phone number |
| `address` | string | No | User's address |
| `gender` | string | No | User's gender (male/female/other) |

**Response (Success - 201):**

```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "zalo_id": "u987654321",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84 901234567",
    "address": "123 Main Street, HCM",
    "gender": "male",
    "zalo_group_id": "g123456789",
    "workspace_id": "workspace-xyz",
    "created_at": "2024-01-24T10:30:00Z"
  }
}
```

**Backend Processing:**

1. Validate input (zalo_id, name, zalo_group_id required)
2. Check if user already exists (by zalo_id)
3. Create user record in PostgreSQL `users` table
4. Resolve zalo_group_id → workspace_id via BINDS_TO relationship
5. Create/Update ZaloUser node in Neo4j
6. **Auto-create MEMBER_OF relationship** (User -[:MEMBER_OF]-> ZaloGroup)
7. **Auto-create PART_OF relationship** (User -[:PART_OF]-> Workspace)
8. Return user_id & confirmation

**Error Responses:**

```json
// 400 - Bad Request (missing required fields)
{
  "success": false,
  "error": "Missing required fields: zalo_id, name, zalo_group_id"
}

// 409 - Conflict (user already exists)
{
  "success": false,
  "error": "User with zalo_id u987654321 already exists"
}

// 404 - Not Found (workspace not found)
{
  "success": false,
  "error": "Workspace not found for zalo_group_id: g123456789"
}

// 500 - Server Error
{
  "success": false,
  "error": "Failed to create user relationships in Neo4j: ..."
}
```

---

## 7. GET /api/users - List Users

**Purpose:** Get list of all users with pagination

**Request:**

```http
GET /api/users?limit=20&offset=0
Content-Type: application/json
```

**Query Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 20 | Records per page (max 100) |
| `offset` | integer | 0 | Pagination offset |

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "zalo_id": "u987654321",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+84 901234567",
        "address": "123 Main Street, HCM",
        "gender": "male",
        "created_at": "2024-01-24T10:30:00Z",
        "updated_at": "2024-01-24T10:30:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 50,
      "hasMore": true
    }
  }
}
```

---

## 8. GET /api/users/:id - Get User Detail

**Purpose:** Get specific user's profile

**Request:**

```http
GET /api/users/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "zalo_id": "u987654321",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84 901234567",
    "address": "123 Main Street, HCM",
    "gender": "male",
    "created_at": "2024-01-24T10:30:00Z",
    "updated_at": "2024-01-24T10:30:00Z"
  }
}
```

---

## 9. PUT /api/users/:id - Update User Profile

**Purpose:** Update user's profile information

**Request:**

```http
PUT /api/users/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "email": "newemail@example.com",
  "phone": "+84 909876543",
  "address": "456 New Street, HN"
}
```

**Note:** Cannot update `zalo_id` (immutable)

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "zalo_id": "u987654321",
    "name": "John Doe",
    "email": "newemail@example.com",
    "phone": "+84 909876543",
    "address": "456 New Street, HN",
    "gender": "male",
    "created_at": "2024-01-24T10:30:00Z",
    "updated_at": "2024-01-24T11:00:00Z"
  }
}
```

---

## 10. DELETE /api/users/:id - Delete User

**Purpose:** Delete user from contact list

**Request:**

```http
DELETE /api/users/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "User deleted: 550e8400-e29b-41d4-a716-446655440000"
}
```

**Note:** User is soft-deleted from PostgreSQL. Neo4j relationships remain for audit.

---

## 11. Testing

### Local Testing

```bash
# Test create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "zalo_group_id": "test_group_1",
    "zalo_id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+84 901234567",
    "address": "123 Main St, HCM",
    "gender": "male"
  }'

# Test list users
curl -X GET "http://localhost:3000/api/users?limit=10&offset=0" \
  -H "Content-Type: application/json"

# Test get user
curl -X GET http://localhost:3000/api/users/[user_id] \
  -H "Content-Type: application/json"

# Test update user
curl -X PUT http://localhost:3000/api/users/[user_id] \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "phone": "+84 909876543"
  }'

# Test delete user
curl -X DELETE http://localhost:3000/api/users/[user_id] \
  -H "Content-Type: application/json"

# Test resolve-workspace-context
curl -X POST http://localhost:3000/api/resolve-workspace-context \
  -H "Content-Type: application/json" \
  -d '{
    "zalo_thread_id": "test_group_1",
    "zalo_user_id": "test_user_1"
  }'

# Test sync-user
curl -X POST http://localhost:3000/api/sync-user \
  -H "Content-Type: application/json" \
  -d '{
    "zalo_thread_id": "test_group_1",
    "workspace_id": "test_workspace_1",
    "users": [
      {"zalo_user_id": "u1", "name": "User 1", "role": "admin"}
    ]
  }'
```

### Integration Testing

- Test with actual Zalo webhook data
- Verify response format matches n8n expectations
- Test error cases

---

**Last Updated:** 24/01/2026  
**Version:** 1.1.0
**Changes:** Added User Management APIs (POST, GET, PUT, DELETE /api/users)
