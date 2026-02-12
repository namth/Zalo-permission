"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardStats {
  workspaces: number;
  users: number;
  tools: number;
  auditLogs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    workspaces: 0,
    users: 0,
    tools: 0,
    auditLogs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Fetch tools from API
      const toolsResponse = await fetch("/api/admin/tools");
      const toolsData = await toolsResponse.json();

      setStats({
        workspaces: 0, // Stats API removed - not in spec
        users: 0, // Stats API removed - not in spec
        tools: toolsData.success ? toolsData.data?.length || 0 : 0,
        auditLogs: 0, // Stats API removed - not in spec
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
      count: 0,
      icon: "🏢",
      href: "/admin/workspaces",
      color: "bg-blue-50 border-blue-200",
    },
    {
      title: "Tools",
      count: stats.tools,
      icon: "📦",
      href: "/admin/tools",
      color: "bg-purple-50 border-purple-200",
    },
    {
      title: "Permissions",
      count: 0,
      icon: "🔐",
      href: "/admin/permissions",
      color: "bg-indigo-50 border-indigo-200",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome to Workspace Permission Management System
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div
              className={`${card.color} border rounded-lg p-6 cursor-pointer hover:shadow-lg transition`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {loading ? "-" : card.count}
                  </p>
                </div>
                <div className="text-4xl">{card.icon}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Core APIs Available
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/workspaces">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Manage Workspaces
            </button>
          </Link>
          <Link href="/admin/tools">
            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
              Manage Tools
            </button>
          </Link>
          <Link href="/admin/permissions">
            <button className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Manage Permissions
            </button>
          </Link>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          System Information
        </h3>
        <ul className="text-blue-800 space-y-2 text-sm">
          <li>✓ Database: PostgreSQL + Neo4j</li>
          <li>✓ Permission System: Workspace-based RBAC</li>
          <li>✓ Roles: ADMIN, MEMBER</li>
          <li>✓ Audit Trail: Complete action tracking</li>
        </ul>
      </div>
    </div>
  );
}
