import { NextRequest, NextResponse } from "next/server";
import { query, executeQuery } from "@/lib/db";
import { getAgent } from "@/services/agent.service";
import { logAuditAction } from "@/services/audit.service";

/**
 * GET /api/workspace/groups/:group_id/agents - Get agent for a Zalo group
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { group_id: string } },
) {
  try {
    const groupId = params.group_id;

    // Get group with agent_key
    const groupResult = await query(
      `SELECT agent_key FROM zalo_groups WHERE id = $1`,
      [groupId],
    );

    if (groupResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 },
      );
    }

    const agentKey = groupResult.rows[0].agent_key;

    // If no agent assigned, return null
    if (!agentKey) {
      return NextResponse.json({ success: true, data: null }, { status: 200 });
    }

    // Get agent details
    const agent = await getAgent(agentKey);

    return NextResponse.json({ success: true, data: agent }, { status: 200 });
  } catch (error: any) {
    console.error("Error getting group agent:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get group agent" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspace/groups/:group_id/agents - Assign agent to group
 * Each Zalo group can have exactly one agent via agent_key column
 * Body: { agent_key, assigned_by? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { group_id: string } },
) {
  try {
    const groupId = params.group_id;
    let body;

    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!body.agent_key) {
      return NextResponse.json(
        { success: false, error: "agent_key is required" },
        { status: 400 },
      );
    }

    // Get group
    const groupResult = await query(
      `SELECT id, workspace_id FROM zalo_groups WHERE id = $1`,
      [groupId],
    );

    if (groupResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 },
      );
    }

    const workspaceId = groupResult.rows[0].workspace_id;

    // Verify agent exists
    const agent = await getAgent(body.agent_key);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent not found: ${body.agent_key}` },
        { status: 404 },
      );
    }

    // Update group with agent_key
    const result = await query(
      `UPDATE zalo_groups 
       SET agent_key = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, agent_key, workspace_id, updated_at`,
      [body.agent_key, groupId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to assign agent to group" },
        { status: 500 },
      );
    }

    const updatedGroup = result.rows[0];

    // Create relationship in Neo4j between group and agent
    try {
      await executeQuery(
        `MATCH (g:ZaloGroup {id: $group_id})
         MATCH (a:Agent {key: $agent_key})
         MERGE (g)-[r:USES_AGENT]->(a)
         RETURN r`,
        { group_id: groupId, agent_key: body.agent_key },
      );
    } catch (error) {
      console.error("Failed to create Neo4j relationship:", error);
      // Continue - relationship creation not critical
    }

    // Log audit
    await logAuditAction(
      workspaceId,
      body.assigned_by || null,
      "ASSIGN_AGENT",
      "ZaloGroup",
      groupId,
      { agent_key: null },
      { agent_key: body.agent_key },
    );

    return NextResponse.json(
      { success: true, data: updatedGroup },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error assigning agent to group:", error);
    console.error("Stack trace:", error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to assign agent",
        details: error.stack,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspace/groups/:group_id/agents - Remove agent from group
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { group_id: string } },
) {
  try {
    const groupId = params.group_id;

    // Get group
    const groupResult = await query(
      `SELECT id, workspace_id, agent_key FROM zalo_groups WHERE id = $1`,
      [groupId],
    );

    if (groupResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 },
      );
    }

    const workspaceId = groupResult.rows[0].workspace_id;
    const previousAgentKey = groupResult.rows[0].agent_key;

    // Update group to remove agent_key
    const result = await query(
      `UPDATE zalo_groups 
       SET agent_key = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, agent_key, workspace_id, updated_at`,
      [groupId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to remove agent from group" },
        { status: 500 },
      );
    }

    // Remove relationship from Neo4j
    if (previousAgentKey) {
      try {
        await executeQuery(
          `MATCH (g:ZaloGroup {id: $group_id})-[r:USES_AGENT]->(a:Agent {key: $agent_key})
           DELETE r
           RETURN g`,
          { group_id: groupId, agent_key: previousAgentKey },
        );
      } catch (error) {
        console.error("Failed to delete Neo4j relationship:", error);
        // Continue - relationship deletion not critical
      }
    }

    // Log audit
    await logAuditAction(
      workspaceId,
      null,
      "REMOVE_AGENT",
      "ZaloGroup",
      groupId,
      { agent_key: previousAgentKey },
      { agent_key: null },
    );

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error removing agent from group:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to remove agent",
      },
      { status: 500 },
    );
  }
}
