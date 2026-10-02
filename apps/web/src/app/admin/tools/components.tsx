'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tool } from './api';
import {
  Plus,
  FloppyDisk,
  Globe,
  Lightning,
  Code,
  Info,
  Sparkle,
  CheckCircle,
  FileCode,
} from '@phosphor-icons/react';

interface ToolGroupOption {
  id: string;
  key: string;
  name: string;
  protocol_type?: string;
  base_url?: string;
}

interface ToolFormProps {
  tool?: Tool;
  onSubmit: (data: Partial<Tool>) => Promise<void>;
  onSuccess?: () => void;
}

export function ToolForm({ tool, onSubmit, onSuccess }: ToolFormProps) {
  const searchParams = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';

  const [formData, setFormData] = useState<Partial<Tool>>(() => {
    if (tool) {
      return {
        ...tool,
        group_id: tool.group_id || tool.group_info?.id || defaultGroupId,
        method: tool.method || 'GET',
        path: tool.path || '',
        status: tool.status || 'active',
      };
    }
    return {
      key: '',
      name: '',
      description: '',
      method: 'GET',
      path: '',
      status: 'active',
      group_id: defaultGroupId,
    };
  });

  const [groups, setGroups] = useState<ToolGroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Schema editors state
  const [parametersSchemaRaw, setParametersSchemaRaw] = useState<string>(() => {
    const s = tool?.parameters_schema || tool?.input_schema;
    return s ? JSON.stringify(s, null, 2) : '';
  });
  const [paramSchemaError, setParamSchemaError] = useState<string | null>(null);

  const [bodySchemaRaw, setBodySchemaRaw] = useState<string>(() => {
    return tool?.body_schema ? JSON.stringify(tool.body_schema, null, 2) : '';
  });
  const [bodySchemaError, setBodySchemaError] = useState<string | null>(null);

  const [responseSchemaRaw, setResponseSchemaRaw] = useState<string>(() => {
    const s = tool?.response_schema || tool?.output_schema;
    return s ? JSON.stringify(s, null, 2) : '';
  });
  const [respSchemaError, setRespSchemaError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load active tool groups
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const res = await fetch('/api/admin/tool-groups');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setGroups(data.data);
        }
      } catch (err) {
        console.error('Failed to load tool groups for form', err);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  // Selected group object
  const selectedGroup = useMemo(() => {
    if (!formData.group_id) return null;
    return groups.find((g) => g.id === formData.group_id) || null;
  }, [formData.group_id, groups]);

  const isMcpProtocol = selectedGroup?.protocol_type === 'MCP';

  // Live URL preview
  const liveUrlPreview = useMemo(() => {
    if (isMcpProtocol) {
      return selectedGroup?.base_url || 'MCP Server Transport URL';
    }
    const base = (selectedGroup?.base_url || 'https://api.example.com').replace(/\/+$/, '');
    const p = (formData.path || '').replace(/^\/+/, '');
    return `${base}/${p}`;
  }, [selectedGroup, formData.path, isMcpProtocol]);

  // Auto-slugify key from name if new
  const handleAutoSlug = () => {
    if (!formData.name) return;
    const prefix = selectedGroup?.key ? `${selectedGroup.key}_` : '';
    const slug = formData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setFormData((prev) => ({ ...prev, key: `${prefix}${slug}` }));
  };

  // Quick schema templates
  const insertPathParamTemplate = () => {
    const template = {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Mã định danh (ID) cần tra cứu hoặc thao tác',
        },
      },
      required: ['id'],
    };
    setParametersSchemaRaw(JSON.stringify(template, null, 2));
    setParamSchemaError(null);
  };

  const insertQueryParamTemplate = () => {
    const template = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm',
        },
        limit: {
          type: 'integer',
          description: 'Số lượng kết quả tối đa',
          default: 20,
        },
        page: {
          type: 'integer',
          description: 'Trang kết quả',
          default: 1,
        },
      },
      required: ['query'],
    };
    setParametersSchemaRaw(JSON.stringify(template, null, 2));
    setParamSchemaError(null);
  };

  const insertBodyTemplate = () => {
    const template = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tên đối tượng' },
        amount: { type: 'number', description: 'Số tiền hoặc giá trị' },
        note: { type: 'string', description: 'Ghi chú mô tả' },
      },
      required: ['name'],
    };
    setBodySchemaRaw(JSON.stringify(template, null, 2));
    setBodySchemaError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setParamSchemaError(null);
    setBodySchemaError(null);
    setRespSchemaError(null);
    setSuccess(false);

    // Validation
    if (!formData.key?.trim()) {
      setError('Mã định danh (Tool key) là bắt buộc');
      return;
    }
    if (!formData.name?.trim()) {
      setError('Tên Tool là bắt buộc');
      return;
    }

    // Parse parameters_schema
    let parsedParametersSchema: Record<string, any> | undefined = undefined;
    if (parametersSchemaRaw.trim()) {
      try {
        parsedParametersSchema = JSON.parse(parametersSchemaRaw);
      } catch {
        setParamSchemaError('Parameters Schema không phải là JSON hợp lệ');
        return;
      }
    }

    // Parse body_schema
    let parsedBodySchema: Record<string, any> | undefined = undefined;
    if (bodySchemaRaw.trim()) {
      try {
        parsedBodySchema = JSON.parse(bodySchemaRaw);
      } catch {
        setBodySchemaError('Request Body Schema không phải là JSON hợp lệ');
        return;
      }
    }

    // Parse response_schema
    let parsedResponseSchema: Record<string, any> | undefined = undefined;
    if (responseSchemaRaw.trim()) {
      try {
        parsedResponseSchema = JSON.parse(responseSchemaRaw);
      } catch {
        setRespSchemaError('Response Schema không phải là JSON hợp lệ');
        return;
      }
    }

    try {
      setLoading(true);
      await onSubmit({
        ...formData,
        method: isMcpProtocol ? 'POST' : formData.method || 'GET',
        path: isMcpProtocol ? formData.path || '/call' : formData.path,
        parameters_schema: parsedParametersSchema,
        body_schema: parsedBodySchema,
        response_schema: parsedResponseSchema,
        input_schema: parsedParametersSchema,
        output_schema: parsedResponseSchema,
      });
      setSuccess(true);

      if (!tool) {
        setFormData({
          key: '',
          name: '',
          description: '',
          method: 'GET',
          path: '',
          status: 'active',
          group_id: defaultGroupId,
        });
        setParametersSchemaRaw('');
        setBodySchemaRaw('');
        setResponseSchemaRaw('');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu tool');
    } finally {
      setLoading(false);
    }
  };

  const HTTP_METHODS: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-emerald-600" />
          Đã lưu thông tin công cụ thành công!
        </div>
      )}

      {/* 1. General & Group Association */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-blue-600" />
            Nhóm Công Cụ & Thông Tin Chung
          </h2>
          <span className="text-xs text-gray-500">Mỗi công cụ được tổ chức theo Tool Group</span>
        </div>

        {/* Tool Group Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Nhóm công cụ (Tool Group)
          </label>
          <select
            value={formData.group_id || ''}
            onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
            disabled={loading || loadingGroups}
          >
            <option value="">-- Không phân nhóm (Độc lập) --</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.protocol_type || 'REST'} • {g.key})
              </option>
            ))}
          </select>

          {/* Group details pill */}
          {selectedGroup && (
            <div className="mt-2.5 p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-700">{selectedGroup.name}</span>
                <span
                  className={`px-2 py-0.5 rounded font-mono font-semibold ${
                    selectedGroup.protocol_type === 'MCP'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-cyan-100 text-cyan-800'
                  }`}
                >
                  {selectedGroup.protocol_type || 'REST'}
                </span>
              </div>
              <span className="text-gray-500 font-mono truncate max-w-sm">
                Base URL: {selectedGroup.base_url || 'Chưa thiết lập'}
              </span>
            </div>
          )}
        </div>

        {/* Name & Key */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Tên công cụ (Tool Name) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={() => {
                if (!formData.key && formData.name) handleAutoSlug();
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ví dụ: Tra cứu đơn hàng"
              disabled={loading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Mã định danh (Key) <span className="text-red-500">*</span>
              </label>
              {!tool && (
                <button
                  type="button"
                  onClick={handleAutoSlug}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                >
                  <Sparkle className="w-3 h-3" />
                  Tạo từ tên
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={formData.key || ''}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="tra_cuu_don_hang"
              disabled={loading || !!tool}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Dùng để Agent gọi trong quá trình suy luận (không thể thay đổi sau khi tạo).
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Mô tả chức năng (Agent Instruction)
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
            placeholder="Mô tả chi tiết công cụ này dùng để làm gì, khi nào Agent nên gọi công cụ này..."
            rows={3}
            disabled={loading}
          />
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Trạng thái hoạt động
            </label>
            <select
              value={formData.status || 'active'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
              disabled={loading}
            >
              <option value="active">Active (Sẵn sàng hoạt động)</option>
              <option value="deprecated">Deprecated (Ngưng sử dụng dần)</option>
              <option value="disabled">Disabled (Vô hiệu hóa)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Endpoint & Protocol Configuration */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <Lightning className="w-5 h-5 mr-2 text-amber-500" />
            Cấu Hình Endpoint & Giao Thức Thi Hành
          </h2>
          <span className="text-xs text-gray-500">
            {isMcpProtocol ? 'Giao thức MCP Server' : 'Giao thức RESTful API'}
          </span>
        </div>

        {isMcpProtocol ? (
          /* MCP Notice */
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-sm text-purple-900 space-y-2">
            <div className="flex items-center space-x-2 font-semibold">
              <Sparkle className="w-4 h-4 text-purple-600" />
              <span>Công cụ chuẩn MCP (Model Context Protocol)</span>
            </div>
            <p className="text-xs text-purple-700 leading-relaxed">
              Công cụ này được kết nối và thực thi tự động qua server MCP của nhóm{' '}
              <strong>{selectedGroup?.name}</strong>. Các tham số đầu vào được định nghĩa theo chuẩn
              JSON Schema dưới đây.
            </p>
          </div>
        ) : (
          /* REST Endpoint Configuration */
          <div className="space-y-4">
            {/* Method selection pills */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Phương thức HTTP (Method)
              </label>
              <div className="flex flex-wrap gap-2">
                {HTTP_METHODS.map((m) => {
                  const isSelected = (formData.method || 'GET') === m;
                  let colorClasses = 'border-gray-200 text-gray-700 hover:bg-gray-50';
                  if (isSelected) {
                    if (m === 'GET') colorClasses = 'bg-sky-600 text-white border-sky-600';
                    else if (m === 'POST')
                      colorClasses = 'bg-emerald-600 text-white border-emerald-600';
                    else if (m === 'PUT')
                      colorClasses = 'bg-amber-600 text-white border-amber-600';
                    else if (m === 'DELETE')
                      colorClasses = 'bg-rose-600 text-white border-rose-600';
                    else if (m === 'PATCH')
                      colorClasses = 'bg-purple-600 text-white border-purple-600';
                  }

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormData({ ...formData, method: m })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition ${colorClasses}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Path */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Đường dẫn Endpoint (Path)
              </label>
              <div className="flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-mono">
                  {selectedGroup?.base_url ? new URL(selectedGroup.base_url).pathname : '/'}
                </span>
                <input
                  type="text"
                  value={formData.path || ''}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  placeholder="api/v1/orders/{id}"
                  className="flex-1 min-w-0 block w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-none rounded-r-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Có thể chứa tham số đường dẫn dạng <code className="text-amber-600">{'{id}'}</code>,{' '}
                <code className="text-amber-600">{'{code}'}</code>.
              </p>
            </div>

            {/* Live URL preview */}
            <div className="p-3 bg-gray-900 rounded-lg text-white font-mono text-xs flex items-center justify-between">
              <span className="text-gray-400">URL thực thi:</span>
              <span className="text-emerald-400 font-semibold truncate ml-2">
                {liveUrlPreview}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. JSON Schemas */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <Code className="w-5 h-5 mr-2 text-indigo-600" />
            Cấu Trúc Tham Số (JSON Schemas)
          </h2>
          <span className="text-xs text-gray-500">Quy định các trường Agent cần truyền vào</span>
        </div>

        {/* Parameters Schema (Path & Query params, or MCP Input Schema) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-700">
              {isMcpProtocol ? 'Input Schema (MCP Arguments)' : 'Parameters Schema (Query & Path)'}
            </label>
            {!isMcpProtocol && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={insertPathParamTemplate}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 underline"
                >
                  Mẫu Path Param
                </button>
                <button
                  type="button"
                  onClick={insertQueryParamTemplate}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 underline"
                >
                  Mẫu Query Param
                </button>
              </div>
            )}
          </div>
          <textarea
            value={parametersSchemaRaw}
            onChange={(e) => {
              setParametersSchemaRaw(e.target.value);
              setParamSchemaError(null);
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs ${
              paramSchemaError ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
            placeholder={`{\n  "type": "object",\n  "properties": {\n    "id": { "type": "string", "description": "ID tham số" }\n  },\n  "required": ["id"]\n}`}
            rows={7}
            disabled={loading}
          />
          {paramSchemaError && (
            <p className="text-xs text-red-600 mt-1">{paramSchemaError}</p>
          )}
        </div>

        {/* Request Body Schema (Only for POST / PUT / PATCH) */}
        {!isMcpProtocol &&
          (formData.method === 'POST' ||
            formData.method === 'PUT' ||
            formData.method === 'PATCH') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Request Body Schema (JSON Payload)
                </label>
                <button
                  type="button"
                  onClick={insertBodyTemplate}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 underline"
                >
                  Chèn mẫu Body
                </button>
              </div>
              <textarea
                value={bodySchemaRaw}
                onChange={(e) => {
                  setBodySchemaRaw(e.target.value);
                  setBodySchemaError(null);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs ${
                  bodySchemaError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
                placeholder={`{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" },\n    "amount": { "type": "number" }\n  },\n  "required": ["name"]\n}`}
                rows={7}
                disabled={loading}
              />
              {bodySchemaError && (
                <p className="text-xs text-red-600 mt-1">{bodySchemaError}</p>
              )}
            </div>
          )}

        {/* Response Schema */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Response Schema (Tùy chọn kết quả trả về)
          </label>
          <textarea
            value={responseSchemaRaw}
            onChange={(e) => {
              setResponseSchemaRaw(e.target.value);
              setRespSchemaError(null);
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs ${
              respSchemaError ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
            placeholder={`{\n  "type": "object",\n  "properties": {\n    "success": { "type": "boolean" },\n    "data": { "type": "object" }\n  }\n}`}
            rows={5}
            disabled={loading}
          />
          {respSchemaError && (
            <p className="text-xs text-red-600 mt-1">{respSchemaError}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-sm transition disabled:opacity-50"
        >
          {loading ? (
            'Đang lưu...'
          ) : tool ? (
            <>
              <FloppyDisk className="w-4 h-4 mr-2" />
              Lưu Thay Đổi
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Tạo Công Cụ Mới
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function MethodBadge({ method }: { method?: string | null }) {
  if (!method) return null;
  const m = method.toUpperCase();
  const styles: Record<string, string> = {
    GET: 'bg-sky-100 text-sky-800 border-sky-200',
    POST: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PUT: 'bg-amber-100 text-amber-800 border-amber-200',
    DELETE: 'bg-rose-100 text-rose-800 border-rose-200',
    PATCH: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
        styles[m] || 'bg-gray-100 text-gray-800 border-gray-200'
      }`}
    >
      {m}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    deprecated: 'bg-amber-100 text-amber-800 border-amber-200',
    disabled: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800 border-gray-200'
      }`}
    >
      {status}
    </span>
  );
}

export function ProtocolBadge({ protocol }: { protocol?: string | null }) {
  if (!protocol) return null;
  const p = protocol.toUpperCase();
  const isRest = p === 'REST';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold border ${
        isRest
          ? 'bg-sky-50 text-sky-700 border-sky-200'
          : 'bg-purple-50 text-purple-700 border-purple-200'
      }`}
    >
      {p}
    </span>
  );
}

