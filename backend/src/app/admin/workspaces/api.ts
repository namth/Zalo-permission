// API client for workspace admin endpoints

const API_BASE = '/api/admin/workspaces';

export interface WorkspaceForm {
  workspace_id?: string;
  name: string;
  type?: string;
  agent_key?: string;
  system_prompt: string;
  status?: string;
}

export async function fetchWorkspaces() {
  const response = await fetch(API_BASE, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data || [];
}

export async function fetchWorkspaceDetail(workspace_id: string) {
  const response = await fetch(`${API_BASE}/${workspace_id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspace: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
}

export async function createWorkspace(data: WorkspaceForm) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create workspace');
  }

  const json = await response.json();
  return json.data;
}

export async function updateWorkspace(
  workspace_id: string,
  data: Partial<WorkspaceForm>
) {
  const response = await fetch(`${API_BASE}/${workspace_id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update workspace');
  }

  const json = await response.json();
  return json.data;
}

export async function deleteWorkspace(workspace_id: string) {
  const response = await fetch(`${API_BASE}/${workspace_id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete workspace');
  }

  return true;
}
