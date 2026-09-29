import OpenAI from 'openai';
import { query } from '@/lib/db';
import { neo4jClient } from '@/lib/neo4j';
import { McpConfigParser, McpToolExecutor } from '@omniagent/core';
import { ToolSyncService, ToolGroupSyncService } from '@/services/sync.service';
import { addToolToWorkspace, removeToolFromWorkspace } from '@/services/workspace.service';
import { logAuditAction } from '@/services/audit.service';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CopilotActionPreview {
  action_id: string;
  action_type: 
    | 'IMPORT_MCP_SERVER'
    | 'ASSIGN_TOOL_TO_WORKSPACE'
    | 'ASSIGN_TOOL_GROUP_TO_WORKSPACE'
    | 'REMOVE_TOOL_FROM_WORKSPACE'
    | 'CREATE_SKILL'
    | 'SYNC_MCP_TOOLS'
    | 'DELETE_TOOL_GROUP'
    | 'DELETE_TOOL';
  summary: string;
  details?: Record<string, any>;
  parameters: Record<string, any>;
}

export interface CopilotChatResponse {
  reply: string;
  action_preview?: CopilotActionPreview;
}

export class CopilotService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY || '';
    const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    this.openai = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'https://zalo.oa.io.vn',
        'X-Title': 'OmniAgent Admin Copilot',
      },
    });

    this.model = process.env.COPILOT_MODEL_ID || process.env.WORKER_MODEL_ID || 'anthropic/claude-3.5-sonnet';
  }

  /**
   * System Prompt định hướng cho Copilot
   */
  private getSystemPrompt(): string {
    return `Bạn là "OmniAgent Admin Copilot" - Trợ lý AI cấp cao chuyên trách hỗ trợ quản trị viên quản lý hệ sinh thái phân quyền Zalo và Telegram.
Hệ thống sử dụng cơ sở dữ liệu kết hợp PostgreSQL (dữ liệu nghiệp vụ) và Neo4j (đồ thị phân quyền RBAC đa chiều).

Nhiệm vụ của bạn:
1. Hỗ trợ tra cứu thông tin Workspace, Tool Groups, Tools, Skills, và Audit Logs.
2. Khi người dùng muốn thực hiện hành động làm thay đổi dữ liệu (Thêm MCP Server, Gán quyền Workspace, Dạy Skill mới, Xóa/Thu hồi quyền, Đồng bộ Tool):
   - Bạn PHẢI tra cứu trước thông tin (như ID của Workspace hoặc ToolGroup) nếu chưa rõ.
   - Bạn KHÔNG được tự ý thực thi ngay các hành động ghi/sửa/xóa, mà PHẢI gọi các tool "propose_*" tương ứng để tạo Action Preview Card cho Admin bấm xác nhận.
3. Khi người dùng muốn xóa Tool Group hoặc Tool cá nhân:
   - Hãy tra cứu trước (dùng list_tool_groups hoặc list_tools_in_group) để lấy thông tin ID/Key chính xác.
   - Nhắc nhở người dùng rằng xóa Tool Group sẽ cascade xóa toàn bộ các tools thuộc nhóm đó trong cả PostgreSQL và Neo4j.
   - PHẢI gọi tool "propose_delete_tool_group" hoặc "propose_delete_tool" để tạo Action Preview Card cho Admin xác nhận trước khi thực hiện xóa vĩnh viễn.
4. Trả lời bằng tiếng Việt chuyên nghiệp, ngắn gọn, súc tích và có cấu trúc rõ ràng.

Quy tắc:
- Khi người dùng gửi link MCP hoặc JSON mcpServers: hãy dùng tool "inspect_mcp_source" để kiểm tra trước, sau đó đề xuất "propose_import_mcp".
- Khi người dùng muốn gán tool vào workspace: tra cứu danh sách workspace ("list_workspaces") và danh sách tools ("list_tool_groups" hoặc "list_tools_in_group"), sau đó gọi "propose_assign_tool_to_workspace" hoặc "propose_assign_tool_group_to_workspace".
- Khi người dùng yêu cầu xóa tool group hoặc tool: tìm kiếm ID/Key và gọi "propose_delete_tool_group" hoặc "propose_delete_tool".`;
  }

  /**
   * Khai báo danh mục Tools cho OpenAI Function Calling
   */
  private getToolDeclarations(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return [
      // 1. READ TOOLS
      {
        type: 'function',
        function: {
          name: 'list_workspaces',
          description: 'Lấy danh sách tất cả các Workspaces hiện có trong hệ thống (ID, tên, trạng thái).',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_tool_groups',
          description: 'Lấy danh sách tất cả các Tool Groups (nhóm công cụ) trong hệ thống, bao gồm giao thức (MCP/REST) và mô tả.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_tools_in_group',
          description: 'Lấy danh sách các công cụ (Tools) thuộc một ToolGroup cụ thể.',
          parameters: {
            type: 'object',
            properties: {
              group_id_or_key: { type: 'string', description: 'ID (UUID) hoặc Key của ToolGroup' },
            },
            required: ['group_id_or_key'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_workspace_details',
          description: 'Lấy chi tiết cấu hình của một Workspace bao gồm các công cụ đã được cấp quyền, kỹ năng (Skills) và kênh chat.',
          parameters: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string', description: 'ID (UUID) của Workspace' },
            },
            required: ['workspace_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'inspect_mcp_source',
          description: 'Khảo sát và trích xuất danh sách công cụ từ URL MCP Server hoặc JSON mcpServers.',
          parameters: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'URL endpoint của MCP server hoặc chuỗi JSON config' },
            },
            required: ['source'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_recent_audit_logs',
          description: 'Lấy danh sách các nhật ký kiểm toán (Audit Logs) gần đây của hệ thống.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Số lượng log (mặc định 10, tối đa 30)' },
              workspace_id: { type: 'string', description: 'Lọc theo ID Workspace (tùy chọn)' },
            },
          },
        },
      },

      // 2. PROPOSE ACTION TOOLS (MUTATIONS)
      {
        type: 'function',
        function: {
          name: 'propose_import_mcp',
          description: 'Đề xuất nạp một MCP Server vào kho công cụ của hệ thống.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tên hiển thị của Tool Group' },
              key: { type: 'string', description: 'Mã định danh duy nhất (chữ thường, gạch dưới)' },
              url: { type: 'string', description: 'URL endpoint của MCP Server' },
              transport: { type: 'string', enum: ['SSE', 'STREAMABLE_HTTP', 'DIRECT_HTTP'], description: 'Giao thức truyền dẫn' },
              raw_config: { type: 'string', description: 'Cấu hình JSON thô (nếu có)' },
              selected_tools: {
                type: 'array',
                description: 'Danh sách các tool cần nạp',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    parameters_schema: { type: 'object' },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['name', 'key', 'url', 'selected_tools'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_assign_tool_to_workspace',
          description: 'Đề xuất gán quyền sử dụng một Tool cụ thể cho một Workspace.',
          parameters: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string', description: 'ID của Workspace' },
              workspace_name: { type: 'string', description: 'Tên của Workspace' },
              tool_id: { type: 'string', description: 'ID của Tool' },
              tool_name: { type: 'string', description: 'Tên của Tool' },
              tool_key: { type: 'string', description: 'Key của Tool' },
            },
            required: ['workspace_id', 'tool_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_assign_tool_group_to_workspace',
          description: 'Đề xuất gán toàn bộ các Tool trong một Tool Group cho một Workspace.',
          parameters: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string', description: 'ID của Workspace' },
              workspace_name: { type: 'string', description: 'Tên của Workspace' },
              tool_group_id: { type: 'string', description: 'ID của ToolGroup' },
              tool_group_name: { type: 'string', description: 'Tên của ToolGroup' },
            },
            required: ['workspace_id', 'tool_group_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_remove_tool_from_workspace',
          description: 'Đề xuất thu hồi quyền sử dụng một Tool khỏi Workspace.',
          parameters: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string', description: 'ID của Workspace' },
              workspace_name: { type: 'string', description: 'Tên của Workspace' },
              tool_id: { type: 'string', description: 'ID của Tool' },
              tool_name: { type: 'string', description: 'Tên của Tool' },
            },
            required: ['workspace_id', 'tool_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_create_skill',
          description: 'Đề xuất tạo một Skill mới cho AI Agent.',
          parameters: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Mã định danh của Skill (chữ thường, gạch nối)' },
              name: { type: 'string', description: 'Tên hiển thị của Skill' },
              description: { type: 'string', description: 'Mô tả ngắn gọn về kỹ năng' },
              system_prompt: { type: 'string', description: 'System prompt hướng dẫn AI khi kích hoạt skill này' },
              workspace_id: { type: 'string', description: 'ID Workspace cần liên kết ngay (tùy chọn)' },
            },
            required: ['key', 'name', 'system_prompt'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_sync_mcp_tools',
          description: 'Đề xuất đồng bộ lại danh sách công cụ từ remote server cho một nhóm MCP ToolGroup.',
          parameters: {
            type: 'object',
            properties: {
              tool_group_id: { type: 'string', description: 'ID của ToolGroup' },
              tool_group_name: { type: 'string', description: 'Tên của ToolGroup' },
            },
            required: ['tool_group_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_delete_tool_group',
          description: 'Đề xuất xóa vĩnh viễn một nhóm công cụ (ToolGroup) và CASCADE xóa toàn bộ các tools trực thuộc trong hệ thống (PostgreSQL và Neo4j).',
          parameters: {
            type: 'object',
            properties: {
              tool_group_id_or_key: { type: 'string', description: 'ID (UUID) hoặc Key của ToolGroup cần xóa' },
              tool_group_name: { type: 'string', description: 'Tên của ToolGroup' },
            },
            required: ['tool_group_id_or_key'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_delete_tool',
          description: 'Đề xuất xóa vĩnh viễn một công cụ (Tool) cá nhân khỏi hệ thống (PostgreSQL và Neo4j) và gỡ quyền khỏi các Workspace.',
          parameters: {
            type: 'object',
            properties: {
              tool_id_or_key: { type: 'string', description: 'ID (UUID) hoặc Key của Tool cần xóa' },
              tool_name: { type: 'string', description: 'Tên hiển thị của Tool' },
            },
            required: ['tool_id_or_key'],
          },
        },
      },
    ];
  }

  /**
   * Xử lý thực thi READ TOOLS
   */
  private async executeReadTool(name: string, args: any): Promise<any> {
    try {
      if (name === 'list_workspaces') {
        const res = await query('SELECT id, name, status, description, created_at FROM workspaces ORDER BY name ASC LIMIT 50');
        return res.rows;
      }

      if (name === 'list_tool_groups') {
        const res = await query(`
          SELECT tg.id, tg.key, tg.name, tg.protocol_type, tg.base_url, tg.status,
                 COUNT(t.id)::int as tools_count
          FROM tool_groups tg
          LEFT JOIN tools t ON t.tool_group_id = tg.id
          GROUP BY tg.id
          ORDER BY tg.name ASC
        `);
        return res.rows;
      }

      if (name === 'list_tools_in_group') {
        const { group_id_or_key } = args;
        const res = await query(
          `SELECT t.id, t.key, t.name, t.description, t.status 
           FROM tools t
           JOIN tool_groups tg ON t.tool_group_id = tg.id
           WHERE tg.id::text = $1 OR tg.key = $1
           ORDER BY t.name ASC`,
          [group_id_or_key]
        );
        return res.rows;
      }

      if (name === 'get_workspace_details') {
        const { workspace_id } = args;
        const wsRes = await query('SELECT id, name, status, description FROM workspaces WHERE id = $1', [workspace_id]);
        if (wsRes.rows.length === 0) return { error: 'Workspace không tồn tại' };

        // Tools in Workspace via Neo4j
        const toolsNeoRes = await neo4jClient.run(
          `MATCH (w:Workspace {id: $workspace_id})-[:CAN_USE]->(t:Tool)
           RETURN t.id AS id, t.key AS key, t.name AS name`,
          { workspace_id }
        );
        const tools = toolsNeoRes.records.map(r => ({ id: r.get('id'), key: r.get('key'), name: r.get('name') }));

        // Channels in Workspace
        const channelsRes = await query('SELECT id, platform, chat_id, title FROM channel_chats WHERE workspace_id = $1', [workspace_id]);

        return {
          workspace: wsRes.rows[0],
          assigned_tools: tools,
          channels: channelsRes.rows,
        };
      }

      if (name === 'inspect_mcp_source') {
        const { source } = args;
        const parsed = McpConfigParser.parse(source);
        const tools = await McpToolExecutor.listTools({
          endpointUrl: parsed.targetUrl,
          authHeaders: parsed.headers,
          timeoutMs: 15000,
        });

        return {
          server_name: parsed.serverName,
          target_url: parsed.targetUrl,
          transport: parsed.transport,
          total_tools: tools.length,
          tools: tools.map((t: any) => ({ name: t.name, description: t.description })),
          raw_snippet: parsed.rawSnippet,
        };
      }

      if (name === 'get_recent_audit_logs') {
        const limit = Math.min(args.limit || 10, 30);
        let q = 'SELECT id, action_type, status, user_id, workspace_id, created_at, error_message FROM audit_logs';
        const params: any[] = [];
        if (args.workspace_id) {
          q += ' WHERE workspace_id = $1';
          params.push(args.workspace_id);
        }
        q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const res = await query(q, params);
        return res.rows;
      }

      return { error: `Tool ${name} không tồn tại` };
    } catch (err: any) {
      logger.error(`[Copilot ReadTool Error] ${name}: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Xử lý Chat chính (Multi-turn Tool Calling)
   */
  async chat(messages: CopilotMessage[]): Promise<CopilotChatResponse> {
    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const tools = this.getToolDeclarations();

    // Vòng lặp cho phép model gọi read tools tối đa 4 bước trước khi trả lời
    let iterations = 0;
    while (iterations < 4) {
      iterations++;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: formattedMessages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
      });

      const choice = completion.choices[0];
      const message = choice.message;

      // Nếu không có tool_calls, trả lời trực tiếp
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          reply: message.content || 'Tôi đã xử lý yêu cầu của bạn.',
        };
      }

      // Đưa tin nhắn của assistant vào hội thoại
      formattedMessages.push(message);

      // Duyệt qua các tool calls
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          fnArgs = {};
        }

        // Nếu là tool đề xuất hành động (PROPOSE), dừng lại và trả về Action Preview Card
        if (fnName.startsWith('propose_')) {
          const actionPreview = this.buildActionPreview(fnName, fnArgs);
          return {
            reply: message.content || 'Tôi đã lên kế hoạch thực hiện thao tác sau đây. Vui lòng kiểm tra và xác nhận:',
            action_preview: actionPreview,
          };
        }

        // Nếu là READ tool, thực thi và đưa kết quả vào messages để LLM suy luận tiếp
        const toolResult = await this.executeReadTool(fnName, fnArgs);
        formattedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    return {
      reply: 'Quá trình phân tích hoàn tất.',
    };
  }

  /**
   * Tạo Action Preview Card từ propose tool arguments
   */
  private buildActionPreview(toolName: string, args: any): CopilotActionPreview {
    const actionId = `act_${randomUUID().substring(0, 8)}`;

    switch (toolName) {
      case 'propose_import_mcp':
        return {
          action_id: actionId,
          action_type: 'IMPORT_MCP_SERVER',
          summary: `Thêm MCP Server "${args.name}" (${args.key}) từ URL: ${args.url} với ${args.selected_tools?.length || 0} công cụ.`,
          details: {
            'Tên nhóm': args.name,
            'Mã nhóm': args.key,
            'Endpoint URL': args.url,
            'Số lượng Tool': args.selected_tools?.length || 0,
            'Giao thức': args.transport || 'SSE',
          },
          parameters: args,
        };

      case 'propose_assign_tool_to_workspace':
        return {
          action_id: actionId,
          action_type: 'ASSIGN_TOOL_TO_WORKSPACE',
          summary: `Cấp quyền Tool "${args.tool_name || args.tool_id}" cho Workspace "${args.workspace_name || args.workspace_id}".`,
          details: {
            'Workspace': args.workspace_name || args.workspace_id,
            'Tool': args.tool_name || args.tool_id,
            'Mã Tool': args.tool_key || '—',
          },
          parameters: args,
        };

      case 'propose_assign_tool_group_to_workspace':
        return {
          action_id: actionId,
          action_type: 'ASSIGN_TOOL_GROUP_TO_WORKSPACE',
          summary: `Gán toàn bộ các công cụ của nhóm "${args.tool_group_name || args.tool_group_id}" cho Workspace "${args.workspace_name || args.workspace_id}".`,
          details: {
            'Workspace': args.workspace_name || args.workspace_id,
            'Tool Group': args.tool_group_name || args.tool_group_id,
          },
          parameters: args,
        };

      case 'propose_remove_tool_from_workspace':
        return {
          action_id: actionId,
          action_type: 'REMOVE_TOOL_FROM_WORKSPACE',
          summary: `Thu hồi quyền sử dụng Tool "${args.tool_name || args.tool_id}" khỏi Workspace "${args.workspace_name || args.workspace_id}".`,
          details: {
            'Workspace': args.workspace_name || args.workspace_id,
            'Tool cần gỡ': args.tool_name || args.tool_id,
          },
          parameters: args,
        };

      case 'propose_create_skill':
        return {
          action_id: actionId,
          action_type: 'CREATE_SKILL',
          summary: `Tạo Skill mới "${args.name}" (${args.key}) cho Agent.`,
          details: {
            'Tên Skill': args.name,
            'Key': args.key,
            'Mô tả': args.description || 'Không có mô tả',
            'Gán vào Workspace': args.workspace_id ? args.workspace_id : 'Chưa gán',
          },
          parameters: args,
        };

      case 'propose_sync_mcp_tools':
        return {
          action_id: actionId,
          action_type: 'SYNC_MCP_TOOLS',
          summary: `Kích hoạt đồng bộ công cụ từ remote server cho ToolGroup "${args.tool_group_name || args.tool_group_id}".`,
          details: {
            'Tool Group ID': args.tool_group_id,
            'Tên nhóm': args.tool_group_name || '—',
          },
          parameters: args,
        };

      case 'propose_delete_tool_group':
        return {
          action_id: actionId,
          action_type: 'DELETE_TOOL_GROUP',
          summary: `⚠️ CẢNH BÁO NGUY HIỂM: Xóa nhóm công cụ "${args.tool_group_name || args.tool_group_id_or_key}". Toàn bộ các công cụ (tools) trực thuộc nhóm này sẽ bị XÓA SẠCH vĩnh viễn khỏi hệ thống và gỡ khỏi tất cả workspace!`,
          details: {
            'Nhóm cần xóa': args.tool_group_name || args.tool_group_id_or_key,
            'Mã / ID': args.tool_group_id_or_key,
            'Phạm vi': 'CASCADE DELETE (Xóa sạch toàn bộ Tool liên quan)',
          },
          parameters: args,
        };

      case 'propose_delete_tool':
        return {
          action_id: actionId,
          action_type: 'DELETE_TOOL',
          summary: `⚠️ Xóa vĩnh viễn công cụ "${args.tool_name || args.tool_id_or_key}" khỏi hệ thống. Công cụ này sẽ bị xóa khỏi PostgreSQL, đồ thị Neo4j và bị gỡ khỏi tất cả Workspace đã gán.`,
          details: {
            'Công cụ cần xóa': args.tool_name || args.tool_id_or_key,
            'Mã / ID': args.tool_id_or_key,
            'Phạm vi': 'Xóa đơn lẻ và thu hồi mọi quyền truy cập',
          },
          parameters: args,
        };

      default:
        return {
          action_id: actionId,
          action_type: 'ASSIGN_TOOL_TO_WORKSPACE',
          summary: `Thực thi thao tác ${toolName}`,
          parameters: args,
        };
    }
  }

  /**
   * Thực thi hành động khi Admin bấm Xác nhận
   */
  async executeAction(
    actionType: CopilotActionPreview['action_type'],
    params: Record<string, any>,
    adminUserId: string = 'system_admin'
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (actionType === 'IMPORT_MCP_SERVER') {
        const { name, key, url, transport = 'SSE', raw_config, selected_tools } = params;

        // Gọi import MCP logic
        const sanitizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const groupId = randomUUID();

        // 1. Tạo Tool Group
        const groupRes = await query(
          `INSERT INTO tool_groups (
            id, key, name, description, protocol_type, base_url, mcp_transport,
            mcp_raw_config, status, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, 'MCP', $5, $6, $7, 'active', true, NOW(), NOW())
          ON CONFLICT (key) DO UPDATE SET
            name = EXCLUDED.name,
            protocol_type = 'MCP',
            base_url = EXCLUDED.base_url,
            updated_at = NOW()
          RETURNING id, key, name`,
          [
            groupId,
            sanitizedKey,
            name.trim(),
            params.description || `MCP Server ${name}`,
            url.trim(),
            transport,
            raw_config ? JSON.stringify(raw_config) : null,
          ]
        );
        const group = groupRes.rows[0];

        // 2. Neo4j ToolGroup
        await neo4jClient.run(
          `MERGE (tg:ToolGroup { key: $key })
           SET tg.id = $id, tg.name = $name, tg.protocol = 'MCP', tg.updated_at = timestamp()
           RETURN tg`,
          { id: group.id, key: group.key, name: group.name }
        );

        // 3. Thêm Tools con
        let addedToolsCount = 0;
        for (const tool of selected_tools) {
          const rawName = tool.name || tool.key;
          if (!rawName) continue;

          const toolKey = `${sanitizedKey}_${rawName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
          const toolDesc = tool.description || `Tool ${rawName} from ${name}`;
          const schema = tool.parameters_schema || tool.inputSchema || { type: 'object', properties: {} };
          const toolId = randomUUID();

          const toolPg = await query(
            `INSERT INTO tools (
              id, key, name, description, tool_group_id, method, path,
              parameters_schema, input_schema, status, is_active, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'POST'::"HttpMethod", '/call', $6, $6, 'active', true, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET
              name = EXCLUDED.name,
              tool_group_id = EXCLUDED.tool_group_id,
              parameters_schema = EXCLUDED.parameters_schema,
              input_schema = EXCLUDED.input_schema,
              updated_at = NOW()
            RETURNING id, key, name`,
            [toolId, toolKey, rawName, toolDesc, group.id, JSON.stringify(schema)]
          );
          const t = toolPg.rows[0];

          await neo4jClient.run(
            `MERGE (t:Tool { key: $key })
             SET t.id = $id, t.name = $name, t.updated_at = timestamp()
             WITH t
             MATCH (tg:ToolGroup { id: $groupId })
             MERGE (tg)-[:CONTAINS]->(t)
             MERGE (t)-[:BELONGS_TO_GROUP]->(tg)
             RETURN t`,
            { id: t.id, key: t.key, name: t.name, groupId: group.id }
          );
          addedToolsCount++;
        }

        await logAuditAction(
          null,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'IMPORT_MCP_SERVER', group_key: sanitizedKey },
          { group_id: group.id, tools_count: addedToolsCount },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã nhập thành công MCP Server "${name}" với ${addedToolsCount} công cụ!`,
          data: { group_id: group.id, tools_count: addedToolsCount },
        };
      }

      if (actionType === 'ASSIGN_TOOL_TO_WORKSPACE') {
        const { workspace_id, tool_id } = params;
        await addToolToWorkspace(workspace_id, tool_id, adminUserId);

        await logAuditAction(
          workspace_id,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'ASSIGN_TOOL_TO_WORKSPACE', tool_id },
          { workspace_id, tool_id },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã cấp quyền sử dụng Tool thành công cho Workspace!`,
          data: { workspace_id, tool_id },
        };
      }

      if (actionType === 'ASSIGN_TOOL_GROUP_TO_WORKSPACE') {
        const { workspace_id, tool_group_id } = params;

        // Lấy tất cả tools thuộc group
        const toolsRes = await query('SELECT id, key, name FROM tools WHERE tool_group_id = $1', [tool_group_id]);
        if (toolsRes.rows.length === 0) {
          throw new Error('Không tìm thấy tool nào trong ToolGroup này');
        }

        let assignedCount = 0;
        for (const t of toolsRes.rows) {
          await addToolToWorkspace(workspace_id, t.id, adminUserId);
          assignedCount++;
        }

        await logAuditAction(
          workspace_id,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'ASSIGN_TOOL_GROUP_TO_WORKSPACE', tool_group_id, tools_count: assignedCount },
          { workspace_id, tool_group_id, assigned_tools: assignedCount },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã gán thành công toàn bộ ${assignedCount} công cụ vào Workspace!`,
          data: { workspace_id, assignedCount },
        };
      }

      if (actionType === 'REMOVE_TOOL_FROM_WORKSPACE') {
        const { workspace_id, tool_id } = params;
        await removeToolFromWorkspace(workspace_id, tool_id, adminUserId);

        await logAuditAction(
          workspace_id,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'REMOVE_TOOL_FROM_WORKSPACE', tool_id },
          { workspace_id, tool_id },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã thu hồi quyền sử dụng Tool khỏi Workspace thành công!`,
          data: { workspace_id, tool_id },
        };
      }

      if (actionType === 'CREATE_SKILL') {
        const { key, name, description, system_prompt, workspace_id } = params;
        const skillId = randomUUID();

        const skillRes = await query(
          `INSERT INTO skills (id, key, name, description, detail, status, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', true, NOW(), NOW())
           RETURNING id, key, name`,
          [skillId, key, name, description || null, system_prompt]
        );
        const skill = skillRes.rows[0];

        // Neo4j Skill Node
        await neo4jClient.run(
          `MERGE (s:Skill { id: $id })
           SET s.key = $key, s.name = $name, s.systemPrompt = $systemPrompt, s.updated_at = timestamp()
           RETURN s`,
          { id: skill.id, key: skill.key, name: skill.name, systemPrompt: system_prompt }
        );

        // Gán vào Workspace nếu có
        if (workspace_id) {
          await neo4jClient.run(
            `MATCH (w:Workspace { id: $workspace_id })
             MATCH (s:Skill { id: $skill_id })
             MERGE (w)-[:CAN_USE]->(s)
             RETURN w`,
            { workspace_id, skill_id: skill.id }
          );
        }

        await logAuditAction(
          workspace_id || null,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'CREATE_SKILL', key, name },
          { skill_id: skill.id, workspace_id },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã tạo Skill mới "${name}" thành công!${workspace_id ? ' Đã gán vào Workspace.' : ''}`,
          data: { skill_id: skill.id },
        };
      }

      if (actionType === 'SYNC_MCP_TOOLS') {
        const { tool_group_id } = params;
        // Gọi sync logic
        const groupRes = await query('SELECT * FROM tool_groups WHERE id = $1', [tool_group_id]);
        if (groupRes.rows.length === 0) throw new Error('Tool Group không tồn tại');
        const tg = groupRes.rows[0];

        const tools = await McpToolExecutor.listTools({
          endpointUrl: tg.base_url,
          timeoutMs: 15000,
        });

        let syncedCount = 0;
        for (const tool of tools) {
          const rawName = tool.name;
          const toolKey = `${tg.key}_${rawName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
          const schema = tool.inputSchema || { type: 'object', properties: {} };

          const toolPg = await query(
            `INSERT INTO tools (
              id, key, name, description, tool_group_id, method, path,
              parameters_schema, input_schema, status, is_active, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'POST'::"HttpMethod", '/call', $6, $6, 'active', true, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              tool_group_id = EXCLUDED.tool_group_id,
              parameters_schema = EXCLUDED.parameters_schema,
              input_schema = EXCLUDED.input_schema,
              updated_at = NOW()
            RETURNING id, key, name`,
            [randomUUID(), toolKey, rawName, tool.description || `Tool ${rawName}`, tg.id, JSON.stringify(schema)]
          );
          const t = toolPg.rows[0];

          await neo4jClient.run(
            `MERGE (t:Tool { key: $key })
             SET t.id = $id, t.name = $name, t.updated_at = timestamp()
             WITH t
             MATCH (tg:ToolGroup { id: $groupId })
             MERGE (tg)-[:CONTAINS]->(t)
             MERGE (t)-[:BELONGS_TO_GROUP]->(tg)
             RETURN t`,
            { id: t.id, key: t.key, name: t.name, groupId: tg.id }
          );
          syncedCount++;
        }

        await logAuditAction(
          null,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'SYNC_MCP_TOOLS', tool_group_id },
          { tool_group_id, synced_count: syncedCount },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã đồng bộ thành công ${syncedCount} công cụ từ MCP Server "${tg.name}"!`,
          data: { synced_count: syncedCount },
        };
      }

      if (actionType === 'DELETE_TOOL_GROUP') {
        const { tool_group_id_or_key } = params;

        // Resolve ToolGroup by id or key
        const groupRes = await query(
          'SELECT id, key, name FROM tool_groups WHERE id::text = $1 OR key = $1',
          [tool_group_id_or_key]
        );

        if (groupRes.rows.length === 0) {
          throw new Error(`Không tìm thấy nhóm công cụ "${tool_group_id_or_key}" trong hệ sinh thái.`);
        }

        const group = groupRes.rows[0];
        const deleteResult = await ToolGroupSyncService.deleteToolGroup(group.id, adminUserId);

        const count = (deleteResult as any)?.deleted_tools_count ?? 0;

        await logAuditAction(
          null,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'DELETE_TOOL_GROUP', group_id: group.id, group_key: group.key },
          { group_id: group.id, deleted_tools_count: count },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã xóa vĩnh viễn nhóm công cụ "${group.name}" và xóa sạch ${count} công cụ trực thuộc thành công!`,
          data: { group_id: group.id, group_key: group.key, deleted_tools_count: count },
        };
      }

      if (actionType === 'DELETE_TOOL') {
        const { tool_id_or_key } = params;

        // Resolve Tool by id or key
        const toolRes = await query(
          'SELECT id, key, name FROM tools WHERE id::text = $1 OR key = $1',
          [tool_id_or_key]
        );

        if (toolRes.rows.length === 0) {
          throw new Error(`Không tìm thấy công cụ "${tool_id_or_key}" trong hệ sinh thái.`);
        }

        const tool = toolRes.rows[0];
        await ToolSyncService.deleteTool(tool.id, adminUserId);

        await logAuditAction(
          null,
          null,
          adminUserId,
          'COPILOT_ACTION',
          { action: 'DELETE_TOOL', tool_id: tool.id, tool_key: tool.key },
          { tool_id: tool.id, tool_key: tool.key },
          'SUCCESS'
        );

        return {
          success: true,
          message: `Đã xóa vĩnh viễn công cụ "${tool.name}" (${tool.key}) và thu hồi toàn bộ phân quyền thành công!`,
          data: { tool_id: tool.id, tool_key: tool.key },
        };
      }

      throw new Error(`Loại hành động không được hỗ trợ: ${actionType}`);
    } catch (err: any) {
      logger.error(`[Copilot executeAction Error] ${actionType}: ${err.message}`);
      throw err;
    }
  }
}

export const copilotService = new CopilotService();
