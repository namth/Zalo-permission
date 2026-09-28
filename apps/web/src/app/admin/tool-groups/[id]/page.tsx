'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ToolGroupDetail, getToolGroupById, updateToolGroup, deleteToolGroup,
  ToolGroupData, getToolGroupData, createToolGroupData, updateToolGroupData, deleteToolGroupData
} from '../api';
import { ArrowLeft, Trash, PencilSimple, Check, X, Plus } from '@phosphor-icons/react';

export default function ToolGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [group, setGroup] = useState<ToolGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [id]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getToolGroupById(id);
      setGroup(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
      setEditStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tool group');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) { setEditError('Name is required'); return; }
    try {
      setEditLoading(true);
      setEditError(null);
      const updated = await updateToolGroup(id, { name: editName, description: editDescription, status: editStatus as any });
      setGroup(prev => prev ? { ...prev, ...updated } : null);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update tool group');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete tool group "${group?.name}"? This action cannot be undone.`)) return;
    try {
      setDeleteLoading(true);
      await deleteToolGroup(id);
      router.push('/admin/tool-groups');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tool group');
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (error && !group) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
        <Link href="/admin/tool-groups" className="text-blue-600 hover:text-blue-800">← Back to Tool Groups</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/tool-groups" className="text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{group?.name}</h1>
            <p className="text-gray-500 mt-1 font-mono text-sm">{group?.key}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleteLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
        >
          <Trash size={16} weight="bold" />
          {deleteLoading ? 'Deleting...' : 'Delete Group'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
      )}

      {/* Group Info / Edit Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Group Details</h2>
          {!editing && (
            <button
              onClick={() => { setEditing(true); setEditError(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              <PencilSimple size={14} weight="bold" />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            {editError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{editError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={editLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={editLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={editLoading}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={editLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <Check size={14} weight="bold" />
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setEditError(null); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
              >
                <X size={14} weight="bold" />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Group Key</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{group?.key}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  group?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {group?.status}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{group?.description || <span className="text-gray-400 italic">No description</span>}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{group ? new Date(group.created_at).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">{group ? new Date(group.updated_at).toLocaleString() : '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Tools in this Group */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tools in this Group</h2>
            <p className="text-sm text-gray-500 mt-0.5">{group?.tools?.length || 0} tools assigned</p>
          </div>
          <Link
            href="/admin/tools/new"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition"
          >
            + Add Tool
          </Link>
        </div>

        {!group?.tools || group.tools.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No tools assigned to this group yet.</p>
            <p className="text-xs mt-1">Create or edit a tool and select this group to assign it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Key</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {group.tools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{tool.key}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      <Link href={`/admin/tools/${tool.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                        {tool.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{tool.description || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        tool.status === 'active' ? 'bg-green-100 text-green-800' :
                        tool.status === 'deprecated' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tool.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolGroupDataSection
// ---------------------------------------------------------------------------

function ToolGroupDataSection({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<ToolGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state – keyed by data ID
  const [editId, setEditId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getToolGroupData(groupId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addKey.trim() || !addValue.trim()) {
      setAddError('Key and value are required');
      return;
    }
    try {
      setAddLoading(true);
      setAddError(null);
      await createToolGroupData(groupId, addKey.trim(), addValue.trim());
      await loadData();
      setShowAdd(false);
      setAddKey('');
      setAddValue('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create group data');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    if (!editKey.trim() || !editValue.trim()) {
      setEditError('Key and value are required');
      return;
    }
    try {
      setEditLoading(true);
      setEditError(null);
      await updateToolGroupData(groupId, editId, editKey.trim(), editValue.trim());
      await loadData();
      setEditId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update group data');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (dataId: string) => {
    if (!window.confirm('Delete this group data entry?')) return;
    try {
      await deleteToolGroupData(groupId, dataId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete group data');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Group Data (Neo4j)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configuration variables shared by all tools in this group</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => { setShowAdd(true); setAddError(null); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition"
          >
            <Plus size={16} weight="bold" />
            Add Data
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">
          {error}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">New Data Entry</h4>
          {addError && <div className="text-xs text-red-600">{addError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Key</label>
              <input
                className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={addKey}
                onChange={e => setAddKey(e.target.value)}
                disabled={addLoading}
                placeholder="e.g. API_ENDPOINT"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
              <input
                className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={addValue}
                onChange={e => setAddValue(e.target.value)}
                disabled={addLoading}
                placeholder="e.g. https://api.service.com"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddKey(''); setAddValue(''); setAddError(null); }}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {addLoading ? 'Saving...' : 'Save Data'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-6 text-center text-gray-500 text-sm">Loading data...</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          No data entries yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {editId === item.id ? (
                    <td colSpan={3} className="px-4 py-3">
                      <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editKey}
                          onChange={e => setEditKey(e.target.value)}
                          disabled={editLoading}
                        />
                        <input
                          className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          disabled={editLoading}
                        />
                        {editError && <div className="text-xs text-red-600 sm:col-span-2">{editError}</div>}
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <button type="submit" disabled={editLoading} className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">Save</button>
                          <button type="button" onClick={() => setEditId(null)} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition">Cancel</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-gray-800">{item.key}</td>
                      <td className="px-4 py-3 text-gray-600 break-all">{item.value}</td>
                      <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditId(item.id);
                            setEditKey(item.key);
                            setEditValue(item.value);
                            setEditError(null);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium transition"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
