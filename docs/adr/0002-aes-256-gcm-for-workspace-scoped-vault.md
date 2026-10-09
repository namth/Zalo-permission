# ADR 0002: Kiến trúc Scoped Vault Mã hóa AES-256-GCM Lưu trữ Biến Riêng Biệt

* **Trạng thái:** Chấp thuận (Accepted)
* **Ngày quyết định:** 2026-09-29
* **Người quyết định:** Principal System Architect & PO

---

## 1. Bối cảnh (Context)
Trong mô hình Multi-tenant của OmniAgent, các chi nhánh/Workspace khác nhau (ví dụ: Chi nhánh Hà Nội, Chi nhánh TP.HCM) cùng sử dụng chung một ToolGroup (ví dụ: ERP Quản lý Kho, CRM Bán hàng), nhưng mỗi chi nhánh bắt buộc phải dùng **API Key, Tenant ID, hoặc Branch Code riêng biệt**.

Yêu cầu an toàn thông tin:
1. Tuyệt đối không để lộ API Key của chi nhánh này cho chi nhánh khác.
2. Không lưu trữ bản rõ (Plaintext) của các khóa bí mật trong CSDL PostgreSQL.
3. Không để lộ khóa bí mật trong chuỗi JSON log của hệ thống (`audit_logs`).
4. Khi AI Agent gọi Tool, các biến placeholder `{{API_KEY}}` phải được thay thế chính xác và an toàn ngay trước khi HTTP request rời máy chủ.

---

## 2. Quyết định (Decision)
Chúng tôi quyết định thiết lập mô hình **Scoped Vault nội bộ sử dụng thuật toán mã hóa đối xứng AES-256-GCM**:
* Bảng CSDL `workspace_tool_configs` lưu cấu hình dưới dạng chuỗi định dạng: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
* Khóa bí mật máy chủ `ENCRYPTION_KEY` 256-bit được nạp độc quyền từ biến môi trường của tiến trình runtime.
* Sử dụng chế độ **GCM (Galois/Counter Mode)** để đảm bảo tính bí mật và xác thực toàn vẹn dữ liệu (chống giả mạo bản mã).
* Xây dựng module `variable-injector.ts` giải mã trong RAM khi cần thực thi, thay thế đệ quy trong chuỗi và JSON object, sau đó giải phóng bộ nhớ ngay lập tức.
* Mọi payload ghi vào `audit_logs` tự động được mask bằng chuỗi `***MASKED***`.

---

## 3. Các Phương án Đã Cân nhắc & Lý do Loại bỏ
1. **Sử dụng Dịch vụ Vault Chuyên dụng (HashiCorp Vault / AWS Secrets Manager):**
   * *Ưu điểm:* Tiêu chuẩn bảo mật cấp doanh nghiệp cao nhất.
   * *Nhược điểm:* Quá nặng nề và phức tạp cho giai đoạn hiện tại. Làm tăng độ trễ mạng mỗi khi Agent gọi Tool và đòi hỏi chi phí vận hành cụm Vault riêng.
2. **Lưu bản rõ (Plaintext) trong bảng PostgreSQL nhưng phân quyền theo Row-Level Security (RLS):**
   * *Ưu điểm:* Dễ truy vấn và debug.
   * *Nhược điểm:* Vi phạm nghiêm trọng tiêu chuẩn bảo mật. Nếu CSDL bị dump hoặc lộ quyền truy cập DB, toàn bộ API Key của các đối tác/khách hàng sẽ bị lộ 100%.

---

## 4. Hệ quả & Đánh đổi (Consequences & Trade-offs)
* **Tích cực:**
  * Bảo mật cực cao: Ngay cả khi bị rò rỉ database dump, kẻ tấn công cũng không thể đọc được nội dung cấu hình mà không có `ENCRYPTION_KEY`.
  * Tinh gọn, không phụ thuộc vào hạ tầng bên thứ ba.
* **Đánh đổi:**
  * Không thể tìm kiếm hoặc lọc trực tiếp theo giá trị của biến bí mật trong SQL (do đã bị mã hóa với IV ngẫu nhiên).
  * Việc xoay vòng khóa (Key Rotation) trong tương lai sẽ cần một script giải mã bằng key cũ và mã hóa lại bằng key mới.
