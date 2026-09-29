'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChatCircleDots,
  Plus,
  QrCode,
  TelegramLogo,
  CheckCircle,
  XCircle,
  WarningCircle,
  ArrowClockwise,
  Users,
  Trash,
  FolderSimple,
} from '@phosphor-icons/react';

interface ChannelAccount {
  id: string;
  platform: 'TELEGRAM' | 'ZALO';
  account_name: string;
  auth_type: string;
  status: 'ACTIVE' | 'DISCONNECTED' | 'EXPIRED';
  metadata?: {
    avatar?: string;
    name?: string;
    username?: string;
    zaloId?: string;
  };
  chat_count: number;
  last_synced_at: string | null;
  created_at: string;
}

interface ChannelChat {
  id: string;
  platform: 'TELEGRAM' | 'ZALO';
  platform_chat_id: string;
  title: string;
  chat_type: string;
  is_active: boolean;
  workspace_id: string | null;
  workspace_name: string | null;
  created_at?: string;
}

interface Workspace {
  id: string;
  name: string;
}

export default function ChannelsPage() {
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<ChannelAccount | null>(null);
  const [chats, setChats] = useState<ChannelChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Modals
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isZaloModalOpen, setIsZaloModalOpen] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [zaloQrUrl, setZaloQrUrl] = useState('');
  const [zaloQrStatus, setZaloQrStatus] = useState<string>('IDLE');
  const [zaloScannedUser, setZaloScannedUser] = useState<{ name: string; avatar: string } | null>(null);
  const [zaloError, setZaloError] = useState('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add Chat Modal
  const [isAddChatModalOpen, setIsAddChatModalOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatPlatformId, setNewChatPlatformId] = useState('');
  const [newChatType, setNewChatType] = useState('GROUP');
  const [newChatWorkspaceId, setNewChatWorkspaceId] = useState('');
  const [savingChat, setSavingChat] = useState(false);
  const [addChatError, setAddChatError] = useState('');
  const [updatingChatId, setUpdatingChatId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAccounts(data.data);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/admin/workspaces?limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setWorkspaces(data.data.map((w: any) => ({ id: w.id, name: w.name })));
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchWorkspaces();
    return () => {
      stopZaloPolling();
    };
  }, []);

  const stopZaloPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleSelectAccount = async (acc: ChannelAccount) => {
    setSelectedAccount(acc);
    setLoadingChats(true);
    try {
      const res = await fetch(`/api/channels/${acc.id}/chats?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.success) {
        setChats(data.data);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleAssignWorkspace = async (chatId: string, newWorkspaceId: string) => {
    if (!selectedAccount) return;
    setUpdatingChatId(chatId);
    try {
      const res = await fetch(`/api/channels/${selectedAccount.id}/chats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          workspace_id: newWorkspaceId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  workspace_id: newWorkspaceId || null,
                  workspace_name:
                    workspaces.find((w) => w.id === newWorkspaceId)?.name || null,
                }
              : c
          )
        );
      } else {
        alert(data.error || 'Không thể cập nhật workspace cho nhóm chat');
      }
    } catch (err: any) {
      alert('Lỗi kết nối khi cập nhật workspace: ' + err.message);
    } finally {
      setUpdatingChatId(null);
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!newChatPlatformId.trim() || !newChatTitle.trim()) {
      setAddChatError('Vui lòng nhập đầy đủ ID kênh chat và tên nhóm');
      return;
    }

    setSavingChat(true);
    setAddChatError('');
    try {
      const res = await fetch(`/api/channels/${selectedAccount.id}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_chat_id: newChatPlatformId.trim(),
          title: newChatTitle.trim(),
          chat_type: newChatType,
          workspace_id: newChatWorkspaceId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddChatModalOpen(false);
        setNewChatTitle('');
        setNewChatPlatformId('');
        setNewChatWorkspaceId('');
        await handleSelectAccount(selectedAccount);
        await fetchAccounts();
      } else {
        setAddChatError(data.error || 'Không thể thêm nhóm chat');
      }
    } catch (err: any) {
      setAddChatError(err.message || 'Lỗi khi kết nối máy chủ');
    } finally {
      setSavingChat(false);
    }
  };

  const handleDeleteChat = async (chatId: string, chatTitle: string) => {
    if (!selectedAccount) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa nhóm chat "${chatTitle}" khỏi kênh này không?`)) return;

    try {
      const res = await fetch(`/api/channels/${selectedAccount.id}/chats?chat_id=${chatId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        await fetchAccounts();
      } else {
        alert(data.error || 'Không thể xóa nhóm chat');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    }
  };

  const handleConnectTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/channels/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken }),
      });
      const data = await res.json();
      if (data.success) {
        setIsTelegramModalOpen(false);
        setBotToken('');
        await fetchAccounts();
      } else {
        setErrorMsg(data.error || 'Failed to connect Telegram Bot');
      }
    } catch (err) {
      setErrorMsg('Network error while connecting bot.');
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenZaloQr = async () => {
    setIsZaloModalOpen(true);
    setZaloQrUrl('');
    setZaloQrStatus('INITIALIZING');
    setZaloScannedUser(null);
    setZaloError('');
    stopZaloPolling();

    try {
      const res = await fetch('/api/channels/zalo/qr', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data?.sessionId) {
        const sessionId = data.data.sessionId;
        setZaloQrUrl(data.data.qrDataUrl);
        setZaloQrStatus('GENERATED');

        // Polling check trạng thái quét mã
        pollTimerRef.current = setInterval(async () => {
          try {
            const checkRes = await fetch(`/api/channels/zalo/qr?sessionId=${sessionId}`);
            const checkData = await checkRes.json();
            if (checkData.success && checkData.data) {
              const status = checkData.data.status;
              setZaloQrStatus(status);

              if (status === 'SCANNED') {
                if (checkData.data.user) {
                  setZaloScannedUser(checkData.data.user);
                }
              } else if (status === 'COMPLETED') {
                stopZaloPolling();
                await fetchAccounts();
                setTimeout(() => {
                  setIsZaloModalOpen(false);
                }, 2500);
              } else if (status === 'EXPIRED' || status === 'DECLINED' || status === 'ERROR') {
                stopZaloPolling();
                setZaloError(checkData.data.error || 'Phiên quét mã không thành công');
              }
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
          }
        }, 1500);
      } else {
        setZaloError(data.error || 'Không thể tạo mã QR đăng nhập');
        setZaloQrStatus('ERROR');
      }
    } catch (err: any) {
      setZaloError(err?.message || 'Lỗi mạng khi khởi tạo mã QR');
      setZaloQrStatus('ERROR');
    }
  };

  const handleCloseZaloModal = () => {
    stopZaloPolling();
    setIsZaloModalOpen(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Kênh Liên Lạc (Channel Hub)</h1>
          <p className="text-gray-600 mt-1">
            Quản lý tài khoản Telegram & Zalo kết nối độc lập. Gán từng nhóm chat cụ thể vào từng Workspace.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTelegramModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium shadow-sm transition"
          >
            <TelegramLogo size={20} weight="fill" />
            <span>+ Kết nối Telegram Bot</span>
          </button>
          <button
            onClick={handleOpenZaloQr}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition"
          >
            <QrCode size={20} weight="fill" />
            <span>+ Quét QR Zalo</span>
          </button>
        </div>
      </div>

      {/* Grid Accounts & Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Accounts List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ChatCircleDots size={20} className="text-indigo-600" />
              Tài Khoản Đã Kết Nối ({accounts.length})
            </h2>
            <button
              onClick={fetchAccounts}
              className="text-gray-400 hover:text-gray-600 transition"
              title="Làm mới"
            >
              <ArrowClockwise size={18} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Đang tải danh sách...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Chưa có tài khoản nào kết nối. Bấm nút phía trên để kết nối bot Telegram hoặc Zalo.
            </div>
          ) : (
            <div className="space-y-2.5">
              {accounts.map((acc) => {
                const isSelected = selectedAccount?.id === acc.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {acc.platform === 'TELEGRAM' ? (
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                            <TelegramLogo size={18} weight="fill" />
                          </div>
                        ) : acc.metadata?.avatar ? (
                          <img
                            src={acc.metadata.avatar}
                            alt={acc.account_name}
                            className="w-8 h-8 rounded-full object-cover border border-blue-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            Zalo
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{acc.account_name}</div>
                          <div className="text-xs text-gray-500">{acc.auth_type}</div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          acc.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {acc.status === 'ACTIVE' ? <CheckCircle size={12} weight="fill" /> : <XCircle size={12} weight="fill" />}
                        {acc.status}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span className="flex items-center gap-1">
                        <Users size={14} /> {acc.chat_count} nhóm chat
                      </span>
                      <span>{new Date(acc.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Chat Groups for Selected Account */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">
                {selectedAccount ? `Nhóm Chat của: ${selectedAccount.account_name}` : 'Chi Tiết Nhóm Chat'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Các nhóm chat được định tuyến vào từng Workspace cụ thể để gán agent và skills xử lý.
              </p>
            </div>
            {selectedAccount && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectAccount(selectedAccount)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                  title="Làm mới nhóm chat"
                >
                  <ArrowClockwise size={18} />
                </button>
                <button
                  onClick={() => {
                    setIsAddChatModalOpen(true);
                    setAddChatError('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition"
                >
                  <Plus size={16} weight="bold" />
                  <span>+ Thêm Nhóm Chat</span>
                </button>
              </div>
            )}
          </div>

          {!selectedAccount ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              Chọn một tài khoản ở danh sách bên trái để xem và quản lý danh sách nhóm chat.
            </div>
          ) : loadingChats ? (
            <div className="text-center py-20 text-gray-500 text-sm">Đang tải danh sách nhóm chat...</div>
          ) : chats.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                <ChatCircleDots size={28} />
              </div>
              <p className="text-gray-600 font-medium text-sm">
                Tài khoản này chưa có nhóm chat nào được ghi nhận.
              </p>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Hệ thống sẽ tự động phát hiện khi bot/tài khoản nhận tin nhắn trong nhóm, hoặc bạn có thể thêm thủ công ID nhóm chat ngay bên dưới.
              </p>
              <button
                onClick={() => {
                  setIsAddChatModalOpen(true);
                  setAddChatError('');
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition"
              >
                <Plus size={16} weight="bold" />
                <span>Thêm Nhóm Chat Thủ Công</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">Tên Nhóm</th>
                    <th className="px-4 py-3">ID Kênh Chat</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Gán Vào Workspace</th>
                    <th className="px-4 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chats.map((chat) => (
                    <tr key={chat.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {chat.title}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {chat.platform_chat_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-medium">
                          {chat.chat_type === 'DIRECT' ? 'Cá nhân' : 'Nhóm chat'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={chat.workspace_id || ''}
                            onChange={(e) => handleAssignWorkspace(chat.id, e.target.value)}
                            disabled={updatingChatId === chat.id}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              chat.workspace_id
                                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-800'
                                : 'bg-amber-50/70 border-amber-200 text-amber-800'
                            }`}
                          >
                            <option value="">-- Chưa gán Workspace --</option>
                            {workspaces.map((ws) => (
                              <option key={ws.id} value={ws.id}>
                                {ws.name}
                              </option>
                            ))}
                          </select>
                          {updatingChatId === chat.id && (
                            <span className="text-xs text-indigo-600 animate-pulse">Lưu...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteChat(chat.id, chat.title)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa nhóm chat này"
                        >
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Add Chat Group */}
      {isAddChatModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <Plus size={20} className="text-indigo-600" weight="bold" />
                Thêm Nhóm Chat Vào Kênh
              </h3>
              <button
                onClick={() => setIsAddChatModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2.5 text-xs text-gray-600">
                {selectedAccount.platform === 'TELEGRAM' ? (
                  <TelegramLogo size={20} className="text-sky-500" weight="fill" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                    Z
                  </div>
                )}
                <span>
                  Kênh tài khoản: <b>{selectedAccount.account_name}</b> ({selectedAccount.platform})
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên Nhóm Chat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nhóm Kỹ Thuật & Hỗ Trợ Khách Hàng"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Kênh Chat (Chat ID / Thread ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    selectedAccount.platform === 'TELEGRAM'
                      ? 'Ví dụ: -1001234567890 hoặc chat ID cá nhân'
                      : 'Ví dụ: 789792910810423597 hoặc thread ID nhóm Zalo'
                  }
                  value={newChatPlatformId}
                  onChange={(e) => setNewChatPlatformId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedAccount.platform === 'TELEGRAM'
                    ? 'ID nhóm chat Telegram thường bắt đầu bằng dấu trừ -100...'
                    : 'ID nhóm hoặc thread chat Zalo.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phân Loại Chat
                </label>
                <select
                  value={newChatType}
                  onChange={(e) => setNewChatType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="GROUP">Nhóm chat (Group Chat)</option>
                  <option value="DIRECT">Chat trực tiếp 1-1 (Direct Message)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gán Vào Workspace
                </label>
                <select
                  value={newChatWorkspaceId}
                  onChange={(e) => setNewChatWorkspaceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Chưa gán (Gán sau) --</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Tin nhắn từ nhóm này sẽ được Agent của Workspace đã chọn tiếp nhận và phản hồi.
                </p>
              </div>

              {addChatError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5">
                  <WarningCircle size={16} />
                  {addChatError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddChatModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingChat}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
                >
                  {savingChat ? 'Đang lưu...' : 'Thêm Nhóm Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Connect Telegram */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <TelegramLogo size={22} className="text-sky-500" weight="fill" />
                Kết Nối Telegram Bot
              </h3>
              <button
                onClick={() => setIsTelegramModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectTelegram} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  required
                  placeholder="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lấy token này từ BotFather trên Telegram sau khi tạo bot.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5">
                  <WarningCircle size={16} />
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTelegramModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {connecting ? 'Đang xác thực...' : 'Xác thực & Kết nối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Zalo QR Code */}
      {isZaloModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-5 border border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Đăng Nhập Zalo Bằng Mã QR</h3>
              <p className="text-xs text-gray-500 mt-1">
                Dùng camera hoặc ứng dụng Zalo trên điện thoại quét mã QR bên dưới để xác thực.
              </p>
            </div>

            {/* Khung hiển thị QR / Trạng thái */}
            <div className="p-4 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border border-gray-200 min-h-[220px]">
              {zaloQrStatus === 'INITIALIZING' && (
                <div className="flex flex-col items-center gap-3 text-xs text-gray-500">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang kết nối máy chủ Zalo...</span>
                </div>
              )}

              {zaloQrStatus === 'GENERATED' && zaloQrUrl && (
                <div className="space-y-3">
                  <img
                    src={zaloQrUrl}
                    alt="Zalo QR"
                    className="w-48 h-48 rounded-xl shadow-sm border border-gray-100 mx-auto"
                  />
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                    <span>Chờ quét mã trên điện thoại</span>
                  </div>
                </div>
              )}

              {zaloQrStatus === 'SCANNED' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  {zaloScannedUser?.avatar ? (
                    <img
                      src={zaloScannedUser.avatar}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full border-2 border-green-500 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">
                      {zaloScannedUser?.name?.charAt(0) || 'Z'}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{zaloScannedUser?.name || 'Tài khoản Zalo'}</h4>
                    <p className="text-xs text-green-600 font-medium mt-1">
                      Đã quét thành công!
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Vui lòng bấm <b>"Xác nhận đăng nhập"</b> trên điện thoại của bạn.
                    </p>
                  </div>
                </div>
              )}

              {zaloQrStatus === 'COMPLETED' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle size={36} weight="fill" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-base">Đăng Nhập Thành Công!</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Hệ thống đã mã hóa và lưu phiên làm việc Zalo vào CSDL.
                    </p>
                  </div>
                </div>
              )}

              {(zaloQrStatus === 'EXPIRED' || zaloQrStatus === 'DECLINED' || zaloQrStatus === 'ERROR') && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                    <WarningCircle size={32} weight="fill" />
                  </div>
                  <div>
                    <p className="text-xs text-red-600 font-medium">{zaloError || 'Phiên làm việc đã kết thúc'}</p>
                  </div>
                  <button
                    onClick={handleOpenZaloQr}
                    className="mt-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm transition"
                  >
                    Tạo lại mã QR mới
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleCloseZaloModal}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
