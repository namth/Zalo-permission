# ADR 0003: Kiến trúc Multi-Agent Hai Tầng (Router Fast Classifier & Worker Deep ReAct)

* **Trạng thái:** Chấp thuận (Accepted)
* **Ngày quyết định:** 2026-09-30
* **Người quyết định:** Principal System Architect & PO

---

## 1. Bối cảnh (Context)
Trong một nền tảng hỗ trợ chat qua Zalo/Telegram, các yêu cầu của người dùng rất đa dạng: từ chào hỏi xã giao, hỏi thông tin nhanh, cho đến các tác vụ phức tạp đòi hỏi gọi 3-4 API công cụ (tra cứu tồn kho, kiểm tra trạng thái đơn, tính toán doanh thu).

Bài toán cần giải quyết:
1. **Độ trễ phản hồi (Latency):** Người dùng chat qua Zalo/Telegram kỳ vọng nhận được phản hồi nhanh (< 2-3s).
2. **Chi phí Token (Cost Efficiency):** Việc nạp toàn bộ danh mục công cụ đồ sộ (hàng chục tools) vào prompt của một mô hình LLM đắt tiền (như Claude 3.5 Sonnet hay GPT-4o) cho mọi câu chat thông thường sẽ gây lãng phí chi phí token cực lớn.
3. **Hiện tượng "Ảo giác Công cụ" (Tool Hallucination):** Khi một prompt chứa quá nhiều tools cùng lúc, LLM dễ bị nhầm lẫn giữa các function và gọi sai công cụ.

---

## 2. Quyết định (Decision)
Chúng tôi quyết định áp dụng mô hình **Hai tầng Multi-Agent Tách biệt (Two-Tier Agent Pipeline)** qua OpenRouter Gateway:

```
[Tin nhắn vào] ──> [Tầng 1: Router Agent (Gemini 2.0 Flash)]
                         │
                         ├──> Trả lời trực tiếp nếu là xã giao / ngoài phạm vi (TTFT < 800ms)
                         │
                         └──> Khớp Skill hoặc Lọc đúng nhóm Tool cần thiết
                                       │
                                       ▼
                             [Tầng 2: Worker Agent (Claude 3.5 Sonnet)]
                             (Thực hiện vòng lặp Think -> Plan -> Act -> Observe tối đa 5 bước)
```

* **Tầng 1 - Router Agent:**
  * Model: `google/gemini-2.0-flash` (siêu nhanh, chi phí siêu rẻ, hỗ trợ context lớn).
  * Nhiệm vụ: Phân loại ý định (Intent Classification), lọc đúng Skill hoặc danh mục Tool liên quan từ đồ thị Neo4j của Workspace.
* **Tầng 2 - Worker Agent:**
  * Model: `anthropic/claude-3.5-sonnet` (suy luận sâu sắc, khả năng gọi tool chính xác nhất hiện nay).
  * Nhiệm vụ: Tiếp nhận danh mục tool đã được tinh gọn $\to$ Lập kế hoạch $\to$ Thực thi ReAct Loop tối đa 5 bước $\to$ Sinh câu trả lời tự nhiên.

---

## 3. Các Phương án Đã Cân nhắc & Lý do Loại bỏ
1. **Dùng duy nhất một LLM mạnh (Single Claude 3.5 Sonnet):**
   * *Ưu điểm:* Code đơn giản, không cần chia luồng Router.
   * *Nhược điểm:* Chi phí đội lên gấp 5–10 lần cho những câu chào hỏi thông thường. Thời gian phản hồi cho mọi tin nhắn đều chậm ($> 3\text{s}$). Dễ gọi nhầm tool khi schema quá dài.
2. **Hard-coded Regex / NLU truyền thống (Rasa / Dialogflow):**
   * *Ưu điểm:* Tốc độ gần như tức thì ($< 10\text{ms}$).
   * *Nhược điểm:* Quá cứng nhắc, không hiểu được ngôn ngữ tự nhiên biến thể của người dùng Việt Nam khi chat trên Zalo/Telegram.

---

## 4. Hệ quả & Đánh đổi (Consequences & Trade-offs)
* **Tích cực:**
  * Tối ưu chi phí vượt bậc: $70\%$ tin nhắn thông thường được giải quyết ở Tầng 1 với chi phí gần như bằng 0.
  * Tốc độ phản hồi cực nhanh cho câu hỏi đơn giản.
  * Worker Agent nhận được bộ tools cô đọng nên tỷ lệ gọi tool chính xác đạt $> 98\%$.
* **Đánh đổi:**
  * Tăng độ phức tạp kiến trúc: Phải quản lý 2 prompt templates và luồng state chuyển giao giữa 2 agents.
  * Trường hợp Router phân loại sai sẽ dẫn đến việc Worker không có đủ tool cần thiết (Cần thiết lập fallback cho phép Worker yêu cầu thêm tool nếu cần).
