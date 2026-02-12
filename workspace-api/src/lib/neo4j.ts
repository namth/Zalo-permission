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
   */
  async getAuthorizationContext(
    userId: string,
    threadId: string
  ): Promise<{ workspaceId: string; role: string; availableTools: string[]; availableSkills: string[] } | null> {
    const session = this.driver.session();

    try {
      const result = await session.run(
        `
        MATCH (u:ZaloUser {zalo_user_id: $userId})-[:PART_OF {role: $role}]->(w:Workspace)<-[:BELONGS_TO]-(zg:ZaloGroup {zalo_thread_id: $threadId})
        WITH w, u, $role as role
        OPTIONAL MATCH (w)-[:CAN_USE]->(t:Tool)
        WITH w, u, role, collect(t.key) as tools
        OPTIONAL MATCH (s:Skill)-[:SHARED_TO]->(w)
        WITH w, u, role, tools, collect(s.id) as skills
        RETURN w.id as workspaceId, role, tools, skills
        `,
        { userId, threadId, role: 'admin' }
      );

      // Try as member if admin query fails
      if (!result.records.length) {
        const memberResult = await session.run(
          `
          MATCH (u:ZaloUser {zalo_user_id: $userId})-[:PART_OF {role: 'member'}]->(w:Workspace)<-[:BELONGS_TO]-(zg:ZaloGroup {zalo_thread_id: $threadId})
          WITH w, u, 'member' as role
          OPTIONAL MATCH (w)-[:CAN_USE]->(t:Tool)
          WITH w, u, role, collect(t.key) as tools
          OPTIONAL MATCH (s:Skill)-[:SHARED_TO]->(w)
          WITH w, u, role, tools, collect(s.id) as skills
          RETURN w.id as workspaceId, role, tools, skills
          `,
          { userId, threadId }
        );

        if (!memberResult.records.length) {
          return null;
        }

        const record = memberResult.records[0];
        return {
          workspaceId: record.get('workspaceId'),
          role: record.get('role'),
          availableTools: record.get('tools'),
          availableSkills: record.get('skills'),
        };
      }

      const record = result.records[0];
      return {
        workspaceId: record.get('workspaceId'),
        role: record.get('role'),
        availableTools: record.get('tools'),
        availableSkills: record.get('skills'),
      };
    } catch (error) {
      logger.error(`Failed to get authorization context: ${error}`);
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
        MATCH (u:ZaloUser {zalo_user_id: $userId})
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
   * Create tool access permission
   */
  async createToolPermission(workspaceId: string, toolKey: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MATCH (w:Workspace {id: $workspaceId})
        MATCH (t:Tool {key: $toolKey})
        MERGE (w)-[:CAN_USE]->(t)
        `,
        { workspaceId, toolKey }
      );

      logger.info(`Created CAN_USE relationship: ${workspaceId} -> ${toolKey}`);
    } catch (error) {
      logger.error(`Failed to create tool permission: ${error}`);
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
      // Delete relationships first, then node
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
