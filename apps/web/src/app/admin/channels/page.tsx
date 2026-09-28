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
} from '@phosphor-icons/react';

interface ChannelAccount {
  id: string;
  platform: 'TELEGRAM' | 'ZALO';
  account_name: string;
  auth_type: string;
  status: 'ACTIVE' | 'DISCONNECTED' | 'EXPIRED';
  chat_count: number;
  last_synced_at: string | null;
  created_at: string;
}

interface ChannelChat {
  id: string;
  platform_chat_id: string;
  title: string;
  chat_type: string;
  workspace_name: string | null;
}

export default function ChannelsPage() {
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<ChannelAccount | null>(null);
  const [chats, setChats] = useState<ChannelChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

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

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
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
      const res = await fetch(`/api/channels/${acc.id}/chats`);
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
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {acc.platform === 'TELEGRAM' ? (
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                            <TelegramLogo size={18} weight="fill" />
                          </div>
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
              <h2 className="font-semibold text-gray-900">
                {selectedAccount ? `Nhóm Chat của: ${selectedAccount.account_name}` : 'Chi Tiết Nhóm Chat'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Các nhóm chat được định tuyến vào từng Workspace cụ thể.
              </p>
            </div>
          </div>

          {!selectedAccount ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Chọn một tài khoản ở danh sách bên trái để xem danh sách nhóm chat.
            </div>
          ) : loadingChats ? (
            <div className="text-center py-16 text-gray-500 text-sm">Đang tải danh sách nhóm chat...</div>
          ) : chats.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Tài khoản này chưa tham gia nhóm chat nào hoặc chưa có tin nhắn đến bot.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">Tên Nhóm</th>
                    <th className="px-4 py-3">ID Kênh Chat</th>
                    <th className="px-4 py-3">Workspace Đã Gán</th>
                    <th className="px-4 py-3 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chats.map((chat) => (
                    <tr key={chat.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{chat.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{chat.platform_chat_id}</td>
                      <td className="px-4 py-3">
                        {chat.workspace_name ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                            {chat.workspace_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            Chưa gán Workspace
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Hoạt động" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
