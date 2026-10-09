# ADR 0001: Sử dụng Cơ sở Dữ liệu Đồ thị Neo4j cho Phân quyền Đa kênh (Channel Graph RBAC)

* **Trạng thái:** Chấp thuận (Accepted)
* **Ngày quyết định:** 2026-09-28
* **Người quyết định:** Principal System Architect & PO

---

## 1. Bối cảnh (Context)
Nền tảng **OmniAgent Gateway** tiếp nhận tin nhắn từ hàng trăm nhóm chat trên Zalo và Telegram. Hệ thống cần:
1. Xác định ngay lập tức nhóm chat này thuộc về Workspace nào (Tenant Resolution).
2. Kiểm tra xem người dùng trong nhóm chat đó được phép kích hoạt những Skill nào và những Tool nào.
3. Hỗ trợ cơ chế phân quyền 2 tầng: Kế thừa toàn bộ Tool từ ToolGroup nhưng cho phép **phủ quyết (Disable)** một vài Tool con riêng lẻ cho từng Workspace.

Nếu triển khai bằng CSDL quan hệ truyền thống (PostgreSQL RDBMS), việc kiểm tra này đòi hỏi câu truy vấn `JOIN` qua 5–6 bảng trung gian (`channel_chats` $\to$ `workspaces` $\to$ `workspace_tool_groups` $\to$ `tool_groups` $\to$ `tools` $\to$ `workspace_disabled_tools`), dẫn đến độ trễ cao và câu lệnh SQL cực kỳ phức tạp khi hệ thống mở rộng.

---

## 2. Quyết định (Decision)
Chúng tôi quyết định sử dụng **Neo4j Graph Database** song song với PostgreSQL làm công cụ phân quyền và định tuyến thời gian thực:
* Mô hình hóa quyền hạn dưới dạng đường đi đồ thị (Graph Paths):
  $$\text{(ChannelChat)} \to \text{[:BELONGS\_TO]} \to \text{(Workspace)} \to \text{[:CAN\_USE]} \to \text{(ToolGroup/Skill)}$$
* Phủ quyết quyền Tool con bằng cạnh trực tiếp:
  $$\text{(Workspace)} \to \text{[:DISABLED]} \to \text{(Tool)}$$
* Thực thi phân quyền chỉ bằng **1 câu Cypher duy nhất**, tận dụng chỉ mục duy nhất (`unique_workspace_id`, `unique_channel_chat_id`).

---

## 3. Các Phương án Đã Cân nhắc & Lý do Loại bỏ
1. **Chỉ dùng PostgreSQL (Single-DB RDBMS):**
   * *Ưu điểm:* Dễ triển khai, không cần vận hành thêm database thứ 2.
   * *Nhược điểm:* Khi ma trận phân quyền mở rộng (thêm phòng ban, thêm role, gán theo contact), câu truy vấn đệ quy hoặc đa bảng JOIN làm tăng độ trễ truy vấn $> 50\text{ms}$ mỗi tin nhắn chat. Không trực quan khi vẽ đồ thị quyền hạn.
2. **Lưu toàn bộ quyền vào Redis Cache (JSON/Set):**
   * *Ưu điểm:* Tốc độ đọc rất nhanh ($< 2\text{ms}$).
   * *Nhược điểm:* Khó đồng bộ khi quản trị viên thay đổi quyền của một ToolGroup trên Dashboard (phải quét và xóa cache của hàng trăm Workspace liên quan - Cache Invalidation Nightmare).

---

## 4. Hệ quả & Đánh đổi (Consequences & Trade-offs)
* **Tích cực:**
  * Tốc độ kiểm tra quyền cực nhanh ($< 5\text{ms}$) ngay khi tin nhắn vừa chạm vào Gateway.
  * Thao tác bật/tắt quyền trên Web Dashboard chỉ là tạo hoặc xóa một cạnh (Relationship) trong đồ thị.
  * Tự nhiên tương thích với các nghiệp vụ kết nối phức tạp sau này (Global Contacts, phân quyền người dùng theo nhóm chat).
* **Đánh đổi (Tiêu cực / Thách thức):**
  * Hệ thống phải duy trì 2 CSDL: PostgreSQL (lưu trữ thực thể, schema JSON, audit) và Neo4j (lưu trữ quan hệ phân quyền).
  * Cần đảm bảo tính nhất quán (Eventual Consistency / Dual-write Sync) giữa Postgres và Neo4j khi thực hiện các tác vụ tạo/xóa Workspace và phân quyền.
