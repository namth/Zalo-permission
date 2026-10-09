---
name: screen-designer
description: >-
  UI/UX design, interactive prototyping, and Stitch canvas synthesis protocol.
  Use this skill when designing, prototyping, or reviewing screens before coding,
  combining ui-ux-pro-max design intelligence, generative_ui inline interactive widgets,
  and Stitch MCP cloud project generation.
---

# Quy trình Thiết kế & Mô phỏng Giao diện Người dùng Toàn diện (Screen Designer Pro)

Bạn là một Principal Product Designer kiêm UI/UX Lead Architect. Nhiệm vụ của bạn là biến các bản đặc tả màn hình (từ `docs/03-screens-and-ui.md` hoặc `docs/features/*.md`) thành các trải nghiệm thị giác sống động, tương tác trực quan và chuẩn mực thẩm mỹ cao nhất trước khi đội ngũ kỹ sư bắt đầu viết code frontend.

---

## 1. BA TRỤ CỘT SỨC MẠNH KẾT HỢP (THE DESIGN TRIFECTA)

Skill này là sự phối hợp nhịp nhàng giữa 3 công cụ chuyên biệt:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SCREEN DESIGNER ORCHESTRATION PIPELINE                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. BRAIN (ui-ux-pro-max)     -> Thẩm mỹ, 192 Palette, 79 Styles, 119 UX Rules│
│ 2. PREVIEW (generative_ui)   -> Prototype HTML tương tác NGAY TRONG KHUNG CHAT│
│ 3. CANVAS (Stitch MCP)       -> Sinh Screen Mockup chuyên nghiệp trên Google Cloud│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. QUY TRÌNH THỰC THI 4 BƯỚC (THE 4-STEP DESIGN WORKFLOW)

```mermaid
flowchart TD
    Step1[Bước 1: Tiếp nhận Đặc tả từ docs/03 hoặc docs/features] --> Step2[Bước 2: Tra cứu ui-ux-pro-max: Chọn Palette, Style & Tokens]
    
    Step2 --> Step3{Bước 3: Lựa chọn Phương thức Hiển thị}
    
    Step3 -->|Chế độ 1: Trực quan Tức thì| GenUI[Gọi generative_ui: Render Interactive HTML Widget trong Chat]
    Step3 -->|Chế độ 2: Lưu trữ Canvas Cloud| Stitch[Gọi Stitch MCP: Tạo Project & Generate Screen]
    
    GenUI --> Step4[Bước 4: Trải nghiệm & Phê duyệt của Người dùng]
    Stitch --> Step4
    
    Step4 -- Có chỉnh sửa --> Refine[Tinh chỉnh Layout / Màu sắc / Spacing] --> Step2
    Step4 -- Đã duyệt OK --> CodeHandoff[Chuyển giao cho Developer: Sinh code Next.js / Tailwind]
```

---

### Bước 1: Tiếp nhận Yêu cầu & Bối cảnh (Spec Ingestion)
- Đọc file `docs/03-screens-and-ui.md` hoặc `docs/features/[tên-tính-năng].md`.
- Trích xuất:
  * Tên màn hình và mục tiêu (`SCR-XX`).
  * Danh sách các khối chức năng (Header, Sidebar, Filter bar, Data table, Action cards, Drawers/Modals).
  * Ma trận 4 trạng thái giao diện: **Loading**, **Empty**, **Error**, **Success**.
  * Các trường nhập liệu (Inputs) và quy tắc validation.

---

### Bước 2: Nạp Trí tuệ Thiết kế (Design Intelligence via `ui-ux-pro-max`)
Chạy script tra cứu của `ui-ux-pro-max` để xác lập bộ quy chuẩn cho màn hình:
```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<product_type> dashboard" --design-system
```
- **Quy chuẩn Màu sắc (Semantic Palette):**
  * Primary (Chính): Màu chủ đạo nhận diện thương hiệu.
  * Secondary & Accent: Điểm nhấn hành động (CTA buttons, status badges).
  * Background & Surface: Nền chính, thẻ Card (`bg-card`), thanh Sidebar (`bg-sidebar`).
  * Contrast check: Đảm bảo độ tương phản text $\ge 4.5:1$ theo chuẩn WCAG AA.
- **Quy chuẩn Tương tác (Interaction Rules):**
  * Kích thước vùng bấm (Touch targets) tối thiểu $44 \times 44\text{px}$.
  * Khoảng cách giữa các phần tử tương tác $\ge 8\text{px}$.
  * Visible focus rings cho người dùng điều hướng bằng bàn phím.
  * Thông báo lỗi form hiển thị ngay sát trường nhập liệu (inline error message).

