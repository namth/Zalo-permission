"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardStats {
  workspaces: number;
  channels: number;
  tools: number;
  skills: number;
  users: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    workspaces: 0,
    channels: 0,
    tools: 0,
    skills: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [wsRes, channelsRes, toolsRes, skillsRes, usersRes] = await Promise.allSettled([
        fetch("/api/admin/workspaces?limit=100").then((r) => r.json()),
        fetch("/api/channels").then((r) => r.json()),
        fetch("/api/admin/tools").then((r) => r.json()),
        fetch("/api/admin/skills").then((r) => r.json()),
        fetch("/api/admin/users?limit=100").then((r) => r.json()),
      ]);

      const wsCount =
        wsRes.status === "fulfilled" && wsRes.value.success
          ? wsRes.value.data?.length || 0
          : 0;
      const channelsCount =
        channelsRes.status === "fulfilled" && channelsRes.value.success
          ? channelsRes.value.data?.length || 0
          : 0;
      const toolsCount =
        toolsRes.status === "fulfilled" && toolsRes.value.success
          ? toolsRes.value.data?.length || 0
          : 0;
      const skillsCount =
        skillsRes.status === "fulfilled" && skillsRes.value.success
          ? skillsRes.value.data?.length || 0
          : 0;
      const usersCount =
        usersRes.status === "fulfilled" && usersRes.value.success
          ? usersRes.value.pagination?.total || usersRes.value.data?.length || 0
          : 0;

      setStats({
        workspaces: wsCount,
        channels: channelsCount,
        tools: toolsCount,
        skills: skillsCount,
        users: usersCount,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: "Workspaces",
      count: stats.workspaces,
      icon: "🏢",
      href: "/workspaces",
      color: "bg-blue-50 border-blue-200 text-blue-900",
      description: "Không gian làm việc & phân quyền",
    },
    {
      title: "Kênh Liên Lạc",
      count: stats.channels,
      icon: "💬",
      href: "/channels",
      color: "bg-emerald-50 border-emerald-200 text-emerald-900",
      description: "Tài khoản Zalo & Telegram kết nối",
    },
    {
      title: "Tools & Nhóm Lệnh",
      count: stats.tools,
      icon: "📦",
      href: "/tools",
      color: "bg-purple-50 border-purple-200 text-purple-900",
      description: "Công cụ tích hợp & API MCP",
    },
    {
      title: "Skills & Trợ Lý",
      count: stats.skills,
      icon: "⚡",
      href: "/skills",
      color: "bg-amber-50 border-amber-200 text-amber-900",
      description: "Kịch bản SOP & Intent của Agent",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Quản Trị</h1>
        <p className="text-gray-600 mt-2">
          Hệ thống điều phối OmniAgent Gateway & Quản trị phân quyền không gian làm việc
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div
              className={`${card.color} border rounded-xl p-6 cursor-pointer hover:shadow-lg transition flex flex-col justify-between h-full`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold opacity-80">{card.title}</p>
                  <p className="text-4xl font-extrabold mt-2">
                    {loading ? "-" : card.count}
                  </p>
                </div>
                <div className="text-4xl">{card.icon}</div>
              </div>
              <p className="text-xs opacity-70 mt-4 border-t border-current/10 pt-2 font-medium">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Lối Tắt Quản Trị Nhanh
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/workspaces">
            <button className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition text-sm flex items-center justify-center gap-2">
              <span>🏢</span> Quản Lý Workspaces
            </button>
          </Link>
          <Link href="/channels">
            <button className="w-full px-4 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition text-sm flex items-center justify-center gap-2">
              <span>💬</span> Kết Nối Kênh Chat
            </button>
          </Link>
          <Link href="/tools">
            <button className="w-full px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition text-sm flex items-center justify-center gap-2">
              <span>📦</span> Quản Lý Tools
            </button>
          </Link>
          <Link href="/skills">
            <button className="w-full px-4 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition text-sm flex items-center justify-center gap-2">
              <span>⚡</span> Kịch Bản Skills
            </button>
          </Link>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span>🛡️</span> Trạng Thái Kiến Trúc Hệ Thống (SSOT)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200/80">
            <div className="font-semibold text-slate-900 mb-1">Cơ sở dữ liệu song hành</div>
            <p className="text-slate-600">PostgreSQL (Dữ liệu quan hệ, Audit Logs) + Neo4j Graph (Phân quyền 2 tầng CAN_USE & DISABLED)</p>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200/80">
            <div className="font-semibold text-slate-900 mb-1">Định tuyến đa kênh</div>
            <p className="text-slate-600">Hỗ trợ Zalo Personal, Zalo Group, Telegram Bot Token và Webhook Inbound Callbacks</p>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200/80">
            <div className="font-semibold text-slate-900 mb-1">Máy trạng thái phiên</div>
            <p className="text-slate-600">COLD (im lặng khi không tag) $\leftrightarrow$ WARM (giữ ngữ cảnh 300s) và Human Takeover 30 phút</p>
          </div>
        </div>
      </div>
    </div>
  );
}
