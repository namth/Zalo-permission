## **AI AGENT WORKSPACE SYSTEM (AAWS)**

## **1\. Tổng quan hệ thống (System Overview)**

Hệ thống là một nền tảng quản trị AI Agent đa cấp (Multi-tenant), cho phép quản lý các không gian làm việc (Workspace) tích hợp chặt chẽ với các nhóm Zalo. Điểm đặc biệt là khả năng **phân quyền sâu** và **AI Self-Learning** (AI tự học quy trình mới).

### **Thành phần cốt lõi:**

* **NextJS (Control Plane):** Quản trị Admin, xác thực, quản lý Workspace và phân quyền.  
* **n8n (Execution Engine):** Vận hành bộ ba Agent (Planner, Worker, Observer).  
* **Neo4j (Authorization Layer):** Kiểm tra quyền hạn dựa trên quan hệ giữa User, Workspace, Tool và Skill.  
* **PostgreSQL \+ pgvector (Unified Data):** Lưu trữ toàn bộ thông tin định danh, cấu hình thực thể, audit logs và dữ liệu vector tri thức.

---

## **2\. Kiến trúc dữ liệu (Data Schema)**

### **A. LỚP DỮ LIỆU POSTGRESQL (Cấu trúc & Giao dịch)**

Đây là nơi lưu trữ dữ liệu chuẩn hóa, hồ sơ người dùng và lịch sử hoạt động (Audit Log).

#### **A.1 Quản lý Thực thể & Workspace**

- **user\_profiles:** Lưu hồ sơ chi tiết người dùng (zalo\_id, tên, email...).  
- **workspaces:** Đơn vị quản trị và phân quyền trung tâm.  
- **zalo\_groups:** Liên kết trực tiếp giữa `thread_id` của Zalo với `workspace_id`.

#### **A.2 Quản lý Resource (Tools & Skills)**

- **tools:** Các công cụ API gốc do Admin định nghĩa.  
  * Các trường: `id`, `key`, `name`, `description`, `input_schema (JSONB)`, `embedding (vector(1536))`.  
- **skills:** Các quy trình do User dạy (Immutable \- Không sửa).  
  * Các trường: `id`, `name`, `description`, `logic_config (JSONB)`, `owner_id`, `workspace_id`, `is_shared`, `embedding (vector(1536))`.

#### **A.3 Quản lý Trạng thái: `pending_tasks`**

Lưu trữ trạng thái các nhiệm vụ bị tạm dừng do thiếu dữ liệu đầu vào.

* **Các trường:** `id (UUID)`, `workspace_id`, `thread_id`, `user_id`, `intent`, `full_plan (JSONB)`, `missing_parameters (JSONB)`, `status (AWAITING_INPUT / READY_TO_RESUME / COMPLETED)`, `created_at`.

#### **A.4 Hệ thống Audit Log**

* **audit\_logs:** Ghi lại chi tiết hành vi: `agent_role (Planner/Worker/Observer)`, `action_type`, `input_data`, `output_data`, `status`.

### **B. LỚP DỮ LIỆU NEO4J (Phân quyền & Quan hệ Động)**

Neo4j xử lý các logic truy vấn quyền hạn (Permission Graph) cực nhanh thông qua các mối quan hệ.

#### **B.1 Các Node Types bổ sung**

- `(:User {id, zalo_id})`  
- `(:Workspace {id})`  
- `(:ZaloGroup {thread_id})`  
- `(:Skill {id, is_shared, type: 'user'|'system'})`  
- `(:Tool {key})`

#### **B.2 Các Relationship Types (Cơ chế phân quyền)**

- `(User)-[:PART_OF]->(Workspace)`. 
- `(User)-[:MEMBER_OF]->(ZaloGroup)`.
- `(ZaloGroup)-[:BELONGS_TO]->(Workspace)`.  
- `(Workspace)-[:CAN_USE]->(Tool)`: Quyền truy cập công cụ hệ thống.  
- `(User)-[:OWNER_OF]->(Skill)`: Quyền sở hữu kỹ năng cá nhân.  
- `(Skill)-[:SHARED_TO]->(Workspace)`: Chia sẻ kỹ năng cho toàn bộ thành viên trong không gian làm việc.

## **3\. Quy trình thực thi (Core Workflows)**

### **3.1. Tiếp nhận & Lập kế hoạch (The Planner)**

#### **Bước 1: Khởi tạo & Kiểm tra Trạng thái (Check Persistence)**

* **Input**: Nhận `thread_id`, `user_uid`, và `content` từ Zalo.  
* **Query Pending**: Truy vấn Postgres để tìm các tác vụ đang chờ: `SELECT * FROM pending_tasks WHERE thread_id = $tid AND status = 'AWAITING_INPUT'`.  
* **Verify Context**: Nếu có task cũ, n8n sẽ lấy `full_plan` và `missing_parameters` để chuẩn bị gộp dữ liệu. Nếu không, coi đây là một yêu cầu mới hoàn toàn.

#### **Bước 2: Xác thực Quyền hạn (Authorization via Neo4j)**

