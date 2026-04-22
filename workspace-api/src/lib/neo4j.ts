/**
 * Neo4j Client
 * Manages graph database connections and operations
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { logger } from './logger';

export class Neo4jClient {
  private driver: Driver;

  constructor() {
    const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'neo4j_password';

    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    logger.info('Neo4j driver initialized');
  }

  /**
   * Verify Neo4j connection
   */
  async verifyConnection(): Promise<void> {
    try {
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      logger.info('Neo4j connection verified');
    } catch (error) {
      logger.error(`Failed to verify Neo4j connection: ${error}`);
      throw error;
    }
  }

  /**
   * Get authorization context - Verify user workspace membership and permissions
   * 
   * @param zaloUserId - Zalo user ID (string từ Zalo, map với user_profile.zalo_id)
   * @param threadId   - Zalo group thread_id (string từ Zalo)
   */
  async getAuthorizationContext(
    zaloUserId: string,
    threadId: string
  ): Promise<{ workspaceId: string; role: string; availableToolIds: string[]; availableSkills: string[] } | null> {
    const session = this.driver.session();

    try {
      // ZaloUser node được tạo với {id: UUID, zalo_id: zaloString}
      // ZaloGroup node được tạo với {id: UUID, thread_id: zaloThread}
      // Điều kiện xác thực:
      //   1. ZaloGroup(thread_id) -[:BELONGS_TO]-> Workspace
      //   2. ZaloUser(zalo_id) -[:MEMBER_OF]-> ZaloGroup(thread_id)
      // Không yêu cầu ZaloUser phải có quan hệ PART_OF trực tiếp với Workspace.
      const result = await session.run(
        `
        MATCH (g:ZaloGroup {thread_id: $threadId})-[:BELONGS_TO]->(w:Workspace)
        MATCH (u:ZaloUser {zalo_id: $zaloUserId})-[r:MEMBER_OF]->(g)
        WITH w, r.role AS role
        // Whitelist tools directly
        OPTIONAL MATCH (w)-[:CAN_USE]->(t:Tool)
        WITH w, role, collect(t.id) AS tools
        OPTIONAL MATCH (s:Skill)-[:SHARED_TO]->(w)
        WITH w, role, tools, collect(s.id) AS skills
        RETURN w.id AS workspaceId, coalesce(role, 'MEMBER') AS role, tools, skills
        `,
        { zaloUserId, threadId }
      );

      if (!result.records.length) {
        return null;
      }

      const record = result.records[0];
      return {
        workspaceId: record.get('workspaceId'),
        role: record.get('role'),
        availableToolIds: record.get('tools') || [],
        availableSkills: record.get('skills') || [],
      };
    } catch (error) {
      logger.error(`Failed to get authorization context: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }


  /**
   * Check if a ZaloUser is a member of a ZaloGroup
   *
   * @param zaloId   - Zalo user ID (maps to ZaloUser.zalo_id)
   * @param threadId - Zalo group thread_id (maps to ZaloGroup.thread_id)
   * @returns Object with `is_member` boolean, optional `role`, `group_name`, and `user_id` (UUID)
   */
  async checkGroupMembership(
    zaloId: string,
    threadId: string
  ): Promise<{
    is_member: boolean;
    user_id: string | null;
    role: string | null;
    group_uuid: string | null;
    group_name: string | null;
    workspace_uuid: string | null;
    workspace_name: string | null;
  }> {
    const session = this.driver.session();

    try {
      // OPTIONAL MATCH riêng biệt cho từng phần:
      //   - u: tìm ZaloUser theo zalo_id (null nếu chưa có trong hệ thống)
      //   - g: tìm ZaloGroup theo thread_id (null nếu group chưa tồn tại)
      //   - r: tìm relationship MEMBER_OF (null nếu không phải thành viên)
      //   - w: tìm Workspace qua BELONGS_TO từ ZaloGroup
      const result = await session.run(
        `
        OPTIONAL MATCH (u:ZaloUser {zalo_id: $zaloId})
        OPTIONAL MATCH (g:ZaloGroup {thread_id: $threadId})
        OPTIONAL MATCH (u)-[r:MEMBER_OF]->(g)
        OPTIONAL MATCH (g)-[:BELONGS_TO]->(w:Workspace)
        RETURN u.id AS user_id, g.id AS group_uuid, g.name AS group_name, r.role AS role,
               w.id AS workspace_uuid, w.name AS workspace_name
        `,
        { zaloId, threadId }
      );

      const record = result.records[0];
      const role = record.get('role') ?? null;

      return {
        is_member: role !== null,
        user_id: record.get('user_id') ?? null,
        role: role !== null ? (role || 'MEMBER') : null,
        group_uuid: record.get('group_uuid') ?? null,
        group_name: record.get('group_name') ?? null,
        workspace_uuid: record.get('workspace_uuid') ?? null,
        workspace_name: record.get('workspace_name') ?? null,
      };
    } catch (error) {
      logger.error(`Failed to check group membership: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Sync skill node in Neo4j
   */
  async syncSkill(skillId: string, name: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `
        MERGE (s:Skill {id: $skillId})
        SET s.name = $name
        `,
        { skillId, name }
      );
      logger.info(`Synced Skill node in Neo4j: ${skillId} (${name})`);
    } catch (error) {
      logger.error(`Failed to sync Skill node in Neo4j: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create user ownership relationship with skill
   */
  async createOwnershipRelationship(userId: string, skillId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MATCH (u:ZaloUser {zalo_id: $userId})
        MATCH (s:Skill {id: $skillId})
        MERGE (u)-[:OWNER_OF]->(s)
        `,
        { userId, skillId }
      );

      logger.info(`Created OWNER_OF relationship: ${userId} -> ${skillId}`);
    } catch (error) {
      logger.error(`Failed to create ownership relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Link tools to a skill
   */
  async linkToolsToSkill(skillId: string, toolIds: string[]): Promise<void> {
    const session = this.driver.session();
    try {
      // First, remove existing tool links
      await session.run(
        `MATCH (s:Skill {id: $skillId})-[r:USES_TOOL]->(t:Tool) DELETE r`,
        { skillId }
      );
      
      // Then link new ones
      for (const toolId of toolIds) {
        await session.run(
          `
          MATCH (s:Skill {id: $skillId})
          MATCH (t:Tool {id: $toolId})
          MERGE (s)-[:USES_TOOL]->(t)
          `,
          { skillId, toolId }
        );
      }
      logger.info(`Linked ${toolIds.length} tools to skill ${skillId}`);
    } catch (error) {
      logger.error(`Failed to link tools to skill: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Set category for a skill
   */
  async setSkillCategory(skillId: string, categoryName: string): Promise<void> {
    const session = this.driver.session();
    try {
      // Remove existing category links
      await session.run(
        `MATCH (s:Skill {id: $skillId})-[r:HAS_CATEGORY]->(c:Category) DELETE r`,
        { skillId }
      );
      
      // Add new category
      if (categoryName) {
        await session.run(
          `
          MERGE (c:Category {name: $categoryName})
          WITH c
          MATCH (s:Skill {id: $skillId})
          MERGE (s)-[:HAS_CATEGORY]->(c)
          `,
          { categoryName, skillId }
        );
      }
      logger.info(`Set category ${categoryName} for skill ${skillId}`);
    } catch (error) {
      logger.error(`Failed to set skill category: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get skill category and tools
   */
  async getSkillRelations(skillId: string): Promise<{ 
      category: string | null, 
      tools: {id: string, name: string}[],
      owner_zalo_id: string | null,
      workspace_id: string | null
  }> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (s:Skill {id: $skillId})
        OPTIONAL MATCH (s)-[:HAS_CATEGORY]->(c:Category)
        OPTIONAL MATCH (s)-[:USES_TOOL]->(t:Tool)
        OPTIONAL MATCH (u:ZaloUser)-[:OWNER_OF]->(s)
        OPTIONAL MATCH (s)-[:SHARED_TO]->(w:Workspace)
        RETURN c.name AS category, 
               collect(DISTINCT {id: t.id, name: t.name}) AS tools,
               u.zalo_id AS owner_zalo_id,
               w.id AS workspace_id
        `,
        { skillId }
      );
      
      if (!result.records.length) return { category: null, tools: [], owner_zalo_id: null, workspace_id: null };
      const record = result.records[0];
      const toolsRaw = record.get('tools');
      const tools = Array.isArray(toolsRaw) ? toolsRaw.filter(t => t.id != null) : [];
      return {
        category: record.get('category') || null,
        tools,
        owner_zalo_id: record.get('owner_zalo_id') || null,
        workspace_id: record.get('workspace_id') || null
      };
    } catch (error) {
      logger.error(`Failed to get skill relations: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get skill IDs filtered by owner or workspace from Neo4j
   */
  async getSkillIdsByFilter(filters: { owner_zalo_id?: string, workspace_id?: string, category?: string }): Promise<string[]> {
    const session = this.driver.session();
    try {
      let query = 'MATCH (s:Skill) ';
      const params: any = {};

      if (filters.owner_zalo_id) {
        query += 'MATCH (u:ZaloUser {zalo_id: $owner_zalo_id})-[:OWNER_OF]->(s) ';
        params.owner_zalo_id = filters.owner_zalo_id;
      }
      if (filters.workspace_id) {
        query += 'MATCH (s)-[:SHARED_TO]->(w:Workspace {id: $workspace_id}) ';
        params.workspace_id = filters.workspace_id;
      }
      if (filters.category) {
        query += 'MATCH (s)-[:HAS_CATEGORY]->(c:Category {name: $category}) ';
        params.category = filters.category;
      }

      query += 'RETURN s.id AS id';
      const result = await session.run(query, params);
      return result.records.map(r => r.get('id'));
    } catch (error) {
      logger.error(`Failed to get skill IDs by filter: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Filter a list of skill IDs by category
   */
  async filterSkillsByCategory(skillIds: string[], category: string): Promise<string[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (s:Skill)-[:HAS_CATEGORY]->(c:Category {name: $category})
        WHERE s.id IN $skillIds
        RETURN s.id AS id
        `,
        { skillIds, category }
      );
      return result.records.map(r => r.get('id'));
    } catch (error) {
      logger.error(`Failed to filter skills by category: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create skill sharing relationship with workspace
   */
  async createSharingRelationship(skillId: string, workspaceId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MATCH (s:Skill {id: $skillId})
        MATCH (w:Workspace {id: $workspaceId})
        MERGE (s)-[:SHARED_TO]->(w)
        `,
        { skillId, workspaceId }
      );

      logger.info(`Created SHARED_TO relationship: ${skillId} -> ${workspaceId}`);
    } catch (error) {
      logger.error(`Failed to create sharing relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Remove skill sharing relationship with workspace
   */
  async removeSharingRelationship(skillId: string, workspaceId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MATCH (s:Skill {id: $skillId})-[r:SHARED_TO]->(w:Workspace {id: $workspaceId})
        DELETE r
        `,
        { skillId, workspaceId }
      );

      logger.info(`Removed SHARED_TO relationship: ${skillId} -> ${workspaceId}`);
    } catch (error) {
      logger.error(`Failed to remove sharing relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }


  /**
   * Delete a node and its relationships
   */
  async deleteNode(nodeId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MATCH (n {id: $nodeId})
        DETACH DELETE n
        `,
        { nodeId }
      );

      logger.info(`Deleted node: ${nodeId}`);
    } catch (error) {
      logger.error(`Failed to delete node: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create Zalo group and link to workspace
   * @param groupName - Optional name for the ZaloGroup
   */
  async createZaloGroupRelationship(threadId: string, workspaceId: string, groupName?: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MERGE (zg:ZaloGroup {thread_id: $threadId})
        SET zg.name = COALESCE(zg.name, $groupName)
        MERGE (ws:Workspace {id: $workspaceId})
        MERGE (zg)-[:BELONGS_TO]->(ws)
        `,
        { threadId, workspaceId, groupName: groupName || null }
      );

      logger.info(`Created BELONGS_TO relationship: ${threadId} -> ${workspaceId}`);
    } catch (error) {
      logger.error(`Failed to create zalo group relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get all Data nodes linked to a ToolGroup
   */
  async getToolGroupData(groupIdOrKey: string): Promise<{ id: string; key: string; value: string; created_at: string }[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (tg:ToolGroup)
         WHERE tg.id = $idOrKey OR tg.key = $idOrKey
         MATCH (tg)-[:HAS_DATA]->(d:Data)
         RETURN d.id as id, d.key as key, d.value as value, d.created_at as created_at
         ORDER BY d.created_at ASC`,
        { idOrKey: groupIdOrKey }
      );
      return result.records.map(r => ({
        id: r.get('id'),
        key: r.get('key'),
        value: r.get('value'),
        created_at: r.get('created_at'),
      }));
    } catch (error) {
      logger.error(`Failed to get tool group data for ${groupIdOrKey}: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create a Data node and link it to a ToolGroup (and optionally a Workspace)
   */
  async createToolGroupData(groupKey: string, key: string, value: string, workspaceId?: string): Promise<{ id: string; key: string; value: string; created_at: string }> {
    const session = this.driver.session();
    try {
      const id = `data_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const created_at = new Date().toISOString();

      if (workspaceId) {
        // Create Data node linked to both ToolGroup and Workspace
        await session.run(
          `MATCH (tg:ToolGroup {key: $groupKey})
           MATCH (w:Workspace {id: $workspaceId})
           CREATE (d:Data {id: $id, key: $key, value: $value, created_at: $created_at})
           CREATE (tg)-[:HAS_DATA]->(d)
           CREATE (w)-[:HAS_DATA]->(d)`,
          { groupKey, workspaceId, id, key, value, created_at }
        );
        logger.info(`Created Data node ${id} for tool group ${groupKey} in workspace ${workspaceId}`);
      } else {
        await session.run(
          `MATCH (tg:ToolGroup {key: $groupKey})
           CREATE (d:Data {id: $id, key: $key, value: $value, created_at: $created_at})
           CREATE (tg)-[:HAS_DATA]->(d)`,
          { groupKey, id, key, value, created_at }
        );
        logger.info(`Created Data node ${id} for tool group ${groupKey}`);
      }

      return { id, key, value, created_at };
    } catch (error) {
      logger.error(`Failed to create tool group data for ${groupKey}: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get all Data nodes linked to both a ToolGroup and a Workspace
   */
  async getToolGroupDataForWorkspace(groupIdOrKey: string, workspaceId: string): Promise<{ id: string; key: string; value: string; created_at: string }[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (tg:ToolGroup)-[:HAS_DATA]->(d:Data)<-[:HAS_DATA]-(w:Workspace {id: $workspaceId})
         WHERE tg.id = $groupIdOrKey OR tg.key = $groupIdOrKey
         RETURN d.id as id, d.key as key, d.value as value, d.created_at as created_at
         ORDER BY d.created_at ASC`,
        { groupIdOrKey, workspaceId }
      );
      return result.records.map(r => ({
        id: r.get('id'),
        key: r.get('key'),
        value: r.get('value'),
        created_at: r.get('created_at'),
      }));
    } catch (error) {
      logger.error(`Failed to get tool group data for ${groupIdOrKey} in workspace ${workspaceId}: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Delete all Data nodes linked to both a ToolGroup and a Workspace
   */
  async deleteToolGroupDataForWorkspace(groupKey: string, workspaceId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (tg:ToolGroup {key: $groupKey})-[:HAS_DATA]->(d:Data)<-[:HAS_DATA]-(w:Workspace {id: $workspaceId})
         DETACH DELETE d`,
        { groupKey, workspaceId }
      );
      logger.info(`Deleted all Data nodes for tool group ${groupKey} in workspace ${workspaceId}`);
    } catch (error) {
      logger.error(`Failed to delete tool group data for ${groupKey} in workspace ${workspaceId}: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Update a Data node
   */
  async updateToolData(dataId: string, key: string, value: string): Promise<{ id: string; key: string; value: string; created_at: string }> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (d:Data {id: $dataId})
         SET d.key = $key, d.value = $value
         RETURN d.id as id, d.key as key, d.value as value, d.created_at as created_at`,
        { dataId, key, value }
      );
      if (result.records.length === 0) throw new Error(`Data node ${dataId} not found`);
      const r = result.records[0];
      logger.info(`Updated Data node ${dataId}`);
      return { id: r.get('id'), key: r.get('key'), value: r.get('value'), created_at: r.get('created_at') };
    } catch (error) {
      logger.error(`Failed to update tool data ${dataId}: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a Data node
   */
  async deleteToolData(dataId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (d:Data {id: $dataId}) DETACH DELETE d`,
        { dataId }
      );
      logger.info(`Deleted Data node ${dataId}`);
    } catch (error) {
      logger.error(`Failed to delete tool data ${dataId}: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Run a raw Cypher query
   */
  async run(query: string, parameters?: any) {
    const session = this.driver.session();
    try {
      const result = await session.run(query, parameters);
      return result;
    } catch (error) {
      logger.error(`Neo4j run error: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Close driver connection
   */
  async close(): Promise<void> {
    try {
      await this.driver.close();
      logger.info('Neo4j driver closed');
    } catch (error) {
      logger.error(`Failed to close Neo4j driver: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const neo4jClient = new Neo4jClient();
