/**
 * pgvector Search Helper
 * Utilities for vector similarity search in PostgreSQL
 */

import { Pool, QueryResult } from 'pg';
import { logger } from './logger';

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number; // Cosine similarity threshold (0-1)
  operator?: '<->' | '<#>' | '@@'; // <-> cosine, <#> inner product, @@ L2 distance
}

export interface VectorSearchResult<T> {
  item: T;
  similarity: number;
  distance?: number;
}

/**
 * Perform vector similarity search
 */
export async function vectorSearch<T>(
  db: Pool,
  tableName: string,
  vectorColumnName: string,
  query: number[],
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult<T>[]> {
  try {
    const { limit = 10, threshold = 0.5, operator = '<->' } = options;

    if (!Array.isArray(query) || query.length === 0) {
      logger.warn(`Invalid query vector for ${tableName}`);
      return [];
    }

    // Build query for cosine similarity
    const sql = `
      SELECT 
        *,
        1 - (${vectorColumnName} ${operator} $1::vector) as similarity
      FROM ${tableName}
      WHERE ${vectorColumnName} IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $2
    `;

    const result: QueryResult<T & { similarity: number }> = await db.query(sql, [
      JSON.stringify(query),
      limit,
    ]);

    // Filter by threshold and map results
    const results: VectorSearchResult<T>[] = result.rows
      .filter((row) => row.similarity >= threshold)
      .map((row) => {
        const { similarity, ...item } = row;
        return {
          item: item as T,
          similarity,
        };
      });

    logger.debug(`Vector search on ${tableName}: found ${results.length} results`);

    return results;
  } catch (error) {
    logger.error(`Vector search failed: ${error}`);
    throw error;
  }
}

/**
 * Batch vector similarity search
 */
export async function vectorSearchBatch<T>(
  db: Pool,
  tableName: string,
  vectorColumnName: string,
  queries: number[][],
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult<T>[][]> {
  try {
    const results: VectorSearchResult<T>[][] = [];

    for (const query of queries) {
      const result = await vectorSearch<T>(db, tableName, vectorColumnName, query, options);
      results.push(result);
    }

    return results;
  } catch (error) {
    logger.error(`Batch vector search failed: ${error}`);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * SQL: 1 - (v1 <-> v2)
 */
export function cosineSimilaritySQL(vectorCol: string, queryVector: string): string {
  return `1 - (${vectorCol} <-> '${queryVector}'::vector)`;
}

/**
 * Create HNSW index on vector column for faster search
 * Requires: pgvector extension installed
 */
export async function createVectorIndex(
  db: Pool,
  tableName: string,
  columnName: string,
  indexType: 'hnsw' | 'ivfflat' = 'hnsw'
): Promise<void> {
  try {
    const indexName = `idx_${tableName}_${columnName}_vector`;

    const sql = `
      CREATE INDEX IF NOT EXISTS ${indexName}
      ON ${tableName} USING ${indexType} (${columnName} vector_cosine_ops)
    `;

    await db.query(sql);

    logger.info(`Created ${indexType} index on ${tableName}.${columnName}`);
  } catch (error) {
    logger.error(`Failed to create vector index: ${error}`);
    throw error;
  }
}

/**
 * Check if pgvector extension is installed
 */
export async function isPgvectorInstalled(db: Pool): Promise<boolean> {
  try {
    const result = await db.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as installed
    `);

    return result.rows[0].installed;
  } catch (error) {
    logger.error(`Failed to check pgvector installation: ${error}`);
    return false;
  }
}

/**
 * Install pgvector extension
 */
export async function installPgvector(db: Pool): Promise<void> {
  try {
    const installed = await isPgvectorInstalled(db);

    if (installed) {
      logger.info('pgvector already installed');
      return;
    }

    await db.query('CREATE EXTENSION IF NOT EXISTS vector');
    logger.info('pgvector extension installed');
  } catch (error) {
    logger.error(`Failed to install pgvector: ${error}`);
    throw error;
  }
}

/**
 * Get vector statistics
 */
export async function getVectorStats(db: Pool, tableName: string, columnName: string): Promise<{
  null_count: number;
  not_null_count: number;
  total: number;
} | null> {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE ${columnName} IS NULL) as null_count,
        COUNT(*) FILTER (WHERE ${columnName} IS NOT NULL) as not_null_count,
        COUNT(*) as total
      FROM ${tableName}
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return {
      null_count: parseInt(result.rows[0].null_count, 10),
      not_null_count: parseInt(result.rows[0].not_null_count, 10),
      total: parseInt(result.rows[0].total, 10),
    };
  } catch (error) {
    logger.error(`Failed to get vector statistics: ${error}`);
    throw error;
  }
}
