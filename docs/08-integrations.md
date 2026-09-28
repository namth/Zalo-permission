# 08. Hướng dẫn Tích hợp Bên thứ ba (Third-Party Integrations)

## 1. Tích hợp AI LLM Gateway (OpenRouter API)

Hệ thống sử dụng **OpenRouter** làm cổng tập trung điều phối các Model AI hàng đầu mà chỉ cần quản lý một API Key duy nhất.

### 1.1. Cấu hình Kỹ thuật
* **Base URL:** `https://openrouter.ai/api/v1`
* **SDK:** `openai` Node.js SDK (chỉ cần đổi `baseURL` và `apiKey`).
* **Header bắt buộc:**
  * `HTTP-Referer`: URL hệ thống (`http://localhost:3000` hoặc domain production).
  * `X-Title`: `OmniAgent Gateway`.

### 1.2. Chiến lược Phân chia Model:
* **Router Agent (Intent Classification & Routing):**
  * Model ID: `google/gemini-2.0-flash`
  * Nhiệm vụ: Phân loại ý định, trích xuất thực thể, tra cứu Skill trong Neo4j.
  * Tốc độ: ~200ms - 400ms, token cost siêu rẻ ($0.10/M tokens).
* **Worker Agent (Reasoning, Plan & Tool Execution):**
  * Model ID: `anthropic/claude-3.5-sonnet` (hoặc `openai/gpt-4o`)
  * Nhiệm vụ: Suy nghĩ logic nghiệp vụ phức tạp, gọi function calling / tool calling theo JSON Schema, tự sửa lỗi khi API trả về mã lỗi.

---

## 2. Tích hợp Kênh Telegram (Telegram Bot API via `grammY`)

### 2.1. Framework Lựa chọn
* Sử dụng thư viện `grammY` – thư viện TypeScript hiện đại nhất cho Telegram Bot, nhẹ, hỗ trợ typing đầy đủ và kiến trúc Middleware linh hoạt.

### 2.2. Cơ chế Hoạt động
* **Polling Mode (Development & Local testing):**
  * Lắng nghe trực tiếp sự kiện tin nhắn thông qua `bot.start()`.
* **Webhook Mode (Production):**
  * Đăng ký endpoint: `POST /api/channels/telegram/webhook/{accountId}`.
  * Xác thực thông qua secret token trong header `X-Telegram-Bot-Api-Secret-Token`.
* **Quy tắc Tiếp nhận:**
  * Trong nhóm chat: Chỉ kích hoạt khi bot được `@mention` hoặc người dùng Reply một tin nhắn trước đó của bot.
  * Trong tin nhắn trực tiếp (Direct Message): Tự động tiếp nhận mọi tin nhắn.

---

## 3. Tích hợp Kênh Zalo (Zalo Personal via `zca-js` & Zalo OA)

### 3.1. Zalo Cá nhân (Zalo Personal Account qua `zca-js`)
* **Thư viện tham khảo:** `zca-js` (Zalo Chat Automation in JavaScript).
* **Cơ chế xác thực QR Code:**
  1. Backend khởi tạo phiên đăng nhập Zalo Web headless.
  2. Bắt sự kiện mã QR $\rightarrow$ Trả chuỗi Base64 Data URL về giao diện Admin.
  3. Quản trị viên dùng app Zalo trên điện thoại quét mã và xác nhận đăng nhập.
  4. Backend lưu cookie session (`imei`, `cookie`, `secret_key`) mã hóa AES-256 vào PostgreSQL `channel_accounts`.
  5. Tiếp tục lắng nghe tin nhắn qua WebSocket/Long-polling của Zalo Web.

### 3.2. Zalo Official Account (Zalo OA - Chính sách Doanh nghiệp)
* **Cơ chế:**
  1. Đăng ký Webhook trên Zalo Developer Console trỏ về URL: `POST /api/channels/zalo/webhook`.
  2. Xác thực chữ ký `mac` gửi kèm trong header sử dụng `OA_SECRET_KEY`.
  3. Làm mới Access Token định kỳ 25 giờ sử dụng Refresh Token.

---

## 4. Tích hợp Đồ thị Tri thức Neo4j

### 4.1. Driver & Kết nối
* Thư viện: `neo4j-driver` (v5+).
* Giao thức: `neo4j://` (hoặc `neo4j+s://` trên Neo4j Aura Cloud).
* Session Pooling: Quản lý session tự động đóng (`session.close()`) sau mỗi truy vấn hoặc dùng Managed Transactions (`session.executeRead()`, `session.executeWrite()`).

### 4.2. Cơ chế Đồng bộ Hai chiều (Dual-write Sync)
* Khi tạo mới hoặc cập nhật Workspace / Chat / Tool / Skill trên Web Dashboard:
  * Bước 1: Ghi dữ liệu chi tiết vào **PostgreSQL** thông qua Prisma Transaction.
  * Bước 2: Bắn lệnh Cypher đồng bộ tương ứng sang **Neo4j** để duy trì tính nhất quán của mạng lưới đồ thị phân quyền.

---

## 5. Tích hợp Hàng đợi & Xử lý Bất đồng bộ (Redis Streams via `ioredis`)

### 5.1. Cấu trúc Stream & Consumer Group
* Khởi tạo Consumer Group an toàn:
  ```bash
  XGROUP CREATE stream:inbound_messages agent_workers $ MKSTREAM
  XGROUP CREATE stream:outbound_messages channel_dispatchers $ MKSTREAM
  ```
* Cơ chế đọc theo đợt (Batch Reading) với `XREADGROUP`:
  ```typescript
  const messages = await redis.xreadgroup(
    'GROUP', 'agent_workers', 'worker_instance_1',
    'COUNT', 5,
    'BLOCK', 2000,
    'STREAMS', 'stream:inbound_messages', '>'
  );
  ```
* Cơ chế xác nhận hoàn tất: Gọi `XACK stream:inbound_messages agent_workers <message_id>` sau khi đã xử lý xong.
