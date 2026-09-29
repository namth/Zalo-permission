import OpenAI from 'openai';
import type {
  SkillDefinition,
  ToolGroupDefinition,
  ToolDefinition,
  RouterDecision,
  ConversationHistoryMessage,
} from '../types.js';

export interface RouterAgentOptions {
  userPrompt: string;
  accessibleSkills: SkillDefinition[];
  accessibleToolGroups: ToolGroupDefinition[];
  accessibleTools?: ToolDefinition[];
  conversationHistory?: ConversationHistoryMessage[];
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

    this.modelId = modelId || process.env.ROUTER_MODEL_ID || 'google/gemini-2.0-flash';
  }

  /**
   * Phân loại ý định người dùng và xác định xem có khớp với Skill nào không.
   * Nếu không, trả về danh mục Tool Groups liên quan.
   */
  async classify(options: RouterAgentOptions): Promise<RouterDecision> {
    const { userPrompt, accessibleSkills, accessibleToolGroups, accessibleTools, conversationHistory } = options;

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

RULES:
1. If the user's request matches the purpose or trigger intents of any available Skill, set "is_skill_matched": true, and provide "matched_skill_id" and "matched_skill_key".
2. If NO skill matches, check if the user's request requires executing any available Tools or Tool Groups (such as recording an expense, creating a transaction, checking balance or debts, managing members/groups/products, etc.). If so, specify the exact intent and select 1 to 3 "recommended_tool_groups" (by group key) that contain those tools.
3. If the request is purely generic small talk or greetings without any actionable task or data request, set "intent": "chitchat", "is_skill_matched": false, "recommended_tool_groups": [].
4. Output STRICT JSON only conforming to the schema:
{
  "intent": "string",
  "is_skill_matched": boolean,
  "matched_skill_id": "string or null",
  "matched_skill_key": "string or null",
  "recommended_tool_groups": ["group_key"],
  "confidence": number between 0 and 1,
  "extracted_parameters": {}
}`;

    // Load 3 - 5 most recent history turns to resolve anaphora / follow-up intents
    let userQueryWithContext = '';
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

      return {
        intent: parsed.intent || 'unknown',
        isSkillMatched: Boolean(parsed.is_skill_matched),
        matchedSkillId: parsed.matched_skill_id || null,
        matchedSkillKey: parsed.matched_skill_key || null,
        recommendedToolGroups: Array.isArray(parsed.recommended_tool_groups)
          ? parsed.recommended_tool_groups
          : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
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
        extractedParameters: {},
      };
    }
  }
}
