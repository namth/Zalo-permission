'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  fetchPermissions,
  grantToolAccess,
  revokeToolAccess,
  PermissionMatrix,
} from './api';

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterWorkspace, setFilterWorkspace] = useState('');
  const [filterTool, setFilterTool] = useState('');

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPermissions();
      setMatrix(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = async (workspaceId: string, toolId: string, hasAccess: boolean) => {
    const key = `${workspaceId}-${toolId}`;
    setUpdating(key);

    try {
      if (hasAccess) {
        await revokeToolAccess(workspaceId, toolId);
      } else {
        await grantToolAccess(workspaceId, toolId);
      }
      await loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating permission');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading permissions matrix...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permissions Matrix</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
          <button
            onClick={loadPermissions}
            className="ml-4 text-red-600 hover:text-red-800 font-medium underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permissions Matrix</h1>
        </div>
        <div className="text-gray-500">No permission data available</div>
      </div>
    );
  }

  const filteredWorkspaces = matrix.workspaces.filter((ws) =>
    !filterWorkspace || ws.name.toLowerCase().includes(filterWorkspace.toLowerCase())
  );

  const filteredTools = matrix.tools.filter((tool) =>
    !filterTool || tool.name.toLowerCase().includes(filterTool.toLowerCase()) ||
    tool.key.toLowerCase().includes(filterTool.toLowerCase())
  );

  const hasPermission = (wsId: string, toolId: string) => {
    return matrix.permissions.some(
      (p) => p.workspace_id === wsId && p.tool_id === toolId && p.permission_type === 'tool'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permissions Matrix</h1>
          <p className="text-gray-600 mt-2">Manage workspace access to tools and skills</p>
        </div>
        <button
          onClick={loadPermissions}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by workspace
            </label>
            <input
              type="text"
              placeholder="Search workspaces..."
              value={filterWorkspace}
              onChange={(e) => setFilterWorkspace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by tool
            </label>
            <input
              type="text"
              placeholder="Search tools..."
              value={filterTool}
              onChange={(e) => setFilterTool(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>How to use:</strong> Check the box to grant a workspace access to a tool. Uncheck to revoke access.
          Changes are applied immediately.
        </p>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredWorkspaces.length === 0 || filteredTools.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No data to display with current filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Workspace
                  </th>
                  {filteredTools.map((tool) => (
                    <th
                      key={tool.id}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-900 whitespace-nowrap"
                    >
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-xs text-gray-500">{tool.key}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredWorkspaces.map((workspace) => (
                  <tr key={workspace.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <Link
                        href={`/admin/workspaces/${workspace.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {workspace.name}
                      </Link>
                    </td>
                    {filteredTools.map((tool) => {
                      const key = `${workspace.id}-${tool.id}`;
                      const access = hasPermission(workspace.id, tool.id);
                      const isUpdating = updating === key;

                      return (
                        <td key={tool.id} className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={access}
                            onChange={() => handleTogglePermission(workspace.id, tool.id, access)}
                            disabled={isUpdating}
                            className="w-4 h-4 cursor-pointer disabled:opacity-50"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Total Workspaces</p>
          <p className="text-2xl font-bold text-blue-900">{matrix.workspaces.length}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-600 font-medium">Total Tools</p>
          <p className="text-2xl font-bold text-purple-900">{matrix.tools.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Active Tools</p>
          <p className="text-2xl font-bold text-green-900">
            {matrix.tools.filter((t) => t.status === 'active').length}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-600 font-medium">Total Permissions</p>
          <p className="text-2xl font-bold text-orange-900">
            {matrix.permissions.filter((p) => p.permission_type === 'tool').length}
          </p>
        </div>
      </div>
    </div>
  );
}
