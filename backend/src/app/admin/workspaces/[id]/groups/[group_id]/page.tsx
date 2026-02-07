"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface User {
  id: string;
  zalo_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  gender?: string;
  status: string;
}

interface Agent {
  key: string;
  name: string;
  description?: string;
}

interface AssignedAgent {
  key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface RemoveConfirm {
  userId: string;
  userName: string;
}

interface AddAgentConfirm {
  agentKey: string;
  agentName: string;
}

export default function GroupDetailPage() {
  const params = useParams();
  const workspace_id = params.id as string;
  const group_id = params.group_id as string;

  const [users, setUsers] = useState<User[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<AssignedAgent | null>(
    null,
  );
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("members");
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirm | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [addingAgent, setAddingAgent] = useState(false);
  const [removingAgent, setRemovingAgent] = useState(false);

  useEffect(() => {
    fetchData();
  }, [group_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, agentsRes, groupAgentRes] = await Promise.all([
        fetch(`/api/workspace/groups/${group_id}/users`),
        fetch(`/api/agents`),
        fetch(`/api/workspace/groups/${group_id}/agents`),
      ]);

      const usersData = await usersRes.json();
      const agentsData = await agentsRes.json();
      const groupAgentData = await groupAgentRes.json();

      if (usersData.success) {
        setUsers(usersData.data.users || []);
      } else {
        setError(usersData.error || "Failed to fetch users");
      }

      if (agentsData.success) {
        setAllAgents(agentsData.data || []);
      }

      if (groupAgentData.success) {
        setAssignedAgent(groupAgentData.data || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!removeConfirm) return;

    try {
      setRemoving(true);
      const response = await fetch(`/api/workspace/groups/${group_id}/user`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: removeConfirm.userId,
          workspace_id: workspace_id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setUsers(users.filter((u) => u.id !== removeConfirm.userId));
        setError(null);
      } else {
        setError(data.error || "Failed to remove user");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error removing user");
    } finally {
      setRemoving(false);
      setRemoveConfirm(null);
    }
  };

  const handleAddAgent = async () => {
    if (!selectedAgent) {
      setError("Please select an agent");
      return;
    }

    try {
      setAddingAgent(true);
      const response = await fetch(`/api/workspace/groups/${group_id}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_key: selectedAgent,
        }),
      });

      const data = await response.json();

      if (data.success) {
        fetchData();
        setSelectedAgent("");
        setShowAddAgent(false);
        setError(null);
      } else {
        setError(data.error || "Failed to add agent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding agent");
    } finally {
      setAddingAgent(false);
    }
  };

  const handleRemoveAgent = async () => {
    if (!assignedAgent) return;

    try {
      setRemovingAgent(true);
      const response = await fetch(`/api/workspace/groups/${group_id}/agents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        setAssignedAgent(null);
        setError(null);
      } else {
        setError(data.error || "Failed to remove agent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error removing agent");
    } finally {
      setRemovingAgent(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/admin/workspaces/${workspace_id}`}
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Back to Workspace
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Group Members</h1>
        <p className="text-gray-600 mt-2">
          Manage members and agents for this Zalo group
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === "members"
              ? "text-blue-600 border-blue-600"
              : "text-gray-600 border-transparent hover:text-gray-900"
          }`}
        >
          Members
        </button>
        <button
          onClick={() => setActiveTab("agents")}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === "agents"
              ? "text-blue-600 border-blue-600"
              : "text-gray-600 border-transparent hover:text-gray-900"
          }`}
        >
          Agents
        </button>
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No members in this group
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
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Giới tính
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Actions
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
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.phone || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.gender || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            user.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() =>
                            setRemoveConfirm({
                              userId: user.id,
                              userName: user.full_name,
                            })
                          }
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          {assignedAgent ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Assigned Agent
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    This group is currently using this agent
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Agent Name
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {assignedAgent.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Agent Key
                    </label>
                    <p className="text-lg font-mono text-gray-600 mt-1">
                      {assignedAgent.key}
                    </p>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Description
                  </label>
                  <p className="text-gray-600 mt-1">
                    {assignedAgent.description || "No description"}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Created At
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(assignedAgent.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Updated At
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(assignedAgent.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAddAgent(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Change Agent
                </button>
                <button
                  onClick={handleRemoveAgent}
                  disabled={removingAgent}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                >
                  {removingAgent ? "Removing..." : "Remove Agent"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-900 font-medium mb-4">
                No agent assigned to this group
              </p>
              <button
                onClick={() => setShowAddAgent(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Assign Agent
              </button>
            </div>
          )}

          {showAddAgent && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {assignedAgent ? "Change Agent" : "Assign Agent"}
                </h3>
                <button
                  onClick={() => setShowAddAgent(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Agent
                  </label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose an agent...</option>
                    {allAgents.map((agent) => (
                      <option key={agent.key} value={agent.key}>
                        {agent.name} ({agent.key})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleAddAgent}
                    disabled={addingAgent || !selectedAgent}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {addingAgent ? "Assigning..." : "Assign Agent"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddAgent(false);
                      setSelectedAgent("");
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Remove Member
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove{" "}
              <strong>{removeConfirm.userName}</strong> from this group?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemoveConfirm(null)}
                disabled={removing}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveUser}
                disabled={removing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
