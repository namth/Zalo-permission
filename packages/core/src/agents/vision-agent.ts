import OpenAI from 'openai';

export interface VisionExtractOptions {
  imageUrls: string[];
  userPrompt?: string;
  senderName?: string;
  openRouterApiKey?: string;
  modelId?: string;
}

export class VisionAgent {
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
        'X-Title': 'OmniAgent Gateway Vision Agent',
      },
    });

    this.modelId = modelId || process.env.VISION_MODEL_ID || 'google/gemini-2.0-flash-001';
  }

  /**
   * Bóc tách thông tin từ hình ảnh (Bill, Hóa đơn, Ảnh chụp màn hình chuyển khoản ngân hàng, Bảng kê)
   * Sử dụng khả năng Multimodal Vision của Google Gemini 2.0 Flash
   */
  async extractImageFacts(options: VisionExtractOptions): Promise<string> {
    const { imageUrls, userPrompt = '', senderName = 'Người dùng' } = options;

    if (!imageUrls || imageUrls.length === 0) {
      return '';
    }

    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `Bạn là AI chuyên trách thị giác và OCR tài liệu/hóa đơn cho Trợ lý ảo Thảo Chi (Công Ty Công Nghệ INOVA).
Nhiệm vụ của bạn là soi kỹ bức ảnh (hóa đơn, bill nhà hàng, ủy nhiệm chi, ảnh chụp màn hình ngân hàng, bảng kê chi tiêu...) và trích xuất dữ liệu thực tế:
1. Nhận diện loại chứng từ (Bill thanh toán, Chuyển khoản ngân hàng, Hóa đơn VAT, v.v.).
2. Trích xuất chính xác các số liệu:
   - Tên đơn vị / Nhà hàng / Người nhận
   - Tổng số tiền (ghi rõ số nguyên, ví dụ: 350.000 VNĐ)
   - Ngày giờ giao dịch
   - Nội dung thanh toán / Danh mục món
   - Số tài khoản / Ngân hàng (nếu là bill chuyển khoản)
3. Tóm tắt ngắn gọn, mạch lạc theo cấu trúc [THÔNG TIN TRÍCH XUẤT TỪ ẢNH]:
Câu hỏi kèm theo của ${senderName}: "${userPrompt || 'Không có chú thích'}"`,
      },
      ...imageUrls.map((url) => ({
        type: 'image_url' as const,
        image_url: { url },
      })),
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelId,
        messages: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('[VisionAgent] Error extracting facts from image:', error);
      return `[Lỗi nhận diện ảnh: Không thể đọc được hình ảnh qua ${this.modelId}]`;
    }
  }
}
