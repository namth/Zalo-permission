'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ToolGroup, fetchToolGroups } from './api';
import { Plus } from '@phosphor-icons/react';

export default function ToolGroupsPage() {
  const [groups, setGroups] = useState<ToolGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchToolGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading tool groups');
    } finally {
      setLoading(false);
    }
  };


  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tool Groups</h1>
          <p className="text-gray-600 mt-2">Organize tools into logical groups for workspaces</p>
        </div>
        <Link
          href="/admin/tool-groups/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={16} weight="bold" />
          New Tool Group
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Search by name or key</label>
        <input
          type="text"
          placeholder="e.g., marketing_tools"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
          <button onClick={loadGroups} className="ml-4 text-red-600 hover:text-red-800 font-medium underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading tool groups...</div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {groups.length === 0 ? 'No tool groups found. Create one to get started.' : 'No groups match your search.'}
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{group.key}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      <Link href={`/admin/tool-groups/${group.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                        {group.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{group.description || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        group.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {group.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(group.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Total Groups</p>
            <p className="text-2xl font-bold text-blue-900">{groups.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Active Groups</p>
            <p className="text-2xl font-bold text-green-900">{groups.filter(g => g.status === 'active').length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
