'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PendingTask, fetchPendingTasks, deletePendingTask } from './api';

export default function PendingTasksPage() {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, [filterStatus, filterWorkspace]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPendingTasks({
        status: filterStatus || undefined,
        workspace_id: filterWorkspace || undefined,
      });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading pending tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this pending task?')) {
      return;
    }

    try {
      await deletePendingTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting task');
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.intent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'AWAITING_INPUT':
        return 'bg-orange-100 text-orange-800';
      case 'READY_TO_RESUME':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pending Tasks</h1>
          <p className="text-gray-600 mt-2">Tasks awaiting user input or completion</p>
        </div>
        <button
          onClick={loadTasks}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by intent or user
            </label>
            <input
              type="text"
              placeholder="Search tasks..."
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
              <option value="AWAITING_INPUT">Awaiting Input</option>
              <option value="READY_TO_RESUME">Ready to Resume</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by workspace
            </label>
            <input
              type="text"
              placeholder="Workspace name..."
              value={filterWorkspace}
              onChange={(e) => setFilterWorkspace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
          <button
            onClick={loadTasks}
            className="ml-4 text-red-600 hover:text-red-800 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading pending tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {tasks.length === 0 ? 'No pending tasks found. All tasks are complete!' : 'No tasks match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Intent</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Workspace</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Missing Info</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {task.intent.substring(0, 50)}
                      {task.intent.length > 50 ? '...' : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{task.user_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{task.workspace_name}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(task.status)}`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {task.required_info?.length ? `${task.required_info.length} field(s)` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(task.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button
                        onClick={() => setSelectedTaskId(task.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Total Tasks</p>
            <p className="text-2xl font-bold text-blue-900">{tasks.length}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-600 font-medium">Awaiting Input</p>
            <p className="text-2xl font-bold text-orange-900">
              {tasks.filter((t) => t.status === 'AWAITING_INPUT').length}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Ready to Resume</p>
            <p className="text-2xl font-bold text-blue-900">
              {tasks.filter((t) => t.status === 'READY_TO_RESUME').length}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Completed</p>
            <p className="text-2xl font-bold text-green-900">
              {tasks.filter((t) => t.status === 'COMPLETED').length}
            </p>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [task, setTask] = useState<PendingTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTask = async () => {
      try {
        const response = await fetch(`/api/admin/pending-tasks/${taskId}`);
        const data = await response.json();
        if (data.success) {
          setTask(data.data);
        }
      } catch (err) {
        console.error('Error loading task:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTask();
  }, [taskId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Task Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : task ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Intent</p>
              <p className="text-sm text-gray-900 mt-1">{task.intent}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">User</p>
              <p className="text-sm text-gray-900 mt-1">{task.user_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Workspace</p>
              <p className="text-sm text-gray-900 mt-1">{task.workspace_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className="text-sm text-gray-900 mt-1">{task.status}</p>
            </div>
            {task.required_info && task.required_info.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600">Required Information</p>
                <ul className="text-sm text-gray-900 mt-1 list-disc list-inside">
                  {task.required_info.map((info, idx) => (
                    <li key={idx}>{info}</li>
                  ))}
                </ul>
              </div>
            )}
            {task.plan_summary && (
              <div>
                <p className="text-sm font-medium text-gray-600">Plan Summary</p>
                <p className="text-sm text-gray-900 mt-1">{task.plan_summary}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">Task not found</div>
        )}
      </div>
    </div>
  );
}
