/**
 * Skill Service
 * Manages skills (learned procedures) - immutable after creation
 */

import { Pool } from 'pg';
import { Skill, SkillStep, LearnSkillRequest } from '../types';
import { embeddingClient } from '../lib/embedding';
import { logger } from '../lib/logger';
import { Neo4jClient } from '../lib/neo4j';

export class SkillService {
  constructor(
    private db: Pool,
    private neo4j: Neo4jClient
  ) { }

  /**
   * Create a new skill (learned from user instruction)
   */
  async createSkill(request: LearnSkillRequest): Promise<Skill> {
    try {
      // Generate embedding from description
      let embedding: number[] | undefined;
      if (request.description) {
        embedding = await embeddingClient.generateEmbedding(request.description);
      }

      const query = `
        INSERT INTO skills (name, description, detail, is_shared, embedding, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.name,
        request.description,
        request.detail,
        request.is_shared || false,
        embedding ? JSON.stringify(embedding) : null,
      ]);

      const skill = this.mapRowToSkill(result.rows[0]);

      // Ensure Skill node exists in Neo4j
      await this.neo4j.syncSkill(skill.id, skill.name);

      // Resolve owner_id to zalo_id for Neo4j relationship creation
      let ownerZaloId = request.owner_id;
      if (request.owner_id && request.owner_id.length === 36) {
        const userRes = await this.db.query('SELECT zalo_id FROM user_profile WHERE id = $1', [request.owner_id]);
        if (userRes.rows.length > 0) {
          ownerZaloId = userRes.rows[0].zalo_id;
        }
      }

      // Create Neo4j relationship: User -[:OWNER_OF]-> Skill
      await this.neo4j.createOwnershipRelationship(ownerZaloId, skill.id);

      // If shared, create Neo4j relationship: Skill -[:SHARED_TO]-> Workspace
      if (request.is_shared) {
        await this.neo4j.createSharingRelationship(skill.id, request.workspace_id);
      }

      // Link tools in Neo4j if provided
      if (request.tools && request.tools.length > 0) {
        await this.neo4j.linkToolsToSkill(skill.id, request.tools);
      }

      // Set category in Neo4j if provided
      if (request.category) {
        await this.neo4j.setSkillCategory(skill.id, request.category);
      }

      logger.info(`Skill created: ${skill.id} by user ${request.owner_id}`);
      return skill;
    } catch (error) {
      logger.error(`Failed to create skill: ${error}`);
      throw error;
    }
  }

  /**
   * Get skill by ID
   */
  async getSkillById(id: string): Promise<Skill | null> {
    try {
      const query = 'SELECT * FROM skills WHERE id = $1';
      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSkill(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get skill ${id}: ${error}`);
      throw error;
    }
  }

  async listSkillsByOwner(
    ownerZaloId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ skills: Skill[]; total: number }> {
    try {
      // Get skill IDs from Neo4j
      const skillIds = await this.neo4j.getSkillIdsByFilter({ owner_zalo_id: ownerZaloId });
      
      if (skillIds.length === 0) {
        return { skills: [], total: 0 };
      }

      const query = `
        SELECT * FROM skills 
        WHERE id = ANY($1::uuid[]) AND status = 'active'
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [skillIds, limit, offset]);
      const skills = result.rows.map((row) => this.mapRowToSkill(row));

      return { skills, total: skillIds.length };
    } catch (error) {
      logger.error(`Failed to list skills by owner ${ownerZaloId}: ${error}`);
      throw error;
    }
  }

  /**
   * List skills available in a workspace (including shared ones)
   */
  async listWorkspaceSkills(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ skills: Skill[]; total: number }> {
    try {
      const query = `
        SELECT DISTINCT s.* FROM skills s
        INNER JOIN neo4j_relationships nr ON s.id = nr.source_id
        WHERE nr.relationship_type = 'SHARED_TO'
        AND nr.target_id = $1
        AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [workspaceId, limit, offset]);
      const skills = result.rows.map((row) => this.mapRowToSkill(row));

      // Get total count
      const countResult = await this.db.query(
        `
        SELECT COUNT(DISTINCT s.id) as count FROM skills s
        INNER JOIN neo4j_relationships nr ON s.id = nr.source_id
        WHERE nr.relationship_type = 'SHARED_TO'
        AND nr.target_id = $1
        AND s.status = 'active'
        `,
        [workspaceId]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      return { skills, total };
    } catch (error) {
      logger.error(`Failed to list skills for workspace ${workspaceId}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete skill (soft delete - set status to archived)
   */
  async deleteSkill(id: string, userZaloId: string): Promise<void> {
    try {
      // Verify ownership via Neo4j
      const relations = await this.neo4j.getSkillRelations(id);

      if (!relations.owner_zalo_id) {
        throw new Error(`Skill ${id} ownership not found in Neo4j`);
      }

      if (relations.owner_zalo_id !== userZaloId) {
        throw new Error(`User ${userZaloId} is not the owner of skill ${id}`);
      }

      // Soft delete by updating status
      const query = 'UPDATE skills SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
      await this.db.query(query, ['archived', id]);

      // Remove Neo4j relationships
      await this.neo4j.deleteNode(id);

      logger.info(`Skill ${id} archived`);
    } catch (error) {
      logger.error(`Failed to delete skill ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Share skill with workspace
   */
  async shareSkill(skillId: string, workspaceId: string, userZaloId: string): Promise<void> {
    try {
      // Verify ownership via Neo4j
      const relations = await this.neo4j.getSkillRelations(skillId);

      if (!relations.owner_zalo_id) {
        throw new Error(`Skill ${skillId} ownership not found in Neo4j`);
      }

      if (relations.owner_zalo_id !== userZaloId) {
        throw new Error(`User ${userZaloId} is not the owner of skill ${skillId}`);
      }

      // Update is_shared flag
      const query = 'UPDATE skills SET is_shared = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
      await this.db.query(query, [skillId]);

      // Create Neo4j relationship: Skill -[:SHARED_TO]-> Workspace
      await this.neo4j.createSharingRelationship(skillId, workspaceId);

      logger.info(`Skill ${skillId} shared with workspace ${workspaceId}`);
    } catch (error) {
      logger.error(`Failed to share skill ${skillId}: ${error}`);
      throw error;
    }
  }

  /**
   * Vector similarity search for skills
   */
  async searchSkillsByEmbedding(
    query: string,
    workspaceId?: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<Skill[]> {
    try {
      // Generate embedding for search query
      const queryEmbedding = await embeddingClient.generateEmbedding(query);

      let sql = `
        SELECT 
          s.*,
          1 - (s.embedding <=> $1::vector) as similarity
        FROM skills s
      `;

      const params: any[] = [JSON.stringify(queryEmbedding)];

      // Filter by workspace if provided
      if (workspaceId) {
        sql += `
          INNER JOIN neo4j_relationships nr ON s.id = nr.source_id
          WHERE nr.relationship_type = 'SHARED_TO'
          AND nr.target_id = $${params.length + 1}
          AND s.status = 'active'
        `;
        params.push(workspaceId);
      } else {
        sql += ` WHERE s.status = 'active'`;
      }

      // Filter by similarity threshold
      sql += ` AND 1 - (s.embedding <=> $1::vector) > $${params.length + 1}
        ORDER BY similarity DESC
        LIMIT $${params.length + 2}
      `;
      params.push(threshold, limit);

      const result = await this.db.query(sql, params);
      return result.rows.map((row) => this.mapRowToSkill(row));
    } catch (error) {
      logger.error(`Failed to search skills by embedding: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Map database row to Skill interface
   */
  private mapRowToSkill(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      detail: row.detail,
      is_shared: row.is_shared,
      embedding: row.embedding && typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding,
      status: row.status,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
