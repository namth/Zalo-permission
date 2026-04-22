'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChartBar,
  Buildings,
  Users,
  Package,
  Lightning,
  Lock,
  SignOut,
  UserCircle,
  Gear,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
            <p className="text-sm text-gray-600">Workspace Management</p>
          </div>

        <nav className="space-y-1">
          {user?.role === 'admin' && (
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <ChartBar size={18} weight="duotone" />
              <span>Dashboard</span>
            </Link>
          )}

          {/* MANAGEMENT */}
          <div className="pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">Management</p>
          </div>
          <Link
            href="/admin/workspaces"
            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <Buildings size={18} weight="duotone" />
            <span>Workspaces</span>
          </Link>
          
          {user?.role === 'admin' && (
            <Link
              href="/admin/users"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <Users size={18} weight="duotone" />
              <span>Users</span>
            </Link>
          )}

          {/* TASKS & MONITORING */}
          <div className="pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">Tasks & Monitoring</p>
          </div>
          <Link
            href="/admin/pending-tasks"
            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <Lock size={18} weight="duotone" />
            <span>Pending Tasks</span>
          </Link>

          {/* RESOURCES */}
          <div className="pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">Resources</p>
          </div>
          
          {user?.role === 'admin' && (
            <>
              <Link
                href="/admin/tools"
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Package size={18} weight="duotone" />
                <span>Tools</span>
              </Link>
              <Link
                href="/admin/tool-groups"
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Buildings size={18} weight="duotone" />
                <span>Tool Groups</span>
              </Link>
            </>
          )}
          
          <Link
            href="/admin/skills"
            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <Lightning size={18} weight="duotone" />
            <span>Skills</span>
          </Link>

          {/* SETTINGS */}
          <div className="pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">System</p>
          </div>
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <Gear size={18} weight="duotone" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <UserCircle size={28} weight="duotone" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {user?.role || 'System'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <SignOut size={18} weight="duotone" />
            <span>Sign Out</span>
          </button>
        </div>
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
