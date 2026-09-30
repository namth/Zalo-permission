import OpenAI from 'openai';
import type {
  SkillDefinition,
  ToolGroupDefinition,
  ToolDefinition,
  RouterDecision,
  ConversationHistoryMessage,
  QuotedMessageInfo,
} from '../types.js';

export interface RouterAgentOptions {
  userPrompt: string;
  accessibleSkills: SkillDefinition[];
  accessibleToolGroups: ToolGroupDefinition[];
  accessibleTools?: ToolDefinition[];
  conversationHistory?: ConversationHistoryMessage[];
  isGroup?: boolean;
  isWarmSession?: boolean;
  quotedMessage?: QuotedMessageInfo;
  visualSummary?: string;
  openRouterApiKey?: string;
  modelId?: string;
}

export class RouterAgent {
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
        'X-Title': 'OmniAgent Gateway Router',
      },
    });

    this.modelId = modelId || process.env.ROUTER_MODEL_ID || 'google/gemini-2.0-flash-001';
  }

  /**
   * Phân loại ý định người dùng và xác định xem có khớp với Skill nào không.
   * Đồng thời kiểm tra xem tin nhắn có hướng đến Agent không và có cần gọi tool không.
   */
  async classify(options: RouterAgentOptions): Promise<RouterDecision> {
    const {
      userPrompt,
      accessibleSkills,
      accessibleToolGroups,
      accessibleTools,
      conversationHistory,
      isGroup = false,
      isWarmSession = false,
      quotedMessage,
      visualSummary,
    } = options;

    const skillsSummary = accessibleSkills.map((s) => ({
      id: s.id,
      key: s.key,
      name: s.name,
      description: s.description,
      trigger_intents: s.triggerIntents,
    }));

    const toolGroupsSummary = accessibleToolGroups.map((tg) => {
      const groupTools = accessibleTools
        ? accessibleTools
            .filter((t) => t.toolGroupId === tg.id)
            .map((t) => ({ key: t.key, name: t.name, description: t.description }))
        : [];
      return {
        id: tg.id,
        key: tg.key,
        name: tg.name,
        description: tg.description,
        ...(groupTools.length > 0 ? { tools: groupTools } : {}),
      };
    });

    const systemPrompt = `You are a high-speed Intent Classifier & Router for an Enterprise AI Agent platform.
Your task is to analyze the user's prompt and make a routing decision.

AVAILABLE SKILLS in this Workspace:
${JSON.stringify(skillsSummary, null, 2)}

AVAILABLE TOOL GROUPS & TOOLS in this Workspace:
${JSON.stringify(toolGroupsSummary, null, 2)}

CHAT CONTEXT:
- Platform Mode: ${isGroup ? 'GROUP CHAT' : 'DIRECT 1-ON-1 CHAT'}
- Warm Session Active: ${isWarmSession ? 'YES (The user recently talked with you)' : 'NO'}

RULES:
1. If the user's request matches the purpose or trigger intents of any available Skill, set "is_skill_matched": true, and provide "matched_skill_id" and "matched_skill_key".
2. If NO skill matches, check if the user's request requires executing any available Tools or Tool Groups (such as recording an expense, creating a transaction, checking balance or debts, managing members/groups/products, etc.). If so, specify the exact intent and select 1 to 3 "recommended_tool_groups" (by group key) that contain those tools.
3. If the request is purely generic small talk or greetings without any actionable task or data request, set "intent": "chitchat", "is_skill_matched": false, "recommended_tool_groups": [], "requires_tools": false.
4. "requires_tools": Set to true if fulfilling the request requires calling external tools or APIs (expense, debt, balances, database queries).
5. "is_addressed_to_agent":
   - If this is a Group Chat: Determine whether the message is directed to the assistant (Thảo Chi) or if it's casual chatter between other human members. If the user is asking you a question, continuing a task, or giving instructions -> true. If talking to another member or generic chat not requesting anything from the bot -> false.
   - If Direct 1-on-1: Always true.
6. Output STRICT JSON only conforming to the schema:
{
  "intent": "string",
  "is_skill_matched": boolean,
  "matched_skill_id": "string or null",
  "matched_skill_key": "string or null",
  "recommended_tool_groups": ["group_key"],
  "confidence": number between 0 and 1,
  "requires_tools": boolean,
  "is_addressed_to_agent": boolean,
  "suggested_pre_ack": "string or null",
  "extracted_parameters": {}
}`;

    // Enrich query context with recent history, quoted message, and visual evidence
    let userQueryWithContext = '';

    if (quotedMessage && quotedMessage.text) {
      userQueryWithContext += `<quoted_tagged_message from="${quotedMessage.senderName || 'Người khác'}">\n${quotedMessage.text}\n</quoted_tagged_message>\n`;
    }

    if (visualSummary) {
      userQueryWithContext += `<visual_evidence_from_images>\n${visualSummary}\n</visual_evidence_from_images>\n`;
    }

    // Load 3 - 5 most recent history turns to resolve anaphora / follow-up intents
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-4);
      userQueryWithContext += `<recent_conversation_history>\n${recentHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')}\n</recent_conversation_history>\n`;
    }

    userQueryWithContext += `<current_user_query>${userPrompt}</current_user_query>`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQueryWithContext },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      const requiresTools = Boolean(
        parsed.requires_tools ||
        (Array.isArray(parsed.recommended_tool_groups) && parsed.recommended_tool_groups.length > 0 && parsed.intent !== 'chitchat') ||
        parsed.is_skill_matched
      );

      return {
        intent: parsed.intent || 'unknown',
        isSkillMatched: Boolean(parsed.is_skill_matched),
        matchedSkillId: parsed.matched_skill_id || null,
        matchedSkillKey: parsed.matched_skill_key || null,
        recommendedToolGroups: Array.isArray(parsed.recommended_tool_groups)
          ? parsed.recommended_tool_groups
          : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
        requiresTools,
        isAddressedToAgent: typeof parsed.is_addressed_to_agent === 'boolean' ? parsed.is_addressed_to_agent : true,
        suggestedPreAck: parsed.suggested_pre_ack || null,
        extractedParameters: parsed.extracted_parameters || {},
      };
    } catch (error) {
      console.error('[RouterAgent] Classification error:', error);
      // Fallback decision
      return {
        intent: 'fallback_error',
        isSkillMatched: false,
        matchedSkillId: null,
        matchedSkillKey: null,
        recommendedToolGroups: accessibleToolGroups.map((tg) => tg.key),
        confidence: 0.5,
        requiresTools: true,
        isAddressedToAgent: true,
        suggestedPreAck: 'Dạ em đang xử lý cho anh/chị đây ạ!',
        extractedParameters: {},
      };
    }
  }
}
