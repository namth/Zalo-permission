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

### 2.4. Bóc tách & Khảo sát Cấu hình MCP (Inspect MCP Config)
* **Endpoint:** `POST /api/mcp/inspect`
* **Request Payload:**
```json
{
  "raw_config": {
    "mcpServers": {
      "simplefinance": {
        "command": "npx",
        "args": ["-y", "mcp-proxy", "https://financemcp.oa.io.vn/mcp.php"]
      }
    }
  },
  "default_auth_token": "Bearer my_secret_token"
}
```
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "data": {
    "server_name": "simplefinance",
    "target_url": "https://financemcp.oa.io.vn/mcp.php",
    "transport": "SSE",
    "tools": [
      {
        "name": "get_account_balance",
        "description": "Lấy số dư tài khoản theo mã tiền tệ",
        "parameters_schema": {
          "type": "object",
          "properties": {
            "currency": { "type": "string" }
          },
          "required": ["currency"]
        }
      }
    ]
  }
}
```

### 2.5. Nhập Cấu hình MCP vào Kho Master (Import MCP ToolGroup)
* **Endpoint:** `POST /api/mcp/import`
* **Request Payload:**
```json
{
  "key": "simplefinance",
  "name": "SimpleFinance MCP Server",
  "description": "Hệ thống quản lý tài chính doanh nghiệp",
  "target_url": "https://financemcp.oa.io.vn/mcp.php",
  "transport": "SSE",
  "timeout_seconds": 15,
  "default_auth_token": "Bearer my_secret_token",
  "raw_config": { "mcpServers": { ... } },
  "selected_tools": [
    {
      "key": "simplefinance_get_account_balance",
      "name": "Lấy số dư tài khoản",
      "description": "Lấy số dư tài khoản theo mã tiền tệ",
      "parameters_schema": { ... }
    }
  ]
}
```
* **Response Status:** `201 Created`

### 2.6. Đồng bộ lại Tool từ MCP Server (On-Demand Sync)
* **Endpoint:** `POST /api/tool-groups/{id}/mcp/sync`
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "message": "MCP tools synced successfully",
  "data": {
    "total_tools": 5,
    "added_tools": 1,
    "updated_tools": 4
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

---

## 5. Phân hệ Admin AI Copilot (Copilot APIs)

### 5.1. Trò chuyện & Phân tích Ý định (Chat & Intent Resolution)
* **Endpoint:** `POST /api/admin/copilot/chat`
* **Quyền hạn:** `ADMIN`, `SUPER_ADMIN`
* **Request Payload:**
```json
{
  "message": "Gán toàn bộ tool nhóm simplefinance vào workspace e8b5...",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "reply": "Tôi đã chuẩn bị thao tác gán nhóm công cụ vào workspace. Vui lòng xác nhận bên dưới.",
  "action_preview": {
    "action_id": "act_8f7b2c",
    "action_type": "ASSIGN_TOOL_GROUP_TO_WORKSPACE",
    "summary": "Gán ToolGroup 'simplefinance' (20 tools) vào Workspace 'Bán Hàng'",
    "parameters": {
      "workspace_id": "e8b5...",
      "tool_group_key": "simplefinance"
    }
  }
}
```

### 5.2. Xác nhận Thực thi Hành động (Execute Action Confirmation)
* **Endpoint:** `POST /api/admin/copilot/execute`
* **Quyền hạn:** `ADMIN`, `SUPER_ADMIN`
* **Request Payload:**
```json
{
  "action_id": "act_8f7b2c",
  "action_type": "ASSIGN_TOOL_GROUP_TO_WORKSPACE",
  "parameters": {
    "workspace_id": "e8b5...",
    "tool_group_key": "simplefinance"
  }
}
```
* **Response Status:** `200 OK`
* **Response Payload:**
```json
{
  "success": true,
  "message": "Đã gán thành công 20 công cụ của nhóm 'simplefinance' vào Workspace 'Bán Hàng'.",
  "result_data": {
    "affected_tools": 20,
    "workspace_id": "e8b5..."
  }
}
```

---

## 6. Phân hệ Inbound Webhooks & Async Callback (`FEAT-WORKSPACE-WEBHOOKS`)

### 6.1. Nhận Tin nhắn Inbound từ Client Bên Ngoài (Mobile App / Web)
* **Endpoint:** `POST /api/v1/workspaces/{workspace_id}/webhooks/{webhook_id}`
* **Xác thực:** Header `Authorization: Bearer <secret_token>` hoặc `X-Webhook-Secret: <secret_token>`
* **Request Payload (HTTP Callback):**
```json
{
  "prompt": "Kiểm tra tồn kho sản phẩm ABC",
  "sender_id": "user_mobile_0901234567",
  "session_id": "sess_order_check_01",
  "callback": {
    "type": "HTTP_POST",
    "url": "https://api.my-app.com/v1/agent/callback"
  }
}
```
* **Request Payload (Firebase FCM Push):**
```json
{
  "prompt": "Kiểm tra đơn hàng DH-9981",
  "sender_id": "user_mobile_0901234567",
  "callback": {
    "type": "FIREBASE_FCM",
    "fcm_token": "eK3lZ...fcm_registration_token_here..."
  }
}
```
* **Response Status:** `202 Accepted`
* **Response Payload:**
```json
{
  "success": true,
  "message": "Message accepted and queued for agent processing",
  "data": {
    "job_id": "job_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "session_id": "sess_order_check_01",
    "status": "QUEUED",
    "received_at": "2026-10-01T12:00:00Z"
  }
}
```

### 6.2. Cấu trúc JSON Outbound Callback Gửi về Client
* **Phương thức:** HTTP `POST` đến `callback.url` (hoặc FCM Data Payload).
* **Payload:**
```json
{
  "event": "agent.response",
  "job_id": "job_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "session_id": "sess_order_check_01",
  "sender_id": "user_mobile_0901234567",
  "user_prompt": "Kiểm tra tồn kho sản phẩm ABC",
  "response": "Sản phẩm ABC hiện còn 15 chiếc trong kho chi nhánh Hà Nội.",
  "status": "SUCCESS",
  "error": null,
  "metadata": {
    "workspace_id": "ws_hanoi_uuid",
    "webhook_id": "wh_mobile_uuid",
    "audit_log_id": "audit_log_uuid",
    "execution_time_ms": 1420,
    "completed_at": "2026-10-01T12:00:01.420Z"
  }
}
```

### 6.3. Quản lý Webhooks của Workspace (Dashboard APIs)
* **Lấy danh sách:** `GET /api/workspaces/{id}/webhooks`
* **Tạo mới Webhook:** `POST /api/workspaces/{id}/webhooks` (Body: `{ "name": "...", "description": "..." }`)
* **Làm mới Secret:** `POST /api/workspaces/{id}/webhooks/{webhook_id}/regenerate-secret`
* **Bật/Tắt:** `PATCH /api/workspaces/{id}/webhooks/{webhook_id}` (Body: `{ "is_active": boolean }`)
* **Xóa:** `DELETE /api/workspaces/{id}/webhooks/{webhook_id}`

### 6.4. Cấu hình Firebase FCM của Workspace (Dashboard APIs)
* **Lấy cấu hình hiện tại:** `GET /api/workspaces/{id}/firebase-config`
* **Cập nhật cấu hình:** `PUT /api/workspaces/{id}/firebase-config` (Body: `{ "project_id": "...", "client_email": "...", "service_account_json": "..." }`)
* **Kiểm tra kết nối Firebase:** `POST /api/workspaces/{id}/firebase-config/test`


