import { randomUUID } from 'crypto';
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
    console.log(`[Dispatcher] Processing message from ${message.platform} chat: ${message.platformChatId} by user: ${message.senderName || message.senderId}`);

    // 1. Resolve Workspace via Neo4j Graph (ChannelChat or ZaloGroup)
    const wsLookupQuery = `
      MATCH (c:ChannelChat { platform: $platform, platform_chat_id: $chat_id })-[:BELONGS_TO]->(w:Workspace)
      RETURN w.id AS workspace_id, w.name AS workspace_name
      UNION
      MATCH (g:ZaloGroup { thread_id: $chat_id })-[:BELONGS_TO]->(w:Workspace)
      RETURN w.id AS workspace_id, w.name AS workspace_name
      LIMIT 1
    `;
    const wsResult = await runCypher<{ workspace_id: string; workspace_name: string }>(wsLookupQuery, {
      platform: message.platform,
      chat_id: String(message.platformChatId),
    }).catch((e) => {
      console.warn('[Dispatcher] Neo4j workspace lookup notice:', e);
      return [];
    });

    let workspaceId = wsResult?.[0]?.workspace_id;

    if (!workspaceId) {
      // Fallback check PostgreSQL channel_chats
      let chatInDb = await prisma.channelChat.findUnique({
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
      } else if (message.platform === 'ZALO') {
        // Fallback check zalo_groups table
        const zaloGroup = await prisma.$queryRaw<Array<{ id: string; workspace_id: string; name: string }>>`
          SELECT id, workspace_id, name FROM zalo_groups WHERE thread_id = ${String(message.platformChatId)} LIMIT 1
        `.catch(() => []);

        if (zaloGroup?.[0]?.workspace_id) {
          workspaceId = zaloGroup[0].workspace_id;
          // Auto-link channelChat to this workspace in PostgreSQL
          try {
            if (chatInDb) {
              await prisma.channelChat.update({
                where: { id: chatInDb.id },
                data: { workspaceId },
              });
            }
          } catch (e) {
            console.warn('[Dispatcher] Failed to link channelChat to workspace in DB:', e);
          }
        }
      }

      if (workspaceId) {
        // Self-heal Neo4j relationship in background
        runCypher(
          `
          MERGE (c:ChannelChat { platform: $platform, platform_chat_id: $platformChatId })
          ON CREATE SET c.id = randomUUID(), c.title = $title
          WITH c
          MATCH (w:Workspace { id: $workspaceId })
          MERGE (c)-[:BELONGS_TO]->(w)
          `,
          {
            platform: message.platform,
            platformChatId: String(message.platformChatId),
            title: chatInDb?.title || 'Chat Group',
            workspaceId,
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
      description: s.description || '',
      systemPrompt: s.systemPrompt || '',
      triggerIntents: (s.triggerIntents as string[]) || [],
      requiredTools: s.requiredTools,
      isActive: s.isActive,
    }));

    // 3. Fetch accessible Tool Groups & Tools from Neo4j (resilient 2-tier permission)
    const toolsQuery = `
      MATCH (w:Workspace { id: $workspace_id })
      OPTIONAL MATCH (w)-[:CAN_USE]->(dt:Tool)
      OPTIONAL MATCH (w)-[:CAN_USE]->(tg:ToolGroup)
      OPTIONAL MATCH (w)-[:CAN_USE]->(tgGroup:ToolGroup)<-[:BELONGS_TO_GROUP|PART_OF|CONTAINS]-(groupTool:Tool)
      OPTIONAL MATCH (w)-[:DISABLED]->(disabledTool:Tool)
      RETURN 
        collect(DISTINCT coalesce(dt.id, dt.key)) AS direct_tool_refs,
        collect(DISTINCT coalesce(tg.id, tg.key)) AS explicit_group_refs,
        collect(DISTINCT coalesce(groupTool.id, groupTool.key)) AS group_tool_refs,
        collect(DISTINCT coalesce(disabledTool.id, disabledTool.key)) AS disabled_tool_refs
    `;
    const neoRows = await runCypher<{
      direct_tool_refs: string[];
      explicit_group_refs: string[];
      group_tool_refs: string[];
      disabled_tool_refs: string[];
    }>(toolsQuery, { workspace_id: workspaceId });

    const neoResult = neoRows[0] || {
      direct_tool_refs: [],
      explicit_group_refs: [],
      group_tool_refs: [],
      disabled_tool_refs: [],
    };

    const directToolRefs = (neoResult.direct_tool_refs || []).filter(Boolean);
    const explicitGroupRefs = (neoResult.explicit_group_refs || []).filter(Boolean);
    const groupToolRefs = (neoResult.group_tool_refs || []).filter(Boolean);
    const disabledToolRefs = new Set((neoResult.disabled_tool_refs || []).filter(Boolean));

    const combinedToolRefs = Array.from(new Set([...directToolRefs, ...groupToolRefs]));

    // Query explicit ToolGroups if any
    let explicitGroupsFromDb: any[] = [];
    if (explicitGroupRefs.length > 0) {
      explicitGroupsFromDb = await prisma.toolGroup.findMany({
        where: {
          OR: [
            { id: { in: explicitGroupRefs } },
            { key: { in: explicitGroupRefs } },
          ],
          isActive: true,
        },
      });
    }

    const explicitGroupIds = explicitGroupsFromDb.map((g) => g.id);

    // Fetch accessible tools from Postgres
    const toolOrConditions: any[] = [];
    if (combinedToolRefs.length > 0) {
      toolOrConditions.push({ id: { in: combinedToolRefs } });
      toolOrConditions.push({ key: { in: combinedToolRefs } });
    }
    if (explicitGroupIds.length > 0) {
      toolOrConditions.push({ toolGroupId: { in: explicitGroupIds } });
    }

    let toolsFromDb: any[] = [];
    if (toolOrConditions.length > 0) {
      const candidateTools = await prisma.tool.findMany({
        where: {
          OR: toolOrConditions,
          isActive: true,
        },
      });

      // Filter out disabled tools
      toolsFromDb = candidateTools.filter(
        (t) => !disabledToolRefs.has(t.id) && !disabledToolRefs.has(t.key)
      );
    }

    // Collect all unique toolGroupIds needed by the accessible tools + explicit groups
    const allToolGroupIds = Array.from(
      new Set([
        ...explicitGroupIds,
        ...toolsFromDb.map((t) => t.toolGroupId).filter((id): id is string => Boolean(id)),
      ])
    );

    // Fetch tool groups and workspace configs from Postgres
    const [groupsFromDb, scopedConfigsFromDb] = await Promise.all([
      prisma.toolGroup.findMany({
        where: { id: { in: allToolGroupIds }, isActive: true },
      }),
      prisma.workspaceToolConfig.findMany({
        where: { workspaceId, toolGroupId: { in: allToolGroupIds } },
      }),
    ]);

    const toolGroupsMap = new Map<string, ToolGroupDefinition>();
    groupsFromDb.forEach((g: any) => {
      toolGroupsMap.set(g.id, {
        id: g.id,
        key: g.key,
        name: g.name,
        description: g.description,
        protocolType: g.protocolType || 'REST',
        baseUrl: g.baseUrl || '',
        mcpTransport: g.mcpTransport || 'SSE',
        mcpRawConfig: (g.mcpRawConfig as Record<string, unknown>) || null,
        timeoutSeconds: g.timeoutSeconds || 15,
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
      accessibleTools,
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
    } else if (routerDecision.intent === 'chitchat') {
      filteredTools = [];
    }

    // 5. WORKER AGENT: Think -> Plan -> Act (Tools) -> Synthesize
    const workerResult = await this.workerAgent.execute({
      userPrompt: message.text,
      senderName: message.senderName,
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
          id: randomUUID(),
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
