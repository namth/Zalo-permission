'use client';

import { useState } from 'react';
import { PendingTask } from './api';

export function StatusBadge({ status }: { status: string }) {
  let styles = 'bg-gray-100 text-gray-800';
  if (status === 'AWAITING_INPUT') styles = 'bg-yellow-100 text-yellow-800';
  else if (status === 'READY_TO_RESUME') styles = 'bg-blue-100 text-blue-800';
  else if (status === 'COMPLETED') styles = 'bg-green-100 text-green-800';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

interface PendingTaskFormProps {
  task?: PendingTask;
  onSubmit: (data: Partial<PendingTask>) => Promise<void>;
  onSuccess?: () => void;
}

export function PendingTaskForm({ task, onSubmit, onSuccess }: PendingTaskFormProps) {
  const [formData, setFormData] = useState<Partial<PendingTask>>(
    task || {
      workspace_id: '',
      thread_id: '',
      user_id: '',
      intent: '',
      status: 'AWAITING_INPUT',
    }
  );
  
  const [fullPlanRaw, setFullPlanRaw] = useState<string>(
    task?.full_plan ? JSON.stringify(task.full_plan, null, 2) : ''
  );
  const [missingParamsRaw, setMissingParamsRaw] = useState<string>(
    task?.missing_parameters ? JSON.stringify(task.missing_parameters, null, 2) : ''
  );

  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setJsonError(null);
    setSuccess(false);

    if (!formData.workspace_id?.trim() || !formData.thread_id?.trim() || !formData.user_id?.trim()) {
      setError('Workspace ID, Thread ID, and User ID are required');
      return;
    }

    let parsedFullPlan = undefined;
    let parsedMissingParams = undefined;

    try {
      if (fullPlanRaw.trim()) parsedFullPlan = JSON.parse(fullPlanRaw);
      if (missingParamsRaw.trim()) parsedMissingParams = JSON.parse(missingParamsRaw);
    } catch {
      setJsonError('Invalid JSON in Full Plan or Missing Parameters');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        ...formData,
        full_plan: parsedFullPlan,
        missing_parameters: parsedMissingParams
      });
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving task');
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
          Task saved successfully!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Workspace ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.workspace_id || ''}
            onChange={(e) => setFormData({ ...formData, workspace_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || !!task}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thread ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.thread_id || ''}
            onChange={(e) => setFormData({ ...formData, thread_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || !!task}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.user_id || ''}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || !!task}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status || 'AWAITING_INPUT'}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="AWAITING_INPUT">AWAITING_INPUT</option>
            <option value="READY_TO_RESUME">READY_TO_RESUME</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Intent
        </label>
        <input
          type="text"
          value={formData.intent || ''}
          onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Plan (JSON)
          </label>
          <textarea
            value={fullPlanRaw}
            onChange={(e) => {
              setFullPlanRaw(e.target.value);
              setJsonError(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={8}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Missing Parameters (JSON)
          </label>
          <textarea
            value={missingParamsRaw}
            onChange={(e) => {
              setMissingParamsRaw(e.target.value);
              setJsonError(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={8}
            disabled={loading}
          />
        </div>
      </div>

      {jsonError && (
        <p className="text-sm text-red-600 font-medium">{jsonError}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
      </button>
    </form>
  );
}