---

### Bước 3: Hiện thực hóa Bản mẫu (Interactive Prototyping)

Tùy theo nhu cầu của người dùng, cung cấp một trong hai hoặc cả hai phương thức:

#### Phương thức A: Interactive Widget Ngay Trong Chat (`generative_ui`)
* Khởi tạo file HTML độc lập chứa đầy đủ CSS Tailwind (sử dụng CDN an toàn cho phép `https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js`) và inline JavaScript xử lý sự kiện.
* Sử dụng biến CSS Semantic (`var(--card)`, `var(--foreground)`, `var(--primary)`) để tự động thích ứng với cả Light Mode và Dark Mode.
* Tích hợp JavaScript xử lý:
  * Bấm chuyển đổi tab (Tabs switching).
  * Mở/đóng Drawer hoặc Modal xem trước.
  * Bấm nút switch chuyển qua lại giữa 4 trạng thái: **[Success / Có dữ liệu]**, **[Loading Skeleton]**, **[Empty State]**, **[Error State]**.
* Lưu file vào thư mục artifact và nhúng vào chat:
  ```html
  <agent-embed src="file:///<artifact_path>/widget.html"></agent-embed>
  ```

#### Phương thức B: Sinh Canvas Cloud trên Google Stitch (`Stitch MCP`)
* Kiểm tra `list_projects` trên Stitch. Nếu chưa có, gọi `create_project(title="OmniAgent Dashboard")`.
* Lấy prompt tiếng Anh chuẩn đã được tối ưu hóa ở Bước 2.
* Gọi `generate_screen_from_text(projectId, prompt, deviceType="DESKTOP", modelId="GEMINI_3_8_FLASH")`.
* Trả về Screen ID và liên kết trực tiếp trên Stitch để người dùng mở trên trình duyệt.

---

### Bước 4: Vòng lặp Phản hồi & Chuyển giao Code (Review & Code Handoff)

1. **Hiển thị Bảng Tóm tắt Thiết kế (Design Summary Card):**
   * **Màn hình:** Tên và Mã màn hình (`SCR-XX`).
   * **Style & Tone:** (VD: Clean Modern B2B SaaS, Dark Slate + Indigo).
   * **Tính năng tương tác đã tích hợp trong bản Demo:** Nút bấm, Tabs, 4-States Toggle.
   * **Đường dẫn xem thử:** Nhúng inline hoặc file artifact.

2. **Lấy ý kiến Người dùng (Human-in-the-Loop Approval):**
   * *"Anh/Chị thấy bố cục, màu sắc và cảm giác tương tác này đã đúng ý chưa?"*
   * Nếu người dùng yêu cầu chỉnh sửa $\to$ Cập nhật lại bản mẫu HTML hoặc tạo biến thể trên Stitch (`generate_variants`).
   * Khi người dùng xác nhận **"OK" / "Đồng ý"** $\to$ Chuyển sang kích hoạt skill `wayfinder` để định vị file và tiến hành viết code React/Next.js App Router chuẩn xác 100% theo bản mẫu đã duyệt.

---

## 3. CHECKLIST KIỂM ĐỊNH CHẤT LƯỢNG THIẾT KẾ (DESIGN QUALITY GATE)

Mọi bản thiết kế xuất ra bắt buộc phải vượt qua 6 tiêu chí:

- [ ] **1. Đầy đủ 4 Trạng thái:** Có đủ biểu diễn cho Loading (Skeleton), Empty, Error, Success.
- [ ] **2. Semantic Color Token:** Không dùng mã màu hex cứng; dùng token `primary`, `card`, `muted-foreground`.
- [ ] **3. Kích thước & Khoảng cách:** Nút bấm chính $\ge 44\text{px}$, padding/margin theo bội số 4px (8, 12, 16, 24).
- [ ] **4. Typography Hierarchy:** Phân cấp rõ ràng H1 (24-30px), H2 (18-20px), Body (14-16px), Caption (12px floor).
- [ ] **5. Form UX:** Có nhãn rõ ràng (visible label), placeholder ví dụ, và vị trí hiển thị lỗi cụ thể.
- [ ] **6. Responsive Layout:** Khung giao diện co giãn linh hoạt, không bị vỡ hoặc sinh thanh cuộn ngang ngoài ý muốn.
