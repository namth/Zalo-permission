import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma, runCypher } from '@omniagent/database';
import { ContactService, type ContactRole } from '@omniagent/core';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const AVAILABLE_TOOLS = [
  {
    name: 'create_workspace',
    description: 'Tạo một không gian làm việc (Workspace) mới trong hệ thống OmniAgent.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tên của Workspace mới (vd: Dự án X, Chi nhánh Hà Nội)' },
        description: { type: 'string', description: 'Mô tả mục đích hoặc chức năng của Workspace' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_workspaces',
    description: 'Xem danh sách các Workspace hiện có trong hệ thống.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Số lượng tối đa cần lấy (mặc định 20)' },
      },
    },
  },
  {
    name: 'add_contact',
    description: 'Thêm một người dùng mới vào Danh bạ (Contacts) toàn cầu của hệ thống trước hoặc sau khi tương tác.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Họ và tên của người dùng' },
        nickname: { type: 'string', description: 'Biệt danh hoặc tên gọi thân mật (vd: Nam, Huy, Alex)' },
        zalo_id: { type: 'string', description: 'ID tài khoản Zalo (nếu có)' },
        telegram_id: { type: 'string', description: 'ID tài khoản Telegram (nếu có)' },
        role: { type: 'string', enum: ['USER', 'SUPER_ADMIN'], description: 'Quyền hạn trong hệ thống (mặc định USER)' },
        workspace_id: { type: 'string', description: 'ID của Workspace muốn gán người này vào' },
        gender: { type: 'string', description: 'Giới tính (nam/nữ)' },
        birth_year: { type: 'number', description: 'Năm sinh (vd: 1990)' },
        email: { type: 'string', description: 'Địa chỉ Email' },
        phone: { type: 'string', description: 'Số điện thoại' },
        hobbies: { type: 'string', description: 'Sở thích cá nhân' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_contacts',
    description: 'Tìm kiếm hoặc xem danh sách người dùng trong Danh bạ (Contacts).',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Lọc danh bạ theo Workspace ID' },
        query: { type: 'string', description: 'Từ khóa tìm kiếm theo tên, SĐT hoặc email' },
        limit: { type: 'number', description: 'Số lượng tối đa (mặc định 20)' },
      },
    },
  },
  {
    name: 'update_contact_info',
    description: 'Cập nhật hoặc bổ sung thông tin cá nhân (giới tính, năm sinh, email, sđt, sở thích, họ tên) của một người trong danh bạ.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'ID định danh của Contact cần cập nhật' },
        name: { type: 'string', description: 'Tên mới (nếu muốn đổi)' },
        nickname: { type: 'string', description: 'Biệt danh hoặc tên thân mật ưu tiên khi AI gọi tên' },
        gender: { type: 'string', description: 'Giới tính' },
        birth_year: { type: 'number', description: 'Năm sinh' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Số điện thoại' },
        hobbies: { type: 'string', description: 'Sở thích cá nhân' },
        role: { type: 'string', enum: ['USER', 'SUPER_ADMIN'], description: 'Cập nhật quyền hạn' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'assign_contact_to_workspace',
    description: 'Gán một người dùng trong danh bạ vào một Workspace cụ thể.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'ID của Contact' },
        workspace_id: { type: 'string', description: 'ID của Workspace' },
      },
      required: ['contact_id', 'workspace_id'],
    },
  },
  {
    name: 'remove_contact_from_workspace',
    description: 'Gỡ/rút quyền một người dùng trong danh bạ ra khỏi một Workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'ID của Contact' },
        workspace_id: { type: 'string', description: 'ID của Workspace' },
      },
      required: ['contact_id', 'workspace_id'],
    },
  },
  {
    name: 'merge_contacts',
    description: 'Hợp nhất 2 bản ghi Contact của cùng 1 người dùng khi họ tương tác qua cả Zalo và Telegram.',
    inputSchema: {
      type: 'object',
      properties: {
        primary_contact_id: { type: 'string', description: 'ID của Contact chính giữ lại' },
        secondary_contact_id: { type: 'string', description: 'ID của Contact phụ sẽ chuyển thông tin sang và xóa' },
      },
      required: ['primary_contact_id', 'secondary_contact_id'],
    },
  },
];

/**
 * Kiểm tra xem người gọi có quyền SUPER_ADMIN không
 */
