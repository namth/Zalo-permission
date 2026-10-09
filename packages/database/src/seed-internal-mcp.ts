import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { prisma } from './postgres.js';
import { runCypher, getNeo4jDriver } from './neo4j.js';

dotenv.config();

const MCP_TOOLS = [
  {
    name: 'create_workspace',
    key: 'internal_mcp_create_workspace',
    description: 'Tạo một không gian làm việc (Workspace) mới trong hệ thống OmniAgent.',
    parametersSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tên của Workspace mới' },
        description: { type: 'string', description: 'Mô tả Workspace' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_workspaces',
    key: 'internal_mcp_list_workspaces',
    description: 'Xem danh sách các Workspace hiện có trong hệ thống.',
    parametersSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Số lượng tối đa cần lấy' },
      },
    },
  },
  {
    name: 'add_contact',
    key: 'internal_mcp_add_contact',
    description: 'Thêm một người dùng mới vào Danh bạ (Contacts) toàn cầu của hệ thống.',
    parametersSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Họ và tên của người dùng' },
        nickname: { type: 'string', description: 'Biệt danh hoặc tên gọi thân mật ưu tiên khi AI xưng hô (vd: Nam, Huy, Alex)' },
        zalo_id: { type: 'string', description: 'ID tài khoản Zalo' },
        telegram_id: { type: 'string', description: 'ID tài khoản Telegram' },
        role: { type: 'string', enum: ['USER', 'SUPER_ADMIN'], description: 'Quyền hạn' },
        workspace_id: { type: 'string', description: 'ID Workspace muốn gán vào' },
        gender: { type: 'string', description: 'Giới tính (nam/nữ)' },
        birth_year: { type: 'number', description: 'Năm sinh' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Số điện thoại' },
        hobbies: { type: 'string', description: 'Sở thích cá nhân' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_contacts',
    key: 'internal_mcp_list_contacts',
    description: 'Tìm kiếm hoặc xem danh sách người dùng trong Danh bạ (Contacts).',
    parametersSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Lọc danh bạ theo Workspace ID' },
        query: { type: 'string', description: 'Từ khóa tìm kiếm theo tên hoặc SĐT/email' },
      },
    },
  },
  {
    name: 'update_contact_info',
    key: 'internal_mcp_update_contact_info',
    description: 'Cập nhật hoặc bổ sung thông tin cá nhân (giới tính, năm sinh, email, sđt, sở thích, biệt danh) của người trong danh bạ.',
    parametersSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'ID của Contact cần cập nhật' },
        name: { type: 'string', description: 'Tên mới' },
        nickname: { type: 'string', description: 'Biệt danh hoặc tên gọi thân mật mới' },
        gender: { type: 'string', description: 'Giới tính' },
        birth_year: { type: 'number', description: 'Năm sinh' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Số điện thoại' },
        hobbies: { type: 'string', description: 'Sở thích cá nhân' },
        role: { type: 'string', enum: ['USER', 'SUPER_ADMIN'], description: 'Quyền hạn' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'assign_contact_to_workspace',
    key: 'internal_mcp_assign_contact_to_workspace',
    description: 'Gán một người dùng trong danh bạ vào một Workspace cụ thể.',
    parametersSchema: {
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
    key: 'internal_mcp_remove_contact_from_workspace',
    description: 'Gỡ một người dùng trong danh bạ ra khỏi một Workspace cụ thể.',
    parametersSchema: {
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
    key: 'internal_mcp_merge_contacts',
    description: 'Hợp nhất 2 bản ghi Contact của cùng một người khi họ dùng cả Zalo và Telegram.',
    parametersSchema: {
      type: 'object',
      properties: {
        primary_contact_id: { type: 'string', description: 'ID Contact chính giữ lại' },
        secondary_contact_id: { type: 'string', description: 'ID Contact phụ sẽ gộp và xóa' },
      },
      required: ['primary_contact_id', 'secondary_contact_id'],
    },
  },
];

export async function seedInternalMcp(): Promise<void> {
  console.log('--- Seeding Internal System MCP ToolGroup & Tools ---');

  const groupKey = 'internal_system_mcp';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7140';
  const mcpEndpoint = `${appUrl.replace(/\/+$/, '')}/api/mcp`;

  // 1. Tạo hoặc cập nhật ToolGroup
  const toolGroup = await prisma.toolGroup.upsert({
    where: { key: groupKey },
    update: {
      name: 'OmniAgent Internal Management (MCP)',
      description: 'Bộ công cụ MCP Server nội bộ cho phép Agent tự động tạo Workspace, quản lý thành viên, danh bạ và phân quyền.',
      protocolType: 'MCP',
      baseUrl: mcpEndpoint,
      mcpTransport: 'SSE',
      isActive: true,
    },
    create: {
      id: randomUUID(),
      key: groupKey,
      name: 'OmniAgent Internal Management (MCP)',
      description: 'Bộ công cụ MCP Server nội bộ cho phép Agent tự động tạo Workspace, quản lý thành viên, danh bạ và phân quyền.',
      protocolType: 'MCP',
      baseUrl: mcpEndpoint,
      mcpTransport: 'SSE',
      isActive: true,
    },
  });

  console.log(`✓ ToolGroup synced: ${toolGroup.name} (${toolGroup.id})`);

  // Đồng bộ sang Neo4j
  await runCypher(
    `
    MERGE (tg:ToolGroup { key: $key })
    SET tg.id = $id,
        tg.name = $name,
        tg.protocol = 'MCP',
        tg.updated_at = timestamp()
    RETURN tg
    `,
    {
      id: toolGroup.id,
      key: toolGroup.key,
      name: toolGroup.name,
    }
  );

  // 2. Tạo hoặc cập nhật từng Tool
  for (const t of MCP_TOOLS) {
    const tool = await prisma.tool.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        description: t.description,
        toolGroupId: toolGroup.id,
        method: 'POST',
        path: '/call',
        parametersSchema: t.parametersSchema as any,
        inputSchema: t.parametersSchema as any,
        isActive: true,
      },
      create: {
        id: randomUUID(),
        key: t.key,
        name: t.name,
        description: t.description,
        toolGroupId: toolGroup.id,
        method: 'POST',
        path: '/call',
        parametersSchema: t.parametersSchema as any,
        inputSchema: t.parametersSchema as any,
        isActive: true,
      },
    });

    console.log(`  ✓ Tool: ${tool.name} (${tool.key})`);

    // Neo4j link
    await runCypher(
      `
      MERGE (t:Tool { key: $key })
      SET t.id = $id,
          t.name = $name,
          t.updated_at = timestamp()
      WITH t
      MATCH (tg:ToolGroup { id: $groupId })
      MERGE (tg)-[:CONTAINS]->(t)
      MERGE (t)-[:BELONGS_TO_GROUP]->(tg)
      RETURN t
      `,
      {
        id: tool.id,
        key: tool.key,
        name: tool.name,
        groupId: toolGroup.id,
      }
    );
  }

  console.log('--- Internal System MCP Initialized Successfully ---');
}

// Auto-run if executed directly
if (process.argv[1]?.includes('seed-internal-mcp')) {
  seedInternalMcp()
    .then(async () => {
      const driver = getNeo4jDriver();
      await driver.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error seeding Internal MCP:', err);
      process.exit(1);
    });
}
