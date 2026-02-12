'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tool, getToolById, updateTool, deleteTool } from '../api';
import { ToolForm, StatusBadge } from '../components';

export default function ToolDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(params.id === 'new');

  useEffect(() => {
    if (params.id === 'new') {
      setLoading(false);
      return;
    }
    loadTool();
  }, [params.id]);

  const loadTool = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getToolById(params.id);
      setTool(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading tool');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: Partial<Tool>) => {
    if (params.id === 'new') {
      await createNewTool(formData);
    } else {
      await updateExistingTool(formData);
    }
  };

  const createNewTool = async (formData: Partial<Tool>) => {
    try {
      const newTool = await createTool(formData);
      router.push(`/admin/tools/${newTool.id}`);
    } catch (err) {
      throw err;
    }
  };

  const createTool = async (toolData: Partial<Tool>) => {
    const response = await fetch('/api/admin/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolData),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create tool');
    }
    return data.data;
  };

  const updateExistingTool = async (formData: Partial<Tool>) => {
    try {
      const updated = await updateTool(params.id, formData);
      setTool(updated);
      setIsEditing(false);
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this tool? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteTool(params.id);
      router.push('/admin/tools');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting tool');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (params.id === 'new') {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/tools" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Tools
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Create New Tool</h1>
        </div>

        <ToolForm
          onSubmit={async (data) => {
            await handleSubmit(data);
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link href="/admin/tools" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Tools
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="space-y-6">
        <Link href="/admin/tools" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Tools
        </Link>
        <div className="text-gray-500">Tool not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/admin/tools" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Tools
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{tool.name}</h1>
          <p className="text-gray-600 mt-2">{tool.description || 'No description provided'}</p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing && (
        <ToolForm
          tool={tool}
          onSubmit={handleSubmit}
          onSuccess={() => setIsEditing(false)}
        />
      )}

      {!isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tool Information */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Tool Information</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-600">Key</dt>
                <dd className="text-sm font-mono text-gray-900 mt-1">{tool.key}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Status</dt>
                <dd className="text-sm mt-1">
                  <StatusBadge status={tool.status} />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Created</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {new Date(tool.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Updated</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {new Date(tool.updated_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Workspace Access */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Workspace Access</h3>
            <p className="text-sm text-gray-600 mb-4">
              Manage which workspaces can use this tool
            </p>
            <Link
              href={`/admin/permissions?tool=${tool.id}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Manage Permissions →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
