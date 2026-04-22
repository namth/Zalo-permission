'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createToolGroup } from '../api';
import { ArrowLeft } from '@phosphor-icons/react';

export default function NewToolGroupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ key: '', name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.key.trim()) { setError('Key is required'); return; }
    if (!formData.name.trim()) { setError('Name is required'); return; }

    try {
      setLoading(true);
      const group = await createToolGroup(formData);
      router.push(`/admin/tool-groups/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tool group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/tool-groups" className="text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Tool Group</h1>
          <p className="text-gray-600 mt-1">Create a new group to organize tools</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Group Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., marketing_tools"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only. Cannot be changed later.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Marketing Tools"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What is this group of tools for?"
            rows={4}
            disabled={loading}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {loading ? 'Creating...' : 'Create Tool Group'}
          </button>
          <Link
            href="/admin/tool-groups"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
