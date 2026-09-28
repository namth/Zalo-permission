
import { query, executeQuery } from '@/lib/db';
import { logAuditAction } from './audit.service';
import neo4j from 'neo4j-driver';

export interface ZaloGroup {
    id: string;
    workspace_id: string;
    thread_id: string;
    name: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Zalo Group Member (trả về từ Neo4j + PostgreSQL join)
 */
export interface ZaloGroupMember {
    user_id: string;
    zalo_group_id: string;
    role: string;
    joined_at: string | null;
    full_name: string | null;
    zalo_id: string | null;
}

export class ZaloGroupService {

    /**
     * Get users in a Zalo Group — từ Neo4j MEMBER_OF relationships
     * Query các ZaloUser có relationship MEMBER_OF tới ZaloGroup,
     * sau đó join với user_profile trong PostgreSQL để lấy thông tin chi tiết.
     */
    static async getGroupUsers(
        zalo_group_id: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<{ members: ZaloGroupMember[]; total: number }> {
        // Lấy danh sách user_id và role từ Neo4j
        // Use neo4j.int() to ensure LIMIT/SKIP receive integer (not float) values
        const neo4jResult = await executeQuery(
            `MATCH (u:ZaloUser)-[r:MEMBER_OF]->(g:ZaloGroup {id: $group_id})
       RETURN u.id AS user_id, r.role AS role, r.joined_at AS joined_at
       ORDER BY r.joined_at DESC
       SKIP $offset LIMIT $limit`,
            { group_id: zalo_group_id, offset: neo4j.int(offset), limit: neo4j.int(limit) }
        );

        const records = neo4jResult.records;

        if (records.length === 0) {
            return { members: [], total: 0 };
        }

        const userIds = records.map((r: any) => r.get('user_id'));
        const roleMap = new Map<string, { role: string; joined_at: string | null }>(
            records.map((r: any) => {
                const joinedAtRaw = r.get('joined_at');
                // Neo4j DateTime object needs to be converted to ISO string
                let joined_at: string | null = null;
                if (joinedAtRaw) {
                    if (typeof joinedAtRaw === 'string') {
                        joined_at = joinedAtRaw;
                    } else if (joinedAtRaw.toString) {
                        // Neo4j DateTime object — convert to string
                        joined_at = joinedAtRaw.toString();
                    }
                }
                return [
                    r.get('user_id'),
                    { role: r.get('role') || 'MEMBER', joined_at },
                ];
            })
        );

        // Lấy thông tin chi tiết từ PostgreSQL
        const placeholders = userIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
        const pgResult = await query(
            `SELECT id, zalo_id, full_name
       FROM user_profile
       WHERE id = ANY(ARRAY[${placeholders}]::uuid[])`,
            userIds
        );

        const members: ZaloGroupMember[] = pgResult.rows.map((u: any) => {
            const meta = roleMap.get(u.id) || { role: 'MEMBER', joined_at: null };
            return {
                user_id: u.id,
                zalo_group_id,
                role: meta.role,
                joined_at: meta.joined_at,
                full_name: u.full_name,
                zalo_id: u.zalo_id,
            };
        });

        // Count chính xác
        const countResult = await executeQuery(
            `MATCH (u:ZaloUser)-[:MEMBER_OF]->(g:ZaloGroup {id: $group_id})
       RETURN count(u) AS total`,
            { group_id: zalo_group_id }
        );
        const total = countResult.records.length > 0
            ? Number(countResult.records[0].get('total'))
            : members.length;

        return { members, total };
    }

    /**
     * Add user to Zalo Group — Neo4j only
     * Tạo MEMBER_OF relationship trong Neo4j.
     * Đồng thời tạo PART_OF với Workspace nếu chưa có.
     */
    static async addUserToGroup(
        zalo_group_id: string,
        user_id: string,
        role: string = 'MEMBER',
        added_by?: string
    ): Promise<ZaloGroupMember> {
        // Kiểm tra user tồn tại
        const userRes = await query(
            `SELECT id, zalo_id, full_name FROM user_profile WHERE id = $1`,
            [user_id]
        );
        if (userRes.rows.length === 0) throw new Error(`User not found: ${user_id}`);
        const user = userRes.rows[0];

        // Kiểm tra group tồn tại, lấy workspace_id
        const groupRes = await query(
            'SELECT id, workspace_id, thread_id FROM zalo_groups WHERE id = $1',
            [zalo_group_id]
        );
        if (groupRes.rows.length === 0) throw new Error('Zalo Group not found');
        const workspace_id = groupRes.rows[0].workspace_id;

        // Kiểm tra đã là member chưa (trong Neo4j)
        const existCheck = await executeQuery(
            `MATCH (u:ZaloUser {id: $user_id})-[r:MEMBER_OF]->(g:ZaloGroup {id: $group_id})
       RETURN r`,
            { user_id, group_id: zalo_group_id }
        );
        if (existCheck.records.length > 0) {
            throw new Error('User already in this group');
        }

        // Tạo MEMBER_OF relationship trong Neo4j
        await executeQuery(
            `MATCH (u:ZaloUser {id: $user_id})
       MATCH (g:ZaloGroup {id: $group_id})
       MERGE (u)-[r:MEMBER_OF]->(g)
       SET r.role = $role, r.joined_at = datetime()
       RETURN r`,
            { user_id, group_id: zalo_group_id, role }
        );

        // Đồng thời tạo PART_OF với Workspace nếu chưa có
        try {
            await executeQuery(
                `MATCH (u:ZaloUser {id: $user_id})
         MATCH (w:Workspace {id: $workspace_id})
         MERGE (u)-[r:PART_OF]->(w)
         ON CREATE SET r.role = $role, r.assigned_at = datetime()
         RETURN r`,
                { user_id, workspace_id, role }
            );
        } catch (error) {
            console.warn('Failed to create PART_OF relationship with workspace:', error);
        }

        try {
            await logAuditAction(
                workspace_id, null, added_by || null,
                'ADD_USER_TO_ZALO_GROUP',
                { group_id: zalo_group_id, user_id },
                { user_id, role }
            );
        } catch (auditErr) {
            console.warn('Failed to log audit action (non-critical):', auditErr);
        }

        return {
            user_id,
            zalo_group_id,
            role,
            joined_at: new Date().toISOString(),
            full_name: user.full_name,
            zalo_id: user.zalo_id,
        };
    }

    /**
     * Remove user from Zalo Group — Neo4j only
     * Xóa MEMBER_OF relationship trong Neo4j.
     */
    static async removeUserFromGroup(
        zalo_group_id: string,
        user_id: string,
        removed_by?: string
    ): Promise<void> {
        const groupRes = await query(
            'SELECT workspace_id FROM zalo_groups WHERE id = $1',
            [zalo_group_id]
        );
        const workspace_id = groupRes.rows.length > 0 ? groupRes.rows[0].workspace_id : null;

        // Xóa MEMBER_OF relationship trong Neo4j
        await executeQuery(
            `MATCH (u:ZaloUser {id: $user_id})-[r:MEMBER_OF]->(g:ZaloGroup {id: $group_id})
       DELETE r`,
            { user_id, group_id: zalo_group_id }
        );

        if (workspace_id) {
            try {
                await logAuditAction(
                    workspace_id, null, removed_by || null,
                    'REMOVE_USER_FROM_ZALO_GROUP',
                    { group_id: zalo_group_id, user_id },
                    null
                );
            } catch (auditErr) {
                console.warn('Failed to log audit action (non-critical):', auditErr);
            }
        }
    }

    /**
     * Get Zalo Group details (name, thread_id, etc.) from PostgreSQL
     */
    static async getGroupById(zalo_group_id: string): Promise<ZaloGroup | null> {
        const res = await query(
            `SELECT id, workspace_id, thread_id, name, created_at, updated_at
       FROM zalo_groups WHERE id = $1`,
            [zalo_group_id]
        );
        if (res.rows.length === 0) return null;
        return res.rows[0] as ZaloGroup;
    }

    /**
     * Update Zalo Group name — PostgreSQL + Neo4j sync
     */
    static async updateGroupName(
        zalo_group_id: string,
        newName: string,
        updated_by?: string
    ): Promise<ZaloGroup> {
        // Get current value for audit log
        const current = await ZaloGroupService.getGroupById(zalo_group_id);
        if (!current) throw new Error('Zalo Group not found');

        const trimmedName = newName.trim();
        if (!trimmedName) throw new Error('Name cannot be empty');

        // Update in PostgreSQL
        const res = await query(
            `UPDATE zalo_groups
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, workspace_id, thread_id, name, created_at, updated_at`,
            [trimmedName, zalo_group_id]
        );
        if (res.rows.length === 0) throw new Error('Failed to update group name');
        const updated = res.rows[0] as ZaloGroup;

        // Sync name to Neo4j ZaloGroup node
        try {
            await executeQuery(
                `MATCH (g:ZaloGroup {id: $group_id})
         SET g.name = $name, g.updated_at = datetime()
         RETURN g`,
                { group_id: zalo_group_id, name: trimmedName }
            );
        } catch (error) {
            console.warn('Failed to sync group name to Neo4j:', error);
        }

        // Audit log (non-critical — don't let audit errors break the update)
        try {
            await logAuditAction(
                current.workspace_id, null, updated_by || null,
                'UPDATE_ZALO_GROUP_NAME',
                { group_id: zalo_group_id, old_name: current.name },
                { name: trimmedName }
            );
        } catch (auditErr) {
            console.warn('Failed to log audit action (non-critical):', auditErr);
        }

        return updated;
    }
}
