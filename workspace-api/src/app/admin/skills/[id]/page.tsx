'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Skill, getSkillById, updateSkillStatus, deleteSkill } from '../api';
import { StatusBadge, TypeBadge, SkillSharingModal, SkillDeleteConfirmation } from '../components';

export default function SkillDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    loadSkill();
  }, [params.id]);

  const loadSkill = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSkillById(params.id);
      setSkill(data);
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
      setSkill(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating skill status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleShare = async (workspaceIds: string[]) => {
    // Will be implemented when skill sharing API is available
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link href="/admin/skills" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Skills
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="space-y-6">
        <Link href="/admin/skills" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Skills
        </Link>
        <div className="text-gray-500">Skill not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/admin/skills" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Skills
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{skill.name}</h1>
          <p className="text-gray-600 mt-2">{skill.description || 'No description provided'}</p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Delete Skill
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Skill Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Skill Information</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-600">Owner</dt>
                <dd className="text-sm text-gray-900 mt-1">{skill.owner_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Type</dt>
                <dd className="text-sm mt-1">
                  <TypeBadge type={skill.type} />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Status</dt>
                <dd className="text-sm mt-1">
                  <StatusBadge status={skill.status} />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Created</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {new Date(skill.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Last Updated</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {new Date(skill.updated_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Logic Config */}
          {skill.logic_config && (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Workflow Configuration</h3>
              <pre className="bg-gray-50 p-4 rounded text-sm text-gray-600 overflow-x-auto max-h-96">
                {JSON.stringify(skill.logic_config, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Management */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Status Management</h3>
            <div className="space-y-2">
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

          {/* Sharing */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Sharing</h3>
            <p className="text-sm text-gray-600 mb-4">
              Shared with {skill.shared_to?.length || 0} workspace(s)
            </p>
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

          {/* Usage */}
          {typeof skill.usage_count !== 'undefined' && (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Usage</h3>
              <p className="text-2xl font-bold text-blue-600">{skill.usage_count}</p>
              <p className="text-sm text-gray-600">times used</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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