* **Verify**: Backend gọi Neo4j để xác định Workspace và quyền hạn của User: `MATCH (u:User {id: $uid})-[:PART_OF]->(w:Workspace)<-[:BELONGS_TO]-(t:ZaloGroup {thread_id: $tid}) RETURN w.id`.  
* **Scope**: Xác định danh sách `Tool_IDs` và `Skill_IDs` mà Workspace này được phép sử dụng thông qua các mối quan hệ `[:CAN_USE]` và `[:AVAILABLE_IN]`.

#### **Bước 3: Thu thập Tài nguyên (Retrieval)**

* **Retrieve**: Lấy mô tả chi tiết (Metadata) của các công cụ và kỹ năng từ Qdrant/Postgres dựa trên danh sách ID đã xác thực ở Bước 2\.  
* **Context Injection**: Nạp thêm 20 câu đối thoại gần nhất từ Memory và thông tin từ `full_plan` (nếu là task cũ) vào Prompt của Planner.

#### **Bước 4: Lập kế hoạch hoặc Cập nhật Kế hoạch (Planning/Refining)**

* **Phân tích (Reasoning)**: Planner Agent so sánh `content` mới với danh sách tài nguyên và trạng thái cũ.  
* **Trường hợp A (Yêu cầu mới)**: Planner tạo ra một `full_plan` gồm các bước (`Task List`).  
* **Trường hợp B (Bổ sung thông tin)**: Planner trích xuất các giá trị từ `content` để điền vào `missing_parameters` của task cũ.

#### **Bước 5: Ra quyết định (Decision Gate)**

Planner kiểm tra tính đầy đủ của thông tin trước khi chuyển giao cho Worker:

* **Nếu ĐỦ dữ liệu**:  
  * Cập nhật `full_plan` với các giá trị thực tế.  
  * Cập nhật `status = 'READY_TO_RESUME'` trong bảng `pending_tasks`.  
  * Chuyển giao cho **Worker Agent**.  
* **Nếu THIẾU dữ liệu (Dù là mới hay cũ)**:  
  * Xác định tất cả các tham số còn thiếu (Ví dụ: Bước 1 thiếu `A`, Bước 3 thiếu `B`).  
  * Lưu/Cập nhật vào `pending_tasks` với `status = 'AWAITING_INPUT'`.  
  * Soạn nội dung phản hồi Zalo: *"Tôi cần thêm các thông tin sau: \[Danh sách thiếu\] để tiếp tục"* và kết thúc workflow tại đây.

---

### **Bảng tóm tắt logic xử lý của Planner**

| Tình huống | Hành động của Planner | Trạng thái `pending_tasks` |
| :---- | :---- | :---- |
| **Yêu cầu mới & Đủ thông tin** | Lập kế hoạch 3 bước và đẩy cho Worker. | `COMPLETED` (sau khi xong) |
| **Yêu cầu mới & Thiếu thông tin** | Lập kế hoạch, liệt kê mọi thông tin thiếu, hỏi User. | `AWAITING_INPUT` (Tạo mới) |
| **Yêu cầu cũ & Đã bổ sung đủ** | Gộp thông tin vào kế hoạch cũ, đẩy cho Worker. | `READY_TO_RESUME` |
| **Yêu cầu cũ & Vẫn thiếu thông tin** | Tiếp tục liệt kê các phần còn lại chưa có, hỏi User. | `AWAITING_INPUT` (Cập nhật) |

### **3.2. Thực thi & Giám sát (Worker & Observer)**

1. **Execution:** Planner gửi System Prompt \+ Task cụ thể cho **Worker**.  
2. **Validation:** Trước mỗi hành động của Worker, hệ thống check lại `Tool_ID` trong danh sách Whitelist của Workspace đó.  
3. **Observation:** **Observer** nhận Output của Worker.  
   * Check 1: Kết quả có đúng format yêu cầu không?  
   * Check 2: Kết quả có thỏa mãn ý định của User không?  
   * Nếu Fail: Gửi phản hồi lại cho Planner để tái lập kế hoạch (Loop).  
   * Nếu Pass: Gửi kết quả về Zalo cho User.

### **3.3. Chức năng học tập (Self-Learning Skill)**

Đây là quy trình khi User muốn tạo Skill mới.

1. **Trình kích hoạt:** User nói: *"Học cách báo cáo doanh số: B1 lấy data từ Excel, B2 vẽ biểu đồ, B3 gửi mail"*.  
2. **Learning Agent:** Chạy một Workflow đặc biệt để phân tích quy trình.  
3. **Validation:** Agent kiểm tra xem các Tool cần thiết (Excel, Chart, Mail) có nằm trong danh sách `Allowed_Tools` của Workspace không.  
4. **Persistence:** \* Tạo Metadata trong Postgres.  
   * Tạo Relationship trong Neo4j (Workspace \-\> CAN\_ACCESS \-\> New\_Skill).  
   * Index mô tả Skill vào Qdrant.

---

## **4\. Đặc tả kỹ thuật n8n Agent (PRD)**

