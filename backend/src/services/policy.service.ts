import { executeQuery } from '@/lib/db';
import { getZaloGroupByThreadId } from './workspace.service';
import { getUserByZaloId, getUserRoleInWorkspace } from './user.service';

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
  created_at?: Date;
}

/**
 * Resolve workspace context from Zalo message
 * This is the main permission check function
 * [UPDATED] Now uses direct agent link from zalo_groups table
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

    // Step 2: Find ZaloGroup by thread_id and get agent_key directly
    const zaloGroup = await getZaloGroupByThreadId(thread_id);
    if (!zaloGroup) {
      return {
        allowed: false,
        error: 'ZALO_GROUP_NOT_FOUND',
        message: 'Zalo group not found or not configured'
      };
    }

    // Step 3: [NEW] Check if agent is configured for this group
    if (!zaloGroup.agent_key) {
      return {
        allowed: false,
        error: 'AGENT_NOT_CONFIGURED',
        message: 'No agent configured for this Zalo group'
      };
    }

    // Step 4: Get workspace from zalo group (for user membership check)
    const workspace_id = zaloGroup.workspace_id;

    // Step 6: Get or create user
    const user = await getUserByZaloId(zalo_user_id);
    if (!user) {
      return {
        allowed: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found in system'
      };
    }

    // Step 7: Check user role in workspace (optional permission check)
    const user_role = await getUserRoleInWorkspace(workspace_id, user.id);
    if (!user_role) {
      return {
        allowed: false,
        error: 'USER_NOT_IN_WORKSPACE',
        message: 'User not a member of this workspace'
      };
    }

    // Step 8: Return full context
    return {
      allowed: true,
      workspace_id,
      user_id: user.id,
      user_role,
      agent_key: zaloGroup.agent_key,
      created_at: zaloGroup.created_at
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
