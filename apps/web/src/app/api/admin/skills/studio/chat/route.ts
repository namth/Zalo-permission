import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { SkillSopStep } from '@omniagent/core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      currentSteps = [],
      skillId,
      skillKey,
      skillName,
    } = body;

    if (!message && (!history || history.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Tin nhắn không được để trống' },
        { status: 400 }
      );
    }

    // 1. Fetch available active tools
    const toolsRes = await query(
      `SELECT t.key, t.name, t.description, tg.name as group_name
       FROM tools t
       LEFT JOIN tool_groups tg ON t.tool_group_id = tg.id
       WHERE t.is_active = true
       ORDER BY tg.name, t.name`
    );

    const availableTools = toolsRes.rows.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description || '',
      group: t.group_name || 'Khác',
    }));

    // 2. Load existing skill if skillId provided
    let existingSkill: any = null;
    if (skillId) {
      const skillRes = await query(
        `SELECT id, key, name, description, detail, system_prompt, trigger_intents, required_tools, sop_steps, execution_mode
         FROM skills WHERE id = $1`,
        [skillId]
      );
      if (skillRes.rows.length > 0) {
        existingSkill = skillRes.rows[0];
      }
    }

    // 3. Build system instruction
    const systemPrompt = `Bạn là "OmniAgent Skill Studio Architect" - Chuyên gia phỏng vấn, cố vấn quy trình và thiết kế SOP (Standard Operating Procedure) chuẩn xác cho AI Agent.

MỤC TIÊU:
Bạn sẽ tương tác phỏng vấn trực tiếp với người dùng để hiểu rõ yêu cầu nghiệp vụ, sau đó cùng người dùng chốt quy trình từng bước (SOP Steps).
Khi đã có quy trình SOP chuẩn, Agent khi gặp yêu cầu sẽ thi hành chính xác tuần tự từng bước mà không cần suy luận lan man hay bịa đặt công cụ!

DANH SÁCH CÁC CÔNG CỤ HIỆN CÓ TRONG HỆ THỐNG:
${availableTools.map((t) => `- [${t.key}] (${t.name}, Nhóm: ${t.group}): ${t.description}`).join('\n')}

QUY ĐỊNH VỀ CÁC LOẠI BƯỚC SOP (SkillSopActionType):
1. 'LLM_EXTRACT': Agent dùng LLM để trích xuất các biến/thông tin từ câu nói người dùng hoặc tin nhắn quoted (ví dụ: số tiền, danh mục, nội dung, ngày tháng).
2. 'TOOL_CALL': Agent gọi trực tiếp một công cụ cụ thể từ danh sách công cụ trên với tham số đã trích xuất.
3. 'CONDITIONAL_TOOL': Agent kiểm tra điều kiện (ví dụ: nếu chưa có số tiền hoặc nếu chưa xác thực) thì mới gọi tool hoặc rẽ nhánh.
4. 'ASK_USER': Nếu thiếu thông tin bắt buộc hoặc cần người dùng xác nhận, Agent dừng lại đặt câu hỏi phản hồi cho người dùng.
5. 'SYNTHESIZE': Agent tổng hợp kết quả các bước trước và trả lời thân thiện cho người dùng theo văn phong chuẩn.

CÁCH THỨC PHỎNG VẤN & PHẢN HỒI:
- Phân tích kỹ yêu cầu của người dùng. Nếu người dùng đưa ra một yêu cầu mới hoặc muốn sửa skill cũ, hãy thảo luận và đề xuất quy trình SOP gồm các bước cụ thể.
- Hỏi người dùng những điểm còn mơ hồ (ví dụ: "Nếu người dùng không nói rõ danh mục thì mặc định là gì?", "Có cần hỏi lại người dùng để xác nhận trước khi lưu không?").
- Nếu người dùng yêu cầu chỉnh sửa bước nào (thêm bước, đổi thứ tự, bỏ bước), hãy lắng nghe và cập nhật lại danh sách SOP steps ngay.
- Đưa ra phản hồi ngắn gọn, chuyên nghiệp, khích lệ và cầu thị bằng tiếng Việt.

BẮT BUỘC TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON HỢP LỆ VỚI CẤU TRÚC SAU:
{
  "reply": "Lời giải thích, phân tích và câu hỏi phỏng vấn tương tác gửi cho người dùng (Markdown tiếng Việt).",
  "skill_name": "Tên Skill (ví dụ: Thêm Chi Tiêu)",
  "skill_key": "Mã skill snake_case (ví dụ: them_chi_tieu)",
  "description": "Mô tả ngắn gọn mục đích skill",
  "system_prompt": "Hướng dẫn hệ thống chuyên biệt cho skill này khi chạy",
  "trigger_intents": ["câu lệnh mẫu 1", "câu lệnh mẫu 2", "từ khóa kích hoạt"],
  "required_tools": ["mã_tool_1", "mã_tool_2"],
  "sop_steps": [
    {
      "stepId": 1,
      "title": "Trích xuất thông tin chi tiêu",
      "actionType": "LLM_EXTRACT",
      "description": "Trích xuất số tiền (amount), mô tả (note), danh mục (category)",
      "inputMapping": { "text": "{{user_message}}" }
    },
    {
      "stepId": 2,
      "title": "Kiểm tra số tiền",
      "actionType": "ASK_USER",
      "condition": "!amount",
      "description": "Nếu không tìm thấy số tiền, hỏi người dùng số tiền cần chi"
    },
    {
      "stepId": 3,
      "title": "Lưu chi tiêu vào hệ thống",
      "actionType": "TOOL_CALL",
      "toolKey": "inova_create_expense",
      "inputMapping": { "amount": "{{amount}}", "note": "{{note}}", "category": "{{category}}" },
      "description": "Gọi tool ghi nhận chi tiêu"
    },
    {
      "stepId": 4,
      "title": "Phản hồi kết quả",
      "actionType": "SYNTHESIZE",
      "description": "Báo lại người dùng đã ghi nhận thành công chi tiêu"
    }
  ],
  "execution_mode": "DETERMINISTIC_SOP",
  "is_ready": true hoặc false (true nếu các bước đã đầy đủ và có thể chốt lưu, false nếu còn đang hỏi làm rõ)
}
Chỉ trả về JSON thuần túy, không bọc markdown \`\`\`json.`;

    const apiKey = process.env.OPENROUTER_API_KEY || '';
    const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    const openai = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'https://zalo.oa.io.vn',
        'X-Title': 'OmniAgent Skill Studio',
      },
    });

    const model =
      process.env.COPILOT_MODEL_ID ||
      process.env.WORKER_MODEL_ID ||
      'anthropic/claude-3.5-sonnet';

    // 4. Build message history
    const contextPrompt = [];
    if (existingSkill) {
      contextPrompt.push(
        `[THÔNG TIN SKILL ĐANG CHỈNH SỬA]:\n` +
          `- ID: ${existingSkill.id}\n` +
          `- Key: ${existingSkill.key}\n` +
          `- Name: ${existingSkill.name}\n` +
          `- Mô tả: ${existingSkill.description || ''}\n` +
          `- System Prompt: ${existingSkill.system_prompt || ''}\n` +
          `- Trigger Intents: ${JSON.stringify(existingSkill.trigger_intents || [])}\n` +
          `- Required Tools: ${JSON.stringify(existingSkill.required_tools || [])}\n` +
          `- SOP Steps hiện tại: ${JSON.stringify(existingSkill.sop_steps || [])}\n`
      );
    } else if (skillName || skillKey) {
      contextPrompt.push(
        `[SKILL MỚI ĐANG THIẾT KẾ]: Tên: ${skillName || ''}, Key: ${skillKey || ''}`
      );
    }

    if (currentSteps && currentSteps.length > 0) {
      contextPrompt.push(
        `[CÁC BƯỚC SOP HIỆN TẠI TRÊN BẢNG THIẾT KẾ]:\n${JSON.stringify(currentSteps, null, 2)}`
      );
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (contextPrompt.length > 0) {
      messages.push({
        role: 'system',
        content: contextPrompt.join('\n\n'),
      });
    }

    for (const h of history) {
      messages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      });
    }

    if (message) {
      messages.push({ role: 'user', content: message });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      // Clean up markdown block if present
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    logger.error(`POST /api/admin/skills/studio/chat error: ${error}`);
    return NextResponse.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
