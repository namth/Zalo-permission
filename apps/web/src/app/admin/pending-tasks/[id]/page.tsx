'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CaretLeft, Trash } from '@phosphor-icons/react';
import { PendingTask, fetchPendingTaskById, updatePendingTask, deletePendingTask } from '../api';
import { PendingTaskForm, StatusBadge } from '../components';

export default function PendingTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [task, setTask] = useState<PendingTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadTask();
    }
  }, [id]);

  const loadTask = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPendingTaskById(id);
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: Partial<PendingTask>) => {
    const updated = await updatePendingTask(id, data);
    setTask(updated);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this pending task? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deletePendingTask(id);
      router.push('/admin/pending-tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting task');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading task details...</div>;
  }

  if (error || !task) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin/pending-tasks"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <CaretLeft size={20} weight="bold" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Task Not Found</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800 text-center">
          {error || "The task you're looking for doesn't exist or has been deleted."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/pending-tasks"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition mt-1"
          >
            <CaretLeft size={20} weight="bold" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono text-sm">{task.id}</h1>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-gray-600 mt-1">
              Created on {new Date(task.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm font-medium disabled:opacity-50"
        >
          <Trash size={16} weight="bold" />
          {isDeleting ? 'Deleting...' : 'Delete Task'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-3">
          <PendingTaskForm
            task={task}
            onSubmit={handleUpdate}
          />
        </div>
      </div>
    </div>
  );
}
