'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tool, getToolById, updateTool, deleteTool } from '../api';
import { ToolForm, StatusBadge, MethodBadge, ProtocolBadge } from '../components';
import {
  ArrowLeft,
  PencilSimple,
  Trash,
  Globe,
  Lightning,
  Code,
  FileCode,
  CheckCircle,
} from '@phosphor-icons/react';

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
      setError(err instanceof Error ? err.message : 'Lỗi khi tải thông tin công cụ');
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
    if (!tool) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa công cụ "${tool.name}"?\nHành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await deleteTool(params.id);
      router.push('/admin/tools');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi xóa công cụ');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 text-sm">Đang tải thông tin công cụ...</div>
      </div>
    );
  }

  if (params.id === 'new') {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/tools"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
          >
            <ArrowLeft size={14} weight="bold" />
            <span>Quay lại danh sách công cụ</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">Tạo Công Cụ Mới</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Định nghĩa endpoint REST API hoặc MCP Tool call và cấu hình schema tham số tương ứng
          </p>
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
        <Link
          href="/admin/tools"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
        >
          <ArrowLeft size={14} weight="bold" />
          <span>Quay lại danh sách công cụ</span>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/tools"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
        >
          <ArrowLeft size={14} weight="bold" />
          <span>Quay lại danh sách công cụ</span>
        </Link>
        <div className="text-gray-500 text-sm">Không tìm thấy công cụ yêu cầu.</div>
      </div>
    );
  }

  const protocol =
    tool.group_info?.protocol_type?.toUpperCase() || (tool.method ? 'REST' : 'MCP');
  const isRest = protocol === 'REST';
  const baseUrl = tool.group_info?.base_url || '';
  const fullUrl = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/${(tool.path || '').replace(/^\/+/, '')}`
    : tool.path || '';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/tools"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition mb-2"
          >
            <ArrowLeft size={14} weight="bold" />
            <span>Quay lại danh sách công cụ</span>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{tool.name}</h1>
            <ProtocolBadge protocol={protocol} />
            <StatusBadge status={tool.status} />
          </div>
          <p className="text-xs font-mono text-gray-500 mt-1">{tool.key}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs font-semibold shadow-sm"
          >
            <PencilSimple size={15} weight="bold" />
            <span>{isEditing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition text-xs font-semibold"
          >
            <Trash size={15} weight="bold" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Cập Nhật Công Cụ</h2>
          <ToolForm
            tool={tool}
            onSubmit={handleSubmit}
            onSuccess={() => {
              setIsEditing(false);
              loadTool();
            }}
          />
        </div>
      ) : (
        <>
          {/* Main Info Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs space-y-5">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              Thông Tin Định Danh &amp; Giao Thức
            </h2>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-xs">
              <div>
                <dt className="text-gray-500 font-medium mb-1">Mã định danh (Key)</dt>
                <dd className="font-mono font-semibold text-gray-900 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded inline-block">
                  {tool.key}
                </dd>
              </div>

              <div>
                <dt className="text-gray-500 font-medium mb-1">Thuộc Nhóm công cụ (Tool Group)</dt>
                <dd className="text-gray-900">
                  {tool.group_info ? (
                    <Link
                      href={`/admin/tool-groups/${tool.group_info.id}`}
                      className="text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      {tool.group_info.name} ({tool.group_info.key})
                    </Link>
                  ) : (
                    <span className="text-gray-400 italic">Chưa gán nhóm</span>
                  )}
                </dd>
              </div>

              <div className="md:col-span-2">
                <dt className="text-gray-500 font-medium mb-1">Mô tả chức năng</dt>
                <dd className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {tool.description || <span className="text-gray-400 italic">Chưa có mô tả</span>}
                </dd>
              </div>

              {/* REST Specific info */}
              {isRest ? (
                <>
                  <div>
                    <dt className="text-gray-500 font-medium mb-1">Phương thức HTTP</dt>
                    <dd className="mt-1">
                      <MethodBadge method={tool.method || 'GET'} />
                    </dd>
                  </div>

                  <div>
                    <dt className="text-gray-500 font-medium mb-1">Đường dẫn Endpoint (Path)</dt>
                    <dd className="font-mono text-gray-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded inline-block">
                      {tool.path || '/'}
                    </dd>
                  </div>

                  {fullUrl && (
                    <div className="md:col-span-2 bg-sky-50/60 border border-sky-200 rounded-lg p-3">
                      <dt className="text-sky-800 font-medium mb-1 flex items-center gap-1.5">
                        <Globe size={14} className="text-sky-600" />
                        <span>URL Đầy Đủ (Live Endpoint)</span>
                      </dt>
                      <dd className="font-mono text-xs text-sky-950 break-all select-all font-semibold">
                        {fullUrl}
                      </dd>
                    </div>
                  )}
                </>
              ) : (
                <div className="md:col-span-2 bg-purple-50/60 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                    <Lightning size={16} className="text-purple-600" />
                    <span>Cơ chế gọi MCP (Model Context Protocol)</span>
                  </div>
                  <p className="text-[11.5px] text-purple-800 mt-1 leading-relaxed">
                    Công cụ này được thực thi qua giao thức MCP JSON-RPC protocol (<code className="font-mono font-semibold">tools/call</code>) của nhóm{' '}
                    <strong>{tool.group_info?.name || 'MCP Server'}</strong>. Tham số đầu vào sẽ được kiểm định tự động theo schema bên dưới.
                  </p>
                </div>
              )}

              <div>
                <dt className="text-gray-500 font-medium mb-1">Ngày tạo</dt>
                <dd className="text-gray-700">{new Date(tool.created_at).toLocaleString()}</dd>
              </div>

              <div>
                <dt className="text-gray-500 font-medium mb-1">Cập nhật lần cuối</dt>
                <dd className="text-gray-700">{new Date(tool.updated_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Schemas Section */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Code size={18} className="text-blue-600" weight="bold" />
              <span>Cấu Trúc Tham Số &amp; Dữ Liệu (Schemas)</span>
            </h2>

            {/* REST Parameters Schema (Path/Query) */}
            {isRest && (
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <FileCode size={15} className="text-sky-600" />
                    <span>Tham số URL &amp; Query Params (parameters_schema)</span>
                  </h3>
                  <span className="text-[11px] text-gray-400">JSON Schema</span>
                </div>
                {tool.parameters_schema && Object.keys(tool.parameters_schema).length > 0 ? (
                  <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(tool.parameters_schema, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
                    Chưa có cấu hình tham số path/query.
                  </p>
                )}
              </div>
            )}

            {/* REST Request Body Schema */}
            {isRest && ['POST', 'PUT', 'PATCH'].includes((tool.method || 'GET').toUpperCase()) && (
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <FileCode size={15} className="text-emerald-600" />
                    <span>Dữ liệu Request Body Payload (body_schema)</span>
                  </h3>
                  <span className="text-[11px] text-gray-400">JSON Schema</span>
                </div>
                {tool.body_schema && Object.keys(tool.body_schema).length > 0 ? (
                  <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(tool.body_schema, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
                    Chưa có cấu hình body schema.
                  </p>
                )}
              </div>
            )}

            {/* REST Response Schema */}
            {isRest && (
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <FileCode size={15} className="text-purple-600" />
                    <span>Cấu trúc dữ liệu phản hồi mẫu (response_schema)</span>
                  </h3>
                  <span className="text-[11px] text-gray-400">JSON Schema / Example</span>
                </div>
                {tool.response_schema && Object.keys(tool.response_schema).length > 0 ? (
                  <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(tool.response_schema, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
                    Chưa có cấu hình response schema.
                  </p>
                )}
              </div>
            )}

            {/* MCP Input Schema */}
            {!isRest && (tool.input_schema || tool.parameters_schema) && (
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <FileCode size={15} className="text-purple-600" />
                    <span>Tham số đầu vào MCP Tool (input_schema)</span>
                  </h3>
                  <span className="text-[11px] text-gray-400">JSON Schema</span>
                </div>
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(tool.input_schema || tool.parameters_schema, null, 2)}
                </pre>
              </div>
            )}

            {/* MCP Output Schema */}
            {!isRest && tool.output_schema && (
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <FileCode size={15} className="text-emerald-600" />
                    <span>Dữ liệu đầu ra MCP Tool (output_schema)</span>
                  </h3>
                  <span className="text-[11px] text-gray-400">JSON Schema</span>
                </div>
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(tool.output_schema, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

