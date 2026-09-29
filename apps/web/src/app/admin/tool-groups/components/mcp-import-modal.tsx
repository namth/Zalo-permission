'use client';

import { useState } from 'react';
import { inspectMcpConfig, importMcpServer, DiscoveredTool } from '../api';
import { X, Sparkle, CheckCircle, WarningCircle, ArrowRight, ShieldCheck } from '@phosphor-icons/react';

interface McpImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function McpImportModal({ isOpen, onClose, onSuccess }: McpImportModalProps) {
  const [activeTab, setActiveTab] = useState<'JSON' | 'URL'>('JSON');
  const [jsonConfig, setJsonConfig] = useState<string>(
    JSON.stringify(
      {
        mcpServers: {
          simplefinance: {
            command: 'npx',
            args: ['-y', 'mcp-proxy', 'https://financemcp.oa.io.vn/mcp.php'],
          },
        },
      },
      null,
      2
    )
  );
  const [directUrl, setDirectUrl] = useState('');
  const [defaultAuthToken, setDefaultAuthToken] = useState('');

  // Inspection states
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Parsed result
  const [serverKey, setServerKey] = useState('');
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [transport, setTransport] = useState('SSE');
  const [discoveredTools, setDiscoveredTools] = useState<DiscoveredTool[]>([]);
  const [selectedToolsMap, setSelectedToolsMap] = useState<Record<string, boolean>>({});
  const [rawSnippet, setRawSnippet] = useState<any>(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInspect = async () => {
    try {
      setInspecting(true);
      setInspectError(null);
      setSaveError(null);

      const payload = {
        raw_config: activeTab === 'JSON' ? jsonConfig : undefined,
        endpoint_url: activeTab === 'URL' ? directUrl : undefined,
        default_auth_token: defaultAuthToken.trim() || undefined,
      };

      const result = await inspectMcpConfig(payload);

      setServerKey(result.server_name);
      setServerName(result.server_name.toUpperCase() + ' MCP Service');
      setServerDescription(`Model Context Protocol Hub for ${result.server_name}`);
      setTargetUrl(result.target_url);
      setTransport(result.transport || 'SSE');
      setDiscoveredTools(result.tools);
      setRawSnippet(result.raw_config);

      // Mặc định chọn tất cả tools
      const initialMap: Record<string, boolean> = {};
      result.tools.forEach((t) => {
        initialMap[t.name] = true;
      });
      setSelectedToolsMap(initialMap);
    } catch (err: any) {
      setInspectError(err.message || 'Lỗi kiểm tra cấu hình MCP');
    } finally {
      setInspecting(false);
    }
  };

  const handleToggleTool = (toolName: string) => {
    setSelectedToolsMap((prev) => ({
      ...prev,
      [toolName]: !prev[toolName],
    }));
  };

  const handleToggleAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    discoveredTools.forEach((t) => {
      updated[t.name] = select;
    });
    setSelectedToolsMap(updated);
  };

  const selectedCount = discoveredTools.filter((t) => selectedToolsMap[t.name]).length;

  const handleSave = async () => {
    if (!serverKey.trim() || !serverName.trim()) {
      setSaveError('Vui lòng nhập Key và Tên Tool Group');
      return;
    }

    const toolsToImport = discoveredTools.filter((t) => selectedToolsMap[t.name]);
    if (toolsToImport.length === 0) {
      setSaveError('Vui lòng chọn ít nhất 1 tool để nhập vào hệ thống');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      await importMcpServer({
        key: serverKey.trim(),
        name: serverName.trim(),
        description: serverDescription.trim(),
        target_url: targetUrl.trim(),
        transport,
        timeout_seconds: 15,
        default_auth_token: defaultAuthToken.trim() || undefined,
        raw_config: rawSnippet,
        selected_tools: toolsToImport,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Lỗi khi lưu cấu hình MCP');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Sparkle size={22} weight="fill" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Connect Model Context Protocol (MCP) Server
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động bóc tách và nạp công cụ trực tiếp từ giao thức MCP tiêu chuẩn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('JSON')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'JSON'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Paste JSON Config (mcpServers)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('URL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'URL'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Direct Endpoint URL
            </button>
          </div>

          {/* Input Area */}
          {activeTab === 'JSON' ? (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cấu hình JSON <span className="font-mono text-slate-400">(mcpServers snippet)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setJsonConfig(
                      JSON.stringify(
                        {
                          mcpServers: {
                            simplefinance: {
                              command: 'npx',
                              args: ['-y', 'mcp-proxy', 'https://financemcp.oa.io.vn/mcp.php'],
                            },
                          },
                        },
                        null,
                        2
                      )
                    )
                  }
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Nạp mẫu SimpleFinance
                </button>
              </div>
              <textarea
                rows={7}
                value={jsonConfig}
                onChange={(e) => setJsonConfig(e.target.value)}
                className="w-full font-mono text-xs p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='{\n  "mcpServers": {\n    "myserver": {\n      "args": ["https://..."]\n    }\n  }\n}'
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                MCP Server Endpoint URL (SSE / Streamable HTTP)
              </label>
              <input
                type="url"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://financemcp.oa.io.vn/mcp.php"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Master Default Auth Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Master Default Auth Token <span className="text-slate-400 font-normal">(Tùy chọn - Dùng chung nếu Workspace không cấu hình riêng)</span>
            </label>
            <input
              type="text"
              value={defaultAuthToken}
              onChange={(e) => setDefaultAuthToken(e.target.value)}
              placeholder="Bearer secret_token_here (hoặc để trống nếu public)"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleInspect}
              disabled={inspecting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Sparkle size={16} weight="bold" />
              {inspecting ? 'Đang kết nối & bóc tách...' : 'Kiểm tra & Lấy danh sách Tools'}
            </button>
          </div>

          {inspectError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs flex items-start gap-2">
              <WarningCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Kiểm tra kết nối thất bại:</p>
                <p className="mt-0.5">{inspectError}</p>
              </div>
            </div>
          )}

          {/* Discovered Tools Preview */}
          {targetUrl && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Target Endpoint</span>
                  <p className="text-xs font-mono font-medium text-slate-900 dark:text-slate-100 truncate">{targetUrl}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Giao thức / Transport</span>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <ShieldCheck size={16} /> Native MCP ({transport})
                  </p>
                </div>
              </div>

              {/* Form metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Group Key
                  </label>
                  <input
                    type="text"
                    value={serverKey}
                    onChange={(e) => setServerKey(e.target.value)}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên Hiển Thị
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Tools List Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <CheckCircle size={16} className="text-emerald-500" weight="fill" />
                    Danh sách Tools tìm thấy ({discoveredTools.length})
                  </h3>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleToggleAll(true)}
                      className="text-blue-600 hover:underline"
                    >
                      Chọn tất cả
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(false)}
                      className="text-slate-500 hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-8"></th>
                        <th className="py-2 px-3">Tên Tool</th>
                        <th className="py-2 px-3">Mô tả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {discoveredTools.map((t) => (
                        <tr
                          key={t.name}
                          onClick={() => handleToggleTool(t.name)}
                          className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                            selectedToolsMap[t.name] ? 'bg-blue-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedToolsMap[t.name]}
                              onChange={() => handleToggleTool(t.name)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200">
                            {t.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 line-clamp-1">
                            {t.description || 'Không có mô tả'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {saveError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">
                  {saveError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            Đóng
          </button>

          {discoveredTools.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition"
            >
              {saving ? 'Đang lưu vào kho...' : `Lưu ${selectedCount} Tools vào Kho`}
              <ArrowRight size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
