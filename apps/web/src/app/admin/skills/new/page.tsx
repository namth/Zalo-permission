'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSkill, getCategories, Skill } from '../api';

export default function NewSkillPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [detail, setDetail] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [toolGroupFilter, setToolGroupFilter] = useState('');

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<{id: string, name: string, group_info?: {id: string, name: string}}[]>([]);
  const [availableToolGroups, setAvailableToolGroups] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    // Fetch categories and tools
    Promise.all([
      getCategories(),
      fetch('/api/admin/tools?status=active').then(res => res.json()),
      fetch('/api/admin/tool-groups').then(res => res.json())
    ]).then(([cats, toolsRes, groupsRes]) => {
      setAvailableCategories(cats);
      if (toolsRes.success) {
        setAvailableTools(toolsRes.data || []);
      }
      if (groupsRes.success) {
        setAvailableToolGroups(groupsRes.data || []);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const finalCategory = newCategory.trim() !== '' ? newCategory.trim() : category;

    try {
      setLoading(true);
      setError(null);
      
      const newSkill = await createSkill({
        name,
        description,
        detail,
        category: finalCategory,
        tools: selectedTools,
        type: 'system', // Default type for admin panel
        status: 'active'
      });

      router.push(`/admin/skills/${newSkill.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating skill');
      setLoading(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/skills" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Skills
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Skill</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            required
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <div className="flex gap-4">
            <select
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value !== 'new') setNewCategory('');
              }}
            >
              <option value="">-- No Category --</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="new">+ Create New Category</option>
            </select>
            {category === 'new' && (
              <input
                type="text"
                placeholder="New category name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Tools</label>
            <select 
              className="text-xs border rounded px-2 py-1 bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none"
              value={toolGroupFilter}
              onChange={(e) => setToolGroupFilter(e.target.value)}
            >
              <option value="">All Tool Groups</option>
              {availableToolGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {availableTools
                .filter(tool => !toolGroupFilter || tool.group_info?.id === toolGroupFilter)
                .map(tool => (
                <label key={tool.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-700 font-medium">{tool.name}</span>
                    <span className="text-[10px] text-gray-400 capitalize">{tool.group_info?.name || 'Uncategorized'}</span>
                  </div>
                </label>
              ))}
            </div>
            {availableTools.filter(tool => !toolGroupFilter || tool.group_info?.id === toolGroupFilter).length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500">No tools found for this group</div>
            )}
          </div>
          {selectedTools.length > 0 && (
            <div className="mt-2 text-[10px] text-blue-600 font-medium">
              Selected: {selectedTools.length} tools across groups
            </div>
          )}
        </div>

        {selectedTools.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-blue-500 mb-2">Selected Tools for Prompting</label>
            <div className="flex flex-wrap gap-2">
              {selectedTools.map(id => {
                const tool = availableTools.find(t => t.id === id);
                return (
                  <div key={id} className="flex items-center bg-white border border-blue-200 rounded-full px-3 py-1 shadow-sm">
                    <span className="text-sm font-medium text-blue-700">{tool?.name || id}</span>
                    <button 
                      type="button"
                      onClick={() => toggleTool(id)}
                      className="ml-2 text-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-blue-400 italic">
              Tip: Use the tool names above in your prompt instructions below.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prompt Detail (Markdown)
          </label>
          <textarea
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Write detail instructions here..."
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="mr-3 px-4 py-2 text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Creating...' : 'Create Skill'}
          </button>
        </div>
      </form>
    </div>
  );
}
