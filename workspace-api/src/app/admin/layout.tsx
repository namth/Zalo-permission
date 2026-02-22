'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-600">Workspace Management</p>
        </div>

        <nav className="space-y-4">
          <Link
            href="/admin/dashboard"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            📊 Dashboard
          </Link>

          {/* MANAGEMENT */}
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Management</p>
          </div>
          <Link
            href="/admin/workspaces"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            🏢 Workspaces
          </Link>
          <Link
            href="/admin/users"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            👥 Users
          </Link>

          {/* RESOURCES */}
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Resources</p>
          </div>
          <Link
            href="/admin/tools"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            📦 Tools
          </Link>
          <Link
            href="/admin/skills"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            🎯 Skills
          </Link>
          <Link
            href="/admin/permissions"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            🔐 Permissions
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
