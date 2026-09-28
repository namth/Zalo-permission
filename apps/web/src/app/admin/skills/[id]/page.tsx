'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Skill, getSkillById, updateSkillStatus, deleteSkill, updateSkill, getCategories } from '../api';
import { StatusBadge, TypeBadge, SkillSharingModal, SkillDeleteConfirmation } from '../components';

export default function SkillDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  
  // Edit State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [toolGroupFilter, setToolGroupFilter] = useState('');
  
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<{id: string, name: string, group_info?: {id: string, name: string}}[]>([]);
  const [availableToolGroups, setAvailableToolGroups] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    loadSkill();
    // Fetch categories and tools for edit mode
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
  }, [params.id]);

  const loadSkill = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSkillById(params.id);
      setSkill(data);
      // init edit state
      setEditName(data.name);
      setEditDescription(data.description || '');
      setEditDetail(data.detail || '');
      setEditCategory(data.category || '');
      setSelectedTools(data.tools?.map(t => t.id) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading skill');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'archived' | 'disabled') => {
    if (!skill) return;
    try {
      setIsUpdatingStatus(true);
      const updated = await updateSkillStatus(params.id, newStatus);
      setSkill({ ...skill, status: updated.status, updated_at: updated.updated_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating skill status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleShare = async (workspaceIds: string[]) => {
    console.log('Sharing skill to workspaces:', workspaceIds);
  };

  const handleDelete = async () => {
    try {
      await deleteSkill(params.id);
      router.push('/admin/skills');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting skill');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName) return;

    const finalCategory = newCategory.trim() !== '' ? newCategory.trim() : editCategory;

    try {
      setIsUpdatingStatus(true);
      const updated = await updateSkill(params.id, {
        name: editName,
        description: editDescription,
        detail: editDetail,
        category: finalCategory,
        tools: selectedTools
      });
      setSkill(updated);
      setIsEditing(false);
      // update category lists if there's a new category
      if (newCategory.trim() !== '' && !availableCategories.includes(newCategory.trim())) {
        setAvailableCategories([...availableCategories, newCategory.trim()]);
      }
      setEditCategory(finalCategory);
      setNewCategory('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving skill');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="space-y-6">
        <Link href="/admin/skills" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Skills
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || 'Skill not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/admin/skills" className="text-blue-600 hover:text-blue-800 text-sm mb-2 block">
            ← Back to Skills
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{skill.name}</h1>
          <p className="text-gray-600 mt-2">{skill.description || 'No description provided'}</p>
        </div>
        <div className="flex space-x-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Edit Skill
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Edit Skill Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Detail (Markdown)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 h-80 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="Detail instructions for the AI..."
                  value={editDetail}
                  onChange={(e) => setEditDetail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="flex gap-4">
                  <select
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      if (e.target.value !== 'new') setNewCategory('');
                    }}
                  >
                    <option value="">-- No Category --</option>
                    {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="new">+ Create New Category</option>
                  </select>
                  {editCategory === 'new' && (
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Detail (Markdown)
                </label>
                <textarea
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  value={editDetail}
                  onChange={(e) => setEditDetail(e.target.value)}
                  placeholder="Write detail instructions here..."
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // reset edits
                    setEditName(skill.name);
                    setEditDescription(skill.description || '');
                    setEditDetail(skill.detail || '');
                    setEditCategory(skill.category || '');
                    setSelectedTools(skill.tools?.map(t => t.id) || []);
                  }}
                  disabled={isUpdatingStatus}
                  className="mr-3 px-4 py-2 text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus || !editName}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {isUpdatingStatus ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">Details</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Category</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {skill.category ? <span className="bg-gray-100 px-2 py-1 rounded text-gray-800">{skill.category}</span> : 'None'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Tools Used</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {skill.tools && skill.tools.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {skill.tools.map(t => (
                            <span key={t.id} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">{t.name}</span>
                          ))}
                        </div>
                      ) : 'None'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Owner</dt>
                    <dd className="text-sm text-gray-900 mt-1">{skill.owner_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type</dt>
                    <dd className="text-sm mt-1">
                      <TypeBadge type={skill.type} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="text-sm text-gray-900 mt-1">{new Date(skill.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="text-sm text-gray-900 mt-1">{new Date(skill.updated_at).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              {skill.detail && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">Prompt Setup</h3>
                  <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
                    {skill.detail}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Status</h3>
            <div className="mb-4">
               <StatusBadge status={skill.status} />
            </div>
            <div className="space-y-2 mt-4 border-t pt-4">
              <button
                onClick={() => handleStatusChange('active')}
                disabled={isUpdatingStatus || skill.status === 'active'}
                className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {skill.status === 'active' ? '✓ Active' : 'Make Active'}
              </button>
              <button
                onClick={() => handleStatusChange('archived')}
                disabled={isUpdatingStatus || skill.status === 'archived'}
                className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {skill.status === 'archived' ? '✓ Archived' : 'Archive'}
              </button>
              <button
                onClick={() => handleStatusChange('disabled')}
                disabled={isUpdatingStatus || skill.status === 'disabled'}
                className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {skill.status === 'disabled' ? '✓ Disabled' : 'Disable'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Sharing</h3>
            <p className="text-sm text-gray-600 mb-4">
              Shared with {skill.shared_to?.length || 0} workspace(s)
            </p>
            {/* The actual share logic here was not fully implemented in the original file, we leave it as is */}
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Manage Sharing
            </button>
            {skill.shared_to && skill.shared_to.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p className="font-medium mb-2">Shared with:</p>
                <ul className="space-y-1">
                  {skill.shared_to.map((ws) => (
                    <li key={ws}>• {ws}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <SkillSharingModal
        isOpen={showShareModal}
        skillName={skill.name}
        onClose={() => setShowShareModal(false)}
        onShare={handleShare}
        currentSharedTo={skill.shared_to}
      />

      <SkillDeleteConfirmation
        isOpen={showDeleteConfirm}
        skillName={skill.name}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
