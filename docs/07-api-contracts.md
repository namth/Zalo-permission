# 07. Hợp đồng Dữ liệu API (API Contracts & Endpoints)

Tất cả các API quản trị nội bộ đều tuân theo chuẩn RESTful JSON, được phục vụ bởi Next.js App Router API Routes (`/api/*`).

---

## 1. Phân hệ Kênh Kết nối (Channel Management APIs)

### 1.1. Lấy Danh sách Tài khoản Kênh
* **Endpoint:** `GET /api/channels`
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "data": [
    {
      "id": "c1f7b8e0-4a8f-4d92-93cb-718290abc111",
      "platform": "TELEGRAM",
      "account_name": "@SalesAIBot",
      "status": "ACTIVE",
      "chat_count": 5,
      "last_synced_at": "2026-09-28T08:30:00Z"
    },
    {
      "id": "e2a9c1d0-1234-5678-90ab-abcdef123456",
      "platform": "ZALO",
      "account_name": "CSKH Miền Bắc",
      "status": "ACTIVE",
      "chat_count": 3,
      "last_synced_at": "2026-09-28T08:35:00Z"
    }
  ]
}
```

### 1.2. Kết nối Tài khoản Telegram Mới
* **Endpoint:** `POST /api/channels/telegram/connect`
* **Request Payload:**
```json
{
  "bot_token": "7192837461:AAF-ExampleToken_Here"
}
```
* **Response Status:** `201 Created`
* **Response Payload:**
```json
{
  "success": true,
  "message": "Connected to Telegram Bot successfully",
  "data": {
    "account_id": "c1f7b8e0-4a8f-4d92-93cb-718290abc111",
    "bot_username": "SalesAIBot",
    "first_name": "Sales AI Assistant"
  }
}
```

### 1.3. Khởi tạo Đăng nhập Zalo QR Code
* **Endpoint:** `POST /api/channels/zalo/qr/init`
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "session_id": "zalo_sess_891230",
  "qr_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "expires_in_seconds": 60
}
```

### 1.4. Lấy Danh sách Nhóm Chat của Tài khoản
* **Endpoint:** `GET /api/channels/{accountId}/chats`
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "data": [
    {
      "id": "chat_01",
      "platform_chat_id": "-100293847581",
      "title": "Nhóm Sales Hà Nội",
      "chat_type": "GROUP",
      "workspace_id": "ws_hanoi_uuid",
      "workspace_name": "Chi nhánh Hà Nội"
    },
    {
      "id": "chat_02",
      "platform_chat_id": "-100874635241",
      "title": "Nhóm Kỹ thuật Dev",
      "chat_type": "GROUP",
      "workspace_id": null,
      "workspace_name": null
    }
  ]
}
```

---

## 2. Phân hệ Tool Groups & Tools (Tool Catalog APIs)

### 2.1. Tạo mới Tool Group
* **Endpoint:** `POST /api/tool-groups`
* **Request Payload:**
```json
{
  "key": "kiotviet_inventory",
  "name": "KiotViet Inventory System",
  "description": "Quản lý tồn kho và sản phẩm trên phần mềm KiotViet",
  "base_url": "https://public.kiotapi.com",
  "auth_type": "BEARER",
  "required_variables": ["API_KEY", "RETAILER_NAME"]
}
```
* **Response Status:** `201 Created`

### 2.2. Tạo mới Tool Con thuộc Tool Group
* **Endpoint:** `POST /api/tool-groups/{groupId}/tools`
* **Request Payload:**
```json
{
  "key": "get_product_stock",
  "name": "Tra cứu Tồn kho theo Mã SKU",
  "description": "Lấy thông tin tồn kho thực tế của sản phẩm theo mã hàng",
  "method": "GET",
  "path": "/products/code/{sku}",
  "parameters_schema": {
    "type": "object",
    "properties": {
      "sku": { "type": "string", "description": "Mã sản phẩm (ví dụ: SP001)" }
    },
    "required": ["sku"]
  },
  "body_schema": {}
}
```
* **Response Status:** `201 Created`

### 2.3. Test Chạy Thử Tool (Interactive Tool Runner)
* **Endpoint:** `POST /api/tools/{toolId}/test`
* **Request Payload:**
```json
{
  "workspace_id": "ws_hanoi_uuid", // Nếu truyền, lấy config của workspace này; nếu null, dùng default
  "parameters": {
    "sku": "SP001"
  }
}
```
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "execution_details": {
    "url": "https://public.kiotapi.com/products/code/SP001",
    "method": "GET",
    "headers_sent": {
      "Authorization": "Bearer kv_sec_*********",
      "Retailer": "my_shop_hn"
    },
    "status_code": 200,
    "response_body": {
      "id": 19283,
      "code": "SP001",
      "name": "Áo Thun Polo",
      "on_hand": 24
    },
    "latency_ms": 320
  }
}
```

