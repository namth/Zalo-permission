// API client for tools admin endpoints

export interface Tool {
  id: string;
  key: string;
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  status: 'active' | 'deprecated' | 'disabled';
  group_info?: {
    id: string;
    key: string;
    name: string;
  } | null;
  group_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolData {
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

export async function fetchTools(): Promise<Tool[]> {
  const response = await fetch('/api/admin/tools');
  const data = await response.json() as ApiResponse<Tool[]>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch tools');
  }

  return data.data || [];
}

export async function getToolById(id: string): Promise<Tool> {
  const response = await fetch(`/api/admin/tools/${id}`);
  const data = await response.json() as ApiResponse<Tool>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch tool');
  }

  return data.data!;
}

export async function createTool(toolData: Partial<Tool>): Promise<Tool> {
  const response = await fetch('/api/admin/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolData),
  });

  const data = await response.json() as ApiResponse<Tool>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to create tool');
  }

  return data.data!;
}

export async function updateTool(id: string, toolData: Partial<Tool>): Promise<Tool> {
  const response = await fetch(`/api/admin/tools/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolData),
  });

  const data = await response.json() as ApiResponse<Tool>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to update tool');
  }

  return data.data!;
}

export async function deleteTool(id: string): Promise<void> {
  const response = await fetch(`/api/admin/tools/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json() as ApiResponse<null>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete tool');
  }
}

// --- Tool Data (Neo4j) ---

export async function getToolData(toolId: string): Promise<ToolData[]> {
  const response = await fetch(`/api/admin/tools/${toolId}/data`);
  const data = await response.json() as ApiResponse<ToolData[]>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to fetch tool data');
  return data.data || [];
}

export async function createToolData(toolId: string, key: string, value: string): Promise<ToolData> {
  const response = await fetch(`/api/admin/tools/${toolId}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  const data = await response.json() as ApiResponse<ToolData>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to create tool data');
  return data.data!;
}

export async function updateToolData(toolId: string, dataId: string, key: string, value: string): Promise<ToolData> {
  const response = await fetch(`/api/admin/tools/${toolId}/data/${dataId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  const data = await response.json() as ApiResponse<ToolData>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update tool data');
  return data.data!;
}

export async function deleteToolData(toolId: string, dataId: string): Promise<void> {
  const response = await fetch(`/api/admin/tools/${toolId}/data/${dataId}`, { method: 'DELETE' });
  const data = await response.json() as ApiResponse<null>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete tool data');
}
