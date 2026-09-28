// API client for tool-groups admin endpoints

export interface ToolGroup {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface ToolGroupDetail extends ToolGroup {
  tools: ToolInGroup[];
}

export interface ToolInGroup {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ToolGroupData {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchToolGroups(): Promise<ToolGroup[]> {
  const response = await fetch('/api/admin/tool-groups');
  const data = await response.json() as ApiResponse<ToolGroup[]>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch tool groups');
  return data.data || [];
}

export async function getToolGroupById(id: string): Promise<ToolGroupDetail> {
  const response = await fetch(`/api/admin/tool-groups/${id}`);
  const data = await response.json() as ApiResponse<ToolGroupDetail>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch tool group');
  return data.data!;
}

export async function createToolGroup(groupData: Partial<ToolGroup>): Promise<ToolGroup> {
  const response = await fetch('/api/admin/tool-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupData),
  });
  const data = await response.json() as ApiResponse<ToolGroup>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to create tool group');
  return data.data!;
}

export async function updateToolGroup(id: string, groupData: Partial<ToolGroup>): Promise<ToolGroup> {
  const response = await fetch(`/api/admin/tool-groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupData),
  });
  const data = await response.json() as ApiResponse<ToolGroup>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update tool group');
  return data.data!;
}

export async function deleteToolGroup(id: string): Promise<void> {
  const response = await fetch(`/api/admin/tool-groups/${id}`, { method: 'DELETE' });
  const data = await response.json() as ApiResponse<null>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete tool group');
}

// --- Tool Group Data (Neo4j) ---

export async function getToolGroupData(groupId: string, workspaceId?: string): Promise<ToolGroupData[]> {
  const url = new URL(`${window.location.origin}/api/admin/tool-groups/${groupId}/data`);
  if (workspaceId) url.searchParams.append('workspaceId', workspaceId);
  
  const response = await fetch(url.toString());
  const data = await response.json() as ApiResponse<ToolGroupData[]>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch tool group data');
  return data.data || [];
}

export async function createToolGroupData(groupId: string, key: string, value: string, workspaceId?: string): Promise<ToolGroupData> {
  const response = await fetch(`/api/admin/tool-groups/${groupId}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, workspaceId }),
  });
  const data = await response.json() as ApiResponse<ToolGroupData>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to create tool group data');
  return data.data!;
}

export async function updateToolGroupData(groupId: string, dataId: string, key: string, value: string): Promise<ToolGroupData> {
  const response = await fetch(`/api/admin/tool-groups/${groupId}/data/${dataId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  const data = await response.json() as ApiResponse<ToolGroupData>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update tool group data');
  return data.data!;
}

export async function deleteToolGroupData(groupId: string, dataId: string): Promise<void> {
  const response = await fetch(`/api/admin/tool-groups/${groupId}/data/${dataId}`, { method: 'DELETE' });
  const data = await response.json() as ApiResponse<null>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete tool group data');
}
