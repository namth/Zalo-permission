import OpenAI from 'openai';

export class TextSplitterAgent {
  private openai: OpenAI;
  private modelId: string;

  constructor(apiKey?: string, modelId?: string) {
    const key = apiKey || process.env.OPENROUTER_API_KEY || 'dummy_key';
    const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    this.openai = new OpenAI({
      apiKey: key,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'OmniAgent Text Splitter Agent',
      },
    });

    this.modelId = modelId || process.env.TEXT_SPLITTER_MODEL_ID || 'google/gemini-2.5-flash';
  }

  /**
   * Chuyển đổi một đoạn văn bản thô thành một mảng các chuỗi ngắn đã được làm sạch và chuẩn hóa.
   */
  async splitIntoSentences(text: string): Promise<string[]> {
    if (!text || !text.trim()) return [];

    const rawLines = text
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Nếu văn bản chỉ có 1 câu ngắn đơn giản (không có gạch đầu dòng và ngắn), làm sạch trực tiếp
    if (rawLines.length === 1 && !rawLines[0].startsWith('-') && !rawLines[0].startsWith('*') && rawLines[0].length < 100) {
      return [this.cleanSingleSentence(rawLines[0])];
    }

    const systemPrompt = `Bạn là một AI Agent có nhiệm vụ xử lý văn bản tin nhắn hội thoại cho ứng dụng chat (Zalo/Telegram). Hãy đọc đoạn văn bản đầu vào và tách thành một mảng các tin nhắn ngắn đã được làm sạch và chuẩn hóa.

#### Mục tiêu:
Chuyển đổi một đoạn văn bản thô thành một mảng JSON các chuỗi tin nhắn. Mỗi chuỗi trong mảng là một tin nhắn sẽ được gửi tới người dùng theo thứ tự.

#### Quy tắc xử lý:

1. **ĐỐI VỚI DẠNG THÔNG TIN DANH SÁCH (CỰC KỲ QUAN TRỌNG):**
   * Khi văn bản chứa thông tin dạng danh sách liệt kê (ví dụ: danh sách website, danh sách sản phẩm, dịch vụ, hóa đơn, công nợ, nhiệm vụ, thành viên, các dòng bắt đầu bằng -, *, • hoặc số thứ tự 1., 2., v.v.):
   * **BẮT BUỘC HIỂN THỊ DẠNG LIST XUỐNG DÒNG (\\n). TUYỆT ĐỐI KHÔNG VIẾT HOẶC GỘP THÀNH 1 HÀNG NGANG BẰNG DẤU PHẨY.**
   * Giữ nguyên cấu trúc từng mục trên một dòng riêng biệt và giữ nguyên dấu gạch đầu dòng hoặc số thứ tự (ví dụ: "- website1\\n- website2\\n- website3").
   * Khối danh sách này phải nằm trong MỘT chuỗi duy nhất trong mảng trả về, các mục ngăn cách nhau bởi ký tự xuống dòng \\n.

2. **ĐỐI VỚI CÂU VĂN HỘI THOẠI THÔNG THƯỜNG (Chào hỏi, dẫn dắt, giải thích):**
   * Tách thành các câu ngắn độc lập dựa trên dấu chấm ngắt câu hoặc dấu xuống dòng.
   * Chuyển chữ cái đầu tiên thành chữ thường (lowercase) trừ tên riêng người hoặc địa danh (ví dụ: "dạ em đã lấy danh sách cho anh Nam Trần ạ").
   * Xóa khoảng trắng thừa ở đầu và cuối câu.
   * Xóa dấu chấm (.), phẩy (,), chấm phẩy (;) ở cuối mỗi câu hội thoại ngắn.

3. **Định dạng đầu ra:**
   * Trả về DUY NHẤT một mảng JSON các chuỗi: ["tin nhắn 1", "tin nhắn 2", ...].
   * Tuyệt đối không bọc trong markdown code block, không thêm văn bản giải thích.
   * Không có chuỗi rỗng trong mảng.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
      });

      let content = response.choices[0]?.message?.content?.trim() || '';
      if (content.startsWith('```json')) {
        content = content.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (content.startsWith('```')) {
        content = content.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim()).filter((s) => s.length > 0);
      }
    } catch (err) {
      console.warn('[TextSplitterAgent] LLM sentence split failed, using deterministic fallback:', err);
    }

    // Thuật toán dự phòng thuần Javascript nếu LLM lỗi hoặc bị rate limit
    return this.fallbackSplit(text);
  }

  /**
   * Chuẩn hóa và làm sạch 1 câu theo quy tắc
   */
  private cleanSingleSentence(s: string): string {
    let clean = s.trim();

    // 1. Xóa ký tự đặc biệt ở đầu câu: **, -, *, +, 1., •, v.v. (chỉ áp dụng cho câu hội thoại đơn lẻ)
    clean = clean.replace(/^(?:[-*+•\d.)]\s*)+/g, '').trim();
    clean = clean.replace(/^\*\*/, '').trim();

    // 2. Bỏ viết hoa chữ cái đầu tiên (trừ tên riêng hoặc link)
    if (clean.length > 0 && !clean.startsWith('http')) {
      const firstChar = clean[0];
      // Nếu chữ thứ hai là chữ thường thì mới lowercase ký tự đầu (tránh từ viết tắt toàn chữ hoa)
      if (clean.length > 1 && clean[1] === clean[1].toLowerCase()) {
        clean = firstChar.toLowerCase() + clean.slice(1);
      }
    }

    // 3. Loại bỏ dấu câu ở cuối câu: ., ;, :, ,
    clean = clean.replace(/[.,;:]+$/, '').trim();

    return clean;
  }

  /**
   * Thuật toán phân tách dự phòng
   */
  private fallbackSplit(text: string): string[] {
    const rawLines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) return [];

    const isListItem = (line: string) =>
      /^[-*+•\d.)]/.test(line) ||
      /^[a-zA-Z0-9-]+\.[a-z]{2,}/.test(line);

    const results: string[] = [];
    let currentList: string[] = [];

    for (const line of rawLines) {
      if (isListItem(line)) {
        let cleanItem = line.replace(/^[+*•]\s*/, '- ');
        if (!cleanItem.startsWith('- ') && !/^\d+\.\s*/.test(cleanItem)) {
          cleanItem = `- ${cleanItem}`;
        }
        currentList.push(cleanItem);
      } else {
        if (currentList.length > 0) {
          results.push(currentList.join('\n'));
          currentList = [];
        }
        results.push(this.cleanSingleSentence(line));
      }
    }

    if (currentList.length > 0) {
      results.push(currentList.join('\n'));
    }

    return results.filter((r) => r.trim().length > 0);
  }
}
