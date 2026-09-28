'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CaretLeft } from '@phosphor-icons/react';
import { PendingTaskForm } from '../components';
import { createPendingTask, PendingTask } from '../api';

export default function NewPendingTaskPage() {
  const router = useRouter();

  const handleSubmit = async (data: Partial<PendingTask>) => {
    await createPendingTask(data);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/pending-tasks"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <CaretLeft size={20} weight="bold" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Pending Task</h1>
          <p className="text-gray-600 mt-1">Create a new pending task manually</p>
        </div>
      </div>

      <PendingTaskForm
        onSubmit={handleSubmit}
        onSuccess={() => {
          setTimeout(() => {
            router.push('/admin/pending-tasks');
          }, 1500);
        }}
      />
    </div>
  );
}
