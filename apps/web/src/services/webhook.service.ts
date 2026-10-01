import { randomBytes } from 'crypto';
import { prisma, runCypher, encryptData, decryptData } from '@omniagent/database';
import { initializeApp, cert, deleteApp, type App } from 'firebase-admin/app';

export interface CreateWebhookDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateWebhookDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface SaveFirebaseConfigDto {
  projectId: string;
  clientEmail: string;
  serviceAccountJson: string;
  isActive?: boolean;
}

export class WebhookService {
  /**
   * Lấy danh sách Webhook của một Workspace
   */
  static async listWebhooks(workspaceId: string): Promise<any[]> {
    const webhooks = await prisma.workspaceWebhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            sessions: true,
            auditLogs: true,
          },
        },
      },
    });

    return webhooks.map((wh) => ({
      id: wh.id,
      workspaceId: wh.workspaceId,
      name: wh.name,
      description: wh.description,
      secretTokenMasked: `${wh.secretToken.slice(0, 10)}••••••••••••${wh.secretToken.slice(-4)}`,
      isActive: wh.isActive,
      metadata: wh.metadata,
      createdAt: wh.createdAt,
      updatedAt: wh.updatedAt,
      stats: {
        sessionsCount: wh._count.sessions,
        totalCalls: wh._count.auditLogs,
      },
    }));
  }

  /**
   * Tạo Webhook mới trong Workspace
   */
  static async createWebhook(workspaceId: string, data: CreateWebhookDto): Promise<any> {
    // 1. Kiểm tra Workspace tồn tại
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!ws) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    // 2. Sinh secret token ngẫu nhiên
    const secretToken = `whsec_live_${randomBytes(24).toString('hex')}`;

    // 3. Tạo trong PostgreSQL
    const webhook = await prisma.workspaceWebhook.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        secretToken,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    // 4. Đồng bộ Node vào Neo4j
    await runCypher(
      `
      MATCH (w:Workspace { id: $workspaceId })
      MERGE (wh:WorkspaceWebhook { id: $webhookId })
      SET wh.name = $name, wh.is_active = $isActive
      MERGE (wh)-[:BELONGS_TO]->(w)
      `,
      {
        workspaceId,
        webhookId: webhook.id,
        name: webhook.name,
        isActive: webhook.isActive,
      }
    ).catch((neoErr) => {
      console.warn('[WebhookService] Neo4j sync notice on create:', neoErr);
    });

    // Trả về webhook kèm secretToken thô (chỉ hiển thị 1 lần cho người dùng copy)
    return {
      ...webhook,
      secretTokenRaw: secretToken,
    };
  }

  /**
   * Sinh lại Secret Token cho Webhook
   */
  static async regenerateSecret(workspaceId: string, webhookId: string) {
    const existing = await prisma.workspaceWebhook.findFirst({
      where: { id: webhookId, workspaceId },
    });
    if (!existing) {
      throw new Error('Webhook not found in this workspace');
    }

    const newSecret = `whsec_live_${randomBytes(24).toString('hex')}`;
    const updated = await prisma.workspaceWebhook.update({
      where: { id: webhookId },
      data: { secretToken: newSecret },
    });

    return {
      id: updated.id,
      secretTokenRaw: newSecret,
    };
  }

  /**
   * Cập nhật thông tin / trạng thái Bật-Tắt Webhook
   */
  static async updateWebhook(workspaceId: string, webhookId: string, data: UpdateWebhookDto): Promise<any> {
    const existing = await prisma.workspaceWebhook.findFirst({
      where: { id: webhookId, workspaceId },
    });
    if (!existing) {
      throw new Error('Webhook not found in this workspace');
    }

    const updated = await prisma.workspaceWebhook.update({
      where: { id: webhookId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    // Cập nhật Neo4j
    await runCypher(
      `
      MATCH (wh:WorkspaceWebhook { id: $webhookId })
      SET wh.is_active = $isActive,
          wh.name = coalesce($name, wh.name)
      `,
      {
        webhookId,
        isActive: updated.isActive,
        name: updated.name,
      }
    ).catch((neoErr) => {
      console.warn('[WebhookService] Neo4j sync notice on update:', neoErr);
    });

    return updated;
  }

  /**
   * Xóa Webhook
   */
  static async deleteWebhook(workspaceId: string, webhookId: string) {
    const existing = await prisma.workspaceWebhook.findFirst({
      where: { id: webhookId, workspaceId },
    });
    if (!existing) {
      throw new Error('Webhook not found in this workspace');
    }

    await prisma.workspaceWebhook.delete({
      where: { id: webhookId },
    });

    // Xóa khỏi Neo4j
    await runCypher(
      `
      MATCH (wh:WorkspaceWebhook { id: $webhookId })
      DETACH DELETE wh
      `,
      { webhookId }
    ).catch((neoErr) => {
      console.warn('[WebhookService] Neo4j sync notice on delete:', neoErr);
    });

    return { success: true };
  }

  /**
   * Lấy cấu hình Firebase FCM của Workspace
   */
  static async getFirebaseConfig(workspaceId: string) {
    const config = await prisma.workspaceFirebaseConfig.findUnique({
      where: { workspaceId },
    });

    if (!config) {
      return {
        isConfigured: false,
        isActive: false,
        projectId: null,
        clientEmail: null,
      };
    }

    return {
      isConfigured: true,
      isActive: config.isActive,
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Lưu cấu hình Firebase FCM (mã hóa AES-256-GCM)
   */
  static async saveFirebaseConfig(workspaceId: string, data: SaveFirebaseConfigDto) {
    // 1. Kiểm tra Workspace tồn tại
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!ws) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    // 2. Validate JSON
    try {
      const parsed = JSON.parse(data.serviceAccountJson);
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        throw new Error('Invalid Firebase service account format. Missing project_id, client_email or private_key.');
      }
    } catch (parseErr: any) {
      throw new Error(`Invalid JSON for Firebase credentials: ${parseErr.message}`);
    }

    // 3. Mã hóa toàn bộ chuỗi JSON bằng AES-256-GCM
    const encryptedCredentials = encryptData(data.serviceAccountJson);

    // 4. Upsert vào PostgreSQL
    const saved = await prisma.workspaceFirebaseConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        projectId: data.projectId.trim(),
        clientEmail: data.clientEmail.trim(),
        encryptedCredentials,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      update: {
        projectId: data.projectId.trim(),
        clientEmail: data.clientEmail.trim(),
        encryptedCredentials,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return {
      success: true,
      projectId: saved.projectId,
      clientEmail: saved.clientEmail,
      isActive: saved.isActive,
    };
  }

  /**
   * Kiểm tra thông tin Firebase credentials có hợp lệ hay không
   */
  static async testFirebaseCredentials(serviceAccountJson: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('Invalid JSON format');
    }

    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('Missing required fields: project_id, private_key, or client_email');
    }

    // Test khởi tạo Firebase App tạm thời
    const tempAppName = `test_${Date.now()}`;
    let app: App | null = null;
    try {
      app = initializeApp(
        {
          credential: cert(parsed),
          projectId: parsed.project_id,
        },
        tempAppName
      );
      // Nếu initializeApp thành công
      return {
        success: true,
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        message: 'Firebase credentials are valid and ready to use.',
      };
    } finally {
      if (app) {
        await deleteApp(app).catch(() => {});
      }
    }
  }
}
