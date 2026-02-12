/**
 * /api/admin/workspaces/[id]
 *
 * Admin API for managing individual workspaces
 * GET: Get workspace details
 * PUT: Update workspace
 * DELETE: Delete workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { logger } from "@/lib/logger";
import { deleteWorkspaceAdmin } from "@/services/admin.service";

export const dynamic = "force-dynamic";

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id } = params;
    logger.info(`[API] GET /api/admin/workspaces/${id}`);

    const result = await db.query(`SELECT * FROM workspaces WHERE id = $1`, [
      id,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(`[API] GET /api/admin/workspaces/[id] error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description } = body;

    logger.info(`[API] PUT /api/admin/workspaces/${id}`);

    const result = await db.query(
      `UPDATE workspaces
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name || null, description || null, id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace not found",
        },
        { status: 404 },
      );
    }

    logger.info(`[API] Workspace ${id} updated`);

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(`[API] PUT /api/admin/workspaces/[id] error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id } = params;
    logger.info(`[API] DELETE /api/admin/workspaces/${id}`);

    // Use deleteWorkspaceAdmin from admin.service to handle both PostgreSQL and Neo4j deletion
    await deleteWorkspaceAdmin(id);

    logger.info(`[API] Workspace ${id} deleted from PostgreSQL and Neo4j`);

    return NextResponse.json(
      {
        success: true,
        message: "Workspace deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(`[API] DELETE /api/admin/workspaces/[id] error: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    );
  }
}
