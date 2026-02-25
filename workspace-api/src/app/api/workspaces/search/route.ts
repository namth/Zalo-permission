/**
 * GET /api/workspaces/search?name=...&limit=10&threshold=0.5
 *
 * Semantic workspace search using pgvector.
 * Embeds the query name, then finds workspaces with similar embeddings.
 * Falls back to ILIKE text search when no embedding is available (e.g. no OpenAI key).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { embeddingClient } from '@/lib/embedding';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = req.nextUrl;
        const name = searchParams.get('name')?.trim();
        const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
        const threshold = parseFloat(searchParams.get('threshold') || '0.5');

        if (!name || name.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Query parameter "name" is required' },
                { status: 400 }
            );
        }

        logger.info(`[API] GET /api/workspaces/search - name: "${name}", limit: ${limit}, threshold: ${threshold}`);

        // ------------------------------------------------------------------
        // Try vector (semantic) search first
        // ------------------------------------------------------------------
        let queryVector: number[] = [];
        try {
            queryVector = await embeddingClient.generateEmbedding(name);
        } catch (err) {
            logger.warn(`[API] Embedding generation failed, will fall back to text search: ${err}`);
        }

        if (queryVector.length > 0) {
            // ---------- Vector search with cosine similarity ----------
            const result = await db.query(
                `SELECT
           id, name, description, status, created_at, updated_at,
           1 - (embedding <-> $1::vector) AS similarity
         FROM workspaces
         WHERE embedding IS NOT NULL
           AND status = 'active'
           AND 1 - (embedding <-> $1::vector) >= $2
         ORDER BY similarity DESC
         LIMIT $3`,
                [JSON.stringify(queryVector), threshold, limit]
            );

            // If vector search returns nothing, fall through to text search
            if (result.rows.length > 0) {
                return NextResponse.json({
                    success: true,
                    search_mode: 'vector',
                    data: result.rows.map(r => ({
                        id: r.id,
                        name: r.name,
                        description: r.description,
                        status: r.status,
                        created_at: r.created_at,
                        updated_at: r.updated_at,
                        similarity: parseFloat(parseFloat(r.similarity).toFixed(4)),
                    })),
                    pagination: { limit, threshold, total: result.rows.length },
                });
            }

            logger.info(`[API] Vector search returned 0 results above threshold ${threshold}, falling back to text search`);
        }

        // ------------------------------------------------------------------
        // Fallback: ILIKE text search (partial match, case-insensitive)
        // ------------------------------------------------------------------
        const textResult = await db.query(
            `SELECT id, name, description, status, created_at, updated_at
       FROM workspaces
       WHERE status = 'active'
         AND name ILIKE $1
       ORDER BY name ASC
       LIMIT $2`,
            [`%${name}%`, limit]
        );

        return NextResponse.json({
            success: true,
            search_mode: 'text_fallback',
            data: textResult.rows.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description,
                status: r.status,
                created_at: r.created_at,
                updated_at: r.updated_at,
                similarity: null,
            })),
            pagination: { limit, threshold, total: textResult.rows.length },
        });

    } catch (error) {
        logger.error(`[API] GET /api/workspaces/search error: ${error}`);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