| Agent | Vai trò cụ thể | System Prompt Logic |
| :---- | :---- | :---- |
| **Planner** | Kiến trúc sư | "Dựa trên danh sách Tool \[A, B, C\] được cấp, hãy tạo chuỗi JSON các bước thực hiện cho yêu cầu \[User\_Msg\]." |
| **Worker** | Công nhân | "Bạn chỉ có quyền dùng Tool \[X\] với tham số \[Y\]. Trả về kết quả dưới dạng Markdown/JSON." |
| **Observer** | Quản đốc | "So sánh kết quả của Worker với yêu cầu ban đầu. Nếu sai, hãy nêu lý do kỹ thuật. Nếu đúng, trả về lệnh FINISH." |

## **5\. Các lưu ý về an toàn (Security Notes)**

1. **Isolation:** Mỗi Workspace chỉ được truy cập Vector DB (Qdrant) với Filter theo `workspace_id` để tránh rò rỉ dữ liệu chéo.  
2. **Neo4j Guard:** Mọi request thực thi Tool từ n8n phải quay ngược lại Backend để check quyền qua Neo4j một lần nữa (Stateless Verification).  
3. **Admin UI:** Giao diện NextJS phải có bảng điều khiển để Admin "ngắt kết nối" (Kill switch) một Skill hoặc Tool của bất kỳ Workspace nào ngay lập tức.

## **6\. Đặc tả chức năng & API Backend (NextJS)**

Phía Backend đóng vai trò trung tâm điều phối, xác thực quyền hạn thông qua Neo4j và truy xuất tri thức từ PostgreSQL (pgvector).

### **6.1 Nhóm API Core Agent (n8n Interaction)**

Các API này hỗ trợ trực tiếp cho luồng vận hành của Planner, Worker và Observer trong n8n.

* **POST `/api/agent/auth-and-resources`**:  
  * **Chức năng**: Xác thực người dùng và cung cấp danh sách tài nguyên (Tools/Skills) hợp lệ.  
  * **Luồng xử lý**:  
    1. Kiểm tra quyền sở hữu/tham gia Workspace thông qua Neo4j (User → ZaloGroup → Workspace).  
    2. Truy vấn bảng `pending_tasks` để kiểm tra các nhiệm vụ đang dang dở.  
    3. Thực hiện Hybrid Search: Dùng pgvector tìm kiếm ngữ nghĩa các Tool/Skill liên quan nhất, sau đó lọc lại theo danh sách Whitelist từ Neo4j.  
  * **Trả về**: Workspace ID, Task đang chờ (nếu có), và bộ công cụ AI được phép sử dụng.  
* **POST `/api/agent/pending-task`**:  
  * **Chức năng**: Lưu trữ trạng thái khi Planner phát hiện thiếu thông tin đầu vào.  
  * **Dữ liệu**: Lưu `full_plan` (JSON) và danh sách `missing_parameters` vào bảng `pending_tasks`.  
  * **Mục đích khác**: Chuyển trạng thái task thành `COMPLETED` sau khi Observer xác nhận xong việc.  
* **POST `/api/agent/audit-log`**:  
  * **Chức năng**: Ghi nhật ký thực thi cho từng bước của Agent (Planner, Worker, Observer) để phục vụ hậu kiểm.

### **6.2. Nhóm API Quản trị (Admin Dashboard)**

* **POST/GET `/api/admin/tools`**:  
  * Thêm mới tool hệ thống, định nghĩa `input_schema` và tự động tạo `embedding` để lưu vào Postgres.  
* **POST/GET `/api/admin/workspaces`**:  
  * Tạo Workspace, gán `thread_id` Zalo vào Workspace.  
* **POST `/api/admin/permissions`**:  
  * Tạo relationship `[:CAN_USE]` trong Neo4j giữa Workspace và Tool.

### **6.3. Nhóm API dành cho Người dùng (User/Workspace Management)**

Dành cho giao diện để người dùng quản lý những gì họ sở hữu.

* **GET `/api/user/skills`**: Liệt kê các Skill mà User đó đã "dạy" cho AI hoặc được share.  
* **DELETE `/api/user/skills/:id`**: Xóa Skill (xóa Postgres, gỡ Node trong Neo4j và xóa Vector).  
* **POST `/api/user/skills/share`**:  
  * Nhận `skill_id` và `target_workspace_id`.  
  * Tạo relationship `[:SHARED_TO]` trong Neo4j.  
* **GET `/api/user/audit-logs`**: Cho phép người dùng xem lại lịch sử Agent đã làm gì trong Group Zalo của họ.

### **6.4. Nhóm API cho chức năng "Học tập" (Self-Learning)**

API này được gọi khi Planner xác định User muốn tạo một Skill mới.

* **POST `/api/agent/learn-skill`**:  
  * **Input**: Tên skill, mô tả, và `logic_config` (chuỗi các bước) do AI vừa đúc kết.  
  * **Logic**:  
    1. Tính toán Embedding từ mô tả.  
    2. Lưu vào Postgres (`skills`).  
    3. Tạo quan hệ `(User)-[:OWNER_OF]->(Skill)` trong Neo4j.  
  * **Output**: Success/Fail.

