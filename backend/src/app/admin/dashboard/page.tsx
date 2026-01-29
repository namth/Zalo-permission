'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  workspaces: number;
  users: number;
  agents: number;
  auditLogs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    workspaces: 0,
    users: 0,
    agents: 0,
    auditLogs: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch stats from API
    setLoading(false);
  }, []);

  const cards = [
    {
      title: 'Workspaces',
      count: stats.workspaces,
      icon: '🏢',
      href: '/admin/workspaces',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      title: 'Users',
      count: stats.users,
      icon: '👥',
      href: '/admin/users',
      color: 'bg-green-50 border-green-200'
    },
    {
      title: 'Agents',
      count: stats.agents,
      icon: '🤖',
      href: '/admin/agents',
      color: 'bg-purple-50 border-purple-200'
    },
    {
      title: 'Audit Logs',
      count: stats.auditLogs,
      icon: '📝',
      href: '/admin/audit-logs',
      color: 'bg-orange-50 border-orange-200'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to Workspace Permission Management System</p>
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
                  <p className="text-gray-600 text-sm font-medium">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {loading ? '-' : card.count}
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
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/workspaces?action=create">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              + New Workspace
            </button>
          </Link>
          <Link href="/admin/agents?action=create">
            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
              + New Agent
            </button>
          </Link>
          <Link href="/admin/users">
            <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              Manage Users
            </button>
          </Link>
          <Link href="/admin/audit-logs">
            <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition">
              View Audit Logs
            </button>
          </Link>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">System Information</h3>
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
