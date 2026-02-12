'use client';

import { useState } from 'react';
import { Tool, createTool, updateTool } from './api';

interface ToolFormProps {
  tool?: Tool;
  onSubmit: (data: Partial<Tool>) => Promise<void>;
  onSuccess?: () => void;
}

export function ToolForm({ tool, onSubmit, onSuccess }: ToolFormProps) {
  const [formData, setFormData] = useState<Partial<Tool>>(
    tool || {
      key: '',
      name: '',
      description: '',
      status: 'active',
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate required fields
    if (!formData.key?.trim()) {
      setError('Tool key is required');
      return;
    }
    if (!formData.name?.trim()) {
      setError('Tool name is required');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(formData);
      setSuccess(true);
      
      if (!tool) {
        // Reset form for new tool
        setFormData({
          key: '',
          name: '',
          description: '',
          status: 'active',
        });
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving tool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          Tool saved successfully!
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tool Key <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.key || ''}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., send_email"
          disabled={loading || !!tool}
        />
        <p className="text-xs text-gray-500 mt-1">Unique identifier for the tool (cannot be changed)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Send Email"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What does this tool do?"
          rows={4}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          value={formData.status || 'active'}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="active">Active</option>
          <option value="deprecated">Deprecated</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Saving...' : tool ? 'Update Tool' : 'Create Tool'}
      </button>
    </form>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-100 text-green-800',
    deprecated: 'bg-yellow-100 text-yellow-800',
    disabled: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
