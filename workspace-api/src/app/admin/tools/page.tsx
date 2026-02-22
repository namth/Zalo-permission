'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tool, fetchTools } from './api';
import { StatusBadge } from './components';

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTools();
      console.log('Fetched tools:', data);
      setTools(data);
    } catch (err) {
      console.error('Failed to load tools:', err);
      setError(err instanceof Error ? err.message : 'Error loading tools');
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || tool.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Tools</h1>
          <p className="text-gray-600 mt-2">Manage API tools available to workspaces</p>
        </div>
        <Link
          href="/admin/tools/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + New Tool
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by name or key
            </label>
            <input
              type="text"
              placeholder="e.g., send_email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
          <button
            onClick={loadTools}
            className="ml-4 text-red-600 hover:text-red-800 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tools Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading tools...</div>
        ) : filteredTools.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {tools.length === 0 ? 'No tools found. Create one to get started.' : 'No tools match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Key</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{tool.key}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{tool.name}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={tool.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tool.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <Link
                        href={`/admin/tools/${tool.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && tools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Active Tools</p>
            <p className="text-2xl font-bold text-green-900">{tools.filter(t => t.status === 'active').length}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-600 font-medium">Deprecated</p>
            <p className="text-2xl font-bold text-yellow-900">{tools.filter(t => t.status === 'deprecated').length}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600 font-medium">Disabled</p>
            <p className="text-2xl font-bold text-red-900">{tools.filter(t => t.status === 'disabled').length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
