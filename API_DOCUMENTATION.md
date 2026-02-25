# 📘 Tài Liệu API — Zalo Permission System

> **Base URL:** `http://localhost:3000` (hoặc domain triển khai)  
> **Framework:** Next.js App Router  
> **Ghi chú:** Tất cả response đều trả về JSON với định dạng `{ success: boolean, data?: any, error?: string }`

---

## Mục Lục

- [1. Health Check](#1-health-check)
- [2. Admin — Permissions](#2-admin--permissions)
- [3. Admin — Users](#3-admin--users)
- [4. Admin — Workspaces](#4-admin--workspaces)
- [5. Admin — Tools](#5-admin--tools)
- [6. Admin — Skills](#6-admin--skills)
- [7. Admin — Zalo Groups](#7-admin--zalo-groups)
- [8. User — Skills](#8-user--skills)
- [9. User — Audit Logs](#9-user--audit-logs)

---

## 1. Health Check

### `GET /api/health`

Kiểm tra trạng thái hoạt động của backend API.

**Request:** Không cần tham số.

**Response:**
```json
{
  "status": "ok",
  "message": "Backend API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 2. Admin — Permissions

Quản lý quyền sử dụng tool của từng workspace (mối quan hệ `CAN_USE` trong Neo4j).

### `GET /api/admin/permissions`

Lấy ma trận phân quyền: danh sách workspaces, tools và các quan hệ CAN_USE hiện có.

**Response:**
```json
{
  "success": true,
  "data": {
    "workspaces": [{ "id": "uuid", "name": "string", "created_at": "ISO8601" }],
    "tools": [{ "id": "uuid", "key": "string", "name": "string", "status": "active" }],
    "permissions": [{ "workspace_id": "uuid", "tool_key": "string", "tool_id": "uuid" }]
  }
}
```

---

### `POST /api/admin/permissions`

Cấp quyền cho một workspace được sử dụng một tool. Đồng bộ cả PostgreSQL và Neo4j.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `workspace_id` | string (UUID) | ✅ | ID của workspace |
| `tool_key` | string | ✅ | Key định danh của tool |
| `granted_by` | string (UUID) | ❌ | ID người thực hiện cấp quyền |

**Response (201 — tạo mới / 200 — đã tồn tại):**
```json
{
  "success": true,
  "data": {
    "workspace_id": "uuid",
    "tool_key": "string",
    "relationship_id": "uuid:CAN_USE:tool_key",
    "status": "created | already_exists"
  }
}
```

---

### `DELETE /api/admin/permissions`

Thu hồi quyền của workspace đối với một tool. Đồng bộ cả PostgreSQL và Neo4j.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `workspace_id` | string (UUID) | ✅ | ID của workspace |
| `tool_key` | string | ✅ | Key định danh của tool |
| `revoked_by` | string (UUID) | ❌ | ID người thực hiện thu hồi |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "workspace_id": "uuid",
    "tool_key": "string",
    "relationship_id": "uuid:CAN_USE:tool_key",
    "status": "string"
  }
}
```

---

## 3. Admin — Users

Quản lý người dùng trong hệ thống.

### `GET /api/admin/users`

Lấy danh sách người dùng với phân trang và tìm kiếm.

**Query Parameters:**
| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `search` | string | — | Tìm kiếm theo tên/email |
| `limit` | number | 20 | Số lượng kết quả tối đa |
| `offset` | number | 0 | Vị trí bắt đầu phân trang |

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "pagination": { "limit": 20, "offset": 0, "total": 100 }
}
```

---

### `POST /api/admin/users`

Tạo người dùng mới.

**Request Body:** Thông tin người dùng (tùy schema `UserService.createUser`).

**Response (201):**
```json
{ "success": true, "data": { ...user } }
```

---

### `GET /api/admin/users/[id]`

Lấy thông tin chi tiết của người dùng theo ID.

**Path Params:** `id` — UUID của người dùng.

**Response (200 / 404):**
```json
{ "success": true, "data": { ...user } }
```

---

### `PUT /api/admin/users/[id]`

Cập nhật thông tin người dùng.

**Path Params:** `id` — UUID của người dùng.  
**Request Body:** Các trường cần cập nhật (tùy schema `UserService.updateUser`).

**Response (200):**
```json
{ "success": true, "data": { ...user } }
```

---

### `DELETE /api/admin/users/[id]`

Xoá người dùng khỏi hệ thống.

**Path Params:** `id` — UUID của người dùng.

**Response (200):**
```json
{ "success": true, "message": "User deleted" }
```

---

## 4. Admin — Workspaces

Quản lý workspace. Mọi thao tác ghi đều đồng bộ PostgreSQL và Neo4j.

### `GET /api/admin/workspaces`

Lấy danh sách tất cả workspace với phân trang.

**Query Parameters:**
| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `limit` | number | 50 | Số lượng kết quả |
| `offset` | number | 0 | Vị trí bắt đầu |

**Response (200):**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "name": "string", "description": "string", "status": "string", "created_at": "ISO8601", "updated_at": "ISO8601" }],
  "pagination": { "limit": 50, "offset": 0, "total": 10, "hasMore": false }
}
```

---

### `POST /api/admin/workspaces`

Tạo workspace mới và đồng bộ sang Neo4j.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | string | ✅ | Tên workspace (không được rỗng) |
| `description` | string | ❌ | Mô tả |
| `created_by` | string (UUID) | ❌ | ID người tạo |

**Response (201):**
```json
{ "success": true, "data": { ...workspace } }
```

---

### `GET /api/admin/workspaces/[id]`

Lấy thông tin chi tiết workspace theo ID.

**Path Params:** `id` — UUID của workspace.

**Response (200 / 404):**
```json
{ "success": true, "data": { "id": "uuid", "name": "string", "description": "string", "status": "string", ... } }
```

---

### `PUT /api/admin/workspaces/[id]`

Cập nhật thông tin workspace và đồng bộ Neo4j.

**Path Params:** `id` — UUID của workspace.  
**Request Body (ít nhất 1 field):**
| Field | Kiểu | Mô tả |
|---|---|---|
| `name` | string | Tên mới |
| `description` | string | Mô tả mới |
| `status` | string | Trạng thái mới |
| `updated_by` | string (UUID) | ID người cập nhật |

**Response (200):**
```json
{ "success": true, "data": { ...workspace } }
```

---

### `DELETE /api/admin/workspaces/[id]`

Xoá workspace và toàn bộ dữ liệu liên quan khỏi cả hai database.

**Path Params:** `id` — UUID của workspace.  
**Request Body (tùy chọn):**
| Field | Kiểu | Mô tả |
|---|---|---|
| `deleted_by` | string (UUID) | ID người xoá |

**Response (200):**
```json
{ "success": true, "message": "Workspace deleted successfully from both databases", "data": { ...workspace } }
```

---

### `GET /api/admin/workspaces/[id]/tools`

Lấy danh sách tools được gán cho workspace.

**Response (200):**
```json
{ "success": true, "data": [...tools] }
```

---

### `POST /api/admin/workspaces/[id]/tools`

Gán thêm một tool vào workspace.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tool_id` | string (UUID) | ✅ | ID của tool cần gán |

**Response (201):**
```json
{ "success": true, "message": "Tool added to workspace" }
```

---

### `DELETE /api/admin/workspaces/[id]/tools`

Gỡ một tool khỏi workspace.

**Body hoặc Query Param:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tool_id` | string (UUID) | ✅ | ID của tool cần gỡ (body hoặc `?tool_id=`) |

**Response (200):**
```json
{ "success": true, "message": "Tool removed from workspace" }
```

---

### `GET /api/admin/workspaces/[id]/users`

Lấy danh sách người dùng trong workspace.

**Query Parameters:** `limit` (mặc định 100), `offset` (mặc định 0).

**Response (200):**
```json
{
  "success": true,
  "data": [...users],
  "pagination": { "limit": 100, "offset": 0, "total": 10 }
}
```

---

### `POST /api/admin/workspaces/[id]/users`

Thêm người dùng vào workspace với một vai trò cụ thể.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `user_id` | string (UUID) | ✅ | ID của người dùng |
| `role` | string | ✅ | Vai trò trong workspace |

**Response (201):**
```json
{ "success": true, "data": { ...assignment } }
```

---

### `DELETE /api/admin/workspaces/[id]/users`

Xoá người dùng khỏi workspace.

**Query Param:** `?user_id=<UUID>`

**Response (200):**
```json
{ "success": true, "message": "User removed from workspace" }
```

---

### `GET /api/admin/workspaces/[id]/skills`

Lấy danh sách skills trong workspace.

**Query Parameters:** `limit` (mặc định 100), `offset` (mặc định 0).

**Response (200):**
```json
{
  "success": true,
  "data": [...skills],
  "pagination": { "limit": 100, "offset": 0, "total": 5 }
}
```

---

### `DELETE /api/admin/workspaces/[id]/skills`

Xoá một skill khỏi workspace.

**Query Param:** `?skill_id=<UUID>`

**Response (200):**
```json
{ "success": true, "message": "Skill deleted" }
```

---

### `GET /api/admin/workspaces/[id]/zalo-groups`

Lấy danh sách Zalo Groups được liên kết với workspace.

**Query Parameters:** `limit` (mặc định 100), `offset` (mặc định 0).

**Response (200):**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "workspace_id": "uuid", "thread_id": "string", "name": "string", "status": "string", ... }],
  "pagination": { "limit": 100, "offset": 0, "total": 3, "hasMore": false }
}
```

---

### `POST /api/admin/workspaces/[id]/zalo-groups`

Thêm Zalo Group vào workspace và đồng bộ Neo4j.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `thread_id` | string | ✅ | ID luồng chat Zalo |
| `name` | string | ❌ | Tên nhóm Zalo |
| `created_by` | string (UUID) | ❌ | ID người thêm |

**Response (201):**
```json
{ "success": true, "data": { ...zalo_group } }
```

---

### `DELETE /api/admin/workspaces/[id]/zalo-groups`

Xoá Zalo Group khỏi workspace và đồng bộ Neo4j.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `thread_id` | string | ✅ | ID luồng chat Zalo |
| `deleted_by` | string (UUID) | ❌ | ID người xoá |

**Response (200):**
```json
{ "success": true, "message": "Zalo group removed successfully from both databases", "data": { ...zalo_group } }
```

---

## 5. Admin — Tools

Quản lý các tool/integration trong hệ thống. Mọi thao tác ghi đều đồng bộ PostgreSQL và Neo4j.

### `GET /api/admin/tools`

Lấy danh sách tất cả tool.

**Query Parameters:**
| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `status` | string | — | Lọc theo trạng thái (`active`, `inactive`, ...) |
| `limit` | number | 100 | Số lượng kết quả |
| `offset` | number | 0 | Vị trí bắt đầu |

**Response (200):**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "key": "string", "name": "string", "description": "string", "input_schema": {}, "status": "active", ... }],
  "pagination": { "limit": 100, "offset": 0, "total": 5, "hasMore": false }
}
```

---

### `POST /api/admin/tools`

Tạo tool mới và đồng bộ Neo4j (tự động sinh embedding nếu có description).

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `key` | string | ✅ | Định danh duy nhất (chỉ chữ thường, số, dấu `_`) |
| `name` | string | ✅ | Tên hiển thị |
| `description` | string | ❌ | Mô tả (dùng để sinh vector embedding) |
| `input_schema` | object | ❌ | JSON Schema mô tả input của tool |
| `created_by` | string (UUID) | ❌ | ID người tạo |

**Response (201):**
```json
{ "success": true, "data": { ...tool } }
```

**Lỗi thường gặp:**
- `400` — Thiếu `key` hoặc `name`; sai định dạng `key`
- `409` — Tool với `key` đã tồn tại

---

### `GET /api/admin/tools/[id]`

Lấy chi tiết tool theo ID.

**Path Params:** `id` — UUID của tool.

**Response (200 / 404):**
```json
{ "success": true, "data": { "id": "uuid", "key": "string", "name": "string", "description": "string", "input_schema": {}, "status": "string", ... } }
```

---

### `PUT /api/admin/tools/[id]`

Cập nhật thông tin tool.

**Path Params:** `id` — UUID của tool.  
**Request Body (ít nhất 1 field):**
| Field | Kiểu | Mô tả |
|---|---|---|
| `name` | string | Tên mới |
| `description` | string | Mô tả mới |
| `input_schema` | object | Schema mới |
| `status` | string | Trạng thái mới |

**Response (200):**
```json
{ "success": true, "data": { ...tool } }
```

---

### `DELETE /api/admin/tools/[id]`

Xoá tool khỏi hệ thống.

**Path Params:** `id` — UUID của tool.

**Response (200):**
```json
{ "success": true, "message": "Tool deleted" }
```

---

## 6. Admin — Skills

Quản lý skills của người dùng và workspaces.

### `GET /api/admin/skills`

Lấy danh sách skills với bộ lọc tùy chọn.

**Query Parameters:**
| Tham số | Kiểu | Mô tả |
|---|---|---|
| `workspace_id` | UUID | Lọc theo workspace |
| `owner_id` | UUID | Lọc theo chủ sở hữu |
| `status` | string | Lọc theo trạng thái (`active`, `archived`, `disabled`) |
| `limit` | number | Mặc định 100 |
| `offset` | number | Mặc định 0 |

**Response (200):**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "name": "string", "description": "string", "owner_id": "uuid", "owner_name": "string", "workspace_id": "uuid", "is_shared": false, "logic_config": [...], "status": "active", ... }],
  "pagination": { "limit": 100, "offset": 0, "total": 5, "hasMore": false }
}
```

---

### `POST /api/admin/skills/share`

Chia sẻ skill với một hoặc nhiều workspace.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `skill_id` | UUID | ✅ | ID của skill cần chia sẻ |
| `workspace_ids` | UUID[] | ❌ | Danh sách workspace đích (hiện tại chỉ đánh dấu `is_shared = true`) |

**Response (200):**
```json
{ "success": true, "data": { ...skill } }
```

---

### `GET /api/admin/skills/[id]`

Lấy chi tiết skill theo ID.

**Path Params:** `id` — UUID của skill.

**Response (200 / 404):**
```json
{ "success": true, "data": { ...skill } }
```

---

### `PATCH /api/admin/skills/[id]`

Cập nhật trạng thái skill.

**Path Params:** `id` — UUID của skill.  
**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `status` | string | ✅ | Một trong: `active`, `archived`, `disabled` |

**Response (200):**
```json
{ "success": true, "data": { ...skill } }
```

---

### `DELETE /api/admin/skills/[id]`

Archive skill (không xoá vật lý, đặt `status = 'archived'`).

**Path Params:** `id` — UUID của skill.

**Response (200):**
```json
{ "success": true, "message": "Skill archived" }
```

---

### `DELETE /api/admin/skills/[id]/unshare`

Huỷ chia sẻ skill với workspace.

**Path Params:** `id` — UUID của skill.  
**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `workspace_id` | UUID | ✅ | ID workspace cần huỷ chia sẻ |

**Response (200):**
```json
{ "success": true, "message": "Skill unshared" }
```

---

## 7. Admin — Zalo Groups

Quản lý thành viên trong Zalo Group.

### `GET /api/admin/zalo-groups/[id]/users`

Lấy danh sách thành viên của Zalo Group.

**Path Params:** `id` — UUID của Zalo Group.  
**Query Parameters:** `limit` (mặc định 100), `offset` (mặc định 0).

**Response (200):**
```json
{
  "success": true,
  "data": [...members],
  "pagination": { "limit": 100, "offset": 0, "total": 10 }
}
```

---

### `POST /api/admin/zalo-groups/[id]/users`

Thêm người dùng vào Zalo Group.

**Path Params:** `id` — UUID của Zalo Group.  
**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `user_id` | UUID | ✅ | ID người dùng cần thêm |
| `role` | string | ❌ | Vai trò (mặc định: `MEMBER`) |

**Response (201):**
```json
{ "success": true, "data": { ...member } }
```

---

### `DELETE /api/admin/zalo-groups/[id]/users`

Xoá người dùng khỏi Zalo Group.

**Path Params:** `id` — UUID của Zalo Group.  
**Query Param:** `?user_id=<UUID>`

**Response (200):**
```json
{ "success": true, "message": "User removed from zalo group" }
```

---

## 8. User — Skills

API dành cho người dùng thông thường quản lý skills của mình.

### `GET /api/user/skills`

Lấy danh sách skills của người dùng.

**Query Parameters:**
| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `user_id` | UUID | ✅ | ID của người dùng |
| `workspace_id` | UUID | ❌ | Lọc theo workspace |
| `limit` | number | — | Mặc định 50 |
| `offset` | number | — | Mặc định 0 |

**Response (200):**
```json
{
  "success": true,
  "skills": [...],
  "pagination": { "limit": 50, "offset": 0, "total": 5, "hasMore": false }
}
```

---

### `POST /api/user/skills`

Chia sẻ skill với một workspace.

**Query Param:** `?user_id=<UUID>` (bắt buộc)  
**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `skill_id` | UUID | ✅ | ID của skill |
| `workspace_id` | UUID | ✅ | ID workspace đích |

**Response (200):**
```json
{ "success": true }
```

---

### `DELETE /api/user/skills`

Xoá một skill của người dùng.

**Query Params:**
| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `skill_id` | UUID | ✅ | ID skill cần xoá |
| `user_id` | UUID | ✅ | ID người dùng (xác thực quyền sở hữu) |

**Response (200):**
```json
{ "success": true, "message": "Skill deleted successfully" }
```

---

## 9. User — Audit Logs

Xem lịch sử hoạt động của người dùng và workspace.

### `GET /api/user/audit-logs`

Lấy danh sách audit logs. Hỗ trợ lọc theo user, workspace, hoặc thread Zalo.

**Query Parameters:**
| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `user_id` | UUID | ✅ | ID người dùng (bắt buộc) |
| `workspace_id` | UUID | ❌ | Lọc theo workspace |
| `thread_id` | string | ❌ | Lọc theo thread Zalo chat |
| `start_date` | ISO8601 | ❌ | Lọc từ ngày (khi dùng với `workspace_id`) |
| `end_date` | ISO8601 | ❌ | Lọc đến ngày (khi dùng với `workspace_id`) |
| `limit` | number | — | Mặc định 100 |
| `offset` | number | — | Mặc định 0 |

**Ưu tiên lọc:** `thread_id` > `workspace_id` > `user_id`

**Response (200):**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "user_id": "uuid",
      "action_type": "PERMISSION_GRANTED | PERMISSION_REVOKED | TOOL_CREATED | SKILL_SHARED | SKILL_DELETED | ...",
      "input_data": {},
      "output_data": {},
      "status": "success | failure",
      "created_at": "ISO8601"
    }
  ],
  "pagination": { "limit": 100, "offset": 0, "total": 50, "hasMore": false }
}
```

---

## Cấu Trúc Response Chung

| Field | Kiểu | Mô tả |
|---|---|---|
| `success` | boolean | `true` nếu thành công |
| `data` | object/array | Dữ liệu trả về (nếu có) |
| `error` | string | Thông báo lỗi (nếu `success = false`) |
| `message` | string | Thông báo bổ sung (cho DELETE, v.v.) |
| `pagination` | object | `{ limit, offset, total, hasMore? }` |

## HTTP Status Codes

| Code | Ý nghĩa |
|---|---|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Lỗi dữ liệu đầu vào (thiếu field, sai định dạng) |
| `404` | Không tìm thấy resource |
| `409` | Conflict — dữ liệu đã tồn tại |
| `500` | Lỗi server |

---

### `GET /api/workspaces/search`

Tìm kiếm workspace theo tên bằng **vector search** (cosine similarity). Nếu người dùng gõ thiếu hoặc gần đúng vẫn tìm được. Fallback về ILIKE text search khi chưa có OpenAI key.

**Query Parameters:**
| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | string | ✅ | Tên cần tìm (gần đúng) |
| `limit` | number | ❌ | Số kết quả tối đa (mặc định 10, tối đa 50) |
| `threshold` | number | ❌ | Ngưỡng similarity tối thiểu 0–1 (mặc định 0.5) |

**Ví dụ:**
```
GET /api/workspaces/search?name=Inova Manager&limit=10&threshold=0.5
```

**Response (200):**
```json
{
  "success": true,
  "search_mode": "vector | text_fallback",
  "data": [{
    "id": "uuid",
    "name": "Inova Manager",
    "description": "...",
    "status": "active",
    "similarity": 0.9312
  }],
  "pagination": { "limit": 10, "threshold": 0.5, "total": 1 }
}
```

> `search_mode: "vector"` khi dùng pgvector; `"text_fallback"` khi không có embedding hoặc similarity quá thấp.

---

## 10. Agent APIs (n8n Integration)

Các API này được gọi bởi **n8n Planner Agent** để vận hành luồng AI.

### `POST /api/agent/auth-and-resources`

API cốt lõi cho Planner — xác thực người dùng và cung cấp danh sách tài nguyên (Tools/Skills) phù hợp trong một lần gọi.

**Luồng xử lý:**
1. **Neo4j Auth** — xác thực `ZaloUser → PART_OF → Workspace ← BELONGS_TO ← ZaloGroup(thread_id)`
2. **Pending Task** — kiểm tra task đang chờ `AWAITING_INPUT` cho thread này
3. **Hybrid Search** — nếu có `content`: vector search (pgvector) + lọc whitelist Neo4j; nếu không: trả toàn bộ whitelist

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `zalo_user_id` | string | ✅ | Zalo UID của người dùng |
| `thread_id` | string | ✅ | Thread ID của nhóm Zalo |
| `content` | string | ❌ | Tin nhắn người dùng — dùng để semantic search |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "workspace_id": "uuid",
    "role": "admin | member",
    "pending_task": { "id": "uuid", "intent": "...", "full_plan": {}, "missing_parameters": {}, "status": "AWAITING_INPUT" } | null,
    "tools": [{ "id": "uuid", "key": "string", "name": "string", "description": "string", "input_schema": {}, "similarity": 0.92 }],
    "skills": [{ "id": "uuid", "name": "string", "description": "string", "logic_config": [], "is_shared": true, "similarity": 0.88 }]
  },
  "meta": {
    "elapsed_ms": 120,
    "search_mode": "hybrid | whitelist",
    "tools_count": 3,
    "skills_count": 1
  }
}
```

**Lỗi:**
- `400` — Thiếu `zalo_user_id` hoặc `thread_id`
- `403` — Người dùng không có quyền truy cập workspace từ thread này
- `500` — Lỗi server / Neo4j / PostgreSQL
