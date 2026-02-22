
import { query, executeQuery } from '@/lib/db';
import { logAuditAction } from './audit.service';
import { assignUserRole } from './workspace.service';

/**
 * Zalo Group Member Type
 */
export interface ZaloGroupMember {
    id: string; // member record id
    zalo_group_id: string;
    user_id: string;
    role: string;
    status: string;
    joined_at: Date;
    updated_at: Date;
    user?: {
        full_name: string;
        zalo_id: string;
        avatar?: string;
    };
}

function serializeRow<T extends Record<string, any>>(row: T): T {
    const serialized: any = { ...row };
    Object.keys(serialized).forEach(key => {
        if (serialized[key] instanceof Date) {
            serialized[key] = serialized[key].toISOString();
        }
    });
    return serialized;
}

export class ZaloGroupService {

    /**
     * Get users in a Zalo Group
     */
    static async getGroupUsers(
        zalo_group_id: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<{ members: ZaloGroupMember[]; total: number }> {
        const countResult = await query(
            `SELECT COUNT(*) as count FROM zalo_group_members WHERE zalo_group_id = $1`,
            [zalo_group_id]
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const result = await query(
            `SELECT m.*, 
        u.full_name, u.zalo_id
       FROM zalo_group_members m
       JOIN user_profile u ON m.user_id = u.id
       WHERE m.zalo_group_id = $1
       ORDER BY m.joined_at DESC
       LIMIT $2 OFFSET $3`,
            [zalo_group_id, limit, offset]
        );

        const members = result.rows.map(row => {
            const { full_name, zalo_id, ...memberData } = row;
            const member = serializeRow(memberData);
            member.user = { full_name, zalo_id };
            return member as ZaloGroupMember;
        });

        return { members, total };
    }

    /**
     * Add user to Zalo Group
     */
    static async addUserToGroup(
        zalo_group_id: string,
        user_id: string,
        role: string = 'MEMBER',
        added_by?: string
    ): Promise<ZaloGroupMember> {
        // Check if member exists
        const existing = await query(
            `SELECT id FROM zalo_group_members WHERE zalo_group_id = $1 AND user_id = $2`,
            [zalo_group_id, user_id]
        );

        if (existing.rows.length > 0) {
            throw new Error('User already in this group');
        }

        // Get workspace_id for audit logs (need to lookup)
        const groupRes = await query('SELECT workspace_id FROM zalo_groups WHERE id = $1', [zalo_group_id]);
        if (groupRes.rows.length === 0) throw new Error('Zalo Group not found');
        const workspace_id = groupRes.rows[0].workspace_id;

        const result = await query(
            `INSERT INTO zalo_group_members (zalo_group_id, user_id, role, status, joined_at, updated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW())
       RETURNING *`,
            [zalo_group_id, user_id, role]
        );

        const member = serializeRow(result.rows[0]);

        // Neo4j Sync
        try {
            await executeQuery(
                `MATCH (u:ZaloUser {id: $user_id})
         MATCH (g:ZaloGroup {id: $group_id})
         MERGE (u)-[r:MEMBER_OF]->(g)
         SET r.role = $role, r.joined_at = datetime()
         RETURN r`,
                { user_id, group_id: zalo_group_id, role }
            );
        } catch (error) {
            console.error('Failed to sync group member to Neo4j:', error);
        }

        // Also link to Workspace as MEMBER if not already (Requirement: link to workspace always)
        try {
            await assignUserRole(workspace_id, user_id, 'MEMBER', added_by);
        } catch (e) {
            // Ignore if already member or log warning
            console.warn('User might already be in workspace or assignment failed:', e);
        }

        await logAuditAction(workspace_id, null, added_by || null, 'ADD_USER_TO_ZALO_GROUP', { group_id: zalo_group_id, user_id }, member);

        return member;
    }

    /**
     * Remove user from Zalo Group
     */
    static async removeUserFromGroup(
        zalo_group_id: string,
        user_id: string,
        removed_by?: string
    ): Promise<void> {
        const groupRes = await query('SELECT workspace_id FROM zalo_groups WHERE id = $1', [zalo_group_id]);
        const workspace_id = groupRes.rows.length > 0 ? groupRes.rows[0].workspace_id : null;

        // Delete from PG
        await query(
            `DELETE FROM zalo_group_members WHERE zalo_group_id = $1 AND user_id = $2`,
            [zalo_group_id, user_id]
        );

        // Neo4j Sync
        try {
            await executeQuery(
                `MATCH (u:ZaloUser {id: $user_id})-[r:MEMBER_OF]->(g:ZaloGroup {id: $group_id})
         DELETE r`,
                { user_id, group_id: zalo_group_id }
            );
        } catch (error) {
            console.error('Failed to remove group member from Neo4j:', error);
        }

        if (workspace_id) {
            await logAuditAction(workspace_id, null, removed_by || null, 'REMOVE_USER_FROM_ZALO_GROUP', { group_id: zalo_group_id, user_id }, null);
        }
    }
}
