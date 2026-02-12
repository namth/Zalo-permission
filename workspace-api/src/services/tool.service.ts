/**
 * Tool Service
 * Manages tools/integrations with vector embeddings for semantic search
 */

import { Pool } from 'pg';
import { Tool, CreateToolRequest } from '../types';
import { embeddingClient } from '../lib/embedding';
import { logger } from '../lib/logger';

export class ToolService {
  constructor(private db: Pool) {}

  /**
   * Create a new tool with embedding generation
   */
  async createTool(request: CreateToolRequest): Promise<Tool> {
    try {
      // Generate embedding from description
      let embedding: number[] | undefined;
      if (request.description) {
        embedding = await embeddingClient.generateEmbedding(request.description);
      }

      const query = `
        INSERT INTO tools (key, name, description, input_schema, embedding, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.key,
        request.name,
        request.description || null,
        request.input_schema ? JSON.stringify(request.input_schema) : null,
        embedding ? JSON.stringify(embedding) : null,
      ]);

      const row = result.rows[0];
      logger.info(`Tool created: ${request.key}`);

      return this.mapRowToTool(row);
    } catch (error) {
      logger.error(`Failed to create tool: ${error}`);
      throw error;
    }
  }

  /**
   * Get tool by key
   */
  async getToolByKey(key: string): Promise<Tool | null> {
    try {
      const query = 'SELECT * FROM tools WHERE key = $1';
      const result = await this.db.query(query, [key]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTool(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get tool ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * Get tool by ID
   */
  async getToolById(id: string): Promise<Tool | null> {
    try {
      const query = 'SELECT * FROM tools WHERE id = $1';
      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTool(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to get tool ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * List all tools with optional filtering
   */
  async listTools(status?: string, limit: number = 100, offset: number = 0): Promise<{ tools: Tool[]; total: number }> {
    try {
      let query = 'SELECT * FROM tools';
      const params: any[] = [];

      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      const tools = result.rows.map((row) => this.mapRowToTool(row));

      // Get total count
      let countQuery = 'SELECT COUNT(*) as count FROM tools';
      if (status) {
        countQuery += ' WHERE status = $1';
      }

      const countResult = await this.db.query(countQuery, status ? [status] : []);
      const total = parseInt(countResult.rows[0].count, 10);

      return { tools, total };
    } catch (error) {
      logger.error(`Failed to list tools: ${error}`);
      throw error;
    }
  }

  /**
   * Update tool
   */
  async updateTool(id: string, updates: Partial<Tool>): Promise<Tool> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(updates.description);

        // Regenerate embedding if description changed
        if (updates.description) {
          const embedding = await embeddingClient.generateEmbedding(updates.description);
          fields.push(`embedding = $${paramIndex++}`);
          values.push(JSON.stringify(embedding));
        }
      }

      if (updates.input_schema !== undefined) {
        fields.push(`input_schema = $${paramIndex++}`);
        values.push(updates.input_schema ? JSON.stringify(updates.input_schema) : null);
      }

      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (fields.length === 0) {
        return this.getToolById(id) as Promise<Tool>;
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE tools 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error(`Tool ${id} not found`);
      }

      logger.info(`Tool ${id} updated`);
      return this.mapRowToTool(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to update tool ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete tool
   */
  async deleteTool(id: string): Promise<void> {
    try {
      const query = 'DELETE FROM tools WHERE id = $1';
      await this.db.query(query, [id]);
      logger.info(`Tool ${id} deleted`);
    } catch (error) {
      logger.error(`Failed to delete tool ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Vector similarity search for tools
   */
  async searchToolsByEmbedding(
    query: string,
    workspaceId?: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<Tool[]> {
    try {
      // Generate embedding for search query
      const queryEmbedding = await embeddingClient.generateEmbedding(query);

      let sql = `
        SELECT 
          t.*,
          1 - (t.embedding <=> $1::vector) as similarity
        FROM tools t
      `;

      const params: any[] = [JSON.stringify(queryEmbedding)];

      // Filter by workspace tools if workspace_id provided
      if (workspaceId) {
        sql += `
          INNER JOIN (
            SELECT DISTINCT t2.id 
            FROM tools t2
            INNER JOIN (
              SELECT tool_id FROM workspace_tools 
              WHERE workspace_id = $${params.length + 1}
            ) wt ON t2.id = wt.tool_id
          ) allowed_tools ON t.id = allowed_tools.id
        `;
        params.push(workspaceId);
      }

      // Filter by similarity threshold and active status
      sql += `
        WHERE 1 - (t.embedding <=> $1::vector) > $${params.length + 1}
        AND t.status = 'active'
        ORDER BY similarity DESC
        LIMIT $${params.length + 2}
      `;
      params.push(threshold, limit);

      const result = await this.db.query(sql, params);
      return result.rows.map((row) => this.mapRowToTool(row));
    } catch (error) {
      logger.error(`Failed to search tools by embedding: ${error}`);
      throw error;
    }
  }

  /**
   * Get tools available to a workspace
   */
  async getWorkspaceTools(workspaceId: string): Promise<Tool[]> {
    try {
      const query = `
        SELECT DISTINCT t.* 
        FROM tools t
        INNER JOIN neo4j_relationships nr ON t.key = nr.target_key
        WHERE nr.relationship_type = 'CAN_USE'
        AND nr.source_id = $1
        AND t.status = 'active'
        ORDER BY t.created_at DESC
      `;

      const result = await this.db.query(query, [workspaceId]);
      return result.rows.map((row) => this.mapRowToTool(row));
    } catch (error) {
      logger.error(`Failed to get workspace tools for ${workspaceId}: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Map database row to Tool interface
   */
  private mapRowToTool(row: any): Tool {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      input_schema: row.input_schema ? JSON.parse(row.input_schema) : undefined,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      status: row.status,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
