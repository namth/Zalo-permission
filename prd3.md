# PHÂN TÍCH NGHIỆP VỤ
## HỆ THỐNG QUẢN LÝ WORKSPACE & PHÂN QUYỀN AI AGENT

---

## 1. Mục tiêu hệ thống

Xây dựng một **hệ thống phân quyền trung tâm (Workspace-based)** để:
- Quản lý **AI Agent** hoạt động trong các **Zalo Group**
- Tránh lặp dữ liệu Zalo User / Group ở nhiều hệ thống nghiệp vụ
- Cho phép **Admin thao tác trực tiếp qua trang quản trị**
- Cho phép **AI Agent (qua API)** thực hiện một số hành động có kiểm soát

Hệ thống đóng vai trò là **Permission & Context Service**, không phải hệ thống nghiệp vụ chính.

---

## 2. Các vai trò (Roles)

### 2.1 Admin
- Quản trị toàn bộ Workspace
- Có quyền chỉnh sửa cấu trúc, user, group, agent

### 2.2 Member
- Là user bình thường trong workspace
- Không được thay đổi phân quyền

### 2.3 AI Agent
- Không phải user
- Chỉ gọi API để **thực thi nghiệp vụ được phép**
- Không được phép tự ý thay đổi cấu trúc nếu không có quyền admin

---

## 3. Phạm vi tính năng – Trang Admin

### 3.1 Quản lý Workspace

**Mục tiêu**: Quản lý các đơn vị phân quyền trung tâm

**Chức năng**:
- Xem danh sách workspace
- Thêm mới workspace
- Cập nhật thông tin workspace (name, status)
- Xóa workspace

**Quy tắc nghiệp vụ**:
- Chỉ Admin hệ thống mới được tạo / xóa workspace
- Khi xóa workspace:
  - Không xóa dữ liệu nghiệp vụ ở các hệ thống khác
  - Chỉ xóa relationship & permission

---

### 3.2 Quản lý Zalo Group trong Workspace

**Mục tiêu**: Gắn Zalo Group vào đúng workspace để phân quyền

**Chức năng**:
- Xem danh sách Zalo Group thuộc workspace
- Thêm Zalo Group mới vào workspace
- Xóa Zalo Group khỏi workspace

**Quy tắc nghiệp vụ**:
- Một Zalo Group chỉ thuộc **1 workspace**
- Xóa Zalo Group:
  - Chỉ xóa relationship `ZaloGroup -> Workspace`
  - Không xóa user hoặc group vật lý trên Zalo

---

### 3.3 Quản lý User trong Zalo Group

**Mục tiêu**: Quản lý thành viên và vai trò

**Chức năng**:
- Xem danh sách user trong từng Zalo Group
- Xóa user khỏi Zalo Group
- Cập nhật role của user trong workspace
- Cập nhật thông tin user (tên, email, số điện thoại)

**Quy tắc nghiệp vụ**:
- User có thể thuộc nhiều Zalo Group
- Role được gán **theo Workspace**, không theo Group
- Khi xóa user khỏi group:
  - Không xóa user khỏi workspace nếu user còn group khác

---

### 3.4 Quản lý User trong Workspace

**Mục tiêu**: Quản lý danh bạ người dùng ở cấp workspace

**Chức năng**:
- Xem danh sách user thuộc workspace
- Xóa user khỏi workspace

**Quy tắc nghiệp vụ**:
- Khi xóa user khỏi workspace:
  - Xóa toàn bộ relationship user ↔ group trong workspace đó
  - Không xóa user khỏi hệ thống toàn cục

---

### 3.5 Quản lý Agent

**Mục tiêu**: Quản lý danh sách AI Agent có thể sử dụng

**Chức năng**:
- Xem danh sách agent
- Thêm agent mới
- Cập nhật agent
- Xóa agent

**Quy tắc nghiệp vụ**:
- Agent là global
- Không gắn trực tiếp agent với workspace ở tầng admin

---

## 4. Phạm vi tính năng – AI Agent gọi API

### 4.1 Nguyên tắc chung

- AI Agent **không có toàn quyền**
- Mọi API gọi từ AI đều phải:
  - Xác định được `ZaloGroup`
  - Resolve ra `Workspace`
  - Check quyền admin nếu có thay đổi phân quyền

---

### 4.2 Tạo mới Workspace

**Mô tả**:
- AI Agent có thể tạo workspace khi được chỉ định

**Điều kiện**:
- Chỉ cho phép nếu:
  - AI Agent đang hoạt động trong group có role ADMIN

---

### 4.3 Thêm Zalo Group vào Workspace

**Mô tả**:
- Gắn group hiện tại vào workspace

**Điều kiện**:
- Group chưa thuộc workspace nào
- Người ra lệnh có role ADMIN

---

### 4.4 Thêm User vào Zalo Group / Workspace

**Mô tả**:
- Khi phát hiện user mới trong group:
  - Thêm user vào group
  - Nếu user chưa thuộc workspace → thêm vào workspace

**Quy tắc**:
- User được định danh bằng `zalo_id`
- Không tạo trùng user

---

### 4.5 Thay đổi Role

**Mô tả**:
- AI Agent cập nhật role user theo lệnh

**Điều kiện**:
- Người ra lệnh phải có role ADMIN

---

## 5. Các nguyên tắc nghiệp vụ quan trọng

- Workspace là **đơn vị phân quyền trung tâm**
- Role gắn với **User – Workspace**, không gắn với Group
- Zalo Group chỉ là **entry point giao tiếp**
- AI Agent **không giữ state**, chỉ gọi API

---

## 6. Các rủi ro & kiểm soát

### 6.1 Rủi ro
- AI tự ý thay đổi quyền
- Lệnh không rõ chủ thể admin

### 6.2 Kiểm soát
- Mọi API mutation phải check:
  - user
  - role
  - workspace

---

## 7. Kết luận

Thiết kế nghiệp vụ này đảm bảo:
- Phân quyền rõ ràng
- Mở rộng nhiều hệ thống nghiệp vụ
- AI Agent đóng vai trò **thực thi có kiểm soát**, không phải admin tuyệt đối

👉 Tài liệu này là nền tảng để:
- Thiết kế API
- Viết middleware permission
- Training AI Agent hiểu đúng giới hạn

