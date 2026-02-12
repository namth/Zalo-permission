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
  ) {}

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
        INSERT INTO skills (name, description, logic_config, owner_id, workspace_id, is_shared, embedding, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.name,
        request.description,
        JSON.stringify(request.logic_config),
        request.owner_id,
        request.workspace_id,
        request.is_shared || false,
        embedding ? JSON.stringify(embedding) : null,
      ]);

      const skill = this.mapRowToSkill(result.rows[0]);

      // Create Neo4j relationship: User -[:OWNER_OF]-> Skill
      await this.neo4j.createOwnershipRelationship(request.owner_id, skill.id);

      // If shared, create Neo4j relationship: Skill -[:SHARED_TO]-> Workspace
      if (request.is_shared) {
        await this.neo4j.createSharingRelationship(skill.id, request.workspace_id);
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

  /**
   * List skills by owner
   */
  async listSkillsByOwner(
    ownerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ skills: Skill[]; total: number }> {
    try {
      const query = `
        SELECT * FROM skills 
        WHERE owner_id = $1 AND status = 'active'
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [ownerId, limit, offset]);
      const skills = result.rows.map((row) => this.mapRowToSkill(row));

      // Get total count
      const countResult = await this.db.query('SELECT COUNT(*) as count FROM skills WHERE owner_id = $1', [ownerId]);
      const total = parseInt(countResult.rows[0].count, 10);

      return { skills, total };
    } catch (error) {
      logger.error(`Failed to list skills by owner ${ownerId}: ${error}`);
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
  async deleteSkill(id: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const skillResult = await this.db.query('SELECT owner_id FROM skills WHERE id = $1', [id]);

      if (skillResult.rows.length === 0) {
        throw new Error(`Skill ${id} not found`);
      }

      if (skillResult.rows[0].owner_id !== userId) {
        throw new Error(`User ${userId} is not the owner of skill ${id}`);
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
  async shareSkill(skillId: string, workspaceId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const skillResult = await this.db.query('SELECT owner_id FROM skills WHERE id = $1', [skillId]);

      if (skillResult.rows.length === 0) {
        throw new Error(`Skill ${skillId} not found`);
      }

      if (skillResult.rows[0].owner_id !== userId) {
        throw new Error(`User ${userId} is not the owner of skill ${skillId}`);
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
      logic_config: Array.isArray(row.logic_config) ? row.logic_config : JSON.parse(row.logic_config),
      owner_id: row.owner_id,
      workspace_id: row.workspace_id,
      is_shared: row.is_shared,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      status: row.status,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
