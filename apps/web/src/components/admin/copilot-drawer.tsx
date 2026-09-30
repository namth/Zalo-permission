'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkle,
  X,
  PaperPlaneRight,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  CaretRight,
  ChatCircleDots,
  ShieldCheck,
  Check,
  Cpu,
  Trash,
  ArrowsOut,
  ArrowsIn,
  Minus
} from '@phosphor-icons/react';

interface CopilotMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action_preview?: {
    action_id: string;
    action_type: string;
    summary: string;
    details?: Record<string, any>;
    parameters: Record<string, any>;
    status?: 'PENDING' | 'EXECUTED' | 'CANCELLED';
    execution_result?: string;
  };
  timestamp: string;
}

const QUICK_PROMPTS = [
  'Thêm MCP Server SimpleFinance',
  'Liệt kê danh sách Workspace',
  'Xem các ToolGroup hiện có',
  'Xem 5 Audit Logs gần nhất',
];

export function CopilotDrawer() {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<CopilotMessageItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  // Dimensions & resizing
  const DEFAULT_DRAWER_WIDTH = 520;
  const MIN_DRAWER_WIDTH = 420;
  const DEFAULT_INPUT_HEIGHT = 160;
  const MIN_INPUT_HEIGHT = 80;

  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [inputHeight, setInputHeight] = useState(DEFAULT_INPUT_HEIGHT);
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const [isResizingInput, setIsResizingInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load open state and dimension preferences from localStorage
  useEffect(() => {
    try {
      const savedOpen = localStorage.getItem('omniagent_copilot_open');
      if (savedOpen === 'false') {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }

      const savedWidth = localStorage.getItem('omniagent_copilot_drawer_width');
      if (savedWidth) {
        const parsedW = parseInt(savedWidth, 10);
        if (!isNaN(parsedW)) {
          setDrawerWidth(Math.max(MIN_DRAWER_WIDTH, Math.min(window.innerWidth - 32, parsedW)));
        }
      }

      const savedInputHeight = localStorage.getItem('omniagent_copilot_input_height');
      if (savedInputHeight) {
        const parsedH = parseInt(savedInputHeight, 10);
        if (!isNaN(parsedH)) {
          setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(window.innerHeight - 200, parsedH)));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleOpen = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem('omniagent_copilot_open', open ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  // Drag Left Edge to adjust Drawer Width
  const handleStartDrawerResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDrawer(true);

    const startX = e.clientX;
    const startWidth = drawerWidth;
    let latestWidth = startWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const maxWidth = window.innerWidth - 60;
      latestWidth = Math.max(MIN_DRAWER_WIDTH, Math.min(maxWidth, startWidth + deltaX));
      setDrawerWidth(latestWidth);
    };

    const onMouseUp = () => {
      setIsResizingDrawer(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('omniagent_copilot_drawer_width', latestWidth.toString());
      } catch {}
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Drag Splitter Bar to resize Input Height (drag up -> input taller, chat shrinks)
  const handleStartInputResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingInput(true);

    const startY = e.clientY;
    const startHeight = inputHeight;
    let latestHeight = startHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const maxHeight = window.innerHeight - 200;
      latestHeight = Math.max(MIN_INPUT_HEIGHT, Math.min(maxHeight, startHeight + deltaY));
      setInputHeight(latestHeight);
    };

    const onMouseUp = () => {
      setIsResizingInput(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('omniagent_copilot_input_height', latestHeight.toString());
      } catch {}
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTouchStartInputResize = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsResizingInput(true);

    const startY = touch.clientY;
    const startHeight = inputHeight;
    let latestHeight = startHeight;

    const onTouchMove = (moveEvent: TouchEvent) => {
      const curTouch = moveEvent.touches[0];
      if (!curTouch) return;
      const deltaY = startY - curTouch.clientY;
      const maxHeight = window.innerHeight - 200;
      latestHeight = Math.max(MIN_INPUT_HEIGHT, Math.min(maxHeight, startHeight + deltaY));
      setInputHeight(latestHeight);
    };

    const onTouchEnd = () => {
      setIsResizingInput(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      try {
        localStorage.setItem('omniagent_copilot_input_height', latestHeight.toString());
      } catch {}
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleToggleInputExpand = () => {
    setInputHeight(prev => {
      const newH = prev > 220 ? DEFAULT_INPUT_HEIGHT : 320;
      try {
        localStorage.setItem('omniagent_copilot_input_height', newH.toString());
      } catch {}
      return newH;
    });
  };

  // Load chat history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('omniagent_copilot_chat');
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        // Welcome message
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: 'Xin chào Quản trị viên! Tôi là **Admin AI Copilot**.\n\nTôi có thể hỗ trợ bạn:\n- 🚀 **Thêm nhanh MCP Server** từ URL hoặc JSON cấu hình.\n- 🔐 **Phân quyền Workspace** (gán/thu hồi tool, gán nhóm công cụ).\n- 💡 **Dạy Skill mới** và liên kết với Workspace.\n- 📋 **Tra cứu chẩn đoán** & kiểm tra Audit Logs.\n\nBạn cần hỗ trợ điều gì hôm nay?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('omniagent_copilot_chat', JSON.stringify(messages));
      } catch {
        // ignore
      }
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: CopilotMessageItem = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/admin/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi kết nối với Copilot');
      }

      const assistantMsg: CopilotMessageItem = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        action_preview: data.action_preview
          ? {
              ...data.action_preview,
              status: 'PENDING',
            }
          : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: CopilotMessageItem = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Lỗi:** ${err.message || 'Không thể nhận phản hồi từ AI'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: any) => {
    try {
      setExecutingActionId(action.action_id);
      const res = await fetch('/api/admin/copilot/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: action.action_id,
          action_type: action.action_type,
          parameters: action.parameters,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Thực thi hành động thất bại');
      }

      // Cập nhật trạng thái Action Card trong message
      setMessages(prev =>
        prev.map(m => {
          if (m.id === msgId && m.action_preview) {
            return {
              ...m,
              action_preview: {
                ...m.action_preview,
                status: 'EXECUTED',
                execution_result: data.message,
              },
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(`Lỗi thực thi: ${err.message}`);
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === msgId && m.action_preview) {
          return {
            ...m,
            action_preview: {
              ...m.action_preview,
              status: 'CANCELLED',
            },
          };
        }
        return m;
      })
    );
  };

  const handleClearChat = () => {
    if (!window.confirm('Bạn có chắc muốn xóa lịch sử trò chuyện này?')) return;
    localStorage.removeItem('omniagent_copilot_chat');
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Đã làm mới phiên hội thoại. Tôi có thể hỗ trợ gì cho bạn?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 1. FLOATING TRIGGER BUTTON (RIGHT EDGE) */}
      {!isOpen && (
        <button
          onClick={() => handleToggleOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 group border border-indigo-400/30"
          title="Mở Admin AI Copilot"
        >
          <div className="relative">
            <Sparkle size={20} weight="fill" className="text-yellow-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span className="text-sm font-semibold tracking-wide">AI Copilot</span>
        </button>
      )}

      {/* 2. FULL-HEIGHT SLIDE-OVER RIGHT SIDEBAR DRAWER */}
      <div
        style={{
          width: `${drawerWidth}px`,
          maxWidth: '95vw',
        }}
        className={`fixed top-0 right-0 h-full bg-white z-40 shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out transform ${
          isResizingDrawer || isResizingInput ? 'select-none transition-none' : ''
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Left edge resize handle to adjust drawer width */}
        <div
          onMouseDown={handleStartDrawerResize}
          className="absolute top-0 left-0 bottom-0 w-2.5 z-50 cursor-ew-resize hover:bg-indigo-500/25 active:bg-indigo-500/40 transition-colors select-none"
          title="Kéo sang trái/phải để điều chỉnh độ rộng của Copilot"
        />

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-yellow-300">
              <Sparkle size={20} weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide text-white">Admin AI Copilot</h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  OpenRouter
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Trợ lý phân quyền Zalo & Telegram</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearChat}
              title="Làm mới cuộc trò chuyện"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <ArrowsClockwise size={16} weight="bold" />
            </button>
            <button
              onClick={() => handleToggleOpen(false)}
              title="Đóng Copilot"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                }`}
              >
                {/* Message Content formatted with bold and linebreaks */}
                <div className="whitespace-pre-wrap space-y-1">
                  {msg.content.split('\n').map((line, idx) => {
                    // Check if line contains bold **text**
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <p key={idx}>
                        {parts.map((part, pIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={pIdx} className="font-semibold">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </p>
                    );
                  })}
                </div>

                <span
                  className={`text-[10px] block mt-1.5 ${
                    msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-gray-400'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* ACTION PREVIEW CARD (HUMAN-IN-THE-LOOP) */}
              {msg.action_preview && (() => {
                const isDanger = msg.action_preview.action_type === 'DELETE_TOOL_GROUP' || msg.action_preview.action_type === 'DELETE_TOOL';
                return (
                  <div className={`mt-2.5 w-full max-w-[92%] bg-white rounded-xl border p-3.5 shadow-md ${
                    isDanger ? 'border-red-300 ring-1 ring-red-100' : 'border-indigo-200'
                  }`}>
                    <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${
                      isDanger ? 'border-red-100' : 'border-indigo-50'
                    }`}>
                      {isDanger ? (
                        <Trash size={18} weight="fill" className="text-red-600" />
                      ) : (
                        <ShieldCheck size={18} weight="fill" className="text-indigo-600" />
                      )}
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        isDanger ? 'text-red-900' : 'text-indigo-900'
                      }`}>
                        {isDanger ? 'Xác nhận xóa dữ liệu (Danger Action)' : 'Xác nhận hành động (Action Preview)'}
                      </span>
                    </div>

                    <p className={`text-xs font-medium mb-2 leading-relaxed ${
                      isDanger ? 'text-red-900 font-semibold' : 'text-gray-800'
                    }`}>
                      {msg.action_preview.summary}
                    </p>

                    {/* Parameter Details Table */}
                    {msg.action_preview.details && (
                      <div className={`rounded-lg p-2.5 mb-3 text-[11px] space-y-1 border font-mono ${
                        isDanger ? 'bg-red-50/60 border-red-200/80 text-red-950' : 'bg-indigo-50/50 border-indigo-100/60'
                      }`}>
                        {Object.entries(msg.action_preview.details).map(([key, val]) => (
                          <div key={key} className="flex justify-between items-start gap-2">
                            <span className="text-gray-500 font-sans">{key}:</span>
                            <span className="text-gray-900 font-semibold truncate max-w-[200px]" title={String(val)}>
                              {String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {msg.action_preview.status === 'PENDING' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleConfirmAction(msg.id, msg.action_preview)}
                          disabled={executingActionId === msg.action_preview.action_id}
                          className={`flex-1 py-1.5 px-3 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50 ${
                            isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {executingActionId === msg.action_preview.action_id ? (
                            <>
                              <ArrowsClockwise size={13} className="animate-spin" />
                              Đang thực thi...
                            </>
                          ) : isDanger ? (
                            <>
                              <Trash size={13} weight="bold" />
                              Xác nhận xóa vĩnh viễn
                            </>
                          ) : (
                            <>
                              <Check size={13} weight="bold" />
                              Xác nhận thực hiện
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelAction(msg.id)}
                          disabled={executingActionId === msg.action_preview.action_id}
                          className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : msg.action_preview.status === 'EXECUTED' ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle size={15} weight="fill" className="text-emerald-600 flex-shrink-0" />
                        <span>{msg.action_preview.execution_result || 'Đã thực thi thành công!'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
                        <X size={14} className="text-gray-400" />
                        <span>Đã hủy bỏ hành động này.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 bg-white border border-indigo-100 px-3 py-2 rounded-xl w-fit shadow-sm">
              <ArrowsClockwise size={14} className="animate-spin" />
              <span>Copilot đang suy nghĩ và tra cứu hệ thống...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-white flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100/80 transition flex-shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* RESIZABLE SPLITTER (DRAG UP / DOWN TO RESIZE INPUT HEIGHT & SHRINK CHAT) */}
        <div
          onMouseDown={handleStartInputResize}
          onTouchStart={handleTouchStartInputResize}
          onDoubleClick={handleToggleInputExpand}
          className="group relative h-4 bg-slate-100 border-t border-b border-gray-200 cursor-row-resize flex items-center justify-center hover:bg-indigo-50 active:bg-indigo-100 transition-colors select-none flex-shrink-0"
          title="Kéo lên/xuống để chỉnh độ cao ô nhập lệnh (Nhấp đúp để mở rộng/thu nhỏ)"
        >
          <div className="w-14 h-1.5 bg-gray-300 group-hover:bg-indigo-500 group-active:bg-indigo-600 rounded-full transition-all shadow-xs" />
          <span className="absolute right-3 text-[10px] text-gray-400 group-hover:text-indigo-600 font-medium transition-colors">
            {inputHeight > 220 ? 'Thu ngắn ô nhập' : 'Kéo lên để nới rộng ô nhập'}
          </span>
        </div>

        {/* RESIZABLE INPUT FOOTER */}
        <div
          style={{ height: `${inputHeight}px` }}
          className="p-3 bg-white flex flex-col flex-shrink-0 transition-[height] duration-75"
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex-1 flex flex-col gap-2 min-h-0"
          >
            <div className="relative flex-1 min-h-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi hoặc ra lệnh cho Copilot... (Shift + Enter để xuống dòng, Enter để gửi)"
                disabled={loading}
                className="w-full h-full text-xs text-gray-900 border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition bg-slate-50/50 leading-relaxed font-sans placeholder:text-gray-400"
              />
            </div>

            <div className="flex items-center justify-between pt-0.5 flex-shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>Shift + Enter để xuống dòng</span>
                <span>•</span>
                <span>Chế độ an toàn 1-Click Confirm</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleInputExpand}
                  className="px-2 py-1 text-[11px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                >
                  {inputHeight > 220 ? 'Thu ngắn ô nhập' : 'Mở rộng ô nhập'}
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-xl transition flex-shrink-0 shadow-sm"
                  title="Gửi tin nhắn"
                >
                  <span>Gửi</span>
                  <PaperPlaneRight size={14} weight="fill" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
