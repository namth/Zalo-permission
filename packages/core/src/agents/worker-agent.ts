import OpenAI from 'openai';
import type {
  ToolDefinition,
  ToolGroupDefinition,
  SkillDefinition,
  ToolExecutionResult,
  ExecutionPlanStep,
} from '../types.js';
import { ToolExecutor } from '../tools/executor.js';

export interface WorkerExecuteOptions {
  userPrompt: string;
  matchedSkill?: SkillDefinition | null;
  tools: ToolDefinition[];
  toolGroupsMap: Map<string, ToolGroupDefinition>; // toolGroupId -> ToolGroupDefinition
  scopedVariablesMap: Map<string, Record<string, string>>; // toolGroupId -> scopedVariables
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

  constructor(apiKey?: string, modelId?: string) {
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

    this.modelId = modelId || process.env.WORKER_MODEL_ID || 'anthropic/claude-3.5-sonnet';
  }

  /**
   * Thực hiện vòng lặp Think -> Plan -> Act (Tool Call) -> Observe -> Final Answer
   */
  async execute(options: WorkerExecuteOptions): Promise<WorkerExecutionResult> {
    const {
      userPrompt,
      matchedSkill,
      tools,
      toolGroupsMap,
      scopedVariablesMap,
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
    let systemInstruction = `You are a helpful and capable Enterprise AI Agent.
You have access to specific external APIs (tools) that have been authorized for this workspace.

EXECUTION INSTRUCTIONS:
1. Think carefully before taking action. If you need data, call the appropriate tool.
2. Never make up or hallucinate API data. Always use the actual data returned from tools.
3. If an API returns an error or empty result, explain politely to the user.
4. Format your final answer concisely and professionally for messaging apps (Telegram / Zalo).
`;

    if (matchedSkill) {
      systemInstruction += `\nSPECIALIZED SKILL SOP (${matchedSkill.name}):\n${matchedSkill.systemPrompt}\n`;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: `<user_query>${userPrompt}</user_query>` },
    ];

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

    return {
      finalResponse: finalAnswer,
      plan,
      toolCalls: toolExecutions,
    };
  }
}
