'use client';

import { useState } from 'react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    active: 'bg-green-100 text-green-800',
    archived: 'bg-yellow-100 text-yellow-800',
    disabled: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
      type === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
    }`}>
      {type === 'user' ? 'User' : 'System'}
    </span>
  );
}

interface SkillSharingModalProps {
  isOpen: boolean;
  skillName: string;
  onClose: () => void;
  onShare: (workspaceIds: string[]) => Promise<void>;
  currentSharedTo?: string[];
}

export function SkillSharingModal({
  isOpen,
  skillName,
  onClose,
  onShare,
  currentSharedTo = [],
}: SkillSharingModalProps) {
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>(currentSharedTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      await onShare(selectedWorkspaces);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sharing skill');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Share "{skillName}" with Workspaces
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">
            {error}
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          Select which workspaces should have access to this skill
        </p>

        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
          {/* Placeholder for workspace list - will be populated with actual workspaces */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              disabled
            />
            <span className="text-sm text-gray-500">(Workspaces will be populated from API)</span>
          </label>
        </div>

        <div className="flex space-x-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SkillDeleteConfirmationProps {
  isOpen: boolean;
  skillName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function SkillDeleteConfirmation({
  isOpen,
  skillName,
  onClose,
  onConfirm,
}: SkillDeleteConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting skill');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Skill?</h3>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">
            {error}
          </div>
        )}

        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete "{skillName}"? This action cannot be undone.
        </p>

        <div className="flex space-x-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
