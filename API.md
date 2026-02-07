# 📡 API Documentation

**Backend:** Next.js (App Router)  
**Base URL:** `http://localhost:3000` (local) | `https://your-domain.com` (production)

---

## 1. POST /api/resolve-workspace-context

**Purpose:** Resolve Zalo group → agent (TRỰC TIẾP), kiểm tra quyền & lấy cấu hình agent khi có message từ Zalo

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
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | User có được phép sử dụng agent không |
| `agent_key` | string | Identifier của agent (e.g., agent_support, agent_finance) |
| `role` | string | Role của user trong workspace (admin, member) |
| `status` | string | Trạng thái group (active, disabled) |
| `created_at` | timestamp | Thời gian tạo config |

**Response (Error Cases):**

### Case 1: ZaloGroup không tồn tại hoặc chưa cấu hình agent

```json
{
  "allowed": false,
  "error": "ZALO_GROUP_NOT_FOUND",
  "message": "Zalo group không tồn tại hoặc chưa được cấu hình agent"
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

### Case 3: Zalo Group bị disable

```json
{
  "allowed": false,
  "error": "GROUP_DISABLED",
  "message": "Zalo group hiện đang bị vô hiệu hóa",
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
2. Query ZaloGroup by zalo_thread_id (PostgreSQL)
3. If ZaloGroup not found → return allowed: false
4. Get agent_key from zalo_groups table
5. If agent_key not set → return allowed: false
6. Check ZaloUser exists (Neo4j) → create if not exists
7. Check ZaloUser MEMBER_OF Workspace (Neo4j) - optional permission check
8. If not member → return allowed: false
9. Get role from MEMBER_OF relationship
10. Get ZaloGroup status (active | disabled)
11. Return full policy object
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

## 2. GET /api/workspaces/search - Search Workspaces

**Purpose:** Tìm kiếm workspace ID dựa trên workspace name (gần đúng) sử dụng trigram similarity

**Request:**

```http
GET /api/workspaces/search?name=customer%20support&limit=10&threshold=0.3
Content-Type: application/json
```

**Query Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | - | Workspace name to search |
| `limit` | integer | No | 20 | Max results (max: 100) |
| `threshold` | float | No | 0.3 | Similarity threshold (0-1, 0.3 = 30% match) |

**Response (Success - 200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "w123",
      "name": "Customer Support Team",
      "status": "active",
      "description": "Main support workspace",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-24T15:45:00Z",
      "similarity": 0.95
    },
    {
      "id": "w124",
      "name": "Support - Sales Team",
      "status": "active",
      "description": "Sales support workspace",
      "created_at": "2024-01-20T12:00:00Z",
      "updated_at": "2024-01-24T14:30:00Z",
      "similarity": 0.85
    }
  ],
  "pagination": {
    "limit": 10,
    "total": 2,
    "hasMore": false
  },
  "search": {
    "query": "customer support",
    "threshold": 0.3,
    "method": "trigram_similarity"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always true on success |
| `data` | array | Array of matching workspaces |
| `data[].similarity` | float | Similarity score (0-1) - higher is better |
| `pagination.hasMore` | boolean | Whether more results exist |
| `search.method` | string | Search algorithm used (trigram_similarity or fallback) |

**Response (Error Cases):**

### Case 1: Missing name parameter

```json
{
  "success": false,
  "error": "MISSING_PARAM",
  "message": "Parameter \"name\" is required and cannot be empty"
}
```

### Case 2: Invalid threshold

```json
{
  "success": false,
  "error": "INVALID_PARAM",
  "message": "Parameter \"threshold\" must be between 0 and 1"
}
```

### Case 3: Server Error

```json
{
  "success": false,
  "error": "SEARCH_FAILED",
  "message": "Failed to search workspaces"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| `200` | Thành công - trả về kết quả tìm kiếm |
| `400` | Bad request - missing/invalid parameters |
| `500` | Server error |

**Algorithm Details:**

- Sử dụng **PostgreSQL pg_trgm extension** cho trigram similarity matching
- Tìm kiếm **gần đúng**, không yêu cầu tên chính xác
- Kết quả được sắp xếp theo **similarity score** (cao nhất trước)
- Nếu pg_trgm không available, fallback sang LIKE search
- Similarity threshold mặc định `0.3` (30% match)

**Example cURL:**

```bash
# Search workspaces like "customer support"
curl -X GET "http://localhost:3000/api/workspaces/search?name=customer%20support&limit=10" \
  -H "Content-Type: application/json"

# Search with custom threshold (50% match)
curl -X GET "http://localhost:3000/api/workspaces/search?name=sales&threshold=0.5" \
  -H "Content-Type: application/json"

# Strict search (80% match)
curl -X GET "http://localhost:3000/api/workspaces/search?name=support%20team&threshold=0.8" \
  -H "Content-Type: application/json"
```

**Example Response:**

```bash
{
  "success": true,
  "data": [
    {
      "id": "w123",
      "name": "Customer Support",
      "status": "active",
      "description": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-24T15:45:00Z",
      "similarity": 0.95
    }
  ],
  "pagination": {
    "limit": 20,
    "total": 1,
    "hasMore": false
  },
  "search": {
    "query": "customer support",
    "threshold": 0.3,
    "method": "trigram_similarity"
  }
}
```

---

## 3. POST /api/sync-user (Optional MVP)

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

## 4. Error Handling

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

## 5. Response Format Guidelines

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

## 6. Rate Limiting (Future)

- 1000 requests/hour per IP
- 10000 requests/hour per API key (if authenticated)

---

## 7. Pagination (Future)

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

## 8. Webhook Integration (n8n)

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

## 9. POST /api/users - Create User (Contact List)

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

## 10. GET /api/users - List Users

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

## 11. GET /api/users/:id - Get User Detail

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

## 12. PUT /api/users/:id - Update User Profile

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

## 13. DELETE /api/users/:id - Delete User

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

## 14. Testing

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

# Test search workspaces by name
curl -X GET "http://localhost:3000/api/workspaces/search?name=customer" \
  -H "Content-Type: application/json"

# Test search with custom threshold
curl -X GET "http://localhost:3000/api/workspaces/search?name=support&threshold=0.5&limit=10" \
  -H "Content-Type: application/json"

# Test search with strict matching
curl -X GET "http://localhost:3000/api/workspaces/search?name=customer%20support&threshold=0.8" \
  -H "Content-Type: application/json"
```

### Integration Testing

- Test with actual Zalo webhook data
- Verify response format matches n8n expectations
- Test error cases

---

**Last Updated:** 01/02/2026  
**Version:** 1.2.0
**Changes:** Added GET /api/workspaces/search - Workspace search with trigram similarity matching
