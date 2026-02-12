"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/workspaces");
      const data = await response.json();
      if (data.success) {
        setWorkspaces(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (data.success) {
        setFormData({ name: "", description: "" });
        setShowForm(false);
        fetchWorkspaces();
      }
    } catch (error) {
      console.error("Error creating workspace:", error);
    }
  };

  const handleDelete = async (workspaceId: string, workspaceName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete workspace "${workspaceName}"? This will also delete all related data in Neo4j.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        fetchWorkspaces();
      } else {
        console.error("Error deleting workspace:", data.error);
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? "Cancel" : "New Workspace"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-6 rounded-lg border border-gray-200"
        >
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Workspace name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-600">Loading...</div>
      ) : workspaces.length === 0 ? (
        <div className="text-center text-gray-600">No workspaces yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition"
            >
              <Link href={`/admin/workspaces/${ws.id}`}>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ws.name}
                </h3>
                {ws.description && (
                  <p className="text-gray-600 text-sm mt-2">{ws.description}</p>
                )}
                <p className="text-gray-500 text-xs mt-4">ID: {ws.id}</p>
              </Link>
              <div className="mt-4 flex gap-2">
                <Link href={`/admin/workspaces/${ws.id}`} className="flex-1">
                  <button className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                    Edit
                  </button>
                </Link>
                <button
                  onClick={() => handleDelete(ws.id, ws.name)}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
