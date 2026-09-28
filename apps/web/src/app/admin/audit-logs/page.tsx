'use client';

import React, { useState, useEffect } from 'react';
import {
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  TelegramLogo,
  Eye,
  Lightning,
  Wrench,
  ChatText,
  Lightbulb,
} from '@phosphor-icons/react';

interface AuditLog {
  id: string;
  workspaceId: string | null;
  platform: 'TELEGRAM' | 'ZALO';
  senderId: string;
  userPrompt: string;
  detectedIntent: string | null;
  matchedSkillId: string | null;
  executionPlan: any[];
  toolCalls: any[];
  finalResponse: string | null;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';
  latencyMs: number | null;
  createdAt: string;
  workspace?: { id: string; name: string };
  matchedSkill?: { id: string; name: string; key: string };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs?limit=30');
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Nhật Ký & Giám Sát (Agent Tracing)</h1>
          <p className="text-gray-600 mt-1">
            Theo dõi luồng tư duy, lập kế hoạch, các API đã gọi và thời gian phản hồi của AI Agent.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 font-medium"
        >
          <ClockCounterClockwise size={16} />
          Làm mới
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-500 text-sm">Đang tải nhật ký...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Chưa có nhật ký hoạt động nào. Khi có tin nhắn từ Zalo/Telegram gửi tới, toàn bộ quá trình xử lý sẽ xuất hiện tại đây.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Thời Gian</th>
                  <th className="px-5 py-3">Kênh</th>
                  <th className="px-5 py-3">Workspace</th>
                  <th className="px-5 py-3">Yêu Cầu (Prompt)</th>
                  <th className="px-5 py-3">Ý Định (Intent)</th>
                  <th className="px-5 py-3">Độ Trễ</th>
                  <th className="px-5 py-3">Trạng Thái</th>
                  <th className="px-5 py-3 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition">
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                    </td>
                    <td className="px-5 py-3">
                      {log.platform === 'TELEGRAM' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700">
                          <TelegramLogo size={14} weight="fill" /> Tele
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          Zalo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {log.workspace?.name || 'Chưa gán'}
                    </td>
                    <td className="px-5 py-3 max-w-xs truncate text-gray-800" title={log.userPrompt}>
                      {log.userPrompt}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">
                        {log.detectedIntent || 'none'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-600">
                      {log.latencyMs ? `${log.latencyMs}ms` : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {log.status === 'SUCCESS' ? (
                          <CheckCircle size={12} weight="fill" />
                        ) : (
                          <XCircle size={12} weight="fill" />
                        )}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-gray-100 rounded text-indigo-600 hover:text-indigo-800 transition"
                        title="Xem luồng tư duy"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trace Inspector Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Lightning size={20} className="text-amber-500" weight="fill" />
                  Luồng Thực Thi Chi Tiết (Agent Trace)
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Step 1: Input Prompt */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                  <ChatText size={16} /> 1. Tin nhắn người dùng
                </div>
                <div className="text-sm font-medium text-gray-900 bg-white p-3 rounded border border-gray-100">
                  {selectedLog.userPrompt}
                </div>
              </div>

              {/* Step 2: Router Decision */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase flex items-center gap-1.5">
                  <Lightbulb size={16} /> 2. Quyết định của Router Agent
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Ý định nhận diện:</span>
                    <div className="font-mono font-medium text-gray-900">{selectedLog.detectedIntent}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Skill đặc thù:</span>
                    <div className="font-medium text-gray-900">
                      {selectedLog.matchedSkill?.name || 'Không khớp (Dùng Dynamic Tool)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Tool Calls */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                  <Wrench size={16} /> 3. Các API Đã Gọi ({selectedLog.toolCalls?.length || 0})
                </div>

                {(!selectedLog.toolCalls || selectedLog.toolCalls.length === 0) ? (
                  <div className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded border border-gray-100">
                    Không gọi công cụ API nào (trả lời hội thoại trực tiếp).
                  </div>
                ) : (
                  selectedLog.toolCalls.map((call: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                      <div className="bg-gray-100 px-3 py-2 flex items-center justify-between font-mono">
                        <span className="font-bold text-indigo-600">[{call.method}] {call.url}</span>
                        <span className="text-emerald-700 font-bold">{call.statusCode} OK ({call.latencyMs}ms)</span>
                      </div>
                      <div className="p-3 bg-white space-y-2 font-mono">
                        <div>
                          <div className="text-gray-400 text-[10px]">RESPONSE BODY:</div>
                          <pre className="p-2 bg-gray-50 rounded text-gray-800 overflow-x-auto text-[11px] max-h-40">
                            {JSON.stringify(call.responseBody, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Step 4: Final Bot Response */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-emerald-800 uppercase flex items-center gap-1.5">
                  <CheckCircle size={16} weight="fill" /> 4. Phản hồi gửi về nhóm chat
                </div>
                <div className="text-sm text-gray-900 bg-white p-3 rounded border border-emerald-100 whitespace-pre-wrap">
                  {selectedLog.finalResponse || 'Không có nội dung'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
