# 📘 Tài Liệu API — Zalo Permission System

> **Base URL:** `http://localhost:3000` (hoặc domain triển khai)  
> **Framework:** Next.js App Router  
> **Ghi chú:** Tất cả response đều trả về JSON với định dạng `{ success: boolean, data?: any, error?: string }`

---

## Mục Lục

- [1. Health Check](#1-health-check)
- [2. Authentication](#2-authentication)
- [3. Admin — Users](#3-admin--users)
- [4. Admin — Workspaces](#4-admin--workspaces)

---

## 2. Authentication (Xác thực)

Hầu hết các API `/api/admin/*` đều yêu cầu xác thực. Bạn có thể xác thực theo 2 cách:

### Cách 1: Sử dụng Bearer Token (Khuyên dùng cho curl/Postman)
Gửi token trong header `Authorization`.

**Quy trình lấy token để test:**

1. **Đăng nhập để lấy token:**
```bash
curl --location 'https://zalo.st.io.vn/api/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "identifier": "admin",
    "password": "admin_password_2024"
}'
```
*Lưu ý: Nếu bạn đã đổi password, hãy sử dụng password mới.*

2. **Lấy trường `token` từ response và sử dụng trong header:**
```bash
curl --location 'https://zalo.st.io.vn/api/admin/skills' \
--header 'Authorization: Bearer <YOUR_TOKEN_HERE>' \
--header 'Content-Type: application/json' \
--data-raw '{...}'
```

### Cách 2: Sử dụng Cookie (Dành cho trình duyệt)
Sau khi đăng nhập thành công qua giao diện admin hoặc `/api/auth/login`, một cookie `auth_token` sẽ được thiết lập tự động.

---
- [5. Admin — Tools](#5-admin--tools)
- [6. Admin — Skills](#6-admin--skills)
- [7. Admin — Zalo Groups](#7-admin--zalo-groups)
- [8. Admin — Pending Tasks](#8-admin--pending-tasks)
- [9. User — Skills](#9-user--skills)
- [10. User — Audit Logs](#10-user--audit-logs)

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


## 3. Admin — Users

Quản lý người dùng trong hệ thống.

### `GET /api/admin/users`

Lấy danh sách người dùng với phân trang và tìm kiếm.

**Query Parameters:**
| Tham số | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `search` | string | — | Tìm kiếm theo tên/email/zaloID/SĐT |
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
  "data": [{ 
    "id": "uuid", 
    "key": "string", 
    "name": "string", 
    "description": "string", 
    "input_schema": {}, 
    "status": "active", 
    "group_info": { "id": "uuid", "key": "string", "name": "string" } | null,
    ... 
  }],
  "pagination": { "limit": 100, "offset": 0, "total": 5, "hasMore": false }
}
```

> **Lưu ý:** Thông tin `group_info` được truy vấn từ Neo4j qua quan hệ `BELONGS_TO_GROUP`. PostgreSQL không còn lưu trữ trực tiếp thông tin này.

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
| `group_id` | string (UUID) | ❌ | ID của Tool Group (đối ứng Neo4j) |

**Response (201):**
```json
{ "success": true, "data": { ...tool, "group_info": { ... } } }
```

> **Lưu ý:** Trường `group_id` trong request sẽ tạo quan hệ `BELONGS_TO_GROUP` trong Neo4j. Dữ liệu này không được lưu trong PostgreSQL.

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
| `group_id` | string | ID Tool Group mới (hoặc `null` để huỷ nhóm) |

**Response (200):**
```json
{ "success": true, "data": { ...tool, "group_id": "uuid" } }
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
| `workspace_id` | UUID | Lọc theo workspace |
| `owner_id` | UUID | Lọc theo chủ sở hữu |
| `status` | string | Lọc theo trạng thái (`active`, `archived`, `disabled`) |
| `category` | string | Lọc theo danh mục |
| `limit` | number | Mặc định 100 |
| `offset` | number | Mặc định 0 |

**Response (200):**
```json
{
  "success": true,
  "data": [{ 
    "id": "uuid", 
    "name": "string", 
    "description": "string", 
    "owner_id": "uuid", 
    "owner_name": "string", 
    "workspace_id": "uuid", 
    "is_shared": false, 
    "detail": "string (Markdown prompt)", 
    "category": "string | null",
    "tools": [{ "id": "uuid", "name": "string" }],
    "status": "active", 
    ... 
  }],
  "pagination": { "limit": 100, "offset": 0, "total": 5, "hasMore": false }
}
```

---

### `POST /api/admin/skills`

Tạo mới một skill hoàn chỉnh (bao gồm liên kết trong Neo4j).

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | string | ✅ | Tên skill |
| `description` | string | ❌ | Mô tả ngắn |
| `detail` | string | ✅ | Nội dung prompt chi tiết (Markdown) |
| `category` | string | ❌ | Tên danh mục (nếu mới sẽ tự động tạo) |
| `tools` | UUID[] | ❌ | Danh sách ID các tool mà skill sử dụng |
| `owner_id` | UUID | ❌ | ID người sở hữu |
| `workspace_id` | UUID | ❌ | ID workspace gốc |
| `is_shared` | boolean | ❌ | Chia sẻ toàn cục (mặc định: false) |

**Response (201):**
```json
{
  "success": true,
  "data": { ...skill, "category": "string", "tools": [...] }
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
{
  "success": true,
  "data": { 
    ...skill, 
    "detail": "markdown string", 
    "category": "string", 
    "tools": [{ "id": "uuid", "name": "string" }] 
  }
}
```

---

### `PUT /api/admin/skills/[id]`

Cập nhật thông tin chi tiết của skill.

**Path Params:** `id` — UUID của skill.

**Request Body:** (Tương tự `POST /api/admin/skills`)

**Response (200):**
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

### `GET /api/admin/categories`

Lấy danh sách tất cả các danh mục Skill hiện có trong Neo4j.

**Response (200):**
```json
{
  "success": true,
  "data": ["Category 1", "Category 2", ...]
}
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

API cốt lõi cho Planner — xác thực người dùng qua ZaloGroup và trả về toàn bộ tài nguyên (Tools/Skills) của workspace trong một lần gọi.

**Luồng xử lý:**
1. **Neo4j Auth** — xác thực 2 điều kiện:
   - `ZaloGroup(thread_id) -[:BELONGS_TO]→ Workspace` — Group thuộc workspace nào
   - `ZaloUser(zalo_id) -[:MEMBER_OF]→ ZaloGroup` — User có là thành viên của group đó không
2. **Priority Logic (Specific Mode)**:
   - Nếu `tool_ids` hoặc `skill_ids` được cung cấp, API sẽ **chỉ** trả về các tài nguyên cụ thể đó và bỏ qua `pending_task` cùng các tài nguyên khác.
3. **Pending Task** — kiểm tra task đang chờ `AWAITING_INPUT` cho thread này (chỉ khi không ở Specific Mode).
4. **Resources & Filtering**:
   - Nếu không có IDs cụ thể, API trả về tài nguyên dựa trên `resource_type`.
   - Hỗ trợ lọc `tool_group` cho Tools và `category` cho Skills.

> **Lưu ý:** `zalo_user_id` là Zalo string ID (ví dụ `"123456789"`), được map qua `ZaloUser.zalo_id` trong Neo4j.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `zalo_user_id` | string | ✅ | Zalo UID của người dùng |
| `thread_id` | string | ✅ | Thread ID của nhóm Zalo |
| `resource_type` | string | ❌ | Loại tài nguyên: `all` (mặc định), `tools`, `skills`, `pending_task`, `none`. |
| `tool_group` | string | ❌ | Key của Tool Group cần lọc. |
| `category` | string | ❌ | Tên danh mục Skill cần lọc (dựa trên quan hệ Neo4j). |
| `tool_ids` | UUID[] | ❌ | Danh sách ID Tool cụ thể cần lấy (Kích hoạt Specific Mode). |
| `skill_ids` | UUID[] | ❌ | Danh sách ID Skill cụ thể cần lấy (Kích hoạt Specific Mode). |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "workspace_id": "uuid",
    "role": "ADMIN | MEMBER",
    "user": { "id": "uuid", "full_name": "Nguyen Van A", "gender": "male" } | null,
    "pending_task": { "id": "uuid", "intent": "...", "full_plan": {}, "missing_parameters": {}, "status": "AWAITING_INPUT" } | null,
    "tool_groups": [
      {
        "id": "uuid",
        "key": "string",
        "name": "string",
        "description": "string",
        "status": "active",
        "context-data": "- **inova_id**: 19\n- **owner_user_id**: 19",
        "tools": "### 1. Tool: Get Expiring Services (Key: `get_expiring_services`)\n- **UUID**: 550e8400-e29b-411d-a716-446655440000\n- **Description**: Lấy danh sách dịch vụ sắp hết hạn\n- **Parameters Schema**:\n```json\n{\n  \"type\": \"object\",\n  \"properties\": { ... }\n}\n```"
      }
    ],
    "skills": [
      { 
        "id": "uuid", 
        "name": "string", 
        "description": "string", 
        "detail": "markdown string", 
        "is_shared": true, 
        "status": "active" 
      }
    ]
  }
}
```

**Lỗi:**
- `400` — Thiếu `zalo_user_id` hoặc `thread_id`
- `403` — User không phải thành viên của ZaloGroup, hoặc ZaloGroup không thuộc workspace nào
- `500` — Lỗi server / Neo4j / PostgreSQL

---

### `POST /api/agent/get-skill`

Lấy thông tin chi tiết của một Skill và danh sách các Tool liên quan (dưới dạng Markdown) cho Agent.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `skill_id` | UUID | ✅ | ID của Skill cần lấy thông tin |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Tên Skill",
    "description": "Mô tả ngắn",
    "detail": "# Hướng dẫn Markdown",
    "category": "Kế toán",
    "tools": "### 1. Tool: Name (Key: `key`)\n- **UUID**: ...\n- **Description**: ...\n...",
    "is_shared": true,
    "status": "active",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

---

### `GET /api/agent/check-membership`

Kiểm tra nhanh xem một Zalo User có là thành viên của một Zalo Group hay không, dựa trên quan hệ Neo4j `ZaloUser -[:MEMBER_OF]→ ZaloGroup`. Đồng thời trả về thông tin Workspace mà Group thuộc về.

> **Usecase:** Dùng để xác nhận quyền trước khi thực thi hành động, hoặc kiểm tra membership đơn giản mà không cần lấy toàn bộ tools/skills như `auth-and-resources`.

**Query Parameters:**
| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `zalo_id` | string | ✅ | Zalo UID của người dùng (map với `ZaloUser.zalo_id` trong Neo4j) |
| `thread_id` | string | ✅ | Thread ID của nhóm Zalo (map với `ZaloGroup.thread_id` trong Neo4j) |

**Ví dụ:**
```
GET /api/agent/check-membership?zalo_id=123456789&thread_id=g-abc123
```

**Response (200) — Là thành viên:**
```json
{
  "success": true,
  "data": {
    "zalo_id": "123456789",
    "thread_id": "g-abc123",
    "is_member": true,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "MEMBER",
    "group_uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "group_name": "Nhóm Kinh Doanh",
    "workspace_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "workspace_name": "Administrator"
  }
}
```

**Response (200) — Không là thành viên (nhưng group & user đều tồn tại):**
```json
{
  "success": true,
  "data": {
    "zalo_id": "123456789",
    "thread_id": "g-abc123",
    "is_member": false,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": null,
    "group_uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "group_name": "Nhóm Kinh Doanh",
    "workspace_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "workspace_name": "Administrator"
  }
}
```

**Response (200) — Group không tồn tại trong hệ thống:**
```json
{
  "success": true,
  "data": {
    "zalo_id": "123456789",
    "thread_id": "g-abc123",
    "is_member": false,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": null,
    "group_uuid": null,
    "group_name": null,
    "workspace_uuid": null,
    "workspace_name": null
  }
}
```

**Response (200) — User chưa được thêm vào hệ thống:**
```json
{
  "success": true,
  "data": {
    "zalo_id": "123456789",
    "thread_id": "g-abc123",
    "is_member": false,
    "user_id": null,
    "role": null,
    "group_uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "group_name": "Nhóm Kinh Doanh",
    "workspace_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "workspace_name": "Administrator"
  }
}
```

> **Lưu ý:** API luôn trả về `200`. `is_member` được xác định dựa trên việc có tồn tại relationship `MEMBER_OF` trong Neo4j hay không. Các field `user_id`, `group_uuid`, `group_name`, `workspace_uuid`, `workspace_name` được lookup độc lập — trả về giá trị nếu tồn tại, `null` nếu không. `workspace_uuid`/`workspace_name` chỉ có giá trị khi group đã được link với workspace qua quan hệ `BELONGS_TO`.

**Lỗi:**
- `400` — Thiếu `zalo_id` hoặc `thread_id`
- `500` — Lỗi server / Neo4j

---

### `POST /api/agent/check-membership`

Tương tự GET nhưng nhận params qua request body (tiện hơn khi gọi từ n8n với HTTP Request node).

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `zalo_id` | string | ✅ | Zalo UID của người dùng |
| `thread_id` | string | ✅ | Thread ID của nhóm Zalo |

**Ví dụ request:**
```json
{
  "zalo_id": "123456789",
  "thread_id": "g-abc123"
}
```

**Response:** Giống hệt GET response ở trên.

---

### `POST /api/agent/tool-groups/data`

Lấy các Data nodes liên kết với cả một Tool Group và một Workspace. API này thay thế logic `context-data` trước đây trong `auth-and-resources`.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tool_group_id` | string | ✅ | ID hoặc Key của Tool Group |
| `workspace_id` | string | ✅ | ID của Workspace |

**Ví dụ request:**
```json
{
  "tool_group_id": "inventory_group",
  "workspace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "key1": "value1",
      "key2": "value2"
    }
  ]
}
```

---

### `GET / POST /api/agent/pending-task/search`

Tìm kiếm thông tin của một Pending Task cụ thể dựa trên `user_id`, `thread_id` và `status`. Luôn trả về 1 kết quả mới nhất (dựa trên `updated_at`). Có thể gọi bằng cả GET (qua query params) và POST (qua body).

**Parameters / Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `user_id` | UUID | ✅ | UUID của user trong hệ thống (Tách biệt với zalo_id) |
| `thread_id` | string | ✅ | Zalo thread ID  |
| `status` | string | ✅ | Trạng thái cần tìm (AWAITING_INPUT, READY_TO_RESUME, COMPLETED) |

**Ví dụ GET:**
```
GET /api/agent/pending-task/search?user_id=123e4567-e89b-12d3...&thread_id=g-1234&status=AWAITING_INPUT
```

**Response (200 - Có kết quả):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workspace_id": "uuid",
    "thread_id": "g-1234",
    "user_id": "123e4567-e89b-12d3...",
    "intent": "...",
    "full_plan": {},
    "missing_parameters": {},
    "status": "AWAITING_INPUT",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

**Response (200 - Không tìm thấy task):**
```json
{
  "success": true,
  "data": null
}
```

---

## 11. Admin — Pending Tasks

Quản lý các Pending Tasks của hệ thống (các tác vụ đang chờ AWAITING_INPUT từ user hoặc READY_TO_RESUME).

### `GET /api/admin/pending-tasks`

Lấy danh sách pending tasks. Hỗ trợ phân trang và lọc theo trạng thái.

**Query Parameters:**
| Tham số | Kiểu | Mô tả |
|---|---|---|
| `status` | string | `AWAITING_INPUT`, `READY_TO_RESUME`, hoặc `COMPLETED` |
| `limit` | number | Mặc định 100 |
| `offset` | number | Mặc định 0 |

**Response (200):**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "workspace_id": "uuid", "thread_id": "string", "user_id": "uuid", "intent": "string", "full_plan": {}, "missing_parameters": {}, "status": "AWAITING_INPUT", "created_at": "ISO8601", "updated_at": "ISO8601" }],
  "pagination": { "limit": 100, "offset": 0, "total": 5, "hasMore": false }
}
```

---

### `POST /api/admin/pending-tasks`

Tạo thủ công một pending task. Tự động ghi nhận `PENDING_TASK_CREATED` vào log.

**Request Body:**
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `workspace_id` | UUID | ✅ | ID của workspace |
| `thread_id` | string | ✅ | Zalo thread ID  |
| `user_id` | UUID | ✅ | ID người dùng |
| `intent` | string | ❌ | Ý định gốc của tác vụ |
| `full_plan` | object | ❌ | JSON cấu trúc task plan |
| `missing_parameters` | object | ❌ | JSON danh sách params còn thiếu |
| `status` | string | ❌ | Trạng thái (mặc định: `AWAITING_INPUT`) |

**Response (201):**
```json
{ "success": true, "data": { ...pendingTask } }
```

---

### `GET /api/admin/pending-tasks/[id]`

Lấy chi tiết pending task theo ID.

**Path Params:** `id` — UUID của pending task.

**Response (200 / 404):**
```json
{ "success": true, "data": { ...pendingTask } }
```

---

### `PUT /api/admin/pending-tasks/[id]`

Cập nhật pending task (trạng thái, dữ liệu JSON `full_plan`, `missing_parameters`). Ghi nhận `PENDING_TASK_UPDATED` log.

**Path Params:** `id` — UUID của pending task.  
**Request Body (ít nhất 1 field):**
| Field | Kiểu | Mô tả |
|---|---|---|
| `status` | string | `AWAITING_INPUT` / `READY_TO_RESUME` / `COMPLETED` |
| `intent` | string | Cập nhật intent |
| `full_plan` | object | Thay đổi cấu trúc JSON kế hoạch |
| `missing_parameters` | object | Cập nhật tham số thiếu |

**Response (200):**
```json
{ "success": true, "data": { ...pendingTask } }
```

---

### `DELETE /api/admin/pending-tasks/[id]`

Xóa bỏ hoàn toàn pending task khỏi hệ thống vĩnh viễn và tạo hành động `PENDING_TASK_DELETED` trong audit log.

**Path Params:** `id` — UUID của pending task.

**Response (200 / 404):**
```json
{ "success": true, "message": "Pending task deleted successfully" }
```

