"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PencilSimple, Trash, Plus, X, Copy } from "@phosphor-icons/react";

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
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [cloneData, setCloneData] = useState({ source_id: "", new_name: "" });
  const [cloning, setCloning] = useState(false);

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

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCloning(true);
      const response = await fetch("/api/admin/workspaces/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloneData),
      });
      const data = await response.json();
      if (data.success) {
        setCloneData({ source_id: "", new_name: "" });
        setShowCloneForm(false);
        fetchWorkspaces();
      } else {
        alert("Error cloning workspace: " + data.error);
      }
    } catch (error) {
      console.error("Error cloning workspace:", error);
    } finally {
      setCloning(false);
    }
  };

  const openCloneForm = (workspace: Workspace) => {
    setCloneData({ source_id: workspace.id, new_name: `${workspace.name} (Clone)` });
    setShowCloneForm(true);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          {showForm ? (
            <>
              <X size={16} weight="bold" />
              Cancel
            </>
          ) : (
            <>
              <Plus size={16} weight="bold" />
              New Workspace
            </>
          )}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
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
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              <Plus size={16} weight="bold" />
              Create
            </button>
          </div>
        </form>
      )}

      {showCloneForm && (
        <form
          onSubmit={handleClone}
          className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm mb-6"
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-blue-900">Clone Workspace</h2>
            <p className="text-sm text-blue-700">This will copy all tools and skills connection to the new workspace.</p>
            <input
              type="text"
              placeholder="New workspace name"
              value={cloneData.new_name}
              onChange={(e) =>
                setCloneData({ ...cloneData, new_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={cloning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
              >
                <Copy size={16} weight="bold" />
                {cloning ? "Cloning..." : "Confirm Clone"}
              </button>
              <button
                type="button"
                onClick={() => setShowCloneForm(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
              >
                Cancel
              </button>
            </div>
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
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition"
            >
              <Link href={`/admin/workspaces/${ws.id}`} className="block mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {ws.name}
                </h3>
                {ws.description && (
                  <p className="text-gray-600 text-sm mt-2">{ws.description}</p>
                )}
                <p className="text-gray-400 text-xs mt-3 font-mono">
                  {ws.id}
                </p>
              </Link>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Link href={`/admin/workspaces/${ws.id}`}>
                  <button
                    title="Edit workspace"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                  >
                    <PencilSimple size={15} weight="bold" />
                    Edit
                  </button>
                </Link>
                <button
                  onClick={() => openCloneForm(ws)}
                  title="Clone workspace"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                >
                  <Copy size={15} weight="bold" />
                  Clone
                </button>
                <button
                  onClick={() => handleDelete(ws.id, ws.name)}
                  title="Delete workspace"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                >
                  <Trash size={15} weight="bold" />
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
