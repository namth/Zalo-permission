// API client for tools admin endpoints

export interface Tool {
  id: string;
  key: string;
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
  status: 'active' | 'deprecated' | 'disabled';
  created_at: string;
  updated_at: string;
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
