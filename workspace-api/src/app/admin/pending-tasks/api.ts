// API client for pending tasks admin endpoints

export interface PendingTask {
  id: string;
  user_id: string;
  user_name: string;
  workspace_id: string;
  workspace_name: string;
  intent: string;
  status: 'AWAITING_INPUT' | 'READY_TO_RESUME' | 'COMPLETED';
  missing_parameters?: Record<string, any>;
  plan_summary?: string;
  created_at: string;
  updated_at: string;
  required_info?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchPendingTasks(filters?: {
  workspace_id?: string;
  user_id?: string;
  status?: string;
}): Promise<PendingTask[]> {
  const query = new URLSearchParams();
  if (filters?.workspace_id) query.append('workspace_id', filters.workspace_id);
  if (filters?.user_id) query.append('user_id', filters.user_id);
  if (filters?.status) query.append('status', filters.status);

  const url = `/api/admin/pending-tasks${query.toString() ? '?' + query.toString() : ''}`;
  const response = await fetch(url);
  const data = await response.json() as ApiResponse<PendingTask[]>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch pending tasks');
  }

  return data.data || [];
}

export async function getPendingTaskById(id: string): Promise<PendingTask> {
  const response = await fetch(`/api/admin/pending-tasks/${id}`);
  const data = await response.json() as ApiResponse<PendingTask>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch pending task');
  }

  return data.data!;
}

export async function updatePendingTaskStatus(
  id: string,
  status: 'AWAITING_INPUT' | 'READY_TO_RESUME' | 'COMPLETED'
): Promise<PendingTask> {
  const response = await fetch(`/api/admin/pending-tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const data = await response.json() as ApiResponse<PendingTask>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to update task status');
  }

  return data.data!;
}

export async function deletePendingTask(id: string): Promise<void> {
  const response = await fetch(`/api/admin/pending-tasks/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json() as ApiResponse<null>;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete pending task');
  }
}
