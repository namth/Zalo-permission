// API client for permissions admin endpoints

export interface Permission {
  workspace_id: string;
  workspace_name: string;
  tool_id: string;
  tool_name: string;
  tool_key: string;
  permission_type: 'tool' | 'skill';
  created_at: string;
  created_by: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface Tool {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'deprecated' | 'disabled';
}

export interface PermissionMatrix {
  workspaces: Workspace[];
  tools: Tool[];
  permissions: Permission[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchPermissions(): Promise<PermissionMatrix> {
  const response = await fetch('/api/admin/permissions');
  const data = await response.json() as ApiResponse<PermissionMatrix>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch permissions');
  }

  return data.data!;
}

export async function grantToolAccess(workspaceId: string, toolId: string): Promise<Permission> {
  const response = await fetch('/api/admin/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      tool_id: toolId,
      permission_type: 'tool',
    }),
  });

  const data = await response.json() as ApiResponse<Permission>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to grant permission');
  }

  return data.data!;
}

export async function revokeToolAccess(workspaceId: string, toolId: string): Promise<void> {
  const response = await fetch(`/api/admin/permissions/${workspaceId}/${toolId}`, {
    method: 'DELETE',
  });

  const data = await response.json() as ApiResponse<null>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to revoke permission');
  }
}

export async function bulkGrantTools(workspaceId: string, toolIds: string[]): Promise<Permission[]> {
  const response = await fetch('/api/admin/permissions/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      tool_ids: toolIds,
      permission_type: 'tool',
    }),
  });

  const data = await response.json() as ApiResponse<Permission[]>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to grant permissions');
  }

  return data.data || [];
}