async function checkCallerSuperAdmin(req: NextRequest, args: Record<string, any>): Promise<boolean> {
  // 1. Kiểm tra qua Header được truyền từ ToolExecutor
  const headerRole = req.headers.get('x-caller-role');
  if (headerRole === 'SUPER_ADMIN') {
    return true;
  }

  // 2. Kiểm tra qua Header Platform & SenderId
  const senderId = req.headers.get('x-caller-sender-id') || args.caller_sender_id;
  const platform = req.headers.get('x-caller-platform') || args.caller_platform;
  if (senderId && platform) {
    const isSuper = await ContactService.isSuperAdmin(platform, senderId);
    if (isSuper) return true;
  }

  // 3. Kiểm tra qua Bearer Token / Admin secret
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const adminSecret = process.env.ADMIN_SECRET || process.env.INTERNAL_MCP_SECRET;
  if (token && adminSecret && token === adminSecret) {
    return true;
  }

  // 4. Nếu không có rào chắn secret cụ thể, cho phép nếu callerContactId có role SUPER_ADMIN
  const contactId = req.headers.get('x-caller-contact-id') || args.caller_contact_id;
  if (contactId) {
    const contact = await ContactService.getById(contactId);
    if (contact?.role === 'SUPER_ADMIN') {
      return true;
    }
  }

  return false;
}

