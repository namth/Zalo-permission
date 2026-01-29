import { executeQuery } from '@/lib/neo4j';
import { getZaloGroupByThreadId } from './workspace.service';
import { getUserByZaloId, getUserRoleInWorkspace } from './user.service';
import { getWorkspaceAgentConfig } from './agent.service';

/**
 * Workspace Context Response
 */
export interface WorkspaceContext {
  allowed: boolean;
  error?: string;
  message?: string;
  workspace_id?: string;
  user_id?: string;
  user_role?: string;
  agent_key?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Resolve workspace context from Zalo message
 * This is the main permission check function
 */
export async function resolveWorkspaceContext(
  thread_id: string,
  zalo_user_id: string
): Promise<WorkspaceContext> {
  try {
    // Step 1: Validate input
    if (!thread_id || !zalo_user_id) {
      return {
        allowed: false,
        error: 'INVALID_REQUEST',
        message: 'Missing required: thread_id, zalo_user_id'
      };
    }

    // Step 2: Find ZaloGroup by thread_id
    const zaloGroup = await getZaloGroupByThreadId(thread_id);
    if (!zaloGroup) {
      return {
        allowed: false,
        error: 'GROUP_NOT_FOUND',
        message: 'Zalo group not found in system'
      };
    }

    // Step 3: Get workspace from zalo group
    const workspace_id = zaloGroup.workspace_id;

    // Step 4: Get or create user
    const user = await getUserByZaloId(zalo_user_id);
    if (!user) {
      return {
        allowed: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found in system'
      };
    }

    // Step 5: Check user role in workspace
    const user_role = await getUserRoleInWorkspace(workspace_id, user.id);
    if (!user_role) {
      return {
        allowed: false,
        error: 'USER_NOT_IN_WORKSPACE',
        message: 'User not a member of this workspace'
      };
    }

    // Step 6: Get agent config for workspace
    const agentConfig = await getWorkspaceAgentConfig(workspace_id);
    if (!agentConfig) {
      return {
        allowed: false,
        error: 'AGENT_NOT_CONFIGURED',
        message: 'No agent configured for this workspace'
      };
    }

    // Step 7: Check in Neo4j (verify relationships)
    try {
      const relationshipCheck = await executeQuery(
        `MATCH (u:User {id: $user_id})
         -[:MEMBER_OF]->(g:ZaloGroup {id: $group_id})
         -[:BELONGS_TO]->(w:Workspace {id: $workspace_id})
         MATCH (u)-[:HAS_ROLE]->(w)
         RETURN u, g, w`,
        {
          user_id: user.id,
          group_id: zaloGroup.id,
          workspace_id: workspace_id
        }
      );

      if (relationshipCheck.records.length === 0) {
        // Neo4j relationships not synced yet, but PostgreSQL has them
        console.warn('Neo4j relationships not found, using PostgreSQL data');
      }
    } catch (error) {
      console.error('Neo4j relationship check failed:', error);
      // Continue - PostgreSQL is source of truth
    }

    // Step 8: Return full context
    return {
      allowed: true,
      workspace_id,
      user_id: user.id,
      user_role,
      agent_key: agentConfig.agent_key,
      system_prompt: agentConfig.system_prompt,
      temperature: agentConfig.temperature,
      max_tokens: agentConfig.max_tokens
    };
  } catch (error) {
    console.error('Error resolving workspace context:', error);
    return {
      allowed: false,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error'
    };
  }
}

/**
 * Check if user has admin role in workspace
 */
export async function isAdminInWorkspace(
  workspace_id: string,
  user_id: string
): Promise<boolean> {
  try {
    const role = await getUserRoleInWorkspace(workspace_id, user_id);
    return role === 'ADMIN';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

/**
 * Check if user is member of workspace
 */
export async function isMemberOfWorkspace(
  workspace_id: string,
  user_id: string
): Promise<boolean> {
  try {
    const role = await getUserRoleInWorkspace(workspace_id, user_id);
    return role !== null;
  } catch (error) {
    console.error('Error checking workspace membership:', error);
    return false;
  }
}
