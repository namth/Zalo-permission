'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ZaloGroup {
  id: string;
  thread_id: string;
  workspace_id: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [zaloGroups, setZaloGroups] = useState<ZaloGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showZaloForm, setShowZaloForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [zaloFormData, setZaloFormData] = useState({ thread_id: '', name: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspace();
      fetchZaloGroups();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/workspaces/${workspaceId}`);
      const data = await response.json();
      if (data.success) {
        setWorkspace(data.data);
        setFormData({
          name: data.data.name,
          description: data.data.description || '',
        });
      }
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchZaloGroups = async () => {
    try {
      const response = await fetch(`/api/admin/workspaces/${workspaceId}/zalo-groups`);
      const data = await response.json();
      if (data.success) {
        setZaloGroups(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching zalo groups:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/admin/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (data.success) {
        setWorkspace(data.data);
        setEditing(false);
      }
    } catch (error) {
      setError(String(error));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this workspace?')) return;
    try {
      const response = await fetch(`/api/admin/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        router.push('/admin/workspaces');
      }
    } catch (error) {
      setError(String(error));
    }
  };

  const handleAddZaloGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/zalo-group/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: zaloFormData.thread_id,
          workspace_id: workspaceId,
          name: zaloFormData.name,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setZaloFormData({ thread_id: '', name: '' });
        setShowZaloForm(false);
        fetchZaloGroups();
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError(String(error));
    }
  };

  const handleDeleteZaloGroup = async (threadId: string) => {
    if (!confirm('Are you sure you want to remove this Zalo group?')) return;
    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspaceId}/zalo-groups?thread_id=${threadId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.success) {
        fetchZaloGroups();
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError(String(error));
    }
  };

  if (loading) return <div className="text-center text-gray-600">Loading...</div>;
  if (!workspace && !loading) return <div className="text-center text-red-600">Workspace not found</div>;
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Link href="/admin/workspaces" className="text-blue-600 hover:text-blue-800">
        ← Back to Workspaces
      </Link>

      {error && <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{workspace.name}</h1>
            <p className="text-gray-600 text-sm mt-2">ID: {workspace.id}</p>
          </div>
          <div className="space-x-2">
            <button
              onClick={() => setEditing(!editing)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Delete
            </button>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Save
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Description</p>
              <p className="text-gray-900">{workspace.description || 'No description'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created At</p>
              <p className="text-gray-900">{new Date(workspace.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Updated At</p>
              <p className="text-gray-900">{new Date(workspace.updated_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Zalo Group Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Linked Zalo Groups</h2>
          <button
            onClick={() => setShowZaloForm(!showZaloForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            {showZaloForm ? 'Cancel' : '+ Add Zalo Group'}
          </button>
        </div>

        {showZaloForm && (
          <form onSubmit={handleAddZaloGroup} className="bg-gray-50 p-4 rounded-lg mb-4 space-y-4">
            <input
              type="text"
              placeholder="Zalo Group Thread ID"
              value={zaloFormData.thread_id}
              onChange={(e) => setZaloFormData({ ...zaloFormData, thread_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Group Name (optional)"
              value={zaloFormData.name}
              onChange={(e) => setZaloFormData({ ...zaloFormData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Link Group
            </button>
          </form>
        )}

        {zaloGroups.length === 0 ? (
          <p className="text-gray-500 text-sm">No Zalo groups linked yet</p>
        ) : (
          <div className="space-y-2">
            {zaloGroups.map((group) => (
              <div
                key={group.thread_id}
                className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{group.name || 'Unnamed Group'}</p>
                  <p className="text-gray-600 text-sm">Thread ID: {group.thread_id}</p>
                  <p className="text-gray-500 text-xs">
                    Added: {new Date(group.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteZaloGroup(group.thread_id)}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
