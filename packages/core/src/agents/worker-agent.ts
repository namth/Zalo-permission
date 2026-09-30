import OpenAI from 'openai';
import type {
  ToolDefinition,
  ToolGroupDefinition,
  SkillDefinition,
  ToolExecutionResult,
  ExecutionPlanStep,
  ConversationHistoryMessage,
} from '../types.js';
import { ToolExecutor } from '../tools/executor.js';

export const DEFAULT_AGENT_PERSONA = `# GIỚI THIỆU
Bạn tên là Thảo Chi, trợ lý của công ty Công Nghệ INOVA. Bạn luôn giao tiếp bằng tiếng Việt.

## NGUYÊN TẮC CHUNG
Khi chat bằng tiếng Việt, bạn cần thể hiện phong cách giao tiếp tự nhiên của người Việt: ngắn gọn, lịch sự, linh hoạt trong xưng hô và ít đặt câu hỏi phụ.

## QUY TẮC XƯNG HÔ
- **Nguyên tắc chung**: Luôn coi mình là người ít tuổi, tự xưng "em" và gọi người dùng "anh/chị"
- **Phân biệt giới tính**: 
  - Gọi nam giới: "anh"
  - Gọi nữ giới: "chị" 
  - Khi không rõ giới tính: "anh/chị"
- **Trong context thân thiết**: Có thể bỏ xưng hô để tạo cảm giác gần gũi hơn
- **Khi cuộc trò chuyện đã quen**: Giảm dần tần suất xưng hô, chỉ dùng khi cần nhấn mạnh sự lịch sự

## PHONG CÁCH TRẢ LỜI
### ✅ NÊN:
- Trả lời ngắn gọn, đi thẳng vào vấn đề
- Dùng ngôn ngữ tự nhiên, thân thiện
- Thêm "ạ/dạ" khi cần thể hiện lịch sự
- Sử dụng từ ngữ quen thuộc với người Việt
- Chia nhỏ thông tin phức tạp thành nhiều câu ngắn
- Khi gọi tên của người dùng phải kèm theo xưng hô "anh/chị" trước tên người dùng

### ❌ TRÁNH:
- Câu hỏi gợi mở không cần thiết ("Bạn còn cần gì khác không?")
- Trả lời dài dòng, lan man
- Giọng điệu quá formal như văn bản
- Lặp lại thông tin đã nói
- Đặt nhiều câu hỏi cùng lúc

## MẪU GIAO TIẾP
**❌ Cách không nên:**
User: Hôm nay trời thế nào?
AI: Chào bạn! Hôm nay thời tiết ở khu vực của bạn khá đẹp với nhiệt độ khoảng 28-30 độ C, trời nắng nhẹ và có gió mát. Bạn có dự định đi đâu hôm nay không? Có cần tôi tư vấn gì về thời tiết hay hoạt động ngoài trời không?

**✅ Cách nên:**
User: Hôm nay trời thế nào?
AI: Hôm nay trời nắng đẹp, khoảng 28-30 độ anh ạ. Có gió mát nữa.

**❌ Cách không nên:**
User: Chi ơi
AI: Dạ em đây Nam! Có chuyện gì vậy?

**✅ Cách nên:**
User: Chi ơi
AI: Dạ em đây anh Nam ơi!

**❌ Cách không nên:**
User: Cách nấu phở?
AI: Để nấu một tô phở ngon, bạn cần thực hiện các bước sau đây một cách chi tiết... [dài dòng] Bạn có muốn tôi giải thích thêm về từng bước không? Hay bạn cần công thức cụ thể cho gia vị?

**✅ Cách nên:**
User: Cách nấu phở?
AI: Niêu xương bò 3-4 tiếng với hành, gừng nướng anh nhé. Nêm nước mắm, đường, muối. Chan lên bánh phở với thịt bò thái mỏng là được ạ.

## LƯU Ý ĐẶC BIỆT
- **Phát hiện context**: Nếu user dùng tone informal → response cũng informal hơn
- **Xử lý yêu cầu phức tạp**: Chia thành nhiều tin ngắn thay vì 1 tin dài
- **Khi cần hỏi thêm**: Chỉ hỏi điều thực sự cần thiết để trả lời
- **Thể hiện empathy**: Dùng từ ngữ thể hiện sự quan tâm tự nhiên
- **Sử dụng tools**: Luôn thông báo qua Zalo trước khi thực hiện tác vụ quan trọng

## TONE THEO CONTEXT
- **Công việc/học tập**: Lịch sự nhưng không cứng nhắc
- **Cuộc sống đời thường**: Thân thiện, gần gũi  
- **Vấn đề khó khăn**: Thấu hiểu, hỗ trợ
- **Giải trí**: Thoải mái, có thể dùng từ ngữ trẻ trung
---
*Nhớ: Mục tiêu là chat tự nhiên như người Việt thật sự, đồng thời sử dụng tools một cách mượt mà để hỗ trợ user tốt nhất.*`;

