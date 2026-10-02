'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Tool, fetchTools, deleteTool } from './api';
import { StatusBadge, MethodBadge, ProtocolBadge } from './components';
import {
  Plus,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  Funnel,
  ArrowSquareOut,
  FolderSimple,
} from '@phosphor-icons/react';

interface ToolGroupSummary {
  id: string;
  key: string;
  name: string;
  protocol_type?: string;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [groups, setGroups] = useState<ToolGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterProtocol, setFilterProtocol] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [toolsData, groupsRes] = await Promise.all([
        fetchTools(),
        fetch('/api/admin/tool-groups').then((r) => (r.ok ? r.json() : { success: false, data: [] })),
      ]);
      setTools(toolsData);
      if (groupsRes?.success && Array.isArray(groupsRes.data)) {
        setGroups(groupsRes.data);
      }
    } catch (err) {
      console.error('Failed to load tools:', err);
      setError(err instanceof Error ? err.message : 'Error loading tools');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTool = async (e: React.MouseEvent, tool: Tool) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa công cụ "${tool.name}"?\nHành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      setDeletingId(tool.id);
      await deleteTool(tool.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa công cụ');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.key.toLowerCase().includes(q) ||
        (tool.path && tool.path.toLowerCase().includes(q)) ||
        (tool.description && tool.description.toLowerCase().includes(q));

      const matchesGroup = !filterGroup || tool.group_id === filterGroup || tool.group_info?.id === filterGroup;
      const protocol = tool.group_info?.protocol_type?.toUpperCase() || (tool.method ? 'REST' : 'MCP');
      const matchesProtocol = !filterProtocol || protocol === filterProtocol;
      const matchesStatus = !filterStatus || tool.status === filterStatus;

      return matchesSearch && matchesGroup && matchesProtocol && matchesStatus;
    });
  }, [tools, searchTerm, filterGroup, filterProtocol, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = tools.length;
    const restCount = tools.filter((t) => (t.group_info?.protocol_type || '').toUpperCase() === 'REST' || (!t.group_info && t.method)).length;
    const mcpCount = tools.filter((t) => (t.group_info?.protocol_type || '').toUpperCase() === 'MCP' || (!t.group_info && !t.method)).length;
    const activeCount = tools.filter((t) => t.status === 'active').length;
    return { total, restCount, mcpCount, activeCount };
  }, [tools]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quản Lý Công Cụ (Tools)</h1>
          <p className="text-gray-500 text-sm mt-1">
            Danh mục các công cụ hệ thống (REST API endpoints &amp; MCP Tool calls) được gán theo nhóm
          </p>
        </div>
        <Link
          href="/admin/tools/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} weight="bold" />
          <span>Tạo Công Cụ Mới</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng công cụ</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-sky-50/50 border border-sky-200/80 rounded-xl p-4 shadow-2xs">
          <p className="text-xs font-medium text-sky-700 uppercase tracking-wider">REST Endpoints</p>
          <p className="text-2xl font-bold text-sky-900 mt-1">{stats.restCount}</p>
        </div>
        <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 shadow-2xs">
          <p className="text-xs font-medium text-purple-700 uppercase tracking-wider">MCP Tools</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{stats.mcpCount}</p>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 shadow-2xs">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Đang kích hoạt</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.activeCount}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, key, path..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Group Filter */}
          <div>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tất cả Nhóm công cụ ({groups.length})</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.protocol_type || 'REST'})
                </option>
              ))}
            </select>
          </div>

          {/* Protocol Filter */}
          <div>
            <select
              value={filterProtocol}
              onChange={(e) => setFilterProtocol(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tất cả giao thức</option>
              <option value="REST">REST API</option>
              <option value="MCP">MCP (Model Context Protocol)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Active (Hoạt động)</option>
              <option value="deprecated">Deprecated</option>
              <option value="disabled">Disabled (Vô hiệu)</option>
            </select>
          </div>
        </div>

        {(searchTerm || filterGroup || filterProtocol || filterStatus) && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span>
              Tìm thấy <strong>{filteredTools.length}</strong> / {tools.length} công cụ
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterGroup('');
                setFilterProtocol('');
                setFilterStatus('');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="text-red-700 hover:text-red-900 font-bold underline text-xs">
            Thử lại
          </button>
        </div>
      )}

      {/* Tools Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Đang tải danh sách công cụ...</div>
        ) : filteredTools.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {tools.length === 0
              ? 'Chưa có công cụ nào trong hệ thống. Hãy tạo công cụ mới để bắt đầu.'
              : 'Không tìm thấy công cụ nào phù hợp với bộ lọc hiện tại.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Công Cụ</th>
                  <th className="px-4 py-3.5">Nhóm &amp; Giao Thức</th>
                  <th className="px-4 py-3.5">Phương Thức &amp; Endpoint / Lời Gọi</th>
                  <th className="px-4 py-3.5">Mô Tả</th>
                  <th className="px-4 py-3.5">Trạng Thái</th>
                  <th className="px-5 py-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTools.map((tool) => {
                  const protocol =
                    tool.group_info?.protocol_type?.toUpperCase() || (tool.method ? 'REST' : 'MCP');
                  const isRest = protocol === 'REST';

                  return (
                    <tr key={tool.id} className="hover:bg-slate-50/80 transition">
                      {/* Name & Key */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/tools/${tool.id}`}
                            className="font-bold text-gray-900 hover:text-blue-600 transition"
                          >
                            {tool.name}
                          </Link>
                          <span className="font-mono text-[11px] text-gray-500 mt-0.5">{tool.key}</span>
                        </div>
                      </td>

                      {/* Group & Protocol */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ProtocolBadge protocol={protocol} />
                          {tool.group_info ? (
                            <Link
                              href={`/admin/tool-groups/${tool.group_info.id}`}
                              className="text-gray-700 hover:text-blue-600 font-medium truncate max-w-[130px]"
                              title={tool.group_info.name}
                            >
                              {tool.group_info.name}
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic">Chưa gán</span>
                          )}
                        </div>
                      </td>

                      {/* Endpoint / Call */}
                      <td className="px-4 py-3.5">
                        {isRest ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <MethodBadge method={tool.method || 'GET'} />
                            <code
                              className="text-[11px] font-mono text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded truncate"
                              title={tool.path || '/'}
                            >
                              {tool.path || '/'}
                            </code>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              tools/call
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3.5 text-gray-500 max-w-xs">
                        <p className="truncate text-[11.5px]">{tool.description || '—'}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={tool.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/tools/${tool.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                            title="Chi tiết & Sửa"
                          >
                            <PencilSimple size={14} weight="bold" />
                            <span>Sửa</span>
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTool(e, tool)}
                            disabled={deletingId === tool.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="Xóa công cụ"
                          >
                            <Trash size={14} weight="bold" />
                            <span>{deletingId === tool.id ? 'Đang xóa...' : 'Xóa'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

