'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ToolGroupDetail, getToolGroupById, updateToolGroup, deleteToolGroup,
  ToolGroupData, getToolGroupData, createToolGroupData, updateToolGroupData, deleteToolGroupData,
  syncMcpTools
} from '../api';
import { deleteTool } from '../../tools/api';
import { MethodBadge } from '../../tools/components';
import {
  ArrowLeft, Trash, PencilSimple, Check, X, Plus, ArrowsClockwise, ShieldCheck,
  Key, Info, Sparkle, Globe, Eye, EyeSlash, Copy, CaretDown, CaretRight
} from '@phosphor-icons/react';

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
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleSyncMcp = async () => {
    try {
      setSyncLoading(true);
      setSyncMsg(null);
      const res = await syncMcpTools(id);
      setSyncMsg({ text: `Đồng bộ thành công! Tìm thấy ${res.total_tools} tools (+${res.added_tools} mới, ${res.updated_tools} cập nhật).` });
      await loadGroup();
    } catch (err: any) {
      setSyncMsg({ text: err.message || 'Lỗi khi đồng bộ từ MCP Server', isError: true });
    } finally {
      setSyncLoading(false);
    }
  };

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

  const handleDeleteTool = async (toolId: string, toolName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa công cụ "${toolName}"?\nHành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      setDeletingToolId(toolId);
      await deleteTool(toolId);
      await loadGroup();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa công cụ');
    } finally {
      setDeletingToolId(null);
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
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">{group?.name}</h1>
              {group?.protocol_type === 'MCP' && (
                <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold text-xs">
                  Native MCP
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-1 font-mono text-sm">{group?.key}</p>
            {group?.base_url && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">Endpoint: {group.base_url}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {group?.protocol_type === 'MCP' && (
            <button
              type="button"
              onClick={handleSyncMcp}
              disabled={syncLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition disabled:opacity-50 border border-purple-200"
            >
              <ArrowsClockwise size={16} weight="bold" className={syncLoading ? 'animate-spin' : ''} />
              {syncLoading ? 'Đang đồng bộ...' : 'Sync Tools from Server'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
          >
            <Trash size={16} weight="bold" />
            {deleteLoading ? 'Deleting...' : 'Delete Group'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`p-4 rounded-lg text-sm border ${
          syncMsg.isError
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {syncMsg.text}
        </div>
      )}

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
            href={`/admin/tools/new?group_id=${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold transition"
          >
            <Plus size={14} weight="bold" />
            <span>Thêm Công cụ</span>
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Endpoint / Lời gọi</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Thao tác</th>
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
                    <td className="px-6 py-4 text-sm">
                      {group?.protocol_type === 'MCP' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          tools/call
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <MethodBadge method={tool.method || 'GET'} />
                          <code className="text-xs font-mono text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                            {tool.path || '/'}
                          </code>
                        </div>
                      )}
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
                    <td className="px-6 py-4 text-sm text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTool(tool.id, tool.name)}
                        disabled={deletingToolId === tool.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Xóa Tool"
                      >
                        <Trash size={14} weight="bold" />
                        <span>{deletingToolId === tool.id ? 'Đang xóa...' : 'Xóa'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tool Group Shared Config Data (Neo4j) */}
      <ToolGroupDataSection groupId={id} group={group} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolGroupDataSection
// ---------------------------------------------------------------------------

function ToolGroupDataSection({ groupId, group }: { groupId: string; group: ToolGroupDetail | null }) {
  const [items, setItems] = useState<ToolGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guide toggle
  const [showGuide, setShowGuide] = useState(true);

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addValue, setAddValue] = useState('');
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state – keyed by data ID
  const [editId, setEditId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Masking state & feedback
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const SUGGESTED_KEYS = ['AUTH_TOKEN', 'API_KEY', 'BRANCH_ID', 'BASE_URL', 'TENANT_ID', 'CLIENT_SECRET'];

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
      setAddError('Tên biến và giá trị là bắt buộc');
      return;
    }
    try {
      setAddLoading(true);
      setAddError(null);
      await createToolGroupData(groupId, addKey.trim().toUpperCase(), addValue.trim());
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
      setEditError('Tên biến và giá trị là bắt buộc');
      return;
    }
    try {
      setEditLoading(true);
      setEditError(null);
      await updateToolGroupData(groupId, editId, editKey.trim().toUpperCase(), editValue.trim());
      await loadData();
      setEditId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update group data');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (dataId: string, keyName: string) => {
    if (!window.confirm(`Xóa biến mặc định "${keyName}"? Biến này sẽ bị gỡ khỏi toàn bộ các Workspace dùng chung.`)) return;
    try {
      await deleteToolGroupData(groupId, dataId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete group data');
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Key size={18} className="text-amber-600" weight="bold" />
            <span>Biến Cấu Hình Mặc Định Nhóm (Master Group Data)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {items.length} biến
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Các biến cấu hình dùng chung cho tất cả Workspace kích hoạt nhóm công cụ này. Nếu từng Không gian làm việc có tài khoản riêng, bạn có thể ghi đè trong Scoped Vault của Workspace đó.
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => { setShowAdd(true); setAddError(null); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold rounded-lg transition"
          >
            <Plus size={15} weight="bold" />
            <span>Thêm Biến Mặc Định</span>
          </button>
        )}
      </div>

      {/* Guide Banner */}
      <div className="mb-5 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-indigo-50/40 p-4 text-xs text-blue-950 shadow-2xs">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setShowGuide(!showGuide)}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
              <Info size={15} weight="bold" />
            </div>
            <span className="font-bold text-blue-900 text-xs">
              Hướng dẫn cơ chế biến tùy biến &amp; Cách khắc phục lỗi 401 ({group?.protocol_type === 'MCP' ? 'Native MCP Server' : 'REST API'})
            </span>
          </div>
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded hover:bg-blue-100/50 transition flex items-center gap-1"
          >
            <span>{showGuide ? 'Thu gọn' : 'Xem chi tiết'}</span>
            {showGuide ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
          </button>
        </div>

        {showGuide && (
          <div className="mt-3.5 pt-3.5 border-t border-blue-200/60 space-y-2.5 text-[11.5px] leading-relaxed text-blue-900">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/90 p-3 rounded-lg border border-blue-200/60 space-y-1.5">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" weight="bold" />
                  <span>1. Khắc phục lỗi 401 Unauthorized</span>
                </div>
                <p className="text-slate-700">
                  Khi Agent gọi công cụ và báo lỗi <em>401 Unauthorized</em> (như truy vấn website, danh mục...), đó là do hệ thống chưa có Token xác thực.
                </p>
                <p className="text-slate-700">
                  • <strong>Giải pháp:</strong> Thêm biến tên <code className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">AUTH_TOKEN</code> hoặc <code className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">API_KEY</code> với giá trị là Secret Token của bạn.
                </p>
                <p className="text-slate-700">
                  • Hệ thống OmniAgent sẽ tự động đính kèm Header <code className="bg-blue-100/80 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;TOKEN&gt;</code> vào mọi cuộc gọi JSON-RPC / REST.
                </p>
              </div>

              <div className="bg-white/90 p-3 rounded-lg border border-blue-200/60 space-y-1.5">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <Key size={15} className="text-amber-600" weight="bold" />
                  <span>2. Biến Mặc Định vs Biến Theo Không Gian (Workspace)</span>
                </div>
                <p className="text-slate-700">
                  • <strong>Tại đây (Master Group Data):</strong> Áp dụng mặc định cho tất cả Workspace sử dụng chung một tài khoản dịch vụ.
                </p>
                <p className="text-slate-700">
                  • <strong>Theo Không Gian (Workspace Scoped Vault):</strong> Nếu một chi nhánh hoặc phòng ban có tài khoản riêng, hãy vào trang chi tiết Không gian làm việc đó $\rightarrow$ tab <em>&quot;Công cụ &amp; Biến tùy biến&quot;</em> để khai báo riêng. Giá trị tại Không gian làm việc luôn được ưu tiên cao nhất!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-xs mb-4">
          {error}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-5 p-4 bg-slate-50 border border-indigo-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-800">Thêm Biến Cấu Hình Mặc Định</h4>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-gray-400 mr-1">Gợi ý:</span>
              {SUGGESTED_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAddKey(k)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 rounded border border-gray-200 transition"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {addError && <div className="text-xs text-red-600">{addError}</div>}

          {['AUTH_TOKEN', 'API_KEY', 'TOKEN', 'BEARER_TOKEN', 'API_TOKEN', 'SECRET_KEY'].includes(addKey) && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck size={14} weight="bold" />
              <span>Biến xác thực chuẩn: Sẽ tự động được gán vào Header <strong>Authorization: Bearer</strong> khi gọi Tool.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Tên biến (Key) <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 text-xs font-mono uppercase border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={addKey}
                onChange={e => setAddKey(e.target.value.toUpperCase())}
                disabled={addLoading}
                placeholder="Ví dụ: AUTH_TOKEN, API_KEY"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-gray-600">
                  Giá trị cấu hình (Value) <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddSecret(!showAddSecret)}
                  className="text-[10px] text-gray-500 hover:text-gray-800 flex items-center gap-1"
                >
                  {showAddSecret ? <EyeSlash size={12} /> : <Eye size={12} />}
                  <span>{showAddSecret ? 'Ẩn' : 'Hiện'}</span>
                </button>
              </div>
              <input
                type={showAddSecret ? 'text' : 'password'}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={addValue}
                onChange={e => setAddValue(e.target.value)}
                disabled={addLoading}
                placeholder="Nhập giá trị hoặc Token bảo mật..."
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddKey(''); setAddValue(''); setAddError(null); }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={addLoading || !addKey.trim() || !addValue.trim()}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Check size={14} weight="bold" />
              <span>{addLoading ? 'Đang lưu...' : 'Lưu Biến'}</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-6 text-center text-gray-500 text-xs">Đang tải biến...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          Chưa có biến cấu hình mặc định nào. Thêm biến <code className="font-mono font-bold text-gray-600">AUTH_TOKEN</code> hoặc <code className="font-mono font-bold text-gray-600">API_KEY</code> nếu dịch vụ yêu cầu xác thực.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-500 uppercase border-b border-gray-200 font-semibold">
              <tr>
                <th className="px-4 py-2.5 w-1/3">Tên biến (Key)</th>
                <th className="px-4 py-2.5">Giá trị cấu hình (Value)</th>
                <th className="px-4 py-2.5 text-right w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => {
                const isEditing = editId === item.id;
                const isVisible = visibleKeys[item.id];
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    {isEditing ? (
                      <td colSpan={3} className="px-4 py-3 bg-indigo-50/30">
                        <form onSubmit={handleUpdate} className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              className="px-3 py-1.5 text-xs font-mono uppercase border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={editKey}
                              onChange={e => setEditKey(e.target.value.toUpperCase())}
                              disabled={editLoading}
                            />
                            <input
                              className="px-3 py-1.5 text-xs font-mono border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              disabled={editLoading}
                            />
                          </div>
                          {editError && <div className="text-xs text-red-600">{editError}</div>}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              disabled={editLoading}
                              className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition"
                            >
                              {editLoading ? 'Đang lưu...' : 'Lưu'}
                            </button>
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-800">
                          <div className="flex items-center gap-1.5">
                            <Key size={13} className="text-amber-500" />
                            <span>{item.key}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-600">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-sm">
                              {isVisible ? item.value : '••••••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleVisibility(item.id)}
                              className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition"
                              title={isVisible ? 'Ẩn giá trị' : 'Hiện giá trị'}
                            >
                              {isVisible ? <EyeSlash size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.id, item.value)}
                              className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition relative"
                              title="Sao chép giá trị"
                            >
                              {copiedId === item.id ? (
                                <span className="text-[10px] text-emerald-600 font-bold">Đã chép!</span>
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(item.id);
                              setEditKey(item.key);
                              setEditValue(item.value);
                              setEditError(null);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.key)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium transition"
                          >
                            Xóa
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
