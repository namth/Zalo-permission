'use client';

import React, { useState, useEffect } from 'react';
import {
  ChatCircleDots, TelegramLogo, Clock, ArrowClockwise,
  CheckCircle, Warning, X, ShieldCheck, Lock, Sliders, Trash, Plus
} from '@phosphor-icons/react';
import Link from 'next/link';

interface DirectAccountItem {
  account_id: string;
  platform: 'ZALO' | 'TELEGRAM';
  account_name: string;
  status: string;
  is_assigned: boolean;
  is_assigned_to_current: boolean;
  assigned_workspace: {
    id: string;
    name: string;
  } | null;
  working_time: {
    workingDays: number[];
    startTime: string;
    endTime: string;
    timezone: string;
    takeoverMinutes: number;
  } | null;
  is_in_shift: boolean;
}

export function WorkspaceDirectAssistantSection({ workspaceId }: { workspaceId: string }) {
  const [accounts, setAccounts] = useState<DirectAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Schedule & Assign
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [takeoverMinutes, setTakeoverMinutes] = useState(30);

  // Modal Reassign Warning
  const [showReassignWarning, setShowReassignWarning] = useState(false);
  const [accountToReassign, setAccountToReassign] = useState<DirectAccountItem | null>(null);

  const fetchDirectAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/direct-chats`);
      const data = await res.json();
      if (data.success) {
        const accs: DirectAccountItem[] = data.data || [];
        setAccounts(accs);
        if (accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accs[0].account_id);
        }
      } else {
        setError(data.error || 'Không thể tải danh sách kênh chat cá nhân');
      }
    } catch {
      setError('Lỗi kết nối khi tải danh sách kênh');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectAccounts();
  }, [workspaceId]);

  const handleOpenAddModal = (defaultAcc?: DirectAccountItem) => {
    const target = defaultAcc || (accounts.length > 0 ? accounts[0] : null);
    if (target) {
      setSelectedAccountId(target.account_id);
      applyAccountScheduleToForm(target);
    }
    setShowConfigModal(true);
  };

  const applyAccountScheduleToForm = (acc: DirectAccountItem) => {
    if (acc.working_time) {
      setWorkingDays(acc.working_time.workingDays || [1, 2, 3, 4, 5]);
      setStartTime(acc.working_time.startTime || '08:00');
      setEndTime(acc.working_time.endTime || '18:00');
      setTakeoverMinutes(acc.working_time.takeoverMinutes || 30);
    } else {
      setWorkingDays([1, 2, 3, 4, 5]);
      setStartTime('08:00');
      setEndTime('18:00');
      setTakeoverMinutes(30);
    }
  };

  const handleAccountSelectionChange = (newAccId: string) => {
    setSelectedAccountId(newAccId);
    const found = accounts.find((a) => a.account_id === newAccId);
    if (found) {
      applyAccountScheduleToForm(found);
    }
  };

  const handleAssignClick = (acc: DirectAccountItem) => {
    if (acc.is_assigned && !acc.is_assigned_to_current) {
      setAccountToReassign(acc);
      setShowReassignWarning(true);
    } else {
      handleOpenAddModal(acc);
    }
  };

  const confirmReassign = () => {
    if (!accountToReassign) return;
    const target = accountToReassign;
    setShowReassignWarning(false);
    setAccountToReassign(null);
    handleOpenAddModal(target);
  };

  const handleSaveSchedule = async () => {
    if (!selectedAccountId) {
      alert('Vui lòng chọn một tài khoản');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/direct-chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          working_days: workingDays,
          start_time: startTime,
          end_time: endTime,
          takeover_minutes: takeoverMinutes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowConfigModal(false);
        await fetchDirectAccounts();
      } else {
        alert(data.error || 'Lỗi khi lưu cấu hình');
      }
    } catch {
      alert('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (accountId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy gán tính năng chat cá nhân của tài khoản này khỏi Workspace?')) return;
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/direct-chats/${accountId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchDirectAccounts();
      } else {
        alert(data.error || 'Lỗi khi hủy gán');
      }
    } catch {
      alert('Lỗi kết nối khi hủy gán');
    }
  };

  const toggleDay = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  const dayLabels = [
    { num: 1, label: 'Thứ 2' },
    { num: 2, label: 'Thứ 3' },
    { num: 3, label: 'Thứ 4' },
    { num: 4, label: 'Thứ 5' },
    { num: 5, label: 'Thứ 6' },
    { num: 6, label: 'Thứ 7' },
    { num: 7, label: 'Chủ Nhật' },
  ];

  const currentSelectedAcc = accounts.find((a) => a.account_id === selectedAccountId);

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ChatCircleDots className="text-blue-600" size={20} weight="fill" />
              Trợ lý AI Chat Cá nhân 1-1 (Direct Chat Assistant)
            </h3>
            <span className="bg-blue-100 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
              FEAT-002
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Gán tài khoản Zalo cá nhân hoặc Telegram Bot độc quyền cho Workspace này để AI tự động tư vấn 1-1 theo khung giờ làm việc.
            Ngoài giờ làm việc, AI im lặng 100%. Khi người thật chủ động chat, AI tự động tạm dừng 30 phút.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Plus size={16} weight="bold" />
            <span>Thêm Tài Khoản Cá Nhân</span>
          </button>
          <button
            onClick={fetchDirectAccounts}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="Tải lại danh sách"
          >
            <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Warning size={16} weight="fill" />
            <span>{error}</span>
          </div>
          <button onClick={fetchDirectAccounts} className="font-semibold underline hover:no-underline">
            Thử lại
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-gray-50 border border-gray-200 rounded-lg p-4 h-20"></div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && accounts.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50/50">
          <ChatCircleDots size={36} className="mx-auto text-gray-400 mb-2" />
          <h4 className="text-sm font-semibold text-gray-700">Chưa có tài khoản chat nào trong hệ thống</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Hãy kết nối Telegram Bot hoặc quét mã QR Zalo cá nhân tại trang Quản lý Kênh để kích hoạt tính năng chat 1-1.
          </p>
          <Link
            href="/channels"
            className="inline-flex items-center gap-1.5 mt-3 text-xs bg-blue-600 text-white font-medium px-3.5 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            Quản lý Kênh Kết Nối
          </Link>
        </div>
      )}

      {/* SUCCESS DATA TABLE */}
      {!loading && !error && accounts.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Tài khoản Kênh</th>
                <th className="py-3 px-4">Trạng thái Gán</th>
                <th className="py-3 px-4">Khung giờ Hoạt động</th>
                <th className="py-3 px-4">Trạng thái Hiện tại</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((acc) => (
                <tr key={acc.account_id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      {acc.platform === 'ZALO' ? (
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs border border-blue-200 shrink-0">
                          Z
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-500 border border-sky-200 shrink-0">
                          <TelegramLogo size={16} weight="fill" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-800">{acc.account_name}</div>
                        <div className="text-[10px] text-gray-400">
                          {acc.platform} • {acc.status}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    {acc.is_assigned_to_current ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle size={12} weight="fill" />
                        Đang phục vụ Workspace này
                      </span>
                    ) : acc.is_assigned ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        <Lock size={12} weight="fill" />
                        Đang gán: {acc.assigned_workspace?.name || 'Workspace khác'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                        Chưa kích hoạt
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {acc.working_time ? (
                      <div className="space-y-0.5">
                        <div className="font-medium text-gray-700 flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          {acc.working_time.startTime} - {acc.working_time.endTime}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {acc.working_time.workingDays?.length === 7
                            ? 'Cả tuần'
                            : `T${acc.working_time.workingDays?.join(', T')}`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Mặc định (8h - 18h)</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {acc.is_assigned_to_current ? (
                      acc.is_in_shift ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Trong ca (AI Active)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                          Ngoài ca (AI Silent)
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 text-[11px]">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {acc.is_assigned_to_current ? (
                        <>
                          <button
                            onClick={() => handleOpenAddModal(acc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <Sliders size={12} />
                            Đổi Khung giờ
                          </button>
                          <button
                            onClick={() => handleUnassign(acc.account_id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hủy gán khỏi Workspace này"
                          >
                            <Trash size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAssignClick(acc)}
                          className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-lg transition shadow-xs ${
                            acc.is_assigned
                              ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                              : 'text-white bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          <Plus size={13} weight="bold" />
                          <span>{acc.is_assigned ? 'Chuyển về đây' : 'Gán vào Workspace'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CẢNH BÁO CHUYỂN QUYỀN (REASSIGN CONFIRMATION) */}
      {showReassignWarning && accountToReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Warning size={20} weight="fill" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Xác nhận chuyển quyền Trợ lý Chat</h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Tài khoản <strong className="text-gray-900">{accountToReassign.account_name}</strong> hiện đang được gán làm Trợ lý chat cá nhân cho{' '}
                  <strong className="text-amber-800 underline">
                    {accountToReassign.assigned_workspace?.name || 'Workspace khác'}
                  </strong>.
                </p>
                <p className="text-xs text-amber-700 mt-2 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                  ⚠️ Nếu bạn gán vào Workspace này, kết nối chat cá nhân ở Workspace cũ sẽ tự động bị ngắt ngay lập tức (Atomic Reassign)!
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  setShowReassignWarning(false);
                  setAccountToReassign(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmReassign}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-sm"
              >
                Xác nhận Chuyển quyền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / CẤU HÌNH TÀI KHOẢN CÁ NHÂN VÀ KHUNG GIỜ */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ChatCircleDots className="text-blue-600" size={20} weight="fill" />
                <h4 className="text-sm font-bold text-gray-900">
                  Gán / Cấu hình Tài khoản AI Chat Cá nhân 1-1
                </h4>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Chọn Tài khoản */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Chọn Tài khoản Kênh (Zalo / Telegram):
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountSelectionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      [{acc.platform}] {acc.account_name} —{' '}
                      {acc.is_assigned_to_current
                        ? 'Đang phục vụ Workspace này'
                        : acc.is_assigned
                        ? `Đang gán ở: ${acc.assigned_workspace?.name || 'Workspace khác'}`
                        : 'Chưa kích hoạt'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cảnh báo Reassign nếu tài khoản đang gán nơi khác */}
              {currentSelectedAcc && currentSelectedAcc.is_assigned && !currentSelectedAcc.is_assigned_to_current && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
                  <Warning size={16} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Cảnh báo chuyển quyền:</span> Tài khoản này hiện đang gán cho{' '}
                    <strong>{currentSelectedAcc.assigned_workspace?.name}</strong>. Khi lưu, quyền chat cá nhân ở workspace cũ sẽ tự động được chuyển sang workspace này.
                  </div>
                </div>
              )}

              {/* Chọn Ngày trong tuần */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-semibold text-gray-700">Ngày làm việc trong tuần:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkingDays([1, 2, 3, 4, 5])}
                      className="text-[10px] text-blue-600 hover:underline font-medium"
                    >
                      T2 - T6
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkingDays([1, 2, 3, 4, 5, 6, 7])}
                      className="text-[10px] text-blue-600 hover:underline font-medium"
                    >
                      Cả tuần
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {dayLabels.map((d) => {
                    const active = workingDays.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => toggleDay(d.num)}
                        className={`py-1.5 text-center rounded-lg font-medium text-[11px] transition ${
                          active
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Giờ bắt đầu và kết thúc */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Giờ bắt đầu làm việc:</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Giờ kết thúc làm việc:</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Thời gian Tạm dừng khi Người thật chat (Human Takeover) */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Thời gian tạm dừng khi Người thật chat (phút):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={takeoverMinutes}
                    onChange={(e) => setTakeoverMinutes(parseInt(e.target.value) || 30)}
                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-gray-500 text-[11px]">
                    (AI tự động im lặng 30 phút để người thật trò chuyện mà không bị AI xen vào)
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-800 flex items-start gap-2">
                <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Ngoài khung giờ trên, AI hoàn toàn im lặng 100%. Mọi tin nhắn cá nhân đều được lưu giữ lịch sử riêng biệt.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={saving || !selectedAccountId}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm disabled:opacity-50"
              >
                {saving ? 'Đang lưu cấu hình...' : 'Xác Nhận & Gán Vào Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
