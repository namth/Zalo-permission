"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Workspace {
  id: string;
  name: string;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ZaloGroup {
  id: string;
  thread_id: string;
  name?: string;
  created_at: string;
}

interface User {
  id: string;
  zalo_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
}

interface Account {
  id: string;
  workspace_id: string;
  type: string;
  reference_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const workspace_id = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [groups, setGroups] = useState<ZaloGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("groups");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ thread_id: "", name: "" });
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({
    type: "",
    reference_id: "",
  });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workspace_id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [wsRes, groupsRes, usersRes, accountsRes] = await Promise.all([
        fetch(`/api/admin/workspaces/${workspace_id}`),
        fetch(`/api/admin/workspaces/${workspace_id}/groups`),
        fetch(`/api/admin/workspaces/${workspace_id}/users`),
        fetch(`/api/admin/workspaces/${workspace_id}/accounts`),
      ]);

      const wsData = await wsRes.json();
      const groupsData = await groupsRes.json();
      const usersData = await usersRes.json();
      const accountsData = await accountsRes.json();

      if (wsData.success) setWorkspace(wsData.data);
      if (groupsData.success) setGroups(groupsData.data);
      if (usersData.success) setUsers(usersData.data);
      if (accountsData.success) setAccounts(accountsData.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error fetching workspace data",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspace_id}/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupForm),
        },
      );

      const data = await response.json();

      if (data.success) {
        setGroupForm({ thread_id: "", name: "" });
        setShowAddGroup(false);
        fetchData();
      } else {
        setError(data.error || "Failed to add group");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding group");
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspace_id}/accounts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountForm),
        },
      );

      const data = await response.json();

      if (data.success) {
        setAccountForm({ type: "", reference_id: "" });
        setShowAddAccount(false);
        fetchData();
      } else {
        setError(data.error || "Failed to add account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding account");
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAccountId) return;

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspace_id}/accounts/${editingAccountId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountForm),
        },
      );

      const data = await response.json();

      if (data.success) {
        setAccountForm({ type: "", reference_id: "" });
        setEditingAccountId(null);
        fetchData();
      } else {
        setError(data.error || "Failed to update account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating account");
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!window.confirm("Are you sure you want to delete this account?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspace_id}/accounts/${accountId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        setError(data.error || "Failed to delete account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting account");
    }
  };

  const startEditAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setAccountForm({
      type: account.type,
      reference_id: account.reference_id || "",
    });
    setShowAddAccount(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!workspace) {
    return (
      <div className="text-center py-8 text-red-600">Workspace not found</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/workspaces"
            className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Back to Workspaces
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{workspace.name}</h1>
          <p className="text-gray-600 mt-2">{workspace.description}</p>
        </div>
        <span
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            workspace.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {workspace.status}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("groups")}
            className={`py-4 px-2 font-medium border-b-2 ${
              activeTab === "groups"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Zalo Groups ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`py-4 px-2 font-medium border-b-2 ${
              activeTab === "users"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`py-4 px-2 font-medium border-b-2 ${
              activeTab === "accounts"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Accounts ({accounts.length})
          </button>
        </div>
      </div>

      {/* Groups Tab */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          <button
            onClick={() => setShowAddGroup(!showAddGroup)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {showAddGroup ? "✕ Cancel" : "+ Add Zalo Group"}
          </button>

          {showAddGroup && (
            <form
              onSubmit={handleAddGroup}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thread ID
                  </label>
                  <input
                    type="text"
                    required
                    value={groupForm.thread_id}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, thread_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., group-123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Engineering Team"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Add Group
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {groups.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No Zalo groups found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Thread ID
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {groups.map((group) => (
                      <tr key={group.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">
                          {group.thread_id}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {group.name || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(group.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No users found in this workspace
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Zalo ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {user.zalo_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.email || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {user.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setEditingAccountId(null);
              setAccountForm({ type: "", reference_id: "" });
              setShowAddAccount(!showAddAccount);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {showAddAccount ? "✕ Cancel" : "+ Add Account"}
          </button>

          {showAddAccount && (
            <form
              onSubmit={
                editingAccountId ? handleUpdateAccount : handleAddAccount
              }
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.type}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., hosting, finance, task"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountForm.reference_id}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        reference_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., external system ID"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingAccountId ? "Update Account" : "Add Account"}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {accounts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No accounts found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Reference ID
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Updated
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">
                          {account.type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {account.reference_id || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(account.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(account.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button
                            onClick={() => startEditAccount(account)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
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
        </div>
      )}
    </div>
  );
}
