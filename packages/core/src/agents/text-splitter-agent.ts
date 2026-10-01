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

    const systemPrompt = `Bạn là một AI Agent có nhiệm vụ xử lý văn bản. Hãy đọc đoạn văn bản đầu vào và thực hiện các bước sau để trả về một mảng các chuỗi đã được làm sạch.

#### Mục tiêu:
Chuyển đổi một đoạn văn bản thô thành một mảng các chuỗi. Mỗi chuỗi trong mảng phải là một câu hoàn chỉnh, được làm sạch và chuẩn hóa theo các quy tắc sau.

#### Quy tắc xử lý:

1. **Tách câu:** Tách văn bản thành các câu dựa trên các dấu xuống dòng (\\n). Coi mỗi dòng là một câu riêng biệt.

2. **Gộp câu liên quan:** Nếu số lượng câu từ 5 câu trở lên và có các dòng liên tiếp có mối liên hệ chặt chẽ về ngữ nghĩa hoặc thuộc cùng một ý (ví dụ: liệt kê các gạch đầu dòng của cùng một chủ đề), hãy gộp chúng lại thành một chuỗi duy nhất. Sử dụng dấu phẩy (,) để nối các phần của câu được gộp lại. **Quan trọng**: không được thay đổi nội dung các dòng.

3. **Làm sạch và chuẩn hóa:**
   * **Loại bỏ ký tự đặc biệt:** Xóa tất cả các ký tự đặc biệt ở đầu mỗi câu (ví dụ: **, -, *, +, 1., 2., v.v.).
   * **Bỏ viết hoa đầu câu:** Chuyển chữ cái đầu tiên của mỗi câu thành chữ thường (lowercase) ngoại trừ tên người hoặc tên riêng địa danh.
   * **Xóa khoảng trắng thừa:** Loại bỏ tất cả các khoảng trắng thừa ở đầu và cuối mỗi câu.
   * **Loại bỏ dấu câu cuối cùng:** Xóa các dấu chấm (.), phẩy (,), chấm phẩy (;), hoặc bất kỳ dấu câu nào khác ở cuối mỗi câu.

4. **Định dạng đầu ra:**
   * Trả về DUY NHẤT một mảng JSON các chuỗi: ["câu 1", "câu 2", ...]. Tuyệt đối không bọc trong markdown code block, không thêm văn bản giải thích.
   * Mỗi phần tử trong mảng là một câu đã được xử lý hoàn chỉnh.
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

    // 1. Xóa ký tự đặc biệt ở đầu câu: **, -, *, +, 1., •, v.v.
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

    const cleanedLines = rawLines.map((line) => this.cleanSingleSentence(line)).filter((l) => l.length > 0);

    // Gộp câu liên quan nếu có từ 5 câu trở lên
    if (cleanedLines.length >= 5) {
      const grouped: string[] = [];
      let currentGroup: string[] = [];

      for (const line of cleanedLines) {
        if (line.includes(':') && currentGroup.length > 0) {
          grouped.push(currentGroup.join(', '));
          currentGroup = [line];
        } else if (currentGroup.length > 0 && currentGroup.length < 3) {
          currentGroup.push(line);
        } else {
          if (currentGroup.length > 0) grouped.push(currentGroup.join(', '));
          currentGroup = [line];
        }
      }
      if (currentGroup.length > 0) grouped.push(currentGroup.join(', '));
      return grouped;
    }

    return cleanedLines;
  }
}
