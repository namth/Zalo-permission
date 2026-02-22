
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Workspace {
  id: string;
  name: string;
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

interface Tool {
  id: string;
  key: string;
  name: string;
  description?: string;
}

interface User {
  id: string;
  full_name: string;
  zalo_id: string;
  role: string;
  joined_at: string;
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.id as string;

  const [activeTab, setActiveTab] = useState<'info' | 'groups' | 'tools' | 'users' | 'skills'>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [zaloGroups, setZaloGroups] = useState<ZaloGroup[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Selection Data
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // For selection

  // Forms
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [zaloFormData, setZaloFormData] = useState({ thread_id: '', name: '' });
  const [toolIdToAdd, setToolIdToAdd] = useState('');
  const [userIdToAdd, setUserIdToAdd] = useState('');
  const [userRoleToAdd, setUserRoleToAdd] = useState('MEMBER');

  // Create User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ zalo_id: '', full_name: '', email: '', phone: '' });

  useEffect(() => {
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'info') await fetchWorkspace();
      if (activeTab === 'groups') await fetchZaloGroups();
      if (activeTab === 'tools') {
        await fetchTools();
        await fetchAllTools();
      }
      if (activeTab === 'users') {
        await fetchUsers();
        await fetchAllUsers();
      }
      if (activeTab === 'skills') await fetchSkills();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // --- Fetchers ---
  const fetchWorkspace = async () => {
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`);
    const data = await res.json();
    if (data.success) {
      setWorkspace(data.data);
      setFormData({ name: data.data.name, description: data.data.description || '' });
    }
  };

  const fetchZaloGroups = async () => {
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/zalo-groups`);
    const data = await res.json();
    if (data.success) setZaloGroups(data.data || []);
  };

  const fetchTools = async () => {
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`);
    const data = await res.json();
    if (data.success) setTools(data.data || []);
  };

  const fetchAllTools = async () => {
    const res = await fetch(`/api/admin/tools?status=active`);
    const data = await res.json();
    if (data.success) setAllTools(data.data || []);
  }

  const fetchUsers = async () => {
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/users`);
    const data = await res.json();
    if (data.success) setUsers(data.data || []);
  };

  const fetchAllUsers = async () => {
    const res = await fetch(`/api/admin/users?limit=1000`); // Simple fetch all for dropdown
    const data = await res.json();
    if (data.success) setAllUsers(data.data || []);
  }

  const fetchSkills = async () => {
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/skills`);
    const data = await res.json();
    if (data.success) setSkills(data.data || []);
  };

  // --- Actions ---

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (data.success) {
      setWorkspace(data.data);
      alert('Workspace updated');
    } else setError(data.error);
  };

  const handleAddZaloGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/zalo-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zaloFormData),
    });
    const data = await res.json();
    if (data.success) {
      setZaloFormData({ thread_id: '', name: '' });
      fetchZaloGroups();
    } else alert(data.error);
  };

  const handleRemoveZaloGroup = async (threadId: string) => {
    if (!confirm('Remove this group?')) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/zalo-groups?thread_id=${threadId}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchZaloGroups();
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolIdToAdd) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_id: toolIdToAdd }),
    });
    const data = await res.json();
    if (data.success) {
      setToolIdToAdd('');
      fetchTools();
    } else alert(data.error);
  };

  const handleRemoveTool = async (toolId: string) => {
    if (!confirm('Remove this tool? (Unlink from workspace)')) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_id: toolId })
    });
    if ((await res.json()).success) fetchTools();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdToAdd) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userIdToAdd, role: userRoleToAdd }),
    });
    const data = await res.json();
    if (data.success) {
      setUserIdToAdd('');
      fetchUsers();
    } else alert(data.error);
  };

  const handleCreateUser = async () => {
    try {
      // 1. Create user
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      const createdUser = data.data;

      // 2. Add to workspace
      const linkRes = await fetch(`/api/admin/workspaces/${workspaceId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: createdUser.id, role: 'MEMBER' }),
      });
      const linkData = await linkRes.json();
      if (linkData.success) {
        alert('User created and linked to workspace');
        setShowCreateUser(false);
        setNewUser({ zalo_id: '', full_name: '', email: '', phone: '' });
        fetchUsers();
        fetchAllUsers(); // refresh dropdown
      } else {
        alert('User created but failed to link: ' + linkData.error);
      }
    } catch (err) {
      alert('Failed to create user: ' + String(err));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Remove this user from workspace?')) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/users?user_id=${userId}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchUsers();
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('Delete this skill permanently?')) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/skills?skill_id=${skillId}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchSkills();
  };

  if (activeTab === 'info' && loading && !workspace) return <div>Loading...</div>;

  // Filter tools to show only ones NOT already added
  const availableTools = allTools.filter(at => !tools.find(t => t.key === at.key)); // Matching by key is safer if IDs differ in contexts, but IDs should match

  // Filter users to show only ones NOT already added
  const availableUsers = allUsers.filter(au => !users.find(u => u.id === au.id));

  return (
    <div className="space-y-6">
      <Link href="/admin/workspaces" className="text-blue-600 hover:text-blue-800">
        ← Back to Workspaces
      </Link>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">{workspace?.name || 'Workspace Detail'}</h1>
          <p className="text-sm text-gray-500">{workspaceId}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {['info', 'groups', 'tools', 'users', 'skills'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${activeTab === tab
                ? 'bg-white text-blue-600 border-t-2 border-t-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}

          {/* INFO TAB */}
          {activeTab === 'info' && workspace && (
            <form onSubmit={handleUpdateWorkspace} className="max-w-xl space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
            </form>
          )}

          {/* ZALO GROUPS TAB */}
          {activeTab === 'groups' && (
            <div>
              <form onSubmit={handleAddZaloGroup} className="flex gap-2 mb-6 p-4 bg-gray-50 rounded">
                <input
                  placeholder="Thread ID"
                  className="border px-3 py-2 rounded flex-1"
                  value={zaloFormData.thread_id}
                  onChange={e => setZaloFormData({ ...zaloFormData, thread_id: e.target.value })}
                  required
                />
                <input
                  placeholder="Name"
                  className="border px-3 py-2 rounded flex-1"
                  value={zaloFormData.name}
                  onChange={e => setZaloFormData({ ...zaloFormData, name: e.target.value })}
                />
                <button className="bg-green-600 text-white px-4 py-2 rounded">+ Add</button>
              </form>
              <div className="space-y-2">
                {zaloGroups.map(g => (
                  <div key={g.id} className="flex justify-between items-center border p-3 rounded">
                    <div>
                      <Link href={`/admin/zalo-groups/${g.id}`} className="font-semibold hover:text-blue-600 hover:underline">
                        {g.name || 'Unnamed'}
                      </Link>
                      <div className="text-xs text-gray-500">{g.thread_id}</div>
                    </div>
                    <button onClick={() => handleRemoveZaloGroup(g.thread_id)} className="text-red-600 hover:underline">Remove</button>
                  </div>
                ))}
                {zaloGroups.length === 0 && <p className="text-gray-500">No Zalo groups.</p>}
              </div>
            </div>
          )}

          {/* TOOLS TAB */}
          {activeTab === 'tools' && (
            <div>
              <form onSubmit={handleAddTool} className="flex gap-2 mb-6 p-4 bg-gray-50 rounded">
                <select
                  className="border px-3 py-2 rounded flex-1"
                  value={toolIdToAdd}
                  onChange={e => setToolIdToAdd(e.target.value)}
                >
                  <option value="">-- Select Tool to Add --</option>
                  {availableTools.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.key})</option>
                  ))}
                </select>
                <button disabled={!toolIdToAdd} className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400">+ Add Tool</button>
              </form>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map(t => (
                  <div key={t.id} className="border p-4 rounded flex justify-between items-start">
                    <div>
                      <div className="font-bold">{t.name}</div>
                      <div className="text-sm text-gray-600">{t.key}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                    </div>
                    <button onClick={() => handleRemoveTool(t.id)} className="text-red-600 text-sm hover:underline">Remove</button>
                  </div>
                ))}
                {tools.length === 0 && <p className="text-gray-500 col-span-2">No tools linked.</p>}
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div>
              <div className="flex gap-2 mb-6 p-4 bg-gray-50 rounded items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Add Existing User</label>
                  <form onSubmit={handleAddUser} className="flex gap-2">
                    <select
                      className="border px-3 py-2 rounded flex-1"
                      value={userIdToAdd}
                      onChange={e => setUserIdToAdd(e.target.value)}
                    >
                      <option value="">-- Select User --</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.zalo_id})</option>
                      ))}
                    </select>
                    <select
                      className="border px-3 py-2 rounded w-32"
                      value={userRoleToAdd}
                      onChange={e => setUserRoleToAdd(e.target.value)}
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button disabled={!userIdToAdd} className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400">+ Add</button>
                  </form>
                </div>
                <div className="border-l pl-4 ml-2">
                  <div className="block text-xs font-medium text-gray-500 mb-1">Or Create New</div>
                  <button onClick={() => setShowCreateUser(true)} className="bg-blue-600 text-white px-4 py-2 rounded whitespace-nowrap">Create User</button>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Joined</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <div className="font-medium">{u.full_name}</div>
                        <div className="text-xs text-gray-400">{u.zalo_id}</div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-500">{new Date(u.joined_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <button onClick={() => handleRemoveUser(u.id)} className="text-red-600 hover:underline text-sm">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className="text-center py-4 text-gray-500">No users in this workspace.</p>}
            </div>
          )}

          {/* SKILLS TAB */}
          {activeTab === 'skills' && (
            <div>
              <div className="mb-4 text-sm text-gray-500">
                Skills are processes taught by users directly in the Chat interface. You can view and manage them here.
              </div>
              <div className="space-y-4">
                {skills.map(s => (
                  <div key={s.id} className="p-4 border rounded hover:border-blue-300 transition">
                    <div className="flex justify-between">
                      <h3 className="font-semibold text-lg">{s.name}</h3>
                      <button onClick={() => handleDeleteSkill(s.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                    </div>
                    <p className="text-gray-600 mt-1">{s.description || 'No description'}</p>
                    <div className="text-xs text-gray-400 mt-2">Created: {new Date(s.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {skills.length === 0 && <p className="text-center py-8 text-gray-500 bg-gray-50 rounded">No skills found.</p>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Create & Link User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zalo ID *</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={newUser.zalo_id}
                  onChange={e => setNewUser({ ...newUser, zalo_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={newUser.full_name}
                  onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={newUser.phone}
                  onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreateUser(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button onClick={handleCreateUser} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create & Link</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
