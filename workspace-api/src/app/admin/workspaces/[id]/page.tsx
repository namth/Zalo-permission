
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash, X, Plus, FloppyDisk, UserMinus, CaretDown, CaretRight, PencilSimple, Check } from '@phosphor-icons/react';
import { ToolGroup, fetchToolGroups, getToolGroupData, createToolGroupData, ToolGroupData, updateToolGroupData, deleteToolGroupData } from '../../tool-groups/api';

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

interface ToolData {
  id: string;
  key: string;
  value: string;
  created_at: string;
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

  const [activeTab, setActiveTab] = useState<'info' | 'groups' | 'tools' | 'users' | 'skills' | 'data'>('info');
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
  const [allSkills, setAllSkills] = useState<Skill[]>([]); // For selection

  // Forms
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [zaloFormData, setZaloFormData] = useState({ thread_id: '', name: '' });
  const [toolIdToAdd, setToolIdToAdd] = useState('');
  const [userIdToAdd, setUserIdToAdd] = useState('');
  const [userRoleToAdd, setUserRoleToAdd] = useState('MEMBER');
  const [skillIdToAdd, setSkillIdToAdd] = useState('');

  // Create User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ zalo_id: '', full_name: '', email: '', phone: '' });

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCurrentUser(data.user);
      });
  }, []);

  const isAdmin = currentUser?.role === 'admin';

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
      if (activeTab === 'tools' || activeTab === 'data') {
        await fetchTools();
        await fetchAllTools();
      }
      if (activeTab === 'users') {
        await fetchUsers();
        await fetchAllUsers();
      }
      if (activeTab === 'skills') {
        await fetchSkills();
        await fetchAllSkills();
      }
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

  const fetchAllSkills = async () => {
    const res = await fetch(`/api/admin/skills?limit=1000`);
    const data = await res.json();
    if (data.success) setAllSkills(data.data || []);
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
    if (!confirm('Remove this tool? All data entries for this tool in this workspace will also be deleted.')) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_id: toolId })
    });
    if ((await res.json()).success) {
      fetchTools();
    }
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

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillIdToAdd) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_id: skillIdToAdd }),
    });
    const data = await res.json();
    if (data.success) {
      setSkillIdToAdd('');
      fetchSkills();
    } else alert(data.error);
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!confirm('Unlink this skill from workspace?')) return;
    const res = await fetch(`/api/admin/workspaces/${workspaceId}/skills?skill_id=${skillId}`, { method: 'DELETE' });
    if ((await res.json()).success) fetchSkills();
  };

  if (activeTab === 'info' && loading && !workspace) return <div>Loading...</div>;

  // Filter tools to show only ones NOT already added
  const availableTools = allTools.filter(at => !tools.find(t => t.key === at.key)); // Matching by key is safer if IDs differ in contexts, but IDs should match

  // Filter users to show only ones NOT already added
  const availableUsers = allUsers.filter(au => !users.find(u => u.id === au.id));

  // Filter skills to show only ones NOT already added
  const availableSkills = allSkills.filter(as => !skills.find(s => s.id === as.id));

  return (
    <div className="space-y-6">
      <Link href="/admin/workspaces" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium">
        <ArrowLeft size={15} weight="bold" />
        Back to Workspaces
      </Link>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">{workspace?.name || 'Workspace Detail'}</h1>
          <p className="text-sm text-gray-500">{workspaceId}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {['info', 'groups', 'users', 'skills', 'data'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 font-medium text-sm focus:outline-none ${activeTab === tab
                ? 'bg-white text-blue-600 border-t-2 border-t-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab === 'data' ? 'Data & Tools' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}

          {/* DATA & TOOLS TAB */}
          {activeTab === 'data' && (
            <WorkspaceDataToolsTab 
              workspaceId={workspaceId} 
              workspaceTools={tools} 
              onToolChange={fetchTools}
              isAdmin={isAdmin}
            />
          )}

          {/* INFO TAB */}
          {activeTab === 'info' && workspace && (
            <form onSubmit={handleUpdateWorkspace} className="max-w-xl space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border rounded disabled:bg-gray-50"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded disabled:bg-gray-50"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              {isAdmin && (
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  <FloppyDisk size={16} weight="bold" />
                  Save Changes
                </button>
              )}
            </form>
          )}

          {/* ZALO GROUPS TAB */}
          {activeTab === 'groups' && (
            <div>
              {isAdmin && (
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
                  <button className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
                    <Plus size={15} weight="bold" />
                    Add
                  </button>
                </form>
              )}
              <div className="space-y-2">
                {zaloGroups.map(g => (
                  <div key={g.id} className="flex justify-between items-center border p-3 rounded">
                    <div>
                      <Link href={`/admin/zalo-groups/${g.id}`} className="font-semibold hover:text-blue-600 hover:underline">
                        {g.name || 'Unnamed'}
                      </Link>
                      <div className="text-xs text-gray-500">{g.thread_id}</div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleRemoveZaloGroup(g.thread_id)} title="Remove group" className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                        <X size={14} weight="bold" />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {zaloGroups.length === 0 && <p className="text-gray-500">No Zalo groups.</p>}
              </div>
            </div>
          )}

          {/* TOOLS TAB */}
          {activeTab === 'tools' && (
            <div>
              {isAdmin && (
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
                  <button disabled={!toolIdToAdd} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition">
                    <Plus size={15} weight="bold" />
                    Add Tool
                  </button>
                </form>
              )}
              <div className="space-y-4">
                {tools.map(t => (
                  <div key={t.id} className="border rounded-lg overflow-hidden">
                    <div className="p-4 flex justify-between items-start bg-white">
                      <div className="flex items-start gap-3 flex-1">
                        <div>
                          <div className="font-bold">{t.name}</div>
                          <div className="text-sm text-gray-600">{t.key}</div>
                          <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                        </div>
                      </div>
                      {isAdmin && (
                        <button onClick={() => handleRemoveTool(t.id)} title="Remove tool" className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                          <X size={14} weight="bold" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {tools.length === 0 && <p className="text-gray-500">No tools linked.</p>}
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div>
              {isAdmin && (
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
                      <button disabled={!userIdToAdd} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition">
                        <Plus size={15} weight="bold" />
                        Add
                      </button>
                    </form>
                  </div>
                  <div className="border-l pl-4 ml-2">
                    <div className="block text-xs font-medium text-gray-500 mb-1">Or Create New</div>
                    <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap">
                      <Plus size={15} weight="bold" />
                      Create User
                    </button>
                  </div>
                </div>
              )}

              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Joined</th>
                    {isAdmin && <th className="pb-2">Action</th>}
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
                      {isAdmin && (
                        <td className="py-3">
                          <button onClick={() => handleRemoveUser(u.id)} title="Remove user" className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                            <UserMinus size={14} weight="bold" />
                            Remove
                          </button>
                        </td>
                      )}
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
                Skills are processes taught by users directly in the Chat interface. You can link and unlink them here.
              </div>

              {isAdmin && (
                <form onSubmit={handleAddSkill} className="flex gap-2 mb-6 p-4 bg-gray-50 rounded">
                  <select
                    className="border px-3 py-2 rounded flex-1"
                    value={skillIdToAdd}
                    onChange={e => setSkillIdToAdd(e.target.value)}
                  >
                    <option value="">-- Select Skill to Add --</option>
                    {availableSkills.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button disabled={!skillIdToAdd} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition">
                    <Plus size={15} weight="bold" />
                    Link Skill
                  </button>
                </form>
              )}

              <div className="space-y-4">
                {skills.map(s => (
                  <div key={s.id} className="p-4 border rounded hover:border-blue-300 transition">
                    <div className="flex justify-between">
                      <h3 className="font-semibold text-lg">{s.name}</h3>
                      {isAdmin && (
                        <button onClick={() => handleRemoveSkill(s.id)} title="Unlink skill" className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                          <X size={14} weight="bold" />
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{s.description || 'No description'}</p>
                    <div className="text-xs text-gray-400 mt-2">Created: {new Date(s.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {skills.length === 0 && <p className="text-center py-8 text-gray-500 bg-gray-50 rounded">No skills linked.</p>}
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

// ---------------------------------------------------------------------------
// WorkspaceDataToolsTab
// ---------------------------------------------------------------------------

interface ToolWithGroup extends Tool {
  group_info?: {
    id: string;
    key: string;
    name: string;
  } | null;
}

function WorkspaceDataToolsTab({ 
  workspaceId, 
  workspaceTools,
  onToolChange,
  isAdmin
}: { 
  workspaceId: string, 
  workspaceTools: Tool[],
  onToolChange: () => void,
  isAdmin: boolean
}) {
  const [allToolGroups, setAllToolGroups] = useState<ToolGroup[]>([]);
  const [allTools, setAllTools] = useState<ToolWithGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [groups, toolsData] = await Promise.all([
        fetchToolGroups(),
        fetch('/api/admin/tools?limit=1000').then(res => res.json())
      ]);
      setAllToolGroups(groups);
      setAllTools(toolsData.data || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading tools and groups...</div>;

  // Group tools by their group ID from Neo4j group_info
  const toolsByGroup = allTools.reduce((acc, tool) => {
    const groupId = tool.group_info?.id || 'common';
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(tool);
    return acc;
  }, {} as Record<string, ToolWithGroup[]>);

  const commonTools = toolsByGroup['common'] || [];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Workspace Data & Tools Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage tools and their configuration data for this workspace.
        </p>
      </div>

      {allToolGroups.map(group => (
        <ToolGroupAccordion 
          key={group.id} 
          group={group} 
          workspaceId={workspaceId}
          toolsInGroup={toolsByGroup[group.id] || []}
          workspaceTools={workspaceTools}
          onToolChange={onToolChange}
          isAdmin={isAdmin}
        />
      ))}

      {/* Common Tools Section */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-md font-semibold text-gray-700 mb-4 px-2">Common Tools (No Group)</h3>
        {commonTools.length === 0 ? (
          <p className="text-sm text-gray-400 italic px-2">No common tools available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commonTools.map(tool => (
              <ToolCard 
                key={tool.id} 
                tool={tool} 
                workspaceId={workspaceId}
                isAdded={workspaceTools.some(t => String(t.id) === String(tool.id))}
                onToolChange={onToolChange}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolGroupAccordion({ 
  group, 
  workspaceId, 
  toolsInGroup, 
  workspaceTools,
  onToolChange,
  isAdmin
}: { 
  group: ToolGroup, 
  workspaceId: string, 
  toolsInGroup: ToolWithGroup[],
  workspaceTools: Tool[],
  onToolChange: () => void,
  isAdmin: boolean
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<ToolGroupData[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  const [showAddData, setShowAddData] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const items = await getToolGroupData(group.id, workspaceId);
      setData(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addKey.trim() || !addValue.trim()) return;
    try {
      setAddLoading(true);
      await createToolGroupData(group.id, addKey.trim(), addValue.trim(), workspaceId);
      await loadData();
      setAddKey('');
      setAddValue('');
      setShowAddData(false);
    } catch (err) {
      alert('Failed to add data');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteData = async (dataId: string) => {
    if (!confirm('Delete this data entry?')) return;
    try {
      await deleteToolGroupData(group.id, dataId);
      await loadData();
    } catch (err) {
      alert('Failed to delete data');
    }
  };

  const startEdit = (item: ToolGroupData) => {
    setEditingId(item.id);
    setEditKey(item.key);
    setEditValue(item.value);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditKey('');
    setEditValue('');
  };

  const handleUpdateData = async (dataId: string) => {
    if (!editKey.trim() || !editValue.trim()) return;
    try {
      setEditLoading(true);
      await updateToolGroupData(group.id, dataId, editKey.trim(), editValue.trim());
      await loadData();
      cancelEdit();
    } catch (err) {
      alert('Failed to update data');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            {isOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
          </div>
          <div>
            <span className="font-semibold text-gray-900">{group.name}</span>
            <span className="ml-2 text-xs font-mono text-gray-400">{group.key}</span>
          </div>
        </div>
        <div className="text-xs text-gray-400 capitalize">{group.status}</div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4 bg-gray-50/30">
          {/* Tools Selection in this group */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Tools in this Group</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {toolsInGroup.map(tool => (
                <ToolCard 
                  key={tool.id} 
                  tool={tool} 
                  workspaceId={workspaceId}
                  isAdded={workspaceTools.some(t => String(t.id) === String(tool.id))}
                  onToolChange={onToolChange}
                  isAdmin={isAdmin}
                />
              ))}
              {toolsInGroup.length === 0 && (
                <p className="text-xs text-gray-400 italic">No tools assigned to this group.</p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700">Group Configuration Data</h4>
            {isAdmin && (
              <button 
                onClick={() => setShowAddData(!showAddData)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus size={12} weight="bold" />
                {showAddData ? 'Cancel' : 'Add Data'}
              </button>
            )}
          </div>

          {showAddData && (
            <form onSubmit={handleAddData} className="mb-4 p-4 bg-white border border-blue-100 rounded-lg shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  placeholder="Key" 
                  className="px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={addKey}
                  onChange={e => setAddKey(e.target.value)}
                  disabled={addLoading}
                />
                <input 
                  placeholder="Value" 
                  className="px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={addValue}
                  onChange={e => setAddValue(e.target.value)}
                  disabled={addLoading}
                />
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={addLoading || !addKey || !addValue}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addLoading ? 'Saving...' : 'Save Data'}
                </button>
              </div>
            </form>
          )}

          {loadingData ? (
            <div className="text-center py-4 text-xs text-gray-400">Loading data...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 italic">No data entries for this group in this workspace.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Key</th>
                  <th className="px-3 py-2 text-left font-semibold">Value</th>
                  {isAdmin && <th className="px-3 py-2 text-right font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {editingId === item.id ? (
                        <input 
                          className="w-full px-2 py-1 border rounded"
                          value={editKey}
                          onChange={e => setEditKey(e.target.value)}
                          disabled={editLoading}
                        />
                      ) : item.key}
                    </td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">
                      {editingId === item.id ? (
                        <input 
                          className="w-full px-2 py-1 border rounded"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          disabled={editLoading}
                        />
                      ) : item.value}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {editingId === item.id ? (
                            <>
                              <button 
                                onClick={() => handleUpdateData(item.id)}
                                disabled={editLoading}
                                className="text-green-600 hover:text-green-800 transition"
                                title="Save"
                              >
                                <Check size={14} weight="bold" />
                              </button>
                              <button 
                                onClick={cancelEdit}
                                disabled={editLoading}
                                className="text-gray-400 hover:text-gray-600 transition"
                                title="Cancel"
                              >
                                <X size={14} weight="bold" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => startEdit(item)}
                                className="text-blue-500 hover:text-blue-700 transition"
                                title="Edit"
                              >
                                <PencilSimple size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteData(item.id)}
                                className="text-red-500 hover:text-red-700 transition"
                                title="Delete"
                              >
                                <Trash size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCard({ 
  tool, 
  workspaceId, 
  isAdded, 
  onToolChange,
  isAdmin
}: { 
  tool: Tool, 
  workspaceId: string, 
  isAdded: boolean, 
  onToolChange: () => void,
  isAdmin: boolean
}) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    try {
      setLoading(true);
      if (isAdded) {
        if (!confirm(`Remove "${tool.name}" from workspace?`)) return;
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id })
        });
        if (!(await res.json()).success) {
          throw new Error('Failed to remove tool');
        }
      } else {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id })
        });
        const resData = await res.json();
        if (!resData.success) {
          throw new Error(resData.error || 'Failed to add tool');
        }
      }
      onToolChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-3 rounded-lg border transition flex items-center justify-between ${
      isAdded ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
    }`}>
      <div>
        <div className="text-sm font-semibold text-gray-900">{tool.name}</div>
        <div className="text-[10px] font-mono text-gray-400">{tool.key}</div>
      </div>
      {isAdmin && (
        <button 
          onClick={handleToggle}
          disabled={loading}
          className={`px-2 py-1 rounded text-[10px] font-bold transition ${
            isAdded 
              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {loading ? '...' : (isAdded ? 'REMOVE' : 'ADD')}
        </button>
      )}
    </div>
  );
}
