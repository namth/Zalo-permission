# 01. Tổng quan Dự án (Project Overview)

## 1. Tên Dự án & Định vị (Product Identity)
* **Tên dự án:** **OmniAgent Gateway & Workspace Platform** (Mã dự án: `AAWS v2` / `Zalo-permission`).
* **Định vị sản phẩm:** Nền tảng trung tâm quản lý và điều phối Multi-Agent AI đa kênh (Zalo, Telegram), tập trung vào phân quyền không gian làm việc (Multi-tenant Workspace), quản lý tập trung kho Tool Groups / Tools / Skills, và định tuyến thông minh theo từng nhóm chat doanh nghiệp.

---

## 2. Bài toán Cốt lõi & Động lực Tái cấu trúc (Problem Statement)
* **Phân mảnh tài khoản & nhóm chat:** Các doanh nghiệp thường có nhiều tài khoản Zalo, nhiều Bot Telegram phục vụ các phòng ban, dự án khác nhau. Việc định tuyến thủ công hoặc gán cứng tài khoản vào một mục đích duy nhất làm lãng phí tài nguyên và khó quản lý tập trung.
* **Quản lý Tool & API rời rạc:** Trước đây, các công cụ (Tools) bị phân tán, thiếu cấu trúc phân cấp (Group vs Specific API), không có cơ chế tái sử dụng cấu hình (Authentication, Base URL).
* **Bài toán Scoped Data per Workspace:** Các chi nhánh hoặc phòng ban (Workspace) khác nhau cùng dùng chung một hệ thống (ví dụ: ERP, CRM, Haravan, KiotViet), nhưng mỗi nơi sở hữu một `API_KEY` hoặc `TENANT_ID` khác nhau. Hệ thống cần giải quyết bài toán: **Cùng 1 Tool nhưng Data/Credentials tự động thay đổi theo từng Workspace**.
* **Định tuyến AI Agent 2 bước (Router & Worker):** Cần một mô hình AI thông minh:
  1. Router Agent phân loại ý định người dùng từ tin nhắn chat.
  2. Tra cứu Skill chuyên biệt được phân quyền trong đồ thị tri thức (Neo4j).
  3. Nếu không có Skill phù hợp, tự động trích xuất danh mục Tool được cấp quyền, chuyển giao cho Worker Agent tư duy, lập kế hoạch (Think/Plan/Act) và gọi API thực thi.

---

## 3. Mục tiêu Cụ thể của Hệ thống (Core Objectives)
1. **Quản lý Tập trung Kho Tool & Skill:**
   * **Tool Group:** Lưu trữ Base URL, loại xác thực (Bearer, API Key, Basic, OAuth2), mô tả tổng quan và danh sách biến môi trường mẫu.
   * **Tool:** Từng endpoint cụ thể với JSON Schema tham số chặt chẽ, phương thức HTTP và mô tả hành động.
   * **Skill:** Quy trình/SOP nghiệp vụ cấp cao, định nghĩa intent kích hoạt và danh sách Tool phụ thuộc.
2. **Kênh Đầu ra/Đầu vào Đa dạng (Channel Hub):**
   * Quản lý kết nối độc lập cho nhiều tài khoản Telegram (Bot API) và Zalo (Zalo Personal QR / OA).
   * Cơ chế ánh xạ linh hoạt: Một bot/tài khoản có thể phục vụ nhiều Workspace khác nhau thông qua **ID Nhóm Chat (Group / Thread ID)**.
3. **Phân quyền Đồ thị Động (Graph Authorization via Neo4j):**
   * Sử dụng Neo4j để kiểm tra tức thì: Nhóm chat này thuộc Workspace nào? Workspace này có quyền gọi Skill/Tool nào?
   * Hỗ trợ phân quyền linh hoạt 2 tầng (bật/tắt theo Tool Group hoặc chi tiết từng Tool đơn lẻ).
4. **Cách ly Dữ liệu Workspace (Dynamic Variable Injection):**
   * Cho phép từng Workspace ghi đè giá trị biến môi trường `{{API_KEY}}`, `{{BASE_URL}}` của Tool Group mà không cần nhân bản code.
5. **Xử lý Bất đồng bộ & Ổn định cao:**
   * Sử dụng Redis Streams để tiếp nhận tin nhắn webhook/polling từ Zalo/Telegram, tránh rớt tin nhắn khi lượng truy cập tăng vọt.
   * Multi-Agent Orchestration phân tách giữa Router (tốc độ cao) và Worker (tư duy sâu).

---

## 4. Đối tượng Sử dụng (Target Personas)
1. **System Administrator (Admin nội bộ):**
   * Quản lý toàn bộ Web Dashboard.
   * Cấu hình kết nối tài khoản Telegram / Zalo.
   * Định nghĩa kho Tool Groups, Tools, Skills.
   * Khởi tạo Workspaces, gán các nhóm chat và phân quyền Tools/Skills tương ứng.
   * Giám sát hệ thống qua Audit Logs và Agent Tracing.
2. **End-Users (Nhân viên, Thành viên Nhóm Chat):**
   * Không cần đăng nhập Web Dashboard.
   * Tương tác trực tiếp bằng ngôn ngữ tự nhiên thông qua các nhóm chat Zalo hoặc Telegram đã được gán vào Workspace.
   * Nhận phản hồi nhanh chóng, chính xác theo đúng quyền hạn và dữ liệu của nhóm mình.
