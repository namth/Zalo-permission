'use client';

import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage tools, skills, and workspaces</p>
      </div>

      {/* Resources Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📦 Tools</h3>
            <p className="text-gray-600 mb-4">System API integrations available to workspaces</p>
            <Link
              href="/admin/tools"
              className="inline-block text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Tools →
            </Link>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🎯 Skills</h3>
            <p className="text-gray-600 mb-4">User-learned workflows and automation patterns</p>
            <Link
              href="/admin/skills"
              className="inline-block text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Skills →
            </Link>
          </div>

        </div>
      </div>

      {/* Management Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Management</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🏢 Workspaces</h3>
            <p className="text-gray-600 mb-4">Create and manage workspaces linked to Zalo groups</p>
            <Link
              href="/admin/workspaces"
              className="inline-block text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Workspaces →
            </Link>
          </div>
        </div>
      </div>

      {/* Monitoring Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Monitoring</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">⏳ Pending Tasks</h3>
            <p className="text-gray-600 mb-4">Tasks awaiting user input or completion</p>
            <Link
              href="/admin/pending-tasks"
              className="inline-block text-blue-600 hover:text-blue-800 font-medium"
            >
              View Pending →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
