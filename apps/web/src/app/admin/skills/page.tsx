'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skill, fetchSkills } from './api';
import { StatusBadge, TypeBadge } from './components';
import { ArrowSquareOut, Plus, Sparkle, TreeStructure } from '@phosphor-icons/react';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadSkills();
  }, [filterStatus, filterCategory]);

  useEffect(() => {
    fetch('/api/admin/categories').then(res => res.json()).then(data => {
      if (data.success) setCategories(data.data);
    });
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSkills({
        status: filterStatus || undefined,
        category: filterCategory || undefined,
      });
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading skills');
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.owner_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCurrentUser(data.user);
      });
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Skills Management</h1>
          <p className="text-gray-600 mt-2">View and manage user-learned skills and workflows</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/skills/studio"
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 text-sm font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <Sparkle className="w-4 h-4 text-amber-300" />
            Skill Studio (Huấn luyện SOP)
          </Link>
          {isAdmin && (
            <Link
              href="/admin/skills/new"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tạo Skill mới
            </Link>
          )}
          <Link
            href="/admin/workspaces"
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
          >
            Workspaces
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by name or owner
            </label>
            <input
              type="text"
              placeholder="Search skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
          <button
            onClick={loadSkills}
            className="ml-4 text-red-600 hover:text-red-800 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Skills Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading skills...</div>
        ) : filteredSkills.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {skills.length === 0 ? 'No skills found. They will appear here as users create them.' : 'No skills match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Quy trình (SOP)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Owner</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSkills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      <div className="flex flex-col">
                        <Link href={`/admin/skills/${skill.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {skill.name}
                        </Link>
                        {skill.key && (
                          <span className="text-[11px] text-gray-400 font-mono mt-0.5">{skill.key}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{skill.description}</td>
                    <td className="px-6 py-4 text-sm">
                      {Array.isArray(skill.sop_steps) && skill.sop_steps.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <TreeStructure className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          SOP ({skill.sop_steps.length} bước)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          ReAct Prompt
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">{skill.category || 'None'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{skill.owner_name}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      <Link
                        href={`/admin/skills/studio?id=${skill.id}`}
                        className="inline-flex items-center px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-xs font-medium transition gap-1"
                        title="Mở trong Skill Studio để phỏng vấn và sửa quy trình"
                      >
                        <Sparkle className="w-3.5 h-3.5" />
                        Huấn luyện SOP
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && skills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Total Skills</p>
            <p className="text-2xl font-bold text-blue-900">{skills.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Active</p>
            <p className="text-2xl font-bold text-green-900">{skills.filter(s => s.status === 'active').length}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-600 font-medium">Categories</p>
            <p className="text-2xl font-bold text-purple-900">{categories.length}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-sm text-indigo-600 font-medium">Shared</p>
            <p className="text-2xl font-bold text-indigo-900">{skills.filter(s => (s.shared_to?.length || 0) > 0).length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
