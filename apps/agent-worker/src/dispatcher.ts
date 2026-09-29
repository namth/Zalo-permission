import {
  RouterAgent,
  WorkerAgent,
  type InboundChatMessage,
  type SkillDefinition,
  type ToolGroupDefinition,
  type ToolDefinition,
  type ToolExecutionResult,
  type ExecutionPlanStep,
} from '@omniagent/core';
import {
  prisma,
  runCypher,
  decryptJson,
} from '@omniagent/database';
import { getRedisClient, OUTBOUND_STREAM } from './redis.js';

export class MessageDispatcher {
  private routerAgent: RouterAgent;
  private workerAgent: WorkerAgent;

  constructor() {
    this.routerAgent = new RouterAgent();
    this.workerAgent = new WorkerAgent();
  }

  /**
   * Xử lý luồng Message từ Inbound Stream
   */
  async dispatch(message: InboundChatMessage): Promise<void> {
    const startTime = Date.now();
    console.log(`[Dispatcher] Processing message from ${message.platform} chat: ${message.platformChatId}`);

    // 1. Resolve Workspace via Neo4j Graph
    const wsLookupQuery = `
      MATCH (c:ChannelChat { platform: $platform, platform_chat_id: $chat_id })-[:BELONGS_TO]->(w:Workspace)
      RETURN w.id AS workspace_id, w.name AS workspace_name
      LIMIT 1
    `;
    const wsResult = await runCypher<{ workspace_id: string; workspace_name: string }>(wsLookupQuery, {
      platform: message.platform,
      chat_id: message.platformChatId,
    });

    let workspaceId = wsResult?.[0]?.workspace_id;

    if (!workspaceId) {
      // Fallback check PostgreSQL in case of Neo4j sync latency or reconnect
      const chatInDb = await prisma.channelChat.findUnique({
        where: {
          platform_platformChatId: {
            platform: message.platform,
            platformChatId: String(message.platformChatId),
          },
        },
        include: { workspace: true },
      });

      if (chatInDb?.workspace) {
        workspaceId = chatInDb.workspace.id;
        // Self-heal Neo4j relationship in background
        runCypher(
          `
          MERGE (c:ChannelChat { id: $chatId })
          SET c.platform = $platform, c.platform_chat_id = $platformChatId, c.title = $title
          WITH c
          MATCH (w:Workspace { id: $workspaceId })
          MERGE (c)-[:BELONGS_TO]->(w)
          `,
          {
            chatId: chatInDb.id,
            platform: message.platform,
            platformChatId: String(message.platformChatId),
            title: chatInDb.title,
            workspaceId: chatInDb.workspace.id,
          }
        ).catch(() => {});
      }
    }

    if (!workspaceId) {
      console.warn(`[Dispatcher] Chat ${message.platformChatId} is not assigned to any Workspace.`);
      await this.sendOutbound(message, 'Nhóm chat này chưa được kích hoạt trong bất kỳ không gian làm việc (Workspace) nào.');
      return;
    }

    // 2. Fetch accessible Skills for this Workspace from Neo4j & Postgres
    const skillsQuery = `
      MATCH (w:Workspace { id: $workspace_id })-[:CAN_USE]->(s:Skill)
      WHERE s.is_active = true
      RETURN s.id AS id
    `;
    const skillNodes = await runCypher<{ id: string }>(skillsQuery, { workspace_id: workspaceId });
    const skillIds = skillNodes.map((s) => s.id);

    const skillsFromDb = await prisma.skill.findMany({
      where: { id: { in: skillIds }, isActive: true },
    });

    const accessibleSkills: SkillDefinition[] = skillsFromDb.map((s) => ({
      id: s.id,
      key: s.key || s.name,
      name: s.name,
      description: s.description,
      systemPrompt: s.systemPrompt,
      triggerIntents: (s.triggerIntents as string[]) || [],
      requiredTools: s.requiredTools,
      isActive: s.isActive,
    }));

    // 3. Fetch accessible Tool Groups & Tools from Neo4j (2-tier permission)
    const toolsQuery = `
      MATCH (w:Workspace { id: $workspace_id })-[:CAN_USE]->(tg:ToolGroup)<-[:PART_OF]-(t:Tool)
      WHERE NOT (w)-[:DISABLED]->(t) AND tg.is_active = true AND t.is_active = true
      RETURN tg.id AS group_id, t.id AS tool_id
      UNION
      MATCH (w:Workspace { id: $workspace_id })-[:CAN_USE]->(t:Tool)-[:PART_OF]->(tg:ToolGroup)
      WHERE tg.is_active = true AND t.is_active = true
      RETURN tg.id AS group_id, t.id AS tool_id
    `;
    const toolRows = await runCypher<{ group_id: string; tool_id: string }>(toolsQuery, {
      workspace_id: workspaceId,
    });

    const toolGroupIds = Array.from(new Set(toolRows.map((r) => r.group_id)));
    const toolIds = Array.from(new Set(toolRows.map((r) => r.tool_id)));

    // Fetch tool groups and tools from Postgres
    const [groupsFromDb, toolsFromDb, scopedConfigsFromDb] = await Promise.all([
      prisma.toolGroup.findMany({ where: { id: { in: toolGroupIds } } }),
      prisma.tool.findMany({ where: { id: { in: toolIds } } }),
      prisma.workspaceToolConfig.findMany({
        where: { workspaceId, toolGroupId: { in: toolGroupIds }, isEnabled: true },
      }),
    ]);

    const toolGroupsMap = new Map<string, ToolGroupDefinition>();
    groupsFromDb.forEach((g) => {
      toolGroupsMap.set(g.id, {
        id: g.id,
        key: g.key,
        name: g.name,
        description: g.description,
        baseUrl: g.baseUrl || '',
        authType: g.authType,
        defaultAuthConfig: (g.defaultAuthConfig as Record<string, unknown>) || {},
        defaultHeaders: (g.defaultHeaders as Record<string, string>) || {},
        requiredVariables: (g.requiredVariables as string[]) || [],
        isActive: g.isActive,
      });
    });

    // Decrypt Scoped Variables per ToolGroup for this Workspace
    const scopedVariablesMap = new Map<string, Record<string, string>>();
    for (const sc of scopedConfigsFromDb) {
      if (sc.encryptedEnvOverrides) {
        try {
          const decryptedVars = decryptJson<Record<string, string>>(sc.encryptedEnvOverrides);
          scopedVariablesMap.set(sc.toolGroupId, decryptedVars);
        } catch (e) {
          console.error(`[Dispatcher] Failed to decrypt env overrides for group ${sc.toolGroupId}:`, e);
        }
      }
    }

    const accessibleTools: ToolDefinition[] = toolsFromDb.map((t) => ({
      id: t.id,
      toolGroupId: t.toolGroupId || '',
      key: t.key,
      name: t.name,
      description: t.description,
      method: (t.method as any) || 'GET',
      path: t.path || '',
      parametersSchema: (t.parametersSchema as Record<string, unknown>) || {},
      bodySchema: (t.bodySchema as Record<string, unknown>) || {},
      responseSchema: (t.responseSchema as Record<string, unknown>) || {},
      isActive: t.isActive,
    }));

    // 4. ROUTER AGENT: Classify user intent & match Skill/Tool Categories
    const routerDecision = await this.routerAgent.classify({
      userPrompt: message.text,
      accessibleSkills,
      accessibleToolGroups: Array.from(toolGroupsMap.values()),
    });

    console.log(`[Dispatcher] Router Decision:`, routerDecision);

    let matchedSkill: SkillDefinition | null = null;
    let filteredTools: ToolDefinition[] = accessibleTools;

    if (routerDecision.isSkillMatched && routerDecision.matchedSkillId) {
      matchedSkill = accessibleSkills.find((s) => s.id === routerDecision.matchedSkillId) || null;
      if (matchedSkill && matchedSkill.requiredTools.length > 0) {
        filteredTools = accessibleTools.filter((t) => matchedSkill?.requiredTools.includes(t.id));
      }
    } else if (routerDecision.recommendedToolGroups.length > 0) {
      // Filter tools belonging to recommended tool groups
      const allowedGroupIds = Array.from(toolGroupsMap.values())
        .filter((g) => routerDecision.recommendedToolGroups.includes(g.key))
        .map((g) => g.id);
      if (allowedGroupIds.length > 0) {
        filteredTools = accessibleTools.filter((t) => allowedGroupIds.includes(t.toolGroupId));
      }
    }

    // 5. WORKER AGENT: Think -> Plan -> Act (Tools) -> Synthesize
    const workerResult = await this.workerAgent.execute({
      userPrompt: message.text,
      matchedSkill,
      tools: filteredTools,
      toolGroupsMap,
      scopedVariablesMap,
    });

    const latencyMs = Date.now() - startTime;

    // 6. Send Response to Outbound Stream
    await this.sendOutbound(message, workerResult.finalResponse);

    // 7. Record Audit Log in PostgreSQL
    try {
      await prisma.auditLog.create({
        data: {
          workspaceId,
          platform: message.platform,
          senderId: message.senderId,
          userPrompt: message.text,
          detectedIntent: routerDecision.intent,
          matchedSkillId: matchedSkill ? matchedSkill.id : null,
          executionPlan: JSON.parse(JSON.stringify(workerResult.plan)),
          toolCalls: JSON.parse(JSON.stringify(this.maskToolCalls(workerResult.toolCalls))),
          finalResponse: workerResult.finalResponse,
          status: 'SUCCESS',
          latencyMs,
        },
      });
      console.log(`[Dispatcher] Audit log saved. Total Latency: ${latencyMs}ms`);
    } catch (logErr) {
      console.error('[Dispatcher] Failed to write audit log:', logErr);
    }
  }

  private async sendOutbound(inbound: InboundChatMessage, text: string): Promise<void> {
    const redis = getRedisClient();
    const payload = {
      platform: inbound.platform,
      accountId: inbound.accountId,
      platformChatId: inbound.platformChatId,
      text,
      timestamp: Date.now(),
    };
    await redis.xadd(OUTBOUND_STREAM, '*', 'data', JSON.stringify(payload));
  }

  private maskToolCalls(calls: ToolExecutionResult[]): ToolExecutionResult[] {
    return calls.map((c) => {
      const maskedHeaders = { ...c.headersSent };
      if (maskedHeaders.Authorization) {
        maskedHeaders.Authorization = 'Bearer *********';
      }
      return {
        ...c,
        headersSent: maskedHeaders,
      };
    });
  }
}