---

## 3. Phân hệ Workspace & Phân quyền (Workspace APIs)

### 3.1. Tạo mới Workspace
* **Endpoint:** `POST /api/workspaces`
* **Request Payload:**
```json
{
  "name": "Chi nhánh Miền Trung",
  "slug": "chi-nhanh-mien-trung",
  "description": "Phục vụ văn phòng và kho Đà Nẵng"
}
```
* **Response Status:** `201 Created`

### 3.2. Cập nhật Phân quyền & Gán Kênh cho Workspace
* **Endpoint:** `PUT /api/workspaces/{id}/config`
* **Request Payload:**
```json
{
  "assigned_chat_ids": ["chat_01_uuid", "chat_02_uuid"],
  "enabled_skill_ids": ["skill_order_lookup_uuid"],
  "tool_group_configs": [
    {
      "tool_group_id": "tg_kiotviet_uuid",
      "is_enabled": true,
      "env_overrides": {
        "API_KEY": "danang_secret_key_123",
        "RETAILER_NAME": "shop_danang"
      },
      "disabled_tool_ids": ["tool_delete_product_uuid"]
    }
  ]
}
```
* **Response Status:** `200 OK`
* **Xử lý bên dưới Backend:**
  1. Ghi nhận bảng `workspace_tool_configs` trong PostgreSQL (mã hóa AES-256 `env_overrides`).
  2. Cập nhật bảng `channel_chats` (gán `workspace_id`).
  3. Cập nhật đồng bộ vào Neo4j:
     * Tạo quan hệ `(c:ChannelChat)-[:BELONGS_TO]->(w:Workspace)`
     * Tạo quan hệ `(w:Workspace)-[:CAN_USE]->(tg:ToolGroup)`
     * Tạo quan hệ `(w:Workspace)-[:DISABLED]->(t:Tool)` cho các tool trong `disabled_tool_ids`.
     * Tạo quan hệ `(w:Workspace)-[:CAN_USE]->(s:Skill)`.

---

## 4. Phân hệ Tra cứu Lịch sử (Audit Logs API)

### 4.1. Lọc Lịch sử Audit Logs
* **Endpoint:** `GET /api/audit-logs?workspace_id={wsId}&status={status}&page=1&limit=20`
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_01_uuid",
      "platform": "TELEGRAM",
      "sender_id": "user_tele_123",
      "user_prompt": "Kiểm tra tồn kho SP001",
      "detected_intent": "check_stock",
      "status": "SUCCESS",
      "latency_ms": 1420,
      "created_at": "2026-09-28T09:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 148 }
}
```

### 4.2. Xem Chi tiết Trace của một Log
* **Endpoint:** `GET /api/audit-logs/{id}/trace`
* **Response Status:** `200 OK`
* **Response Payload:** Trả về toàn bộ `execution_plan`, `tool_calls` (với URL, Payload, Response), và `final_response`.
