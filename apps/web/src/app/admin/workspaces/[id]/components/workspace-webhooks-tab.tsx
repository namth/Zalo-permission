'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe, Plus, Copy, Check, Eye, EyeSlash, Trash, ArrowClockwise,
  ShieldCheck, Info, Key, X, Fire, Sparkle
} from '@phosphor-icons/react';

interface WebhookItem {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  secretTokenMasked: string;
  isActive: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  stats: {
    sessionsCount: number;
    totalCalls: number;
  };
}

interface FirebaseConfig {
  isConfigured: boolean;
  isActive: boolean;
  projectId: string | null;
  clientEmail: string | null;
  updatedAt?: string;
}

export function WorkspaceWebhooksTab({ workspaceId }: { workspaceId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal Create Webhook
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', isActive: true });
  const [newlyCreatedWebhook, setNewlyCreatedWebhook] = useState<{ id: string; secretTokenRaw: string; name: string } | null>(null);

  // Modal Firebase Config
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(null);
  const [loadingFirebase, setLoadingFirebase] = useState(false);
  const [savingFirebase, setSavingFirebase] = useState(false);
  const [testingFirebase, setTestingFirebase] = useState(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [firebaseForm, setFirebaseForm] = useState({
    projectId: '',
    clientEmail: '',
    serviceAccountJson: '',
    isActive: true,
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/webhooks`);
      const data = await res.json();
      if (data.success) {
        setWebhooks(data.data || []);
      } else {
        setError(data.error || 'Failed to load webhooks');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading webhooks');
    } finally {
      setLoading(false);
    }
  };

  const fetchFirebaseConfig = async () => {
    try {
      setLoadingFirebase(true);
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/firebase-config`);
      const data = await res.json();
      if (data.success && data.data) {
        setFirebaseConfig(data.data);
        if (data.data.isConfigured) {
          setFirebaseForm((prev) => ({
            ...prev,
            projectId: data.data.projectId || '',
            clientEmail: data.data.clientEmail || '',
            isActive: data.data.isActive,
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching firebase config:', err);
    } finally {
      setLoadingFirebase(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    fetchFirebaseConfig();
  }, [workspaceId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (webhook: WebhookItem) => {
    try {
      const updatedStatus = !webhook.isActive;
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setWebhooks((prev) =>
          prev.map((item) => (item.id === webhook.id ? { ...item, isActive: updatedStatus } : item))
        );
      } else {
        alert(data.error || 'Failed to update webhook');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating webhook');
    }
  };

  const handleRegenerateSecret = async (webhookId: string) => {
    if (!confirm('Bạn có chắc chắn muốn làm mới Secret Token? Ứng dụng client đang sử dụng token cũ sẽ bị từ chối kết nối ngay lập tức!')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/webhooks/${webhookId}/regenerate-secret`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(`Secret Token mới:\n\n${data.data.secretTokenRaw}\n\nVui lòng sao chép token này vào ứng dụng của bạn.`);
        fetchWebhooks();
      } else {
        alert(data.error || 'Failed to regenerate secret');
      }
    } catch (err: any) {
      alert(err.message || 'Error regenerating secret');
    }
  };

  const handleDeleteWebhook = async (webhookId: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa Webhook "${name}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setWebhooks((prev) => prev.filter((item) => item.id !== webhookId));
      } else {
        alert(data.error || 'Failed to delete webhook');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting webhook');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    try {
      setCreatingWebhook(true);
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setNewlyCreatedWebhook({
          id: data.data.id,
          secretTokenRaw: data.data.secretTokenRaw,
          name: data.data.name,
        });
        setCreateForm({ name: '', description: '', isActive: true });
        fetchWebhooks();
      } else {
        alert(data.error || 'Failed to create webhook');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setFirebaseForm({
          projectId: parsed.project_id || '',
          clientEmail: parsed.client_email || '',
          serviceAccountJson: text,
          isActive: true,
        });
        setFirebaseTestResult(null);
      } catch {
        alert('File không phải định dạng JSON hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  const handleTestFirebase = async () => {
    if (!firebaseForm.serviceAccountJson) {
      alert('Vui lòng tải lên hoặc dán nội dung Service Account JSON trước khi kiểm tra.');
      return;
    }

    try {
      setTestingFirebase(true);
      setFirebaseTestResult(null);
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/firebase-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_account_json: firebaseForm.serviceAccountJson }),
      });
      const data = await res.json();
      if (data.success) {
        setFirebaseTestResult({
          success: true,
          message: '✓ Kết nối Firebase thành công! Credentials hợp lệ.',
        });
      } else {
        setFirebaseTestResult({
          success: false,
          message: `✗ Lỗi kiểm tra: ${data.error}`,
        });
      }
    } catch (err: any) {
      setFirebaseTestResult({
        success: false,
        message: `✗ Lỗi kết nối: ${err.message}`,
      });
    } finally {
      setTestingFirebase(false);
    }
  };

  const handleSaveFirebase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseForm.projectId || !firebaseForm.clientEmail || !firebaseForm.serviceAccountJson) {
      alert('Vui lòng điền đủ Project ID, Client Email và nội dung JSON.');
      return;
    }

    try {
      setSavingFirebase(true);
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/firebase-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: firebaseForm.projectId,
          client_email: firebaseForm.clientEmail,
          service_account_json: firebaseForm.serviceAccountJson,
          is_active: firebaseForm.isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã lưu cấu hình Firebase FCM mã hóa AES-256-GCM thành công!');
        setShowFirebaseModal(false);
        fetchFirebaseConfig();
      } else {
        alert(data.error || 'Failed to save Firebase config');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving Firebase config');
    } finally {
      setSavingFirebase(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Globe size={22} className="text-indigo-600" weight="duotone" />
            <h2 className="text-base font-bold text-slate-900">Inbound Webhooks & Async Callbacks</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cung cấp các cổng API cho Mobile App, Website hoặc hệ thống vệ tinh gọi trực tiếp vào Agent của Workspace này.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFirebaseModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
              firebaseConfig?.isConfigured
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Fire size={16} className="text-amber-500" weight="fill" />
            <span>{firebaseConfig?.isConfigured ? 'Firebase FCM (Đã bật)' : 'Cấu hình Firebase FCM'}</span>
          </button>

          <button
            onClick={() => {
              setNewlyCreatedWebhook(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
          >
            <Plus size={16} weight="bold" />
            <span>Tạo Webhook Mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <Info size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Webhooks List Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Đang tải danh sách Webhooks...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 p-8">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
            <Globe size={24} weight="duotone" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Chưa có Webhook nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Khởi tạo Webhook để cho phép Mobile App hoặc Website của bạn gửi tin nhắn trực tiếp vào AI Agent của Workspace này.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Plus size={14} weight="bold" />
            <span>Tạo Webhook Ngay</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Tên & Mô tả</th>
                <th className="py-3 px-4">Endpoint URL</th>
                <th className="py-3 px-4">Secret Token</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Lượt gọi</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {webhooks.map((wh) => {
                const endpointUrl = `${origin}/api/v1/workspaces/${workspaceId}/webhooks/${wh.id}`;
                const isCopied = copiedId === wh.id;

                return (
                  <tr key={wh.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{wh.name}</div>
                      {wh.description && (
                        <div className="text-[11px] text-slate-400 mt-0.5 max-w-xs truncate">{wh.description}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded max-w-xs truncate text-slate-700">
                        <span className="truncate">{endpointUrl}</span>
                        <button
                          onClick={() => handleCopy(endpointUrl, wh.id)}
                          className="text-slate-400 hover:text-indigo-600 shrink-0 ml-auto"
                          title="Copy Endpoint URL"
                        >
                          {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-slate-500">{wh.secretTokenMasked}</span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(wh)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                          wh.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {wh.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {wh.stats.totalCalls}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRegenerateSecret(wh.id)}
                          className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50"
                          title="Làm mới Secret Token"
                        >
                          <ArrowClockwise size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(wh.id, wh.name)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Xóa Webhook"
                        >
                          <Trash size={15} />
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

      {/* CREATE WEBHOOK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {newlyCreatedWebhook ? 'Webhook Đã Tạo Thành Công' : 'Tạo Inbound Webhook Mới'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {newlyCreatedWebhook ? (
              <div className="p-6 space-y-4">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <ShieldCheck size={16} />
                    <span>Lưu ý bảo mật quan trọng:</span>
                  </div>
                  <p>
                    Đây là lần <strong>DUY NHẤT</strong> Secret Token hiển thị ở dạng đầy đủ. Vui lòng sao chép và lưu trữ an toàn trong ứng dụng của bạn!
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Secret Token</label>
                  <div className="flex items-center gap-2 bg-slate-900 text-emerald-400 px-3 py-2 rounded-lg font-mono text-xs">
                    <span className="break-all">{newlyCreatedWebhook.secretTokenRaw}</span>
                    <button
                      onClick={() => handleCopy(newlyCreatedWebhook.secretTokenRaw, 'new-secret')}
                      className="text-slate-400 hover:text-white shrink-0 ml-auto"
                    >
                      {copiedId === 'new-secret' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Endpoint URL</label>
                  <div className="flex items-center gap-2 bg-slate-100 text-slate-800 px-3 py-2 rounded-lg font-mono text-xs">
                    <span className="break-all">{`${origin}/api/v1/workspaces/${workspaceId}/webhooks/${newlyCreatedWebhook.id}`}</span>
                    <button
                      onClick={() => handleCopy(`${origin}/api/v1/workspaces/${workspaceId}/webhooks/${newlyCreatedWebhook.id}`, 'new-endpoint')}
                      className="text-slate-400 hover:text-indigo-600 shrink-0 ml-auto"
                    >
                      {copiedId === 'new-endpoint' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-full py-2 px-4 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    Tôi Đã Lưu Token & Đóng Hộp Thoại
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateWebhook} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên Webhook <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="vd: Mobile App Khách Hàng, Web Tra Cứu..."
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả (Tùy chọn)</label>
                  <textarea
                    rows={2}
                    placeholder="Mục đích sử dụng của Webhook này..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs font-medium text-slate-700">
                    Kích hoạt ngay sau khi tạo
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creatingWebhook}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                  >
                    {creatingWebhook ? 'Đang tạo...' : 'Tạo Webhook'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FIREBASE FCM CONFIG MODAL */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Fire size={20} className="text-amber-500" weight="fill" />
                <h3 className="text-sm font-bold text-slate-900">Cấu hình Firebase FCM Push (Mobile App)</h3>
              </div>
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFirebase} className="p-6 space-y-4">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
                <ShieldCheck size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Mã hóa chuẩn AES-256-GCM</div>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Toàn bộ Service Account Key của bạn được mã hóa an toàn và chỉ giải mã trên bộ nhớ RAM của Agent Worker khi gửi Push Notification.
                  </p>
                </div>
              </div>

              {/* Upload file zone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tải lên tệp `serviceAccountKey.json` từ Firebase Console
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Project ID</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: my-app-12345"
                    value={firebaseForm.projectId}
                    onChange={(e) => setFirebaseForm({ ...firebaseForm, projectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Client Email</label>
                  <input
                    type="email"
                    required
                    placeholder="firebase-adminsdk@..."
                    value={firebaseForm.clientEmail}
                    onChange={(e) => setFirebaseForm({ ...firebaseForm, clientEmail: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung JSON Service Account</label>
                <textarea
                  rows={4}
                  required
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  value={firebaseForm.serviceAccountJson}
                  onChange={(e) => setFirebaseForm({ ...firebaseForm, serviceAccountJson: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-indigo-500 font-mono text-[11px]"
                />
              </div>

              {firebaseTestResult && (
                <div
                  className={`p-3 text-xs rounded-lg border ${
                    firebaseTestResult.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {firebaseTestResult.message}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestFirebase}
                  disabled={testingFirebase}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                >
                  {testingFirebase ? 'Đang kiểm tra...' : 'Kiểm tra Kết nối'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFirebaseModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={savingFirebase}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                  >
                    {savingFirebase ? 'Đang lưu...' : 'Lưu Cấu hình'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
