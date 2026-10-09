import { prisma, runCypher } from '@omniagent/database';
import type { ContactData, ContactRole } from '../types.js';

export interface UpsertContactOptions {
  platform: 'ZALO' | 'TELEGRAM' | 'WEBHOOK' | string;
  senderId: string;
  senderName?: string;
  workspaceId?: string;
}

export class ContactService {
  /**
   * Tự động thu thập/nhận diện người dùng từ tin nhắn gửi đến
   */
  static async upsertFromMessage(options: UpsertContactOptions): Promise<ContactData> {
    const { platform, senderId, senderName, workspaceId } = options;
    const cleanSenderId = String(senderId).trim();
    const displayName = (senderName || '').trim() || `User_${cleanSenderId.slice(-4)}`;

    const isZalo = platform === 'ZALO';
    const isTelegram = platform === 'TELEGRAM';

    // 1. Tìm theo ID nền tảng tương ứng
    let contact: any = null;
    if (isZalo) {
      contact = await prisma.contact.findUnique({ where: { zaloId: cleanSenderId } });
    } else if (isTelegram) {
      contact = await prisma.contact.findUnique({ where: { telegramId: cleanSenderId } });
    }

    // 2. Nếu chưa thấy, áp dụng quy tắc nhận diện thông minh:
    // "thường thì nếu như trong cùng 1 workspace mà tên giống nhau ở các kênh khác nhau thì vẫn là cùng 1 người"
    if (!contact && workspaceId && displayName) {
      try {
        const query = `
          MATCH (c:Contact)-[:BELONGS_TO]->(w:Workspace { id: $workspaceId })
          WHERE toLower(c.name) = toLower($name)
          RETURN c.id AS id
          LIMIT 1
        `;
        const matched = await runCypher<{ id: string }>(query, {
          workspaceId,
          name: displayName,
        });

        if (matched && matched.length > 0) {
          const candidateId = matched[0].id;
          const candidate = await prisma.contact.findUnique({ where: { id: candidateId } });
          if (candidate) {
            // Kiểm tra xem kênh này của candidate đã có ID chưa
            if ((isZalo && !candidate.zaloId) || (isTelegram && !candidate.telegramId)) {
              contact = await prisma.contact.update({
                where: { id: candidateId },
                data: {
                  zaloId: isZalo ? cleanSenderId : candidate.zaloId,
                  telegramId: isTelegram ? cleanSenderId : candidate.telegramId,
                },
              });
              console.log(`[ContactService] 🔗 Tự động gắn kết danh tính cho "${displayName}" (${platform}: ${cleanSenderId}) vào Contact có sẵn: ${candidateId}`);
            }
          }
        }
      } catch (e) {
        console.warn('[ContactService] Lỗi khi nhận diện liên kết contact cùng tên:', e);
      }
    }

    // 3. Nếu vẫn chưa có, tạo Contact mới
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: displayName,
          zaloId: isZalo ? cleanSenderId : null,
          telegramId: isTelegram ? cleanSenderId : null,
          role: 'USER',
        },
      });
      console.log(`[ContactService] 👤 Đã tự động tạo Contact mới: ${contact.name} (${contact.id})`);
    } else if (senderName && contact.name !== displayName && !contact.name.startsWith('User_')) {
      // Giữ nguyên tên người dùng tùy chỉnh nếu đã có tên đẹp, chỉ cập nhật nếu là placeholder
    }

    // 4. Đồng bộ Node Contact và liên kết BELONGS_TO Workspace trong Neo4j
    if (workspaceId) {
      runCypher(
        `
        MERGE (c:Contact { id: $contactId })
        SET c.name = $name,
            c.updated_at = timestamp()
        WITH c
        MATCH (w:Workspace { id: $workspaceId })
        MERGE (c)-[:BELONGS_TO]->(w)
        `,
        {
          contactId: contact.id,
          name: contact.name,
          workspaceId,
        }
      ).catch((err) => {
        console.warn('[ContactService] Lỗi đồng bộ Neo4j Contact relationship:', err);
      });
    }

    return contact as ContactData;
  }

  /**
   * Lấy Contact theo ID
   */
  static async getById(contactId: string): Promise<ContactData | null> {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    return (contact as ContactData) || null;
  }

  /**
   * Lấy Contact theo platform và sender ID
   */
  static async getByPlatformId(platform: string, senderId: string): Promise<ContactData | null> {
    const cleanId = String(senderId).trim();
    if (platform === 'ZALO') {
      const contact = await prisma.contact.findUnique({ where: { zaloId: cleanId } });
      return (contact as ContactData) || null;
    }
    if (platform === 'TELEGRAM') {
      const contact = await prisma.contact.findUnique({ where: { telegramId: cleanId } });
      return (contact as ContactData) || null;
    }
    return null;
  }

  /**
   * Kiểm tra quyền SuperAdmin của người gửi tin nhắn
   */
  static async isSuperAdmin(platform: string, senderId: string): Promise<boolean> {
    const contact = await this.getByPlatformId(platform, senderId);
    return contact?.role === 'SUPER_ADMIN';
  }

  /**
   * Tạo thủ công Contact (chủ đích lưu trước khi trò chuyện)
   */
  static async createContact(data: {
    name: string;
    nickname?: string;
    zaloId?: string;
    telegramId?: string;
    role?: ContactRole;
    gender?: string;
    birthYear?: number;
    email?: string;
    phone?: string;
    hobbies?: string;
    workspaceId?: string;
  }): Promise<ContactData> {
    const { workspaceId, ...fields } = data;

    const contact = await prisma.contact.create({
      data: {
        name: fields.name.trim(),
        nickname: fields.nickname?.trim() || null,
        zaloId: fields.zaloId?.trim() || null,
        telegramId: fields.telegramId?.trim() || null,
        role: fields.role || 'USER',
        gender: fields.gender || null,
        birthYear: fields.birthYear || null,
        email: fields.email?.trim() || null,
        phone: fields.phone?.trim() || null,
        hobbies: fields.hobbies || null,
      },
    });

    if (workspaceId) {
      await runCypher(
        `
        MERGE (c:Contact { id: $contactId })
        SET c.name = $name
        WITH c
        MATCH (w:Workspace { id: $workspaceId })
        MERGE (c)-[:BELONGS_TO]->(w)
        `,
        {
          contactId: contact.id,
          name: contact.name,
          workspaceId,
        }
      ).catch(() => {});
    }

    return contact as ContactData;
  }

  /**
   * Cập nhật thông tin mở rộng của Contact (thu thập dần: giới tính, năm sinh, email, sđt, sở thích)
   */
  static async updateContactInfo(
    contactId: string,
    data: {
      name?: string;
      nickname?: string;
      role?: ContactRole;
      gender?: string;
      birthYear?: number;
      email?: string;
      phone?: string;
      hobbies?: string;
    }
  ): Promise<ContactData> {
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.nickname !== undefined ? { nickname: data.nickname ? data.nickname.trim() : null } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.birthYear !== undefined ? { birthYear: data.birthYear } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.hobbies !== undefined ? { hobbies: data.hobbies } : {}),
      },
    });

    if (data.name) {
      runCypher(`MATCH (c:Contact { id: $contactId }) SET c.name = $name`, {
        contactId,
        name: data.name,
      }).catch(() => {});
    }

    return contact as ContactData;
  }

  /**
   * Gán Contact vào Workspace
   */
  static async assignToWorkspace(contactId: string, workspaceId: string): Promise<void> {
    await runCypher(
      `
      MATCH (c:Contact { id: $contactId }), (w:Workspace { id: $workspaceId })
      MERGE (c)-[:BELONGS_TO]->(w)
      `,
      { contactId, workspaceId }
    );
  }

  /**
   * Gỡ Contact khỏi Workspace
   */
  static async removeFromWorkspace(contactId: string, workspaceId: string): Promise<void> {
    await runCypher(
      `
      MATCH (c:Contact { id: $contactId })-[r:BELONGS_TO]->(w:Workspace { id: $workspaceId })
      DELETE r
      `,
      { contactId, workspaceId }
    );
  }

  /**
   * Hợp nhất 2 Contact (Primary & Secondary)
   * Chuyển toàn bộ platform ID, thông tin còn thiếu và liên kết Workspace sang Primary rồi xóa Secondary
   */
  static async mergeContacts(primaryId: string, secondaryId: string): Promise<ContactData> {
    if (primaryId === secondaryId) {
      throw new Error('Không thể hợp nhất cùng một Contact');
    }

    const [primary, secondary] = await Promise.all([
      prisma.contact.findUnique({ where: { id: primaryId } }),
      prisma.contact.findUnique({ where: { id: secondaryId } }),
    ]);

    if (!primary || !secondary) {
      throw new Error('Một trong hai Contact không tồn tại');
    }

    // Merge dữ liệu còn thiếu từ secondary sang primary
    const updatedData: Record<string, any> = {};
    if (!primary.nickname && secondary.nickname) updatedData.nickname = secondary.nickname;
    if (!primary.zaloId && secondary.zaloId) updatedData.zaloId = secondary.zaloId;
    if (!primary.telegramId && secondary.telegramId) updatedData.telegramId = secondary.telegramId;
    if (!primary.gender && secondary.gender) updatedData.gender = secondary.gender;
    if (!primary.birthYear && secondary.birthYear) updatedData.birthYear = secondary.birthYear;
    if (!primary.email && secondary.email) updatedData.email = secondary.email;
    if (!primary.phone && secondary.phone) updatedData.phone = secondary.phone;

    // Gộp sở thích
    if (secondary.hobbies) {
      if (!primary.hobbies) {
        updatedData.hobbies = secondary.hobbies;
      } else if (!primary.hobbies.includes(secondary.hobbies)) {
        updatedData.hobbies = `${primary.hobbies}, ${secondary.hobbies}`;
      }
    }

    // Nâng role nếu secondary là SUPER_ADMIN
    if (secondary.role === 'SUPER_ADMIN' && primary.role !== 'SUPER_ADMIN') {
      updatedData.role = 'SUPER_ADMIN';
    }

    // 1. Cập nhật Primary trong Postgres
    const merged = await prisma.contact.update({
      where: { id: primaryId },
      data: updatedData,
    });

    // 2. Chuyển đổi liên kết Workspace trong Neo4j
    await runCypher(
      `
      MATCH (sec:Contact { id: $secondaryId })-[r:BELONGS_TO]->(w:Workspace)
      MATCH (prim:Contact { id: $primaryId })
      MERGE (prim)-[:BELONGS_TO]->(w)
      DELETE r
      WITH sec
      DELETE sec
      `,
      {
        primaryId,
        secondaryId,
      }
    ).catch((err) => {
      console.warn('[ContactService] Lỗi chuyển đổi Neo4j khi merge:', err);
    });

    // 3. Xóa Secondary khỏi PostgreSQL
    await prisma.contact.delete({ where: { id: secondaryId } });

    console.log(`[ContactService] 🔀 Đã hợp nhất Contact [${secondary.name} - ${secondaryId}] vào [${primary.name} - ${primaryId}]`);

    return merged as ContactData;
  }
}
