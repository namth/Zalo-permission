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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");

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
    if (!formData.name.trim()) {
      setCreateError("Vui lòng nhập tên workspace");
      return;
    }

    try {
      setCreating(true);
      setCreateError("");
      const response = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setFormData({ name: "", description: "" });
        setShowForm(false);
        fetchWorkspaces();
      } else {
        setCreateError(data.error || "Không thể tạo workspace. Vui lòng kiểm tra lại.");
      }
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      setCreateError(error.message || "Lỗi kết nối máy chủ");
    } finally {
      setCreating(false);
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
        alert("Lỗi xóa workspace: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Error deleting workspace:", error);
      alert("Lỗi kết nối khi xóa workspace: " + error.message);
    }
  };

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneData.new_name.trim()) {
      setCloneError("Vui lòng nhập tên workspace mới");
      return;
    }

    try {
      setCloning(true);
      setCloneError("");
      const response = await fetch("/api/admin/workspaces/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloneData),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setCloneData({ source_id: "", new_name: "" });
        setShowCloneForm(false);
        fetchWorkspaces();
      } else {
        setCloneError(data.error || "Không thể sao chép workspace.");
      }
    } catch (error: any) {
      console.error("Error cloning workspace:", error);
      setCloneError(error.message || "Lỗi kết nối khi sao chép workspace");
    } finally {
      setCloning(false);
    }
  };

  const openCloneForm = (workspace: Workspace) => {
    setCloneData({ source_id: workspace.id, new_name: `${workspace.name} (Clone)` });
    setCloneError("");
    setShowCloneForm(true);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setCreateError("");
            if (!showForm) setShowCloneForm(false);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          {showForm ? (
            <>
              <X size={16} weight="bold" />
              Hủy
            </>
          ) : (
            <>
              <Plus size={16} weight="bold" />
              Tạo Workspace mới
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
            <h2 className="text-lg font-semibold text-gray-900">Tạo Workspace mới</h2>
            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
                <span>{createError}</span>
                <button
                  type="button"
                  onClick={() => setCreateError("")}
                  className="text-red-400 hover:text-red-600 ml-2"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <input
              type="text"
              placeholder="Tên workspace (VD: Sales, Marketing, Customer Support...)"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <textarea
              placeholder="Mô tả workspace (tùy chọn)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
            >
              <Plus size={16} weight="bold" />
              {creating ? "Đang tạo..." : "Tạo Workspace"}
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
            <p className="text-sm text-blue-700">Sao chép cấu hình công cụ (tools) và kỹ năng (skills) sang workspace mới.</p>
            {cloneError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
                <span>{cloneError}</span>
                <button
                  type="button"
                  onClick={() => setCloneError("")}
                  className="text-red-400 hover:text-red-600 ml-2"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <input
              type="text"
              placeholder="Tên workspace mới"
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
                {cloning ? "Đang sao chép..." : "Xác nhận sao chép"}
              </button>
              <button
                type="button"
                onClick={() => setShowCloneForm(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
              >
                Hủy
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