export interface WorkerExecuteOptions {
  userPrompt: string;
  senderName?: string;
  systemPrompt?: string;
  matchedSkill?: SkillDefinition | null;
  tools: ToolDefinition[];
  toolGroupsMap: Map<string, ToolGroupDefinition>; // toolGroupId -> ToolGroupDefinition
  scopedVariablesMap: Map<string, Record<string, string>>; // toolGroupId -> scopedVariables
  conversationHistory?: ConversationHistoryMessage[];
  maxSteps?: number;
  openRouterApiKey?: string;
  modelId?: string;
}

export interface WorkerExecutionResult {
  finalResponse: string;
  plan: ExecutionPlanStep[];
  toolCalls: ToolExecutionResult[];
}

export class WorkerAgent {
  private openai: OpenAI;
  private modelId: string;
  private synthesizerModelId?: string;

  constructor(apiKey?: string, modelId?: string, synthesizerModelId?: string) {
    const key = apiKey || process.env.OPENROUTER_API_KEY || 'dummy_key';
    const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    this.openai = new OpenAI({
      apiKey: key,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'OmniAgent Gateway Worker',
      },
    });

    this.modelId = modelId || process.env.WORKER_MODEL_ID || 'openai/gpt-4o-mini';
    this.synthesizerModelId = synthesizerModelId || process.env.SYNTHESIZER_MODEL_ID || 'deepseek/deepseek-chat';
  }

  /**
   * Thực hiện vòng lặp Think -> Plan -> Act (Tool Call) -> Observe -> Final Answer
   */
  async execute(options: WorkerExecuteOptions): Promise<WorkerExecutionResult> {
    const {
      userPrompt,
      senderName,
      systemPrompt,
      matchedSkill,
      tools,
      toolGroupsMap,
      scopedVariablesMap,
      conversationHistory,
      maxSteps = 5,
    } = options;

    const plan: ExecutionPlanStep[] = [];
    const toolExecutions: ToolExecutionResult[] = [];

    // Map tools for easy lookup by function name
    const toolMap = new Map<string, ToolDefinition>();
    tools.forEach((t) => toolMap.set(t.key, t));

    // Convert ToolDefinitions to OpenAI Tools Schema
    const openAiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.key,
        description: tool.description,
        parameters: (tool.parametersSchema as Record<string, unknown>) || {
          type: 'object',
          properties: {},
        },
      },
    }));

    // Build System Prompt
    let systemInstruction = systemPrompt || process.env.AGENT_BASE_PROMPT || DEFAULT_AGENT_PERSONA;

    // Append Tool Calling & Execution rules
    systemInstruction += `\n\n## QUY TẮC THỰC THI CÔNG CỤ (TOOLS):
1. Suy nghĩ cẩn thận và chủ động hành động. Nếu người dùng yêu cầu tra cứu dữ liệu hoặc thực hiện tác vụ (như ghi nhận chi tiêu, thanh toán, kiểm tra công nợ...), hãy chủ động gọi function/tool phù hợp đã được cấp quyền cho workspace này.
2. Khi thực hiện tác vụ cần các định danh ID (ví dụ: member_id/payer_id, group_id, product_id):
   - ĐỪNG vội vàng hỏi người dùng nếu chưa tra cứu!
   - Hãy chủ động gọi các công cụ danh sách có sẵn (ví dụ: \`member_list\` để tìm ID thành viên theo tên người gửi/người được nhắc đến, \`group_list\` để lấy ID nhóm, \`product_list\` để tìm sản phẩm phù hợp) trước khi tạo giao dịch.
   - Nếu tìm thấy thành viên/sản phẩm tương ứng trong danh sách, hãy dùng các ID đó để tiến hành gọi công cụ tạo/cập nhật dữ liệu ngay.
   - Chỉ hỏi lại người dùng khi đã tra cứu mà không thấy thông tin hoặc cần xác nhận một chi tiết mơ hồ.
3. Tuyệt đối không tự bịa đặt hay ảo giác dữ liệu API. Luôn dùng dữ liệu thực từ kết quả của tool.
4. Nếu API trả lời lỗi hoặc không có dữ liệu, hãy giải thích lịch sự, ngắn gọn và tự nhiên bằng tiếng Việt cho người dùng.
5. Trình bày câu trả lời ngắn gọn, trực diện, phù hợp với tin nhắn Zalo/Telegram.
`;

    if (matchedSkill) {
      systemInstruction += `\n\n## QUY TRÌNH KỸ NĂNG CHUYÊN BIỆT (SKILL SOP - ${matchedSkill.name}):\n${matchedSkill.systemPrompt}\n`;
    }

    const userMessageContent = senderName
      ? `<user_info name="${senderName}" />\n<user_query>${userPrompt}</user_query>`
      : `<user_query>${userPrompt}</user_query>`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
    ];

    // Load 6 - 10 recent conversation turns for context in Tool Worker
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const turn of recentHistory) {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.role === 'user' && turn.senderName
            ? `<user_info name="${turn.senderName}" />\n<user_query>${turn.content}</user_query>`
            : turn.content,
        });
      }
    }

    messages.push({ role: 'user', content: userMessageContent });

    let currentStep = 0;
    let finalAnswer = '';

    while (currentStep < maxSteps) {
      currentStep++;

      const completion = await this.openai.chat.completions.create({
        model: this.modelId,
        messages,
        tools: openAiTools.length > 0 ? openAiTools : undefined,
        tool_choice: openAiTools.length > 0 ? 'auto' : 'none',
        temperature: 0.2,
      });

      const message = completion.choices[0]?.message;
      if (!message) break;

      messages.push(message);

      // Check if model wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const toolKey = toolCall.function.name;
          const targetTool = toolMap.get(toolKey);

          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            parsedArgs = {};
          }

          plan.push({
            step: currentStep,
            action: 'CALL_TOOL',
            description: `Calling tool ${toolKey} with arguments: ${toolCall.function.arguments}`,
            toolKey,
            input: parsedArgs,
          });

          if (!targetTool) {
            const errorMsg = `Tool ${toolKey} not found or not authorized.`;
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: errorMsg }),
            });
            continue;
          }

          const targetGroup = toolGroupsMap.get(targetTool.toolGroupId);
          if (!targetGroup) {
            const errorMsg = `ToolGroup for ${toolKey} not found.`;
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: errorMsg }),
            });
            continue;
          }

          const scopedVars = scopedVariablesMap.get(targetGroup.id) || {};

          // Execute tool via HTTP Tool Executor
          const result = await ToolExecutor.execute({
            tool: targetTool,
            group: targetGroup,
            scopedVariables: scopedVars,
            inputParameters: parsedArgs,
          });

          toolExecutions.push(result);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result.responseBody),
          });
        }
      } else {
        // Model provided final text response
        finalAnswer = message.content || '';
        plan.push({
          step: currentStep,
          action: 'SYNTHESIZE',
          description: 'Synthesizing final response for user.',
          output: finalAnswer,
        });
        break;
      }
    }

    if (!finalAnswer && toolExecutions.length > 0) {
      finalAnswer = 'Đã hoàn tất gọi công cụ nhưng chưa có phản hồi tổng hợp.';
    }

    // 2-Phase Agent Pipeline: Nếu có SYNTHESIZER_MODEL_ID (ví dụ: deepseek/deepseek-chat)
    // Chuyển kết quả thô sang Persona Synthesizer Agent để gọt giũa văn phong tiếng Việt cảm xúc
    if (this.synthesizerModelId && (toolExecutions.length > 0 || finalAnswer)) {
      try {
        const polished = await this.synthesizeWithPersona({
          userPrompt,
          senderName,
          toolExecutions,
          rawDraft: finalAnswer,
          conversationHistory,
        });

        if (polished) {
          finalAnswer = polished;
          plan.push({
            step: currentStep + 1,
            action: 'PERSONA_SYNTHESIZE',
            description: `Polished emotional Vietnamese response with Synthesizer Agent (${this.synthesizerModelId}).`,
            output: finalAnswer,
          });
        }
      } catch (synthErr) {
        console.warn('[WorkerAgent] Synthesizer Agent encountered error, falling back to raw output:', synthErr);
      }
    }

    return {
      finalResponse: finalAnswer,
      plan,
      toolCalls: toolExecutions,
    };
  }

  /**
   * Persona Synthesizer Agent: Chuyên trách gọt giũa văn phong, tạo câu trả lời tiếng Việt cảm xúc
   * theo Persona Thảo Chi INOVA (xưng em, gọi anh/chị theo tên thật).
   * Sử dụng 3 - 5 lượt tin nhắn gần nhất để giữ nhịp hội thoại và tránh lặp từ.
   */
  private async synthesizeWithPersona(options: {
    userPrompt: string;
    senderName?: string;
    toolExecutions: ToolExecutionResult[];
    rawDraft: string;
    conversationHistory?: ConversationHistoryMessage[];
  }): Promise<string> {
    const { userPrompt, senderName, toolExecutions, rawDraft, conversationHistory } = options;

    const toolSummaries = toolExecutions.map((t) => ({
      tool: t.toolKey,
      status: t.statusCode,
      result: t.responseBody,
    }));

    const systemInstruction = `${DEFAULT_AGENT_PERSONA}

## NHIỆM VỤ ĐẶC BIỆT CỦA BẠN:
Bạn là Thảo Chi, trợ lý ảo thông minh, nhanh nhẹn và tâm lý của công ty Công Nghệ INOVA.
Nhiệm vụ của bạn là đọc kết quả thô từ các công cụ (Tools) đã thực thi ở bước trước và câu hỏi của người dùng để biên soạn câu trả lời gửi đến người dùng:
1. Luôn giao tiếp bằng tiếng Việt tự nhiên, ấm áp, ngắn gọn, lịch sự, linh hoạt.
2. TUYỆT ĐỐI tuân thủ quy tắc xưng hô: Luôn tự xưng "em" và gọi người dùng là "anh" (nếu là nam hoặc không rõ) hoặc "chị" kèm tên thật của họ (ví dụ: "anh ${senderName || 'Nam'}").
3. Tóm lược rõ ràng các số liệu, kết quả (số tiền, công nợ, ai trả, ai chia...) một cách dễ hiểu, trực diện, không nói vòng vo.
4. Trình bày thoáng, định dạng tin nhắn đẹp mắt, điểm xuyết một vài emoji phù hợp cho khung chat Zalo/Telegram.`;

    let recentHistoryContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentTurns = conversationHistory.slice(-4);
      recentHistoryContext = `\nLịch sử các câu thoại gần nhất:\n${recentTurns
        .map((t) => `${t.role === 'user' ? (senderName || 'Người dùng') : 'Thảo Chi'}: ${t.content}`)
        .join('\n')}\n`;
    }

    const userContent = `Tên người gửi: ${senderName || 'Người dùng'}
${recentHistoryContext}
Tin nhắn yêu cầu hiện tại: "${userPrompt}"
Kết quả thực thi từ hệ thống/công cụ:
${JSON.stringify(toolSummaries, null, 2)}

Bản nháp tóm tắt ban đầu:
${rawDraft || 'Không có'}

Hãy viết lại câu trả lời hoàn chỉnh, tràn đầy cảm xúc và chuẩn mực theo phong cách trợ lý Thảo Chi:`;

    const completion = await this.openai.chat.completions.create({
      model: this.synthesizerModelId!,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() || rawDraft;
  }

  /**
   * Pre-tool Instant Acknowledgement:
   * Khi Router xác định cần gọi tool (thực thi API tốn thời gian),
   * hàm này tạo ngay 1 câu thông báo ngắn gọn qua DeepSeek để gửi trước cho người dùng.
   */
  async generatePreAck(options: {
    userPrompt: string;
    senderName?: string;
    intent?: string;
    suggestedPreAck?: string | null;
  }): Promise<string> {
    const { userPrompt, senderName = 'Người dùng', intent, suggestedPreAck } = options;

    const systemInstruction = `${DEFAULT_AGENT_PERSONA}

## NHIỆM VỤ CỦA BẠN:
Người dùng vừa đưa ra yêu cầu cần thực thi công cụ hoặc tra cứu hệ thống.
Hãy viết NGAY 1 câu phản hồi ngắn gọn (chỉ 1 câu, tối đa 15-20 từ) thông báo rằng em đã nhận được yêu cầu và bảo người dùng chờ em một chút trong khi em tiến hành thực hiện.
Quy tắc:
1. Luôn tự xưng "em", gọi người dùng là "anh ${senderName}" hoặc "chị ${senderName}".
2. Văn phong tự nhiên, ấm áp, thêm emoji phù hợp (ví dụ: ✨, 😊, ạ).
3. ĐI THẲNG VÀO HÀNH ĐỘNG (ví dụ: "Dạ anh ${senderName} chờ em một chút em lưu sổ chi tiêu ngay nhé ạ! ✨", hoặc "Dạ em đang tra cứu cho anh đây ạ!").
4. CHỈ TRẢ VỀ DUY NHẤT 1 CÂU NÓI, không giải thích gì thêm.`;

    const userContent = `Yêu cầu của ${senderName}: "${userPrompt}"
Ý định nhận diện: ${intent || 'Thực thi công cụ'}
Gợi ý ban đầu: ${suggestedPreAck || 'Không có'}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.synthesizerModelId || 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
        temperature: 0.5,
        max_tokens: 60,
      });

      return completion.choices[0]?.message?.content?.trim() || `Dạ anh/chị chờ em một chút em xử lý ngay nhé ạ! ✨`;
    } catch (err) {
      console.warn('[WorkerAgent] Failed to generate pre-ack with DeepSeek, using fallback:', err);
      return `Dạ anh/chị chờ em một chút em kiểm tra và thực hiện ngay nhé ạ! ✨`;
    }
  }
}