/**
 * GET /api/mcp - MCP Discovery & Server Information
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'OmniAgent Internal MCP Server',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    description: 'Máy chủ MCP nội bộ cung cấp các công cụ quản trị Workspace và Danh bạ đa kênh cho OmniAgent Gateway',
    tools: AVAILABLE_TOOLS,
  });
}

/**
 * POST /api/mcp - JSON-RPC 2.0 Handler
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { id = 1, method, params = {} } = body;

    logger.info(`[Internal MCP] Received RPC method: ${method}`);

    // 1. tools/list - Khám phá công cụ
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: AVAILABLE_TOOLS,
        },
      });
    }

    // 2. tools/call - Thực thi công cụ
    if (method === 'tools/call') {
      const toolName = params.name;
      const args = params.arguments || {};

      logger.info(`[Internal MCP] Executing tool: ${toolName}`, args);

      // Các tool yêu cầu quyền SUPER_ADMIN
      const ADMIN_ONLY_TOOLS = [
        'create_workspace',
        'remove_contact_from_workspace',
        'merge_contacts',
      ];

      if (ADMIN_ONLY_TOOLS.includes(toolName)) {
        const isSuperAdmin = await checkCallerSuperAdmin(req, args);
        if (!isSuperAdmin) {
          logger.warn(`[Internal MCP] Quyền bị từ chối khi thực thi ${toolName}`);
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Quyền bị từ chối: Thao tác này yêu cầu quyền SUPER_ADMIN. Bạn hiện không có đủ thẩm quyền để quản trị hệ thống.',
                  }),
                },
              ],
              isError: true,
            },
          });
        }
      }

      // Xử lý từng tool
      let output: any;

      switch (toolName) {
        case 'create_workspace': {
          const { name, description } = args;
          if (!name) throw new Error('Tham số "name" là bắt buộc');

          const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || `ws-${Date.now()}`;

          const newWs = await prisma.workspace.create({
            data: {
              name: name.trim(),
              slug: `${slug}-${randomUUID().slice(0, 6)}`,
              description: description || null,
              isActive: true,
            },
          });

          // Đồng bộ sang Neo4j
          await runCypher(
            `
            MERGE (w:Workspace { id: $id })
            SET w.name = $name,
                w.slug = $slug,
                w.is_active = true
            RETURN w
            `,
            {
              id: newWs.id,
              name: newWs.name,
              slug: newWs.slug,
            }
          ).catch((e) => console.warn('[Internal MCP] Neo4j workspace sync warning:', e));

          output = {
            success: true,
            message: `Đã tạo thành công không gian làm việc "${newWs.name}"`,
            workspace: {
              id: newWs.id,
              name: newWs.name,
              slug: newWs.slug,
              description: newWs.description,
            },
          };
          break;
        }

        case 'list_workspaces': {
          const limit = Math.min(parseInt(args.limit || '20', 10), 100);
          const workspaces = await prisma.workspace.findMany({
            where: { isActive: true },
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              createdAt: true,
            },
          });
          output = {
            success: true,
            total: workspaces.length,
            workspaces,
          };
          break;
        }

        case 'add_contact': {
          const contact = await ContactService.createContact({
            name: args.name,
            nickname: args.nickname,
            zaloId: args.zalo_id,
            telegramId: args.telegram_id,
            role: args.role as ContactRole,
            workspaceId: args.workspace_id,
            gender: args.gender,
            birthYear: args.birth_year ? parseInt(String(args.birth_year), 10) : undefined,
            email: args.email,
            phone: args.phone,
            hobbies: args.hobbies,
          });
          output = {
            success: true,
            message: `Đã lưu "${contact.name}" vào danh bạ thành công`,
            contact,
          };
          break;
        }

        case 'list_contacts': {
          const limit = Math.min(parseInt(args.limit || '20', 10), 100);
          const query = (args.query || '').trim();
          const workspaceId = args.workspace_id;

          let contactIdsInWs: string[] | null = null;
          if (workspaceId) {
            const neoResult = await runCypher<{ id: string }>(
              `MATCH (c:Contact)-[:BELONGS_TO]->(w:Workspace { id: $workspaceId }) RETURN c.id AS id`,
              { workspaceId }
            );
            contactIdsInWs = neoResult.map((r) => r.id);
          }

          const contacts = await prisma.contact.findMany({
            where: {
              ...(contactIdsInWs !== null ? { id: { in: contactIdsInWs } } : {}),
              ...(query
                ? {
                    OR: [
                      { name: { contains: query, mode: 'insensitive' } },
                      { phone: { contains: query } },
                      { email: { contains: query, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
          });

          output = {
            success: true,
            total: contacts.length,
            contacts,
          };
          break;
        }

        case 'update_contact_info': {
          const { contact_id, ...updates } = args;
          if (!contact_id) throw new Error('Tham số "contact_id" là bắt buộc');

          const updated = await ContactService.updateContactInfo(contact_id, {
            name: updates.name,
            nickname: updates.nickname,
            role: updates.role as ContactRole,
            gender: updates.gender,
            birthYear: updates.birth_year ? parseInt(String(updates.birth_year), 10) : undefined,
            email: updates.email,
            phone: updates.phone,
            hobbies: updates.hobbies,
          });

          output = {
            success: true,
            message: `Đã cập nhật thông tin cho "${updated.name}" thành công`,
            contact: updated,
          };
          break;
        }

        case 'assign_contact_to_workspace': {
          const { contact_id, workspace_id } = args;
          if (!contact_id || !workspace_id) throw new Error('Thiếu "contact_id" hoặc "workspace_id"');

          await ContactService.assignToWorkspace(contact_id, workspace_id);
          output = {
            success: true,
            message: `Đã gán contact ${contact_id} vào Workspace ${workspace_id} thành công`,
          };
          break;
        }

        case 'remove_contact_from_workspace': {
          const { contact_id, workspace_id } = args;
          if (!contact_id || !workspace_id) throw new Error('Thiếu "contact_id" hoặc "workspace_id"');

          await ContactService.removeFromWorkspace(contact_id, workspace_id);
          output = {
            success: true,
            message: `Đã gỡ contact ${contact_id} khỏi Workspace ${workspace_id} thành công`,
          };
          break;
        }

        case 'merge_contacts': {
          const { primary_contact_id, secondary_contact_id } = args;
          if (!primary_contact_id || !secondary_contact_id) {
            throw new Error('Thiếu "primary_contact_id" hoặc "secondary_contact_id"');
          }

          const merged = await ContactService.mergeContacts(primary_contact_id, secondary_contact_id);
          output = {
            success: true,
            message: `Đã hợp nhất danh bạ thành công vào hồ sơ "${merged.name}"`,
            contact: merged,
          };
          break;
        }

        default:
          throw new Error(`Tool "${toolName}" không được hỗ trợ trên Internal MCP Server`);
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof output === 'string' ? output : JSON.stringify(output),
            },
          ],
        },
      });
    }

    return NextResponse.json(
      { jsonrpc: '2.0', id, error: { code: -32601, message: `Method "${method}" không được hỗ trợ` } },
      { status: 400 }
    );
  } catch (err: any) {
    logger.error(`[Internal MCP] Error handling request: ${err.message || err}`);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: err.message || 'Lỗi xử lý nội bộ' }),
            },
          ],
          isError: true,
        },
      },
      { status: 200 }
    );
  }
}
