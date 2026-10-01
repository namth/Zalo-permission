'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkle,
  FloppyDisk,
  ArrowLeft,
  Trash,
  Plus,
  ArrowUp,
  ArrowDown,
  PaperPlaneRight,
  Spinner,
  CheckCircle,
  Gear,
  Wrench,
  ChatCircleDots,
  Lightning,
  TreeStructure,
  Question,
  NotePencil,
} from '@phosphor-icons/react';
import { SkillSopStep, SkillSopActionType } from '@omniagent/core';

interface AvailableTool {
  key: string;
  name: string;
  description: string;
}

interface SkillListItem {
  id: string;
  key?: string;
  name: string;
  description?: string;
  execution_mode?: string;
  sop_steps?: SkillSopStep[];
}

function SkillStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSkillId = searchParams.get('id');

  // Skill state
  const [skillsList, setSkillsList] = useState<SkillListItem[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>(initialSkillId || '');
  const [skillName, setSkillName] = useState('');
  const [skillKey, setSkillKey] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [triggerIntents, setTriggerIntents] = useState<string[]>([]);
  const [newIntentInput, setNewIntentInput] = useState('');
  const [requiredTools, setRequiredTools] = useState<string[]>([]);
  const [sopSteps, setSopSteps] = useState<SkillSopStep[]>([]);
  const [executionMode, setExecutionMode] = useState<'DETERMINISTIC_SOP' | 'FLEXIBLE_REACT'>('DETERMINISTIC_SOP');

  // Available tools
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);

  // Chat interview state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'Xin chào! Tôi là **OmniAgent Skill Studio Architect**.\n\nHãy cho tôi biết bạn muốn Agent học hoặc tối ưu hoá kỹ năng nào (ví dụ: *Thêm chi tiêu*, *Kiểm tra tình trạng website*, *Báo cáo doanh thu*...)?\n\nTôi sẽ phỏng vấn từng trường hợp cụ thể để cùng bạn thống nhất một quy trình chuẩn (**SOP Steps**) gồm các bước gọi công cụ, trích xuất dữ liệu, hoặc hỏi lại người dùng khi thiếu thông tin!',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load existing skills and active tools on mount
  useEffect(() => {
    loadSkills();
    loadAvailableTools();
  }, []);

  // When initialSkillId changes or selectedSkillId changes, load skill details
  useEffect(() => {
    if (selectedSkillId) {
      loadSkillDetails(selectedSkillId);
    }
  }, [selectedSkillId]);

  const loadSkills = async () => {
    try {
      const res = await fetch('/api/admin/skills');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSkillsList(data.data);
      }
    } catch (e) {
      console.error('Error loading skills:', e);
    }
  };

  const loadAvailableTools = async () => {
    try {
      const res = await fetch('/api/admin/tools?limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableTools(
          data.data.map((t: any) => ({
            key: t.key,
            name: t.name,
            description: t.description || '',
          }))
        );
      }
    } catch (e) {
      console.error('Error loading tools:', e);
    }
  };

  const loadSkillDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/skills/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const s = data.data;
        setSkillName(s.name || '');
        setSkillKey(s.key || '');
        setDescription(s.description || '');
        setSystemPrompt(s.system_prompt || '');
        setTriggerIntents(Array.isArray(s.trigger_intents) ? s.trigger_intents : []);
        setRequiredTools(Array.isArray(s.required_tools) ? s.required_tools : []);
        setSopSteps(Array.isArray(s.sop_steps) ? s.sop_steps : []);
        setExecutionMode(s.execution_mode || 'DETERMINISTIC_SOP');

        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Đã nạp thành công skill **${s.name}** (\`${s.key || 'chưa có key'}\`) với ${Array.isArray(s.sop_steps) ? s.sop_steps.length : 0} bước SOP.\n\nBạn muốn điều chỉnh, thêm bớt bước nào, hay kiểm tra lại quy trình này?`,
          },
        ]);
      }
    } catch (e) {
      console.error('Error loading skill detail:', e);
    }
  };

  const handleSelectSkill = (id: string) => {
    setSelectedSkillId(id);
    if (!id) {
      // Reset to new skill
      setSkillName('');
      setSkillKey('');
      setDescription('');
      setSystemPrompt('');
      setTriggerIntents([]);
      setRequiredTools([]);
      setSopSteps([]);
      setExecutionMode('DETERMINISTIC_SOP');
      setChatMessages([
        {
          role: 'assistant',
          content:
            'Chế độ **Tạo Skill Mới** đã sẵn sàng. Hãy mô tả kỹ năng bạn muốn Agent thực hiện!',
        },
      ]);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isSending) return;

    const userMsg = text.trim();
    setInputMessage('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsSending(true);

    try {
      const res = await fetch('/api/admin/skills/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages.slice(-8),
          currentSteps: sopSteps,
          skillId: selectedSkillId || undefined,
          skillKey: skillKey || undefined,
          skillName: skillName || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const payload = data.data;

        // Add assistant reply
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: payload.reply || 'Đã ghi nhận yêu cầu.' },
        ]);

        // Sync visual builder state if suggested
        if (payload.skill_name && !skillName) setSkillName(payload.skill_name);
        if (payload.skill_key && !skillKey) setSkillKey(payload.skill_key);
        if (payload.description) setDescription(payload.description);
        if (payload.system_prompt) setSystemPrompt(payload.system_prompt);
        if (Array.isArray(payload.trigger_intents) && payload.trigger_intents.length > 0) {
          setTriggerIntents(payload.trigger_intents);
        }
        if (Array.isArray(payload.required_tools) && payload.required_tools.length > 0) {
          setRequiredTools(payload.required_tools);
        }
        if (Array.isArray(payload.sop_steps) && payload.sop_steps.length > 0) {
          setSopSteps(payload.sop_steps);
        }
        if (payload.execution_mode) {
          setExecutionMode(payload.execution_mode);
        }
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Gặp lỗi khi xử lý: ${data.error || 'Vui lòng thử lại'}`,
          },
        ]);
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Lỗi kết nối: ${err.message || 'Không thể phản hồi lúc này.'}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveSkill = async () => {
    if (!skillName.trim()) {
      setSaveStatus({ type: 'error', message: 'Tên Skill không được để trống' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    const payload = {
      name: skillName,
      key: skillKey || skillName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      description,
      system_prompt: systemPrompt,
      trigger_intents: triggerIntents,
      required_tools: requiredTools,
      sop_steps: sopSteps,
      execution_mode: executionMode,
      is_shared: false,
    };

    try {
      let res;
      if (selectedSkillId) {
        // Update
        res = await fetch(`/api/admin/skills/${selectedSkillId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
        res = await fetch('/api/admin/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        const savedId = data.data?.id || selectedSkillId;
        setSelectedSkillId(savedId);
        setSaveStatus({
          type: 'success',
          message: selectedSkillId
            ? 'Đã cập nhật Skill và SOP thành công!'
            : 'Đã tạo và kích hoạt Skill mới thành công!',
        });
        loadSkills();
      } else {
        setSaveStatus({ type: 'error', message: data.error || 'Lỗi khi lưu skill' });
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Lỗi kết nối khi lưu' });
    } finally {
      setIsSaving(false);
    }
  };

  // SOP Step manipulation
  const handleAddStep = () => {
    const nextId = sopSteps.length > 0 ? Math.max(...sopSteps.map((s) => s.stepId || 0)) + 1 : 1;
    const newStep: SkillSopStep = {
      stepId: nextId,
      title: `Bước ${nextId}`,
      actionType: 'TOOL_CALL',
      description: 'Mô tả hành động của bước này',
    };
    setSopSteps([...sopSteps, newStep]);
  };

  const handleUpdateStep = (index: number, updated: Partial<SkillSopStep>) => {
    const next = [...sopSteps];
    next[index] = { ...next[index], ...updated };
    setSopSteps(next);
  };

  const handleDeleteStep = (index: number) => {
    const next = sopSteps.filter((_, i) => i !== index);
    // Re-index steps
    const reindexed = next.map((s, idx) => ({ ...s, stepId: idx + 1 }));
    setSopSteps(reindexed);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sopSteps.length - 1) return;

    const next = [...sopSteps];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    const reindexed = next.map((s, idx) => ({ ...s, stepId: idx + 1 }));
    setSopSteps(reindexed);
  };

  const handleAddIntent = () => {
    if (!newIntentInput.trim()) return;
    if (!triggerIntents.includes(newIntentInput.trim())) {
      setTriggerIntents([...triggerIntents, newIntentInput.trim()]);
    }
    setNewIntentInput('');
  };

  const handleRemoveIntent = (intentToRemove: string) => {
    setTriggerIntents(triggerIntents.filter((t) => t !== intentToRemove));
  };

  const getActionBadgeColor = (action: SkillSopActionType) => {
    switch (action) {
      case 'LLM_EXTRACT':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'TOOL_CALL':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CONDITIONAL_TOOL':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ASK_USER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SYNTHESIZE':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionLabel = (action: SkillSopActionType) => {
    switch (action) {
      case 'LLM_EXTRACT':
        return 'Trích xuất LLM';
      case 'TOOL_CALL':
        return 'Gọi Tool';
      case 'CONDITIONAL_TOOL':
        return 'Rẽ nhánh điều kiện';
      case 'ASK_USER':
        return 'Hỏi người dùng';
      case 'SYNTHESIZE':
        return 'Phản hồi & Tổng hợp';
      default:
        return action;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -m-6 bg-gray-50 overflow-hidden">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/skills"
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            title="Quay lại danh sách Skills"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                <Sparkle className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                Skill Studio & SOP Trainer
              </span>
              <span className="text-xs text-gray-400">|</span>
              <select
                value={selectedSkillId}
                onChange={(e) => handleSelectSkill(e.target.value)}
                className="text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border-none rounded px-2.5 py-1 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">(Tạo Skill Mới)</option>
                {skillsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    Chỉnh sửa: {s.name} ({s.key || 'no-key'})
                  </option>
                ))}
              </select>
            </div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center mt-0.5">
              {skillName || 'Skill Chưa Đặt Tên'}
              {skillKey && (
                <span className="ml-2 text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {skillKey}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {saveStatus && (
            <span
              className={`text-xs px-2.5 py-1 rounded-md flex items-center font-medium ${
                saveStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {saveStatus.type === 'success' && <CheckCircle className="w-3.5 h-3.5 mr-1" />}
              {saveStatus.message}
            </span>
          )}

          <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setExecutionMode('DETERMINISTIC_SOP')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                executionMode === 'DETERMINISTIC_SOP'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Deterministic SOP
            </button>
            <button
              type="button"
              onClick={() => setExecutionMode('FLEXIBLE_REACT')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                executionMode === 'FLEXIBLE_REACT'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ReAct Linh hoạt
            </button>
          </div>

          <button
            onClick={handleSaveSkill}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
          >
            {isSaving ? (
              <Spinner className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <FloppyDisk className="w-4 h-4 mr-1.5" />
            )}
            Lưu Skill
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Interactive Interview Chat with Agent */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChatCircleDots className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-bold text-gray-800">
                Phỏng vấn & Huấn luyện SOP với AI
              </span>
            </div>
            <span className="text-xs text-gray-500">
              Đối thoại làm rõ yêu cầu trước khi chốt quy trình
            </span>
          </div>

          {/* Chat Messages Transcript */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3.5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center space-x-1.5 mb-1.5 pb-1 border-b border-gray-100 text-xs font-semibold text-indigo-600">
                      <Sparkle className="w-3.5 h-3.5" />
                      <span>SOP Architect</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 text-sm text-gray-500 flex items-center space-x-2 shadow-sm">
                  <Spinner className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Agent đang phân tích và thiết kế SOP...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-gray-400 font-medium whitespace-nowrap">Gợi ý:</span>
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Hãy kiểm tra lại quy trình và thêm bước hỏi lại người dùng nếu thiếu tham số bắt buộc.'
                )
              }
              className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-full text-gray-700 whitespace-nowrap transition"
            >
              Hỏi lại nếu thiếu tham số
            </button>
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Sau khi gọi tool ghi nhận thành công, hãy tổng hợp phản hồi rõ ràng chi tiết cho người dùng.'
                )
              }
              className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-full text-gray-700 whitespace-nowrap transition"
            >
              Thêm bước phản hồi tổng hợp
            </button>
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Quy trình này đã hoàn chỉnh, hãy xác nhận danh sách SOP steps chuẩn để lưu.'
                )
              }
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full text-indigo-700 font-medium whitespace-nowrap transition"
            >
              Chốt quy trình chuẩn
            </button>
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Nhập yêu cầu hoặc chỉnh sửa quy trình (Nhấn Enter để gửi)..."
                rows={2}
                className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-40 flex items-center justify-center font-medium"
              >
                <PaperPlaneRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Pane: Visual SOP Step Builder */}
        <div className="w-1/2 flex flex-col bg-gray-50/70 overflow-y-auto p-6 space-y-6">
          {/* Metadata Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center">
              <Gear className="w-4 h-4 mr-1.5 text-blue-600" />
              Thông Tin Kỹ Năng (Skill Metadata)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tên kỹ năng
                </label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="Ví dụ: Thêm Chi Tiêu"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mã định danh (Key)
                </label>
                <input
                  type="text"
                  value={skillKey}
                  onChange={(e) => setSkillKey(e.target.value)}
                  placeholder="them_chi_tieu"
                  className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mô tả nghiệp vụ
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục đích và phạm vi sử dụng của kỹ năng này"
                rows={2}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Trigger Intents Chips */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mẫu câu lệnh kích hoạt (Trigger Intents)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {triggerIntents.map((intent, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {intent}
                    <button
                      type="button"
                      onClick={() => handleRemoveIntent(intent)}
                      className="ml-1 text-blue-500 hover:text-blue-800"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newIntentInput}
                  onChange={(e) => setNewIntentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIntent();
                    }
                  }}
                  placeholder="Nhập câu mẫu (ví dụ: ghi sổ chi tiêu) rồi nhấn Enter..."
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddIntent}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
                >
                  Thêm mẫu
                </button>
              </div>
            </div>
          </div>

          {/* SOP Steps List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center">
                  <TreeStructure className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Quy Trình Thi Hành Chuẩn (SOP Steps)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Agent sẽ thực hiện tuần tự từ bước 1 đến bước cuối cùng mà không suy luận bịa đặt.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Thêm bước SOP
              </button>
            </div>

            {sopSteps.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                <Lightning className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium">Chưa có bước SOP nào được thiết kế</p>
                <p className="text-xs text-gray-400 mt-1">
                  Hãy chat với AI ở khung bên trái hoặc nhấn &quot;Thêm bước SOP&quot; để thiết lập thủ công.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sopSteps.map((step, idx) => (
                  <div
                    key={step.stepId || idx}
                    className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-blue-300 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <select
                          value={step.actionType}
                          onChange={(e) =>
                            handleUpdateStep(idx, {
                              actionType: e.target.value as SkillSopActionType,
                            })
                          }
                          className={`text-xs font-semibold px-2 py-1 rounded border ${getActionBadgeColor(
                            step.actionType
                          )} outline-none cursor-pointer`}
                        >
                          <option value="LLM_EXTRACT">Trích xuất LLM (LLM_EXTRACT)</option>
                          <option value="TOOL_CALL">Gọi công cụ (TOOL_CALL)</option>
                          <option value="CONDITIONAL_TOOL">Rẽ nhánh (CONDITIONAL_TOOL)</option>
                          <option value="ASK_USER">Hỏi người dùng (ASK_USER)</option>
                          <option value="SYNTHESIZE">Phản hồi (SYNTHESIZE)</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleMoveStep(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(idx, 'down')}
                          disabled={idx === sopSteps.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStep(idx)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Xóa bước này"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Step Title & Description */}
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                        placeholder="Tiêu đề bước (ví dụ: Gọi tool ghi nhận chi tiêu)"
                        className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => handleUpdateStep(idx, { description: e.target.value })}
                        placeholder="Mô tả chi tiết hành động hoặc hướng dẫn trích xuất"
                        className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Tool selection for TOOL_CALL & CONDITIONAL_TOOL */}
                    {(step.actionType === 'TOOL_CALL' || step.actionType === 'CONDITIONAL_TOOL') && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                            Công cụ (Tool)
                          </label>
                          <select
                            value={step.toolKey || ''}
                            onChange={(e) =>
                              handleUpdateStep(idx, { toolKey: e.target.value || undefined })
                            }
                            className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white font-mono"
                          >
                            <option value="">-- Chọn Tool liên kết --</option>
                            {availableTools.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.name} ({t.key})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                            Điều kiện thực thi (nếu có)
                          </label>
                          <input
                            type="text"
                            value={step.condition || ''}
                            onChange={(e) =>
                              handleUpdateStep(idx, { condition: e.target.value || undefined })
                            }
                            placeholder="Ví dụ: !amount hoặc is_admin"
                            className="w-full px-2.5 py-1 text-xs font-mono border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SkillStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500 text-sm">
          Đang nạp dữ liệu Skill Studio...
        </div>
      }
    >
      <SkillStudioContent />
    </Suspense>
  );
}
