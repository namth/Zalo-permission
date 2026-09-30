'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChatCircleDots,
  Queue,
  TreeStructure,
  Cpu,
  Wrench,
  PaperPlaneTilt,
  ClockCounterClockwise,
  CheckCircle,
  ArrowRight,
  ArrowsClockwise,
  Sparkle,
  ShieldCheck,
  Database,
  Lightning,
  Play,
  Info,
  CaretRight,
  Code,
  Check,
} from '@phosphor-icons/react';

interface WorkflowStats {
  channels: any[];
  workspaces: any[];
  metrics: {
    totalToolGroups: number;
    totalTools: number;
    activeChannels: number;
    totalWorkspaces: number;
  };
  agent: {
    name: string;
    company: string;
    routerModel: string;
    workerModel: string;
    synthesizerModel?: string;
    inboundStream: string;
    outboundStream: string;
    personaSummary: string;
  };
  recentLogs: any[];
}

export default function WorkflowPage() {
  const [data, setData] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string>('agent-worker');
  const [activeTab, setActiveTab] = useState<'diagram' | 'simulator' | 'traces'>('diagram');

  // Simulator state
  const [simPrompt, setSimPrompt] = useState('Chi ơi, kiểm tra số dư quỹ tháng này giúp anh với');
  const [simSender, setSimSender] = useState('Nam Trần');
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/workflow/stats');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error('Failed to load workflow stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runSimulation = async () => {
    setSimulating(true);
    setSimStep(1);
    setSimLogs(['[Bước 1] Kênh Zalo/Telegram nhận tin nhắn: "' + simPrompt + '"']);

    await new Promise((r) => setTimeout(r, 500));
    setSimStep(2);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 2 - BỘ LỌC TRẠNG THÁI COLD/WARM] Quét Mention (@Thảo Chi / "Chi ơi...") -> Xác định trạng thái WARM (Session TTL: 10 phút trên Redis).`,
      `[Bước 2] Đẩy gói tin đã chuẩn hoá vào Redis Stream "${data?.agent.inboundStream || 'stream:inbound_messages'}"`,
    ]);

    await new Promise((r) => setTimeout(r, 600));
    setSimStep(3);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 3] Neo4j Graph Query: Match (ZaloGroup {thread_id}) -> Tìm thấy Workspace "INOVA Technology Workspace".`,
      `[Bước 3] Nếu có ảnh đính kèm: Kích hoạt Vision Agent (Gemini 2.0 Flash) OCR trích xuất số tiền & danh mục bill.`,
      `[Bước 3] Phân quyền 2 tầng: Nạp 20 tools thuộc nhóm "SimpleFinance MCP Service", biến môi trường đã giải mã an toàn.`,
    ]);

    await new Promise((r) => setTimeout(r, 600));
    setSimStep(4);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 4 - AI 1: ROUTER] Router Agent (${data?.agent.routerModel || 'gemini-2.0-flash'}): Phân loại intent = "simplefinance_transaction_create" (~180ms), xác nhận tin nhắn hướng đến bot (is_addressed_to_agent: true), phát hiện cần gọi tool (requires_tools: true).`,
      `[Bước 4.1 - ⚡ PRE-TOOL INSTANT ACK] DeepSeek-V3 sinh câu phản hồi chớp nhoáng: "Dạ anh ${simSender} chờ em một chút em lưu sổ chi tiêu ngay nhé ạ! ✨" -> Gửi ngay tin nhắn đầu tiên về nhóm Zalo!`,
    ]);

    await new Promise((r) => setTimeout(r, 700));
    setSimStep(5);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 5 - AI 2: TOOL WORKER] Tool Worker Agent (${data?.agent.workerModel || 'google/gemini-2.5-flash'}): Lập kế hoạch ReAct, phát hiện thiếu ID thành viên -> Chủ động sinh lệnh gọi Function Calling: member_list, group_list.`,
    ]);

    await new Promise((r) => setTimeout(r, 700));
    setSimStep(6);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 6 - HỆ THỐNG: EXECUTION ENGINE] HTTP REST / Native MCP Server: Thực thi tools/call đến MCP Server -> Trả về kết quả: Nam (ID: 1), Trung (ID: 2). Tool Worker tiếp tục gọi transaction_create(payer: 1, amount: 60k).`,
    ]);

    await new Promise((r) => setTimeout(r, 700));
    setSimStep(7);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 7 - AI 3: PERSONA SYNTHESIZER] Persona Synthesizer Agent (${data?.agent.synthesizerModel || 'deepseek/deepseek-chat'}): Đọc dữ liệu thô từ Step 6 + Persona Thảo Chi INOVA -> Thổi hồn cảm xúc tiếng Việt, xưng "em", gọi "anh ${simSender}", tính nợ chia đôi 30k.`,
    ]);

    await new Promise((r) => setTimeout(r, 500));
    setSimStep(8);
    setSimLogs((prev) => [
      ...prev,
      `[Bước 8 - GIAO VẬN & AUDIT] Đẩy câu trả lời ra Redis Stream "${data?.agent.outboundStream || 'stream:outbound_messages'}" -> ZaloAdapter gửi tin nhắn kết quả về nhóm Zalo!`,
      `[Bước 8] Ghi nhật ký Audit Log vào PostgreSQL (Tổng thời gian xử lý: ~720ms, Trạng thái: SUCCESS).`,
      `✨ Thảo Chi phản hồi kết quả: "Dạ xong rồi anh ${simSender} ơi! Em đã ghi nhận khoản trà 60k cho 2 anh rồi nhé, hiện anh Trung đang nợ anh 30k ạ! 😊"`,
    ]);

    setSimulating(false);
  };

  const nodeDetails: Record<string, { title: string; subtitle: string; tag: string; tech: string; desc: string; inputs: string[]; outputs: string[]; codeRef: string }> = {
    'inbound': {
      title: '1. Kênh Nhắn Tin (Inbound Channels & Quote/Media Extraction)',
      subtitle: 'Tiếp nhận sự kiện & bóc tách câu nói cũ được Tag cùng Hình ảnh',
      tag: 'Hạ Tầng Kênh',
      tech: 'zca-js (Zalo QR Session / OA Secret) & grammy (Telegram Bot API)',
      desc: 'Lắng nghe các tin nhắn từ nhóm chat hoặc chat cá nhân. Tự động bóc tách tin nhắn được tag/trích dẫn (data.quote / reply_to_message) và trích xuất URL hình ảnh hóa đơn/bill chuyển khoản. Đóng gói đầy đủ vào InboundChatMessage.',
      inputs: ['Sự kiện WebSocket từ Zalo Web API', 'Webhook / Long-polling từ Telegram Bot API'],
      outputs: ['InboundChatMessage { platform, platformChatId, senderName, text, isGroup, quotedMessage, mediaUrls }'],
      codeRef: 'packages/channels/src/zalo/index.ts & telegram/index.ts',
    },
    'queue': {
      title: '2. Bộ Lọc Trạng Thái COLD / WARM & Hàng Đợi (Redis Session State)',
      subtitle: 'Quản lý phiên hội thoại nhóm 10 phút, tránh chen ngang làm loãng việc',
      tag: 'Phiên Hội Thoại & Hàng Đợi',
      tech: 'Redis Session Key (TTL: 600s) & Redis Streams (stream:inbound_messages)',
      desc: 'Kiểm tra cấu hình và trạng thái COLD/WARM của nhóm chat. Nếu nhóm BẬT "Luôn trả lời" -> Luôn xử lý mọi tin nhắn/câu hỏi. Nếu TẮT (mặc định) và nhóm đang ở trạng thái COLD mà không có mention (@Thảo Chi, "Chi ơi...") -> Bỏ qua lập tức để không làm loãng việc, không tốn AI token ($0) và không ghi rác vào audit log. Khi có mention -> Kích hoạt phiên WARM trong 10 phút.',
      inputs: ['InboundChatMessage từ Channel Gateway'],
      outputs: ['Redis Stream Message ID & Consumer ACK sau khi hoàn tất'],
      codeRef: 'apps/agent-worker/src/session.ts & channel-manager.ts',
    },
    'memory': {
      title: '3. Bộ Nhớ Đồ Thị & Vision Agent (Neo4j & Gemini Vision)',
      subtitle: 'Phân giải không gian làm việc & OCR bóc tách hình ảnh bill/hóa đơn',
      tag: 'Đồ Thị & Vision OCR',
      tech: 'Neo4j Cypher Graph & Google Gemini 2.0 Flash Vision',
      desc: 'Từ ID nhóm chat, xác định Workspace tương ứng trên đồ thị Neo4j. Nếu tin nhắn có đính kèm hình ảnh (bill, hóa đơn, chuyển khoản), Vision Agent kích hoạt Gemini 2.0 Flash OCR để trích xuất số tiền, ngày giờ và danh mục chi tiêu thành văn bản có cấu trúc.',
      inputs: ['platformChatId, platform, workspaceId, mediaUrls[]'],
      outputs: ['accessibleSkills[], accessibleTools[], visualSummary, scopedVariablesMap'],
      codeRef: 'packages/core/src/agents/vision-agent.ts & apps/agent-worker/src/dispatcher.ts',
    },
    'router-agent': {
      title: '4. [AI Agent 1] Router Agent & Pre-Tool Instant Ack',
      subtitle: 'Định tuyến ý định & Bắn tin nhắn phản hồi chớp nhoáng qua DeepSeek',
      tag: 'AI Agent #1 (Classifier & Pre-Ack)',
      tech: 'Google Gemini 2.5 Flash & DeepSeek-V3 (~$0.0001 / request | ~180ms)',
      desc: 'Phân loại nhanh ý định, kiểm tra xem tin nhắn có hướng đến bot không (is_addressed_to_agent). Nếu phát hiện cần gọi tool nặng, hệ thống lập tức kích hoạt DeepSeek sinh 1 câu phản hồi ngắn ("Dạ anh chờ em chút em lưu sổ ngay nhé ạ ✨") gửi trước về Zalo để người dùng an tâm.',
      inputs: ['userPrompt, recentHistory (3-5 tin), visualSummary, quotedMessage, accessibleSkills/Tools'],
      outputs: ['RouterDecision { intent, requiresTools, isAddressedToAgent } + Pre-Ack Outbound Sent'],
      codeRef: 'packages/core/src/agents/router-agent.ts & worker-agent.ts (generatePreAck)',
    },
    'tool-worker': {
      title: '5. [AI Agent 2] Action / Tool Worker Agent (Lập Kế Hoạch & Gọi Hàm)',
      subtitle: 'Vòng lặp ReAct, tự động suy luận tham số & phát sinh Function Calling',
      tag: 'AI Agent #2 (Function Caller)',
      tech: 'Google Gemini 2.5 Flash (google/gemini-2.5-flash | ~$0.0001 / request | Suy luận & Phân tích số học chính xác)',
      desc: 'Agent thứ hai trong quy trình. Chuyên trách về logic kỹ thuật, quy đổi đơn vị tiền tệ chuẩn xác (30k -> 30000) và tính toán công nợ chia đều không nhầm lẫn. Nạp 6 - 10 tin nhắn lịch sử gần nhất vào mảng messages để hiểu toàn bộ ngữ cảnh, tự động tra cứu ID nếu thiếu và phát sinh các lệnh gọi công cụ có cấu trúc chuẩn.',
      inputs: ['userPrompt, recentHistory (6-10 tin), senderName context, matchedSkill SOP, filteredTools, scopedVariables'],
      outputs: ['toolCalls[] (Danh sách lệnh gọi hàm có tham số JSON)'],
      codeRef: 'packages/core/src/agents/worker-agent.ts',
    },
    'tool-engine': {
      title: '6. [Hệ Thống] Tầng Thực Thi Công Cụ (Execution Engine)',
      subtitle: 'Thực thi mã máy gọi REST API & Model Context Protocol (MCP)',
      tag: 'Execution Engine (Non-AI)',
      tech: 'Axios HTTP REST & JSON-RPC Model Context Protocol (MCP Client)',
      desc: 'Không phải AI suy đoán mà là engine phần mềm thực thi thực tế. Nhận lệnh từ Agent 2, tiêm biến môi trường bảo mật đã giải mã (Bearer token, API key), gọi đến máy chủ API ngoài hoặc MCP Server nội bộ (https://financemcp.oa.io.vn/mcp.php), trả về kết quả dữ liệu thô (raw JSON).',
      inputs: ['ToolKey, InputArguments, TargetUrl, ScopedHeaders'],
      outputs: ['ToolExecutionResult { toolKey, statusCode, responseBody, latencyMs }'],
      codeRef: 'packages/core/src/tools/executor.ts & mcp-executor.ts',
    },
    'persona-synthesizer': {
      title: '7. [AI Agent 3] Persona Synthesizer Agent (Biên Soạn & Cảm Xúc)',
      subtitle: 'Thổi hồn cảm xúc tiếng Việt & Persona Trợ Lý Thảo Chi INOVA',
      tag: 'AI Agent #3 (Communicator)',
      tech: 'DeepSeek-V3 (deepseek/deepseek-chat | ~$0.0003 / request | Tiếng Việt cảm xúc)',
      desc: 'Agent thứ ba trong quy trình. Nhận dữ liệu kết quả thô từ Step 6 kết hợp với Persona Thảo Chi INOVA và 3 - 5 tin nhắn lịch sử gần nhất để biên soạn câu trả lời hoàn chỉnh: luôn tự xưng "em", gọi "anh/chị" theo tên thật, tránh lặp lại lời chào, giải thích số liệu rành mạch, tính toán công nợ rõ ràng và diễn đạt ấm áp.',
      inputs: ['userPrompt, recentHistory (3-5 tin), senderName, rawToolResults[], rawDraft, DEFAULT_AGENT_PERSONA'],
      outputs: ['finalResponse (Câu trả lời tiếng Việt hoàn chỉnh, lịch sự, chuẩn mực)'],
      codeRef: 'packages/core/src/agents/worker-agent.ts (synthesizeWithPersona)',
    },
    'outbound': {
      title: '8. Giao Vận & Kiểm Toán (Outbound Sender & Audit Trail)',
      subtitle: 'Gửi kết quả về nhóm Zalo/Telegram & lưu trữ Audit Log',
      tag: 'Giao Vận & Kiểm Toán',
      tech: 'Redis Stream (stream:outbound_messages) & PostgreSQL audit_logs',
      desc: 'Câu trả lời cuối cùng được đẩy vào stream:outbound_messages. Tiến trình Outbound Sender sử dụng đúng tài khoản kênh (Zalo/Telegram) để gửi lại vào nhóm chat. Đồng thời một bản ghi Audit Log được tạo với đầy đủ kế hoạch thực thi, latency và công cụ đã gọi.',
      inputs: ['finalResponse, platformChatId, accountId, toolCalls, latencyMs'],
      outputs: ['Tin nhắn Zalo/Telegram đến người dùng + Bản ghi Audit Log'],
      codeRef: 'apps/agent-worker/src/channel-manager.ts & dispatcher.ts',
    },
  };

  const selected = nodeDetails[selectedNode] || nodeDetails['tool-worker'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <TreeStructure size={24} weight="duotone" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sơ Đồ Luồng Hoạt Động (WorkFlow)</h1>
              <p className="text-sm text-gray-500">
                Kiến trúc xử lý tin nhắn đa kênh từ Chat Nhóm ➜ Bộ Nhớ ➜ AI Agent Thảo Chi ➜ Phản Hồi
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Zalo: Online
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Telegram: Active
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Agent: Thảo Chi (INOVA)
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Sparkle size={14} className="text-amber-600" weight="fill" />
            3 AI Agents: Router + Tool Worker + Synthesizer
          </span>
          <button
            onClick={fetchStats}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            title="Làm mới trạng thái"
          >
            <ArrowsClockwise size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab('diagram')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'diagram'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <TreeStructure size={18} />
          Sơ Đồ Tương Tác End-to-End
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'simulator'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Play size={18} />
          Chạy Thử Nghiệm Mô Phỏng Luồng
        </button>
        <button
          onClick={() => setActiveTab('traces')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'traces'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ClockCounterClockwise size={18} />
          Tin Nhắn Vừa Xử Lý ({data?.recentLogs?.length || 0})
        </button>
      </div>

      {/* TAB 1: INTERACTIVE WORKFLOW DIAGRAM */}
      {activeTab === 'diagram' && (
        <div className="space-y-6">
          {/* Visual Interactive Pipeline Canvas */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-stretch justify-between gap-4 overflow-x-auto pb-4 pt-2">
              
              {/* NODE 1: Inbound Channels */}
              <div
                onClick={() => setSelectedNode('inbound')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'inbound'
                    ? 'bg-blue-950/80 border-blue-400 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    <ChatCircleDots size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    Step 1
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">Kênh Nhắn Tin</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">Bóc tách Tag Quote & Hình ảnh Bill</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-blue-300">
                  <span>{data?.metrics?.activeChannels || 2} Kênh Active</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 2: Queue & Ingestion */}
              <div
                onClick={() => setSelectedNode('queue')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'queue'
                    ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                    <Queue size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    Step 2
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">Lọc Cold/Warm & Queue</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">Session 10m & Stream đệm phi đồng bộ</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-amber-300">
                  <span>TTL: 600s</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 3: Memory & RBAC Graph */}
              <div
                onClick={() => setSelectedNode('memory')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'memory'
                    ? 'bg-purple-950/80 border-purple-400 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                    <Database size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    Step 3
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">Bộ Nhớ & Vision OCR</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">Neo4j Đồ Thị & Gemini Vision Đọc Bill</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-purple-300">
                  <span>{data?.metrics?.totalWorkspaces || 1} Workspaces</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 4: [AI AGENT 1] Router Agent */}
              <div
                onClick={() => setSelectedNode('router-agent')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'router-agent'
                    ? 'bg-cyan-950/90 border-cyan-400 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Lightning size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    Step 4 (AI #1)
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-cyan-200">Router & Pre-Ack</h3>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">Định tuyến & Bắn tin chờ DeepSeek</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-cyan-300">
                  <span className="font-medium">{data?.agent?.routerModel || 'Gemini 2.0 Flash'}</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 5: [AI AGENT 2] Tool Worker Agent */}
              <div
                onClick={() => setSelectedNode('tool-worker')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'tool-worker'
                    ? 'bg-indigo-950/90 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Cpu size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    Step 5 (AI #2)
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-indigo-200">Tool Worker Agent</h3>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">ReAct Loop & Function Calling (JSON)</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-indigo-300">
                  <span className="font-medium">{data?.agent?.workerModel || 'GPT-4o Mini'}</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 6: [HỆ THỐNG] Execution Engine */}
              <div
                onClick={() => setSelectedNode('tool-engine')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'tool-engine'
                    ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Wrench size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    Step 6 (Engine)
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">Thực Thi Tools (REST/MCP)</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">Gọi máy chủ API & trả Raw JSON</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-emerald-300">
                  <span>{data?.metrics?.totalTools || 20} Tools</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 7: [AI AGENT 3] Persona Synthesizer */}
              <div
                onClick={() => setSelectedNode('persona-synthesizer')}
                className={`cursor-pointer min-w-[210px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'persona-synthesizer'
                    ? 'bg-rose-950/90 border-rose-400 ring-2 ring-rose-500/50 shadow-lg shadow-rose-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                    <Sparkle size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    Step 7 (AI #3)
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-rose-200">Persona Synthesizer</h3>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">Thổi hồn cảm xúc tiếng Việt Thảo Chi</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-rose-300">
                  <span className="font-medium">{data?.agent?.synthesizerModel || 'DeepSeek-V3'}</span>
                  <CaretRight size={12} />
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden lg:flex items-center justify-center text-slate-600">
                <ArrowRight size={20} className="animate-pulse text-indigo-400" />
              </div>

              {/* NODE 8: Outbound Delivery & Audit */}
              <div
                onClick={() => setSelectedNode('outbound')}
                className={`cursor-pointer min-w-[200px] flex-1 rounded-xl p-4 border transition-all ${
                  selectedNode === 'outbound'
                    ? 'bg-slate-900 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-slate-700 text-slate-300">
                    <PaperPlaneTilt size={22} weight="duotone" />
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600">
                    Step 8
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">Giao Vận & Audit Log</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">Gửi về Zalo & lưu PostgreSQL</p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-indigo-300">
                  <span>Audit Tracing</span>
                  <CaretRight size={12} />
                </div>
              </div>

            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Info size={14} className="text-indigo-400" />
                Bấm vào từng khối bên trên để xem thông số kỹ thuật và luồng dữ liệu tương ứng.
              </span>
              <span className="font-mono text-slate-500">OmniAgent Event-Driven Core Architecture</span>
            </div>
          </div>

          {/* Node Detail Inspector Box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 mb-1">
                  {selected.tag}
                </span>
                <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
                <p className="text-sm text-gray-600 mt-0.5">{selected.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg border border-gray-200">
                  📁 {selected.codeRef}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Left Column: Description & Tech */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mô Tả Luồng Xử Lý</h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {selected.desc}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 bg-white">
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CaretRight size={14} className="text-indigo-600" />
                      Dữ Liệu Đầu Vào (Inputs)
                    </h5>
                    <ul className="space-y-1.5 text-xs text-gray-700">
                      {selected.inputs.map((inp, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-500 font-bold">•</span>
                          <span>{inp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-white">
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-600" />
                      Dữ Liệu Đầu Ra (Outputs)
                    </h5>
                    <ul className="space-y-1.5 text-xs text-gray-700">
                      {selected.outputs.map((out, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{out}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Right Column: Persona & Technical Metadata */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
                  <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkle size={16} className="text-indigo-600" />
                    Cấu Hình Persona Thảo Chi INOVA
                  </h4>
                  <div className="space-y-2 text-xs text-indigo-950">
                    <p><strong>Tên trợ lý:</strong> Thảo Chi (Công Ty Công Nghệ INOVA)</p>
                    <p><strong>Xưng hô:</strong> Em - Gọi người dùng Anh/Chị theo tên thật</p>
                    <p><strong>Phong cách:</strong> Tự nhiên, ngắn gọn, lịch sự, chuẩn mực văn phong người Việt.</p>
                    <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">🟣 Router LLM:</span>
                        <div className="text-right">
                          <code className="bg-cyan-100 text-cyan-900 px-1 py-0.5 rounded text-[11px]">{data?.agent.routerModel || 'google/gemini-2.5-flash'}</code>
                          <span className="text-gray-500 text-[10px] ml-1">(~$0.0001)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">🔵 Worker LLM:</span>
                        <div className="text-right">
                          <code className="bg-indigo-100 text-indigo-900 px-1 py-0.5 rounded text-[11px]">{data?.agent.workerModel || 'google/gemini-2.5-flash'}</code>
                          <span className="text-gray-500 text-[10px] ml-1">(~$0.0001)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">🟢 Synthesizer LLM:</span>
                        <div className="text-right">
                          <code className="bg-rose-100 text-rose-900 px-1 py-0.5 rounded text-[11px]">{data?.agent.synthesizerModel || 'deepseek/deepseek-chat'}</code>
                          <span className="text-gray-500 text-[10px] ml-1">(~$0.0003)</span>
                        </div>
                      </div>
                      <div className="pt-1.5 flex items-center justify-between font-semibold text-emerald-700 border-t border-indigo-100/60">
                        <span>Tổng chi phí 3 Agent:</span>
                        <span>~$0.0005 / req (~12 - 15 VNĐ)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Bảo Mật & Phân Quyền 2 Tầng
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Hệ thống kiểm soát 2 tầng (2-Tier RBAC) thông qua Neo4j Graph. Chỉ những Tool được cấp phép tường minh cho Workspace mới được Agent nạp vào prompt. Mọi API Key đều được mã hoá AES-256.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Conversation History Context Window Architecture Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-purple-50 text-purple-700">
                    Context Window & Multi-turn Memory
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Auto Injected from PostgreSQL audit_logs
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-2 flex items-center gap-2">
                  <ClockCounterClockwise size={22} className="text-purple-600" />
                  Chiến Lược Nạp Lịch Sử Hội Thoại (Conversation History Context Window)
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Quy định chính xác Agent nào được nạp lịch sử, số lượng tin nhắn (turns) được nạp vào context, và vai trò thực thi trong toàn bộ pipeline.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-purple-50/70 border border-purple-100 rounded-xl px-4 py-2.5">
                <Database size={24} className="text-purple-600 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-purple-900">Bảng Nguồn: audit_logs</div>
                  <div className="text-purple-700 font-mono text-[11px]">ORDER BY created_at DESC LIMIT 10</div>
                </div>
              </div>
            </div>

            {/* Grid of 3 Agents History Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Router Agent */}
              <div className="rounded-xl border border-cyan-200 bg-gradient-to-b from-cyan-50/60 to-white p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
                      AI Agent #1: Router
                    </span>
                    <span className="text-xs font-semibold text-cyan-700 font-mono">
                      ~$0.0001 / req
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mt-2.5">Google Gemini 2.5 Flash</h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-100/80 text-cyan-900 font-semibold text-xs">
                    <span>⚡ Số lượng nạp:</span>
                    <span className="underline decoration-cyan-500 font-bold">3 - 5 tin nhắn gần nhất</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mt-3">
                    <strong>Mục đích:</strong> Xử lý các câu hỏi phụ thuộc đại từ thay thế (anaphora) hoặc câu trả lời tiếp nối, ví dụ: <em>"ừ ghi lại đi"</em>, <em>"bao nhiêu thế em"</em>, <em>"hủy giao dịch vừa rồi nhé"</em>.
                  </p>
                </div>
                <div className="pt-3 border-t border-cyan-100 text-[11px] text-gray-500 space-y-1">
                  <div><strong>Vị trí tiêm:</strong> <code>&lt;recent_conversation_history&gt;</code> trong User Content</div>
                  <div><strong>Chi phí Token:</strong> Siêu nhẹ (~150 tokens), bảo toàn độ trễ cực thấp (~180ms).</div>
                </div>
              </div>

              {/* Card 2: Tool Worker Agent */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                      AI Agent #2: Tool Worker
                    </span>
                    <span className="text-xs font-semibold text-indigo-700 font-mono">
                      ~$0.0001 / req
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mt-2.5">Google Gemini 2.5 Flash</h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-100/80 text-indigo-900 font-semibold text-xs">
                    <span>⚡ Số lượng nạp:</span>
                    <span className="underline decoration-indigo-500 font-bold">6 - 10 tin nhắn gần nhất</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mt-3">
                    <strong>Mục đích:</strong> Nạp đầy đủ ngữ cảnh nghiệp vụ để ReAct suy luận tham số Function Calling (VD: quy đổi số tiền 30k &rarr; 30000, tính công nợ chia đều không nhầm lẫn) mà không cần hỏi lại người dùng.
                  </p>
                </div>
                <div className="pt-3 border-t border-indigo-100 text-[11px] text-gray-500 space-y-1">
                  <div><strong>Vị trí tiêm:</strong> Mảng <code>messages[]</code> (lượt role user & assistant chuẩn)</div>
                  <div><strong>Chi phí Token:</strong> Tiết kiệm (~500 tokens), chuẩn Schema JSON và tính toán chính xác.</div>
                </div>
              </div>

              {/* Card 3: Persona Synthesizer Agent */}
              <div className="rounded-xl border border-rose-200 bg-gradient-to-b from-rose-50/60 to-white p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-rose-100 text-rose-800 border border-rose-300">
                      AI Agent #3: Synthesizer
                    </span>
                    <span className="text-xs font-semibold text-rose-700 font-mono">
                      ~$0.0003 / req
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mt-2.5">DeepSeek-V3 (deepseek-chat)</h3>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-100/80 text-rose-900 font-semibold text-xs">
                    <span>⚡ Số lượng nạp:</span>
                    <span className="underline decoration-rose-500 font-bold">3 - 5 tin nhắn gần nhất</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mt-3">
                    <strong>Mục đích:</strong> Giữ mạch xưng hô liền mạch, tránh lặp lại lời chào hỏi máy móc ("Dạ em chào anh Nam..."), bắt đúng cảm xúc người dùng (vội vã, than thở hay hài hước) để phản hồi ấm áp, tự nhiên.
                  </p>
                </div>
                <div className="pt-3 border-t border-rose-100 text-[11px] text-gray-500 space-y-1">
                  <div><strong>Vị trí tiêm:</strong> Khối <code>Lịch sử các câu thoại gần nhất</code> trong User Content</div>
                  <div><strong>Chi phí Token:</strong> Tiết kiệm (~300 tokens), tối ưu hoá chất lượng cảm xúc.</div>
                </div>
              </div>

            </div>

            {/* Data Pipeline Technical Details Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="font-semibold text-slate-900">Quy trình nạp lịch sử tự động:</span>
                <span>PostgreSQL `audit_logs` ➜ Filter theo `workspace_id` & `chat_id` ➜ Reverse chronological order ➜ Inject vào 3 AI Agents</span>
              </div>
              <div className="font-mono text-emerald-700 font-semibold bg-emerald-100/60 px-2.5 py-1 rounded-md border border-emerald-200 text-[11px]">
                Tổng chi phí cả 3 Agent: ~$0.0008 / tin nhắn (~20 - 25 VNĐ)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="max-w-3xl">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Play size={22} className="text-indigo-600" weight="fill" />
                Mô Phỏng Trực Quan Hành Trình Một Tin Nhắn
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Nhập tin nhắn bất kỳ từ nhóm Zalo để theo dõi các bước bóc tách, tra cứu đồ thị quyền, phân loại ý định và cách Thảo Chi trả lời.
              </p>

              {/* Simulation Input Form */}
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Tên Người Gửi (Sender)
                    </label>
                    <input
                      type="text"
                      value={simSender}
                      onChange={(e) => setSimSender(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Tin Nhắn Của Người Dùng (Zalo Prompt)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={simPrompt}
                        onChange={(e) => setSimPrompt(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={runSimulation}
                        disabled={simulating || !simPrompt.trim()}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shrink-0 shadow-sm shadow-indigo-100"
                      >
                        {simulating ? <ArrowsClockwise size={18} className="animate-spin" /> : <Play size={18} />}
                        <span>Chạy Mô Phỏng</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset Suggestions */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pt-1">
                  <span className="font-semibold text-gray-700">Mẫu thử nhanh:</span>
                  <button
                    onClick={() => setSimPrompt('Chi ơi, hôm nay trời thế nào?')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition"
                  >
                    "Chi ơi, hôm nay trời thế nào?"
                  </button>
                  <button
                    onClick={() => setSimPrompt('Kiểm tra giúp anh số dư tài khoản INOVA')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition"
                  >
                    "Kiểm tra giúp anh số dư tài khoản INOVA"
                  </button>
                  <button
                    onClick={() => setSimPrompt('Cách nấu phở bò ngon chuẩn vị?')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition"
                  >
                    "Cách nấu phở bò ngon chuẩn vị?"
                  </button>
                </div>
              </div>
            </div>

            {/* Stepper Progress Visualizer */}
            {simStep > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {[
                    { step: 1, label: '1. Kênh Nhắn' },
                    { step: 2, label: '2. Redis Queue' },
                    { step: 3, label: '3. Neo4j & RBAC' },
                    { step: 4, label: '4. AI 1 Router' },
                    { step: 5, label: '5. AI 2 Worker' },
                    { step: 6, label: '6. Gọi Tools' },
                    { step: 7, label: '7. AI 3 Synthesizer' },
                    { step: 8, label: '8. Giao Vận & Audit' },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        simStep >= s.step
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      <div className="w-5 h-5 mx-auto mb-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600">
                        {simStep > s.step ? <Check size={11} weight="bold" /> : s.step}
                      </div>
                      <span className="text-[11px] font-semibold block truncate">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Live Console Logs of Simulation */}
                <div className="bg-slate-950 text-slate-100 p-5 rounded-xl font-mono text-xs space-y-2 border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-800 text-[11px]">
                    <span>OMNIAGENT DISPATCHER TRACE LOG</span>
                    <span className="text-emerald-400">● LIVE RUNNER</span>
                  </div>
                  {simLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 select-none">➜</span>
                      <span className={idx === simLogs.length - 1 && simStep === 8 ? 'text-emerald-300 font-semibold text-sm' : ''}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RECENT TRACES (Nhật ký thực tế) */}
      {activeTab === 'traces' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Các Tin Nhắn Thực Tế Vừa Chạy Qua Hệ Thống</h2>
                <p className="text-xs text-gray-500 mt-0.5">Dữ liệu thời gian thực được trích xuất từ bảng audit_logs</p>
              </div>
              <Link
                href="/admin/audit-logs"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
              >
                <span>Xem toàn bộ nhật ký chi tiết</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Kênh</th>
                    <th className="py-3 px-4">Người gửi & Nội dung</th>
                    <th className="py-3 px-4">Ý định (Intent)</th>
                    <th className="py-3 px-4">Phản hồi của Thảo Chi</th>
                    <th className="py-3 px-4 text-right">Độ trễ</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.recentLogs && data.recentLogs.length > 0 ? (
                    data.recentLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                          {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                            log.platform === 'ZALO' ? 'bg-blue-50 text-blue-700' : 'bg-sky-50 text-sky-700'
                          }`}>
                            {log.platform}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-gray-900 text-xs truncate">{log.user_prompt}</div>
                          <div className="text-[11px] text-gray-400 font-mono truncate">Sender: {log.sender_id}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono">
                            {log.detected_intent || 'chitchat'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-sm truncate text-xs text-gray-700">
                          {log.final_response || 'Chưa có nội dung'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-gray-500">
                          {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                        Chưa có bản ghi tin nhắn nào trong nhật ký. Hãy nhắn tin trong nhóm Zalo để thấy tin nhắn xuất hiện tại đây!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Architecture Deep Dive Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <ChatCircleDots size={20} weight="duotone" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">Đa Kênh Tự Động Phục Hồi</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Hỗ trợ Zalo Web (`zca-js`) và Telegram (`grammy`). Tích hợp vòng lặp retry tự kết nối lại nếu mất mạng, đảm bảo không bị bỏ sót tin nhắn.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
            <TreeStructure size={20} weight="duotone" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">Bộ Nhớ Đồ Thị 2 Tầng</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Ánh xạ nhóm chat vào Workspace qua Neo4j. Kiểm soát quyền gọi công cụ chi tiết đến từng API endpoint mà không cần sửa code.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
            <Sparkle size={20} weight="duotone" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">Persona Thảo Chi INOVA</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            AI Agent được huấn luyện với phong cách tiếng Việt tự nhiên: Xưng "em" - gọi "anh/chị" theo tên thật, trả lời ngắn gọn và trung thực với dữ liệu tools.
          </p>
        </div>
      </div>
    </div>
  );
}
