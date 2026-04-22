// API client for skills admin endpoints

export interface Skill {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_name: string;
  workspace_id: string;
  status: 'active' | 'archived' | 'disabled';
  type: 'user' | 'system';
  detail?: string;
  category?: string;
  tools?: {id: string, name: string}[];
  shared_to?: string[]; // workspace IDs
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchSkills(filters?: {
  workspace_id?: string;
  owner_id?: string;
  status?: string;
  type?: string;
  category?: string;
}): Promise<Skill[]> {
  const query = new URLSearchParams();
  if (filters?.workspace_id) query.append('workspace_id', filters.workspace_id);
  if (filters?.owner_id) query.append('owner_id', filters.owner_id);
  if (filters?.status) query.append('status', filters.status);
  if (filters?.type) query.append('type', filters.type);
  if (filters?.category) query.append('category', filters.category);

  const url = `/api/admin/skills${query.toString() ? '?' + query.toString() : ''}`;
  const response = await fetch(url);
  const data = await response.json() as ApiResponse<Skill[]>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch skills');
  }

  return data.data || [];
}

export async function getSkillById(id: string): Promise<Skill> {
  const response = await fetch(`/api/admin/skills/${id}`);
  const data = await response.json() as ApiResponse<Skill>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch skill');
  }

  return data.data!;
}

export async function updateSkillStatus(
  id: string,
  status: 'active' | 'archived' | 'disabled'
): Promise<Skill> {
  const response = await fetch(`/api/admin/skills/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const data = await response.json() as ApiResponse<Skill>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to update skill status');
  }

  return data.data!;
}

export async function shareSkill(
  id: string,
  workspaceIds: string[]
): Promise<Skill> {
  const response = await fetch(`/api/admin/skills/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill_id: id, workspace_ids: workspaceIds }),
  });

  const data = await response.json() as ApiResponse<Skill>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to share skill');
  }

  return data.data!;
}

export async function unshareSkill(id: string, workspaceId: string): Promise<Skill> {
  const response = await fetch(`/api/admin/skills/${id}/unshare`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
  });

  const data = await response.json() as ApiResponse<Skill>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to unshare skill');
  }

  return data.data!;
}

export async function deleteSkill(id: string): Promise<void> {
  const response = await fetch(`/api/admin/skills/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json() as ApiResponse<null>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete skill');
  }
}

export async function createSkill(skill: Omit<Partial<Skill>, 'tools'> & { tools?: string[], category?: string }): Promise<Skill> {
  const response = await fetch('/api/admin/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill),
  });

  const data = await response.json() as ApiResponse<Skill>;
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to create skill');
  }

  return data.data!;
}

export async function updateSkill(id: string, skill: Omit<Partial<Skill>, 'tools'> & { tools?: string[], category?: string }): Promise<Skill> {
  const response = await fetch(`/api/admin/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill),
  });

  const data = await response.json() as ApiResponse<Skill>;
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to update skill');
  }

  return data.data!;
}

export async function getCategories(): Promise<string[]> {
  const response = await fetch('/api/admin/categories');
  const data = await response.json() as ApiResponse<string[]>;
  if (!response.ok || !data.success) {
    return [];
  }
  return data.data || [];
}
