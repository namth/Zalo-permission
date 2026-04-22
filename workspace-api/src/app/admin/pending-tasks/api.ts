export interface PendingTask {
  id: string;
  workspace_id: string;
  thread_id: string;
  user_id: string;
  intent: string | null;
  full_plan: any;
  missing_parameters: any;
  status: 'AWAITING_INPUT' | 'READY_TO_RESUME' | 'COMPLETED';
  created_at: string;
  updated_at: string;
}

export async function fetchPendingTasks(): Promise<PendingTask[]> {
  const res = await fetch('/api/admin/pending-tasks');
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch pending tasks');
  }
  const data = await res.json();
  return data.data;
}

export async function fetchPendingTaskById(id: string): Promise<PendingTask> {
  const res = await fetch(`/api/admin/pending-tasks/${id}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch pending task');
  }
  const data = await res.json();
  return data.data;
}

export async function createPendingTask(task: Partial<PendingTask>): Promise<PendingTask> {
  const res = await fetch('/api/admin/pending-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create pending task');
  }
  const data = await res.json();
  return data.data;
}

export async function updatePendingTask(id: string, updates: Partial<PendingTask>): Promise<PendingTask> {
  const res = await fetch(`/api/admin/pending-tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update pending task');
  }
  const data = await res.json();
  return data.data;
}

export async function deletePendingTask(id: string): Promise<void> {
  const res = await fetch(`/api/admin/pending-tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete pending task');
  }
}
