
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Trash, X, Plus, FloppyDisk, UserMinus, CaretDown, CaretRight,
  PencilSimple, Check, TelegramLogo, ChatCircleDots, ArrowClockwise, Users,
  CheckCircle, Eye, EyeSlash, Key, Lock, Sliders, Wrench, Sparkle, Globe,
  Copy, MagnifyingGlass, Info, ShieldCheck
} from '@phosphor-icons/react';
import { ToolGroup, fetchToolGroups, getToolGroupData, createToolGroupData, ToolGroupData, updateToolGroupData, deleteToolGroupData } from '../../tool-groups/api';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ChannelAccountOption {
  id: string;
  platform: 'TELEGRAM' | 'ZALO';
  account_name: string;
  status: string;
}

interface DiscoveredGroupItem {
  id: string;
  title: string;
  avatar?: string | null;
  members_count: number;
  platform: 'ZALO' | 'TELEGRAM';
}

interface WorkspaceChannelChat {
  id: string;
  account_id: string;
  account_name: string;
  platform: 'TELEGRAM' | 'ZALO';
  platform_chat_id: string;
  title: string;
  chat_type: string;
  is_active: boolean;
  always_respond?: boolean;
  created_at: string;
}

interface AvailableChannelChat {
  id: string;
  account_id: string;
  account_name: string;
  platform: 'TELEGRAM' | 'ZALO';
  platform_chat_id: string;
  title: string;
  chat_type: string;
  is_active: boolean;
  workspace_id: string | null;
  workspace_name: string | null;
  is_assigned_to_current: boolean;
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

  const [activeTab, setActiveTab] = useState<'info' | 'groups' | 'tools' | 'skills' | 'users'>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channelChats, setChannelChats] = useState<WorkspaceChannelChat[]>([]);
  const [availableChats, setAvailableChats] = useState<AvailableChannelChat[]>([]);
  const [chatIdToAssign, setChatIdToAssign] = useState('');
  const [assigningChat, setAssigningChat] = useState(false);
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

  // Add Chat Modal (Discover Zalo / Telegram)
  const [channelAccounts, setChannelAccounts] = useState<ChannelAccountOption[]>([]);
  const [isAddChatModalOpen, setIsAddChatModalOpen] = useState(false);
  const [selectedModalAccountId, setSelectedModalAccountId] = useState('');
  const [scanningGroups, setScanningGroups] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanError, setScanError] = useState('');
  const [discoveredGroups, setDiscoveredGroups] = useState<DiscoveredGroupItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [addingGroups, setAddingGroups] = useState(false);
  const [telegramTitle, setTelegramTitle] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

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
      if (activeTab === 'groups') {
        await Promise.all([
          fetchChannelChats(),
          fetchAvailableChats(),
          fetchChannelAccounts(),
          fetchZaloGroups(),
        ]);
      }
      if (activeTab === 'tools') {
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

  const fetchChannelChats = async () => {
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel-chats`);
      const data = await res.json();
      if (data.success) setChannelChats(data.data || []);
    } catch (err) {
      console.error('Error fetching channel chats:', err);
    }
  };

  const fetchAvailableChats = async () => {
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel-chats?available=true`);
      const data = await res.json();
      if (data.success) setAvailableChats(data.data || []);
    } catch (err) {
      console.error('Error fetching available chats:', err);
    }
  };

  const fetchChannelAccounts = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        setChannelAccounts(data.data || []);
        if (data.data && data.data.length > 0 && !selectedModalAccountId) {
          setSelectedModalAccountId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching channel accounts:', err);
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

  const handleAssignChannelChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatIdToAssign) return;
    setAssigningChat(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel-chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatIdToAssign }),
      });
      const data = await res.json();
      if (data.success) {
        setChatIdToAssign('');
        await Promise.all([fetchChannelChats(), fetchAvailableChats()]);
      } else {
        alert(data.error || 'Không thể gán nhóm chat vào workspace');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setAssigningChat(false);
    }
  };

  const handleRemoveChannelChat = async (chatId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn gỡ nhóm chat "${title}" khỏi Workspace này không?`)) return;
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel-chats?chat_id=${chatId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchChannelChats(), fetchAvailableChats()]);
      } else {
        alert(data.error || 'Không thể gỡ nhóm chat khỏi workspace');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    }
  };

  const [updatingChatId, setUpdatingChatId] = useState<string | null>(null);

  const handleToggleAlwaysRespond = async (chatId: string, nextValue: boolean) => {
    try {
      setUpdatingChatId(chatId);
      // Optimistic update
      setChannelChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, always_respond: nextValue } : c))
      );

      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel-chats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          always_respond: nextValue,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        // Rollback
        setChannelChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, always_respond: !nextValue } : c))
        );
        alert(data.error || 'Không thể cập nhật cấu hình nhóm chat');
      }
    } catch (err: any) {
      console.error('Error toggling always_respond:', err);
      // Rollback
      setChannelChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, always_respond: !nextValue } : c))
      );
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setUpdatingChatId(null);
    }
  };

  const handleOpenAddChatModal = () => {
    setIsAddChatModalOpen(true);
    setScanError('');
    setHasScanned(false);
    setDiscoveredGroups([]);
    setSelectedGroupIds([]);
    setTelegramTitle('');
    setTelegramChatId('');
    if (channelAccounts.length > 0 && !selectedModalAccountId) {
      setSelectedModalAccountId(channelAccounts[0].id);
    }
  };

  const handleScanGroups = async () => {
    if (!selectedModalAccountId) return;
    setScanningGroups(true);
    setScanError('');
    setHasScanned(false);
    setDiscoveredGroups([]);
    setSelectedGroupIds([]);
    try {
      const res = await fetch(`/api/channels/${selectedModalAccountId}/discover-groups`);
      const data = await res.json();
      if (data.success) {
        setDiscoveredGroups(data.data || []);
        setHasScanned(true);
      } else {
        setScanError(data.error || 'Quét nhóm chat thất bại');
      }
    } catch (err: any) {
      setScanError(err.message || 'Lỗi kết nối khi quét nhóm chat');
    } finally {
      setScanningGroups(false);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedGroupIds.length === discoveredGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(discoveredGroups.map((g) => g.id));
    }
  };

  const handleAddDiscoveredGroups = async () => {
    const selectedAccount = channelAccounts.find((a) => a.id === selectedModalAccountId);
    if (!selectedAccount) return;

    let chatsToAdd: Array<{ platform_chat_id: string; title: string; chat_type: string }> = [];

    if (selectedAccount.platform === 'ZALO') {
      if (selectedGroupIds.length === 0) {
        alert('Vui lòng chọn ít nhất một nhóm chat để thêm');
        return;
      }
      const selectedGroups = discoveredGroups.filter((g) => selectedGroupIds.includes(g.id));
      chatsToAdd = selectedGroups.map((g) => ({
        platform_chat_id: g.id,
        title: g.title,
        chat_type: 'GROUP',
      }));
    } else if (selectedAccount.platform === 'TELEGRAM') {
      if (telegramChatId.trim() && telegramTitle.trim()) {
        chatsToAdd.push({
          platform_chat_id: telegramChatId.trim(),
          title: telegramTitle.trim(),
          chat_type: 'GROUP',
        });
      }
      if (selectedGroupIds.length > 0) {
        const selectedGroups = discoveredGroups.filter((g) => selectedGroupIds.includes(g.id));
        for (const g of selectedGroups) {
          if (!chatsToAdd.find((c) => c.platform_chat_id === g.id)) {
            chatsToAdd.push({
              platform_chat_id: g.id,
              title: g.title,
              chat_type: 'GROUP',
            });
          }
        }
      }
      if (chatsToAdd.length === 0) {
        alert('Vui lòng nhập ID nhóm Telegram hoặc chọn nhóm từ danh sách');
        return;
      }
    }

    setAddingGroups(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel-chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccount.id,
          chats: chatsToAdd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddChatModalOpen(false);
        setSelectedGroupIds([]);
        setDiscoveredGroups([]);
        setHasScanned(false);
        setTelegramTitle('');
        setTelegramChatId('');
        await Promise.all([fetchChannelChats(), fetchAvailableChats()]);
      } else {
        alert(data.error || 'Không thể thêm nhóm chat vào workspace');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setAddingGroups(false);
    }
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
      <Link href="/admin/workspaces" className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
        <ArrowLeft size={16} weight="bold" />
        Quay lại Danh sách Workspace
      </Link>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">{workspace?.name || 'Workspace Detail'}</h1>
          <p className="text-sm text-gray-500">{workspaceId}</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b bg-gray-50/80 px-4 overflow-x-auto gap-1">
          {[
            { id: 'info', label: 'Thông tin chung', icon: Info },
            { id: 'groups', label: 'Kênh & Nhóm Chat', icon: ChatCircleDots, count: channelChats.length },
            { id: 'tools', label: 'Công cụ & Biến tùy biến', icon: Wrench, count: tools.length },
            { id: 'skills', label: 'Kỹ năng (Skills)', icon: Sparkle, count: skills.length },
            { id: 'users', label: 'Thành viên & Quyền', icon: Users, count: users.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3.5 font-medium text-xs sm:text-sm transition-all border-b-2 -mb-px whitespace-nowrap focus:outline-none ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-white font-semibold shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/70'
                }`}
              >
                <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200/70 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}

          {/* TOOLS & SCOPED CREDENTIALS TAB */}
          {activeTab === 'tools' && (
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
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition">
                  <FloppyDisk size={16} weight="bold" />
                  Lưu Thay Đổi
                </button>
              )}
            </form>
          )}

          {/* CHANNEL CHATS & GROUPS TAB */}
          {activeTab === 'groups' && (
            <div className="space-y-8">
              {/* Modern Channel Chats (Telegram & Zalo) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <ChatCircleDots size={20} className="text-indigo-600" />
                      Kênh & Nhóm Chat Đã Gán ({channelChats.length})
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Các nhóm chat thuộc Telegram Bot hoặc Zalo được định tuyến trực tiếp vào Workspace này.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleOpenAddChatModal}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        <Plus size={16} weight="bold" />
                        <span>Thêm Nhóm Chat</span>
                      </button>
                    )}
                    <Link
                      href="/admin/channels"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                    >
                      Kênh Liên Lạc →
                    </Link>
                  </div>
                </div>

                {isAdmin && availableChats.filter((c) => !c.is_assigned_to_current).length > 0 && (
                  <form onSubmit={handleAssignChannelChat} className="flex flex-col sm:flex-row gap-2 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <select
                      className="border border-indigo-200 px-3 py-2 rounded-lg text-xs flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={chatIdToAssign}
                      onChange={(e) => setChatIdToAssign(e.target.value)}
                    >
                      <option value="">-- Hoặc chọn nhóm chat có sẵn từ kênh liên lạc để gán vào Workspace --</option>
                      {availableChats
                        .filter((c) => !c.is_assigned_to_current)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            [{c.platform}] {c.title} (ID: {c.platform_chat_id}) - Kênh: {c.account_name}
                            {c.workspace_name ? ` (Hiện tại: ${c.workspace_name})` : ' (Chưa gán)'}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!chatIdToAssign || assigningChat}
                      className="flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      <Plus size={15} weight="bold" />
                      <span>{assigningChat ? 'Đang gán...' : 'Gán vào Workspace'}</span>
                    </button>
                  </form>
                )}

                {/* Tip banner for Group Chat responsiveness */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                  <span className="text-base">💡</span>
                  <div>
                    <p className="font-semibold">Cơ chế phản hồi trong nhóm chat:</p>
                    <p className="text-indigo-800 text-[11px] mt-0.5 leading-relaxed">
                      • <strong>Mặc định (Chế độ Tiêu chuẩn):</strong> Bot chỉ trả lời khi được gọi tên (<em>@Thảo Chi</em>, <em>Chi ơi...</em>) và duy trì phiên hoạt động 10 phút.<br/>
                      • <strong>Bật công tắc "Luôn trả lời":</strong> Bot sẽ chủ động lắng nghe và trả lời mọi câu hỏi, yêu cầu trong nhóm mà không cần thành viên phải tag tên.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {channelChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {chat.platform === 'TELEGRAM' ? (
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                            <TelegramLogo size={18} weight="fill" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                            Zalo
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 text-sm flex items-center flex-wrap gap-2">
                            <span>{chat.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase font-mono">
                              {chat.chat_type}
                            </span>
                            {chat.always_respond ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                ⚡ Luôn trả lời
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">
                                ❄️ Cần tag tên
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5 flex items-center gap-2">
                            <span>ID: {chat.platform_chat_id}</span>
                            <span>•</span>
                            <span>Kênh: {chat.account_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                        {/* Setting: Luôn trả lời (Always Respond) */}
                        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50/80 hover:bg-gray-100/80 transition">
                          <div className="flex flex-col text-right select-none">
                            <span className="text-[11px] font-semibold text-gray-800">
                              Luôn trả lời
                            </span>
                            <span className={`text-[10px] ${chat.always_respond ? 'text-emerald-600 font-semibold' : 'text-gray-400 font-normal'}`}>
                              {chat.always_respond ? 'Mọi câu hỏi (ON)' : 'Cần tag tên (OFF)'}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={!isAdmin || updatingChatId === chat.id}
                            onClick={() => handleToggleAlwaysRespond(chat.id, !chat.always_respond)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                              chat.always_respond ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                            title={
                              chat.always_respond
                                ? 'Đang BẬT: Agent luôn trả lời mọi câu hỏi trong nhóm mà không cần tag/mention tên.'
                                : 'Đang TẮT: Agent chỉ trả lời khi được tag tên (@Thảo Chi, Chi ơi...) hoặc trong phiên WARM 10 phút.'
                            }
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                chat.always_respond ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveChannelChat(chat.id, chat.title)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition font-medium"
                            title="Gỡ nhóm chat khỏi workspace"
                          >
                            <X size={14} weight="bold" />
                            <span className="hidden md:inline">Gỡ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {channelChats.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      Chưa có kênh hoặc nhóm chat nào được gán vào Workspace này.
                    </div>
                  )}
                </div>
              </div>

              {/* Legacy Zalo Groups (Accordion) */}
              <div className="pt-6 border-t border-gray-200">
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 select-none">
                    <span>Cấu hình nhóm Zalo Legacy (Cũ)</span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    {isAdmin && (
                      <form onSubmit={handleAddZaloGroup} className="flex gap-2 p-3 bg-gray-50 rounded-lg">
                        <input
                          placeholder="Thread ID"
                          className="border px-3 py-1.5 text-xs rounded flex-1"
                          value={zaloFormData.thread_id}
                          onChange={(e) => setZaloFormData({ ...zaloFormData, thread_id: e.target.value })}
                          required
                        />
                        <input
                          placeholder="Tên nhóm"
                          className="border px-3 py-1.5 text-xs rounded flex-1"
                          value={zaloFormData.name}
                          onChange={(e) => setZaloFormData({ ...zaloFormData, name: e.target.value })}
                        />
                        <button className="flex items-center gap-1 bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-800 transition">
                          <Plus size={14} weight="bold" />
                          Thêm Legacy
                        </button>
                      </form>
                    )}
                    <div className="space-y-2">
                      {zaloGroups.map((g) => (
                        <div key={g.id} className="flex justify-between items-center border p-2.5 rounded-lg text-xs">
                          <div>
                            <Link href={`/admin/zalo-groups/${g.id}`} className="font-semibold text-gray-800 hover:underline">
                              {g.name || 'Unnamed'}
                            </Link>
                            <div className="text-[11px] text-gray-400">{g.thread_id}</div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleRemoveZaloGroup(g.thread_id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {zaloGroups.length === 0 && <p className="text-gray-400 text-xs">Không có nhóm zalo legacy nào.</p>}
                    </div>
                  </div>
                </details>
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
                      <button disabled={!userIdToAdd} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition">
                        <Plus size={15} weight="bold" />
                        Gán vào Workspace
                      </button>
                    </form>
                  </div>
                  <div className="border-l pl-4 ml-2">
                    <div className="block text-xs font-medium text-gray-500 mb-1">Hoặc Tạo Mới</div>
                    <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition whitespace-nowrap">
                      <Plus size={15} weight="bold" />
                      Tạo Người Dùng Mới
                    </button>
                  </div>
                </div>
              )}

              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Họ & Tên</th>
                    <th className="pb-2">Vai trò</th>
                    <th className="pb-2">Ngày tham gia</th>
                    {isAdmin && <th className="pb-2 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <div className="font-medium text-gray-900">{u.full_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{u.zalo_id}</div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-500">{new Date(u.joined_at).toLocaleDateString()}</td>
                      {isAdmin && (
                        <td className="py-3 text-right">
                          <button onClick={() => handleRemoveUser(u.id)} title="Gỡ khỏi Workspace" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                            <UserMinus size={14} weight="bold" />
                            Gỡ bỏ
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className="text-center py-4 text-gray-500">Chưa có thành viên nào trong Workspace này.</p>}
            </div>
          )}

          {/* SKILLS TAB */}
          {activeTab === 'skills' && (
            <div>
              <div className="mb-4 text-xs sm:text-sm text-gray-500">
                Kỹ năng (Skills) là các quy trình SOP và nghiệp vụ được định nghĩa hoặc dạy trực tiếp. Bạn có thể phân quyền kích hoạt các kỹ năng này cho Workspace tại đây.
              </div>

              {isAdmin && (
                <form onSubmit={handleAddSkill} className="flex gap-2 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <select
                    className="border border-gray-300 px-3 py-2 rounded-lg text-sm flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={skillIdToAdd}
                    onChange={e => setSkillIdToAdd(e.target.value)}
                  >
                    <option value="">-- Chọn Kỹ năng có sẵn để phân quyền cho Workspace --</option>
                    {availableSkills.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button disabled={!skillIdToAdd} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition">
                    <Plus size={15} weight="bold" />
                    Gán Kỹ Năng
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

      {/* Modal: Thêm Nhóm Chat vào Workspace (Zalo / Telegram) */}
      {isAddChatModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ChatCircleDots size={24} weight="bold" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Thêm Nhóm Chat vào Workspace</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Quét hoặc liên kết nhóm chat từ kênh Zalo / Telegram vào Workspace hiện tại
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddChatModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} weight="bold" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Select Channel Account */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  1. Chọn Kênh Liên Lạc Đã Kết Nối
                </label>
                <select
                  value={selectedModalAccountId}
                  onChange={(e) => {
                    setSelectedModalAccountId(e.target.value);
                    setHasScanned(false);
                    setDiscoveredGroups([]);
                    setSelectedGroupIds([]);
                    setScanError('');
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800"
                >
                  <option value="">-- Chọn tài khoản kết nối --</option>
                  {channelAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.platform}] {acc.account_name} ({acc.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Account details & Action depending on platform */}
              {(() => {
                const currentAccount = channelAccounts.find((a) => a.id === selectedModalAccountId);
                if (!currentAccount) {
                  return (
                    <div className="text-center py-8 text-gray-400 text-xs border border-dashed rounded-xl">
                      Vui lòng chọn một kênh liên lạc ở trên để tiếp tục.
                    </div>
                  );
                }

                if (currentAccount.platform === 'ZALO') {
                  return (
                    <div className="space-y-4">
                      <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3.5 text-xs text-blue-900 space-y-1.5">
                        <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                          <CheckCircle size={15} weight="fill" className="text-blue-600" />
                          Tài khoản Zalo: {currentAccount.account_name}
                        </div>
                        <p className="text-blue-700 leading-relaxed">
                          Bấm nút quét bên dưới để truy xuất toàn bộ các nhóm chat Zalo mà tài khoản đang tham gia. Hệ thống sẽ tự động lọc bỏ các nhóm chat đã có sẵn.
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={handleScanGroups}
                          disabled={scanningGroups}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                        >
                          <ArrowClockwise size={16} className={scanningGroups ? 'animate-spin' : ''} />
                          <span>{scanningGroups ? 'Đang quét nhóm Zalo...' : 'Quét Nhóm Chat từ Zalo'}</span>
                        </button>

                        {hasScanned && discoveredGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={handleToggleSelectAll}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                          >
                            {selectedGroupIds.length === discoveredGroups.length
                              ? 'Bỏ chọn tất cả'
                              : 'Chọn tất cả'}
                          </button>
                        )}
                      </div>

                      {scanError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                          {scanError}
                        </div>
                      )}

                      {/* Scanned groups list */}
                      {hasScanned && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-1">
                            <span>Tìm thấy {discoveredGroups.length} nhóm mới chưa có trong hệ thống</span>
                            <span>Đã chọn: {selectedGroupIds.length}</span>
                          </div>

                          {discoveredGroups.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-xs border border-dashed rounded-xl">
                              Không tìm thấy nhóm mới nào. Tất cả các nhóm Zalo của tài khoản này đã được thêm vào hệ thống trước đó!
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50/30">
                              {discoveredGroups.map((g) => {
                                const isChecked = selectedGroupIds.includes(g.id);
                                return (
                                  <div
                                    key={g.id}
                                    onClick={() => handleToggleGroup(g.id)}
                                    className={`p-3 flex items-center justify-between cursor-pointer transition hover:bg-white ${
                                      isChecked ? 'bg-indigo-50/60' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                      />
                                      {g.avatar ? (
                                        <img
                                          src={g.avatar}
                                          alt={g.title}
                                          className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                                          Zalo
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-xs text-gray-900 truncate">
                                          {g.title}
                                        </div>
                                        <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                                          <span className="font-mono text-[10px] text-gray-400">ID: {g.id}</span>
                                          <span>•</span>
                                          <span className="flex items-center gap-0.5">
                                            <Users size={12} /> {g.members_count} TV
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // Telegram platform
                return (
                  <div className="space-y-4">
                    <div className="bg-sky-50/70 border border-sky-200/70 rounded-xl p-3.5 text-xs text-sky-900 space-y-1.5">
                      <div className="font-semibold flex items-center gap-1.5 text-sky-800">
                        <TelegramLogo size={16} weight="fill" className="text-sky-600" />
                        Tài khoản Bot: {currentAccount.account_name}
                      </div>
                      <p className="text-sky-700 leading-relaxed">
                        Nhập ID nhóm chat Telegram (bắt đầu bằng dấu trừ, ví dụ: <code>-1001234567890</code>) hoặc quét các nhóm bot đã nhận diện được nhưng chưa gán workspace.
                      </p>
                    </div>

                    <div className="space-y-3 p-3.5 border border-gray-200 rounded-xl bg-gray-50/50">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Tên nhóm chat Telegram
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Nhóm CSKH Miền Bắc"
                          value={telegramTitle}
                          onChange={(e) => setTelegramTitle(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Telegram Chat ID
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: -100192837465"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleScanGroups}
                        disabled={scanningGroups}
                        className="flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-900 font-medium"
                      >
                        <ArrowClockwise size={14} className={scanningGroups ? 'animate-spin' : ''} />
                        <span>Kiểm tra nhóm Telegram chưa gán ({discoveredGroups.length})</span>
                      </button>
                    </div>

                    {hasScanned && discoveredGroups.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                        {discoveredGroups.map((g) => {
                          const isChecked = selectedGroupIds.includes(g.id);
                          return (
                            <div
                              key={g.id}
                              onClick={() => handleToggleGroup(g.id)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer text-xs ${
                                isChecked ? 'bg-sky-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="h-3.5 w-3.5 text-sky-600 rounded"
                                />
                                <div>
                                  <div className="font-semibold text-gray-800">{g.title}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">ID: {g.id}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAddChatModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddDiscoveredGroups}
                disabled={
                  addingGroups ||
                  !selectedModalAccountId ||
                  (channelAccounts.find((a) => a.id === selectedModalAccountId)?.platform === 'ZALO'
                    ? selectedGroupIds.length === 0
                    : !telegramChatId.trim() && selectedGroupIds.length === 0)
                }
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition"
              >
                <FloppyDisk size={16} weight="bold" />
                <span>
                  {addingGroups
                    ? 'Đang thêm...'
                    : selectedGroupIds.length > 0
                    ? `Thêm vào Workspace (${selectedGroupIds.length})`
                    : 'Thêm vào Workspace'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceDataToolsTab (Tool Permissions & Scoped Credentials)
// ---------------------------------------------------------------------------

interface ToolWithGroup extends Tool {
  group_info?: {
    id: string;
    key: string;
    name: string;
  } | null;
  parameters_schema?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  status?: string;
}

function getToolMethodBadge(tool: ToolWithGroup, groupProtocol?: 'REST' | 'MCP') {
  if (groupProtocol === 'MCP') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase font-mono">
        MCP
      </span>
    );
  }
  const key = (tool.key || '').toLowerCase();
  if (key.includes('delete') || key.includes('remove') || key.includes('destroy')) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase font-mono">
        DELETE
      </span>
    );
  }
  if (key.includes('post') || key.includes('create') || key.includes('add') || key.includes('insert') || key.includes('send')) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase font-mono">
        POST
      </span>
    );
  }
  if (key.includes('put') || key.includes('update') || key.includes('edit') || key.includes('patch')) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase font-mono">
        PUT
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase font-mono">
      GET
    </span>
  );
}

function WorkspaceDataToolsTab({ 
  workspaceId, 
  workspaceTools,
  onToolChange,
  isAdmin
}: { 
  workspaceId: string;
  workspaceTools: Tool[];
  onToolChange: () => void;
  isAdmin: boolean;
}) {
  const [allToolGroups, setAllToolGroups] = useState<ToolGroup[]>([]);
  const [allTools, setAllTools] = useState<ToolWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<'ALL' | 'REST' | 'MCP'>('ALL');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [groups, toolsRes] = await Promise.all([
        fetchToolGroups(),
        fetch('/api/admin/tools?limit=1000').then(res => res.json())
      ]);
      setAllToolGroups(groups);
      setAllTools(toolsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <ArrowClockwise size={28} className="animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Đang tải danh mục công cụ và cấu hình biến Scoped Vault...</p>
      </div>
    );
  }

  // Group tools by group ID
  const toolsByGroup = allTools.reduce((acc, tool) => {
    const groupId = tool.group_info?.id || 'common';
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(tool);
    return acc;
  }, {} as Record<string, ToolWithGroup[]>);

  const commonTools = toolsByGroup['common'] || [];

  // Filter groups and tools by search query and protocol
  const filteredGroups = allToolGroups.filter((g) => {
    const matchesProtocol = protocolFilter === 'ALL' || (g.protocol_type || 'REST') === protocolFilter;
    if (!matchesProtocol) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesGroup = g.name.toLowerCase().includes(q) || g.key.toLowerCase().includes(q);
    const hasMatchingTools = (toolsByGroup[g.id] || []).some(
      (t) => t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)
    );
    return matchesGroup || hasMatchingTools;
  });

  const filteredCommonTools = commonTools.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
              <Sliders size={18} weight="bold" />
            </span>
            <h2 className="text-base font-bold text-white tracking-wide">
              Phân Quyền Công Cụ & Biến Tùy Biến (Scoped Vault)
            </h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Cấu hình quyền hạn sử dụng từng API và khai báo các thông số bảo mật riêng (ví dụ: <code className="text-amber-300 font-mono">API_KEY</code>, <code className="text-amber-300 font-mono">BRANCH_ID</code>, <code className="text-amber-300 font-mono">BASE_URL</code>) cho Không gian này. AI Agent sẽ tự động nạp các biến này khi thực thi tác vụ.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-400">Đang kích hoạt</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {workspaceTools.length} <span className="text-xs text-slate-400 font-normal">/ {allTools.length} công cụ</span>
            </div>
          </div>
          <Link
            href="/admin/tool-groups"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
          >
            <span>Kho Công Cụ Master →</span>
          </Link>
        </div>
      </div>

      {/* Search & Protocol Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm công cụ theo tên, endpoint hoặc key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setProtocolFilter('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              protocolFilter === 'ALL'
                ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Tất cả ({allToolGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setProtocolFilter('REST')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              protocolFilter === 'REST'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            REST API
          </button>
          <button
            type="button"
            onClick={() => setProtocolFilter('MCP')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              protocolFilter === 'MCP'
                ? 'bg-white text-purple-700 shadow-2xs font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Native MCP
          </button>
        </div>
      </div>

      {/* Tool Groups List */}
      <div className="space-y-4">
        {filteredGroups.map((group) => (
          <ToolGroupConfigCard
            key={group.id}
            group={group}
            workspaceId={workspaceId}
            toolsInGroup={toolsByGroup[group.id] || []}
            workspaceTools={workspaceTools}
            onToolChange={onToolChange}
            isAdmin={isAdmin}
          />
        ))}

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-6 text-gray-500">
            <p className="text-sm font-medium">Không tìm thấy nhóm công cụ nào phù hợp với bộ lọc.</p>
          </div>
        )}
      </div>

      {/* Common / Standalone Tools Section */}
      {filteredCommonTools.length > 0 && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Wrench size={16} className="text-gray-500" />
              Công Cụ Độc Lập ({filteredCommonTools.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Các công cụ chung không thuộc nhóm tích hợp cụ thể nào.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCommonTools.map((tool) => {
              const isAdded = workspaceTools.some((t) => String(t.id) === String(tool.id));
              return (
                <StandaloneToolCard
                  key={tool.id}
                  tool={tool}
                  workspaceId={workspaceId}
                  isAdded={isAdded}
                  onToolChange={onToolChange}
                  isAdmin={isAdmin}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolGroupConfigCard: Modern high-density card with Master Switch,
// Scoped Vault Credentials table & Endpoints list
// ---------------------------------------------------------------------------

function ToolGroupConfigCard({
  group,
  workspaceId,
  toolsInGroup,
  workspaceTools,
  onToolChange,
  isAdmin,
}: {
  group: ToolGroup;
  workspaceId: string;
  toolsInGroup: ToolWithGroup[];
  workspaceTools: Tool[];
  onToolChange: () => void;
  isAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [data, setData] = useState<ToolGroupData[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Scoped Data Form state
  const [showAddData, setShowAddData] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [addKey, setAddKey] = useState('');
  const [addValue, setAddValue] = useState('');
  const [showAddValueSecret, setShowAddValueSecret] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Edit Scoped Data state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Masking state & feedback
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group master toggle state
  const [togglingMaster, setTogglingMaster] = useState(false);
  const [togglingToolId, setTogglingToolId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [group.id, workspaceId]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const items = await getToolGroupData(group.id, workspaceId);
      setData(items);
    } catch (err) {
      console.error('Failed to load scoped data', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Calculation of active status
  const activeCount = toolsInGroup.filter((t) =>
    workspaceTools.some((wt) => String(wt.id) === String(t.id))
  ).length;
  const isFullyActive = toolsInGroup.length > 0 && activeCount === toolsInGroup.length;
  const isPartiallyActive = activeCount > 0 && !isFullyActive;

  // Toggle entire Tool Group
  const handleToggleGroupMaster = async () => {
    if (!isAdmin) return;
    try {
      setTogglingMaster(true);
      if (isFullyActive || isPartiallyActive) {
        if (!confirm(`Thu hồi toàn bộ quyền của nhóm "${group.name}" khỏi Workspace này?`)) return;
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_group_id: group.id }),
        });
        const resJson = await res.json();
        if (!resJson.success) throw new Error(resJson.error || 'Failed to revoke tool group');
      } else {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_group_id: group.id }),
        });
        const resJson = await res.json();
        if (!resJson.success) throw new Error(resJson.error || 'Failed to grant tool group');
      }
      onToolChange();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật quyền nhóm công cụ');
    } finally {
      setTogglingMaster(false);
    }
  };

  // Toggle single tool
  const handleToggleSingleTool = async (tool: ToolWithGroup, currentlyAdded: boolean) => {
    if (!isAdmin) return;
    try {
      setTogglingToolId(tool.id);
      if (currentlyAdded) {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id }),
        });
        const resJson = await res.json();
        if (!resJson.success) throw new Error(resJson.error || 'Failed to remove tool');
      } else {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id }),
        });
        const resJson = await res.json();
        if (!resJson.success) throw new Error(resJson.error || 'Failed to add tool');
      }
      onToolChange();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật quyền công cụ');
    } finally {
      setTogglingToolId(null);
    }
  };

  // Add Scoped Data
  const handleAddData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addKey.trim() || !addValue.trim()) return;
    try {
      setAddLoading(true);
      await createToolGroupData(group.id, addKey.trim().toUpperCase(), addValue.trim(), workspaceId);
      await loadData();
      setAddKey('');
      setAddValue('');
      setShowAddData(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thêm biến tùy biến');
    } finally {
      setAddLoading(false);
    }
  };

  // Update Scoped Data
  const handleUpdateData = async (dataId: string) => {
    if (!editKey.trim() || !editValue.trim()) return;
    try {
      setEditLoading(true);
      await updateToolGroupData(group.id, dataId, editKey.trim().toUpperCase(), editValue.trim());
      await loadData();
      setEditingId(null);
      setEditKey('');
      setEditValue('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật biến');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Scoped Data
  const handleDeleteData = async (dataId: string, keyName: string) => {
    if (!confirm(`Xóa biến "${keyName}" khỏi Không gian làm việc này?`)) return;
    try {
      await deleteToolGroupData(group.id, dataId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa biến');
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick suggestion chips
  const SUGGESTED_KEYS = ['AUTH_TOKEN', 'API_KEY', 'BRANCH_ID', 'BASE_URL', 'TENANT_ID', 'CLIENT_SECRET'];

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all bg-white shadow-sm ${
        isFullyActive
          ? 'border-emerald-300 ring-1 ring-emerald-100'
          : isPartiallyActive
          ? 'border-amber-300 ring-1 ring-amber-100'
          : 'border-gray-200'
      }`}
    >
      {/* Group Card Header */}
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-gray-50/90 via-white to-gray-50/50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-500 transition"
            title={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
          </button>

          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-bold text-gray-900 text-sm">{group.name}</span>
              {group.protocol_type === 'MCP' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  <Sparkle size={11} weight="fill" />
                  Native MCP
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Globe size={11} weight="bold" />
                  REST API
                </span>
              )}
              {isFullyActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {activeCount}/{toolsInGroup.length} Bật
                </span>
              ) : isPartiallyActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {activeCount}/{toolsInGroup.length} Bật một phần
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                  0/{toolsInGroup.length} Chưa kích hoạt
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 font-mono">
              <span>{group.key}</span>
              {group.base_url && (
                <>
                  <span>•</span>
                  <span className="text-gray-400 truncate max-w-xs">{group.base_url}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Master Toggle & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-4 pl-8 sm:pl-0">
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-xs font-bold text-gray-800">
                {isFullyActive ? 'Toàn nhóm BẬT' : isPartiallyActive ? 'Bật một phần' : 'Toàn nhóm TẮT'}
              </div>
              <div className="text-[10px] text-gray-400">Master Switch</div>
            </div>

            <button
              type="button"
              disabled={!isAdmin || togglingMaster}
              onClick={handleToggleGroupMaster}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                isFullyActive
                  ? 'bg-emerald-600'
                  : isPartiallyActive
                  ? 'bg-amber-500'
                  : 'bg-gray-300'
              }`}
              title={
                isFullyActive
                  ? 'Đang BẬT toàn bộ nhóm công cụ (Click để thu hồi)'
                  : isPartiallyActive
                  ? 'Đang bật một phần nhóm công cụ (Click để kích hoạt toàn bộ)'
                  : 'Đang TẮT nhóm công cụ (Click để kích hoạt toàn bộ)'
              }
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isFullyActive ? 'translate-x-5' : isPartiallyActive ? 'translate-x-2.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Group Card Expanded Content */}
      {isOpen && (
        <div className="p-5 space-y-6">
          {/* SECTION A: Workspace Scoped Variables (Vault) */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Key size={14} className="text-amber-600" weight="bold" />
                  <span>Biến Tùy Biến Không Gian (Scoped Vault)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                    {data.length} biến
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Các thông số xác thực riêng cho Workspace này (Agent tự động nạp vào tham số hoặc Header khi gọi Tool).
                </p>
              </div>

              {isAdmin && !showAddData && (
                <button
                  type="button"
                  onClick={() => setShowAddData(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                >
                  <Plus size={14} weight="bold" />
                  <span>Thêm Biến Mới</span>
                </button>
              )}
            </div>

            {/* Guide & Troubleshooting Banner */}
            <div className="mb-4 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-indigo-50/40 p-3.5 text-xs text-blue-950 shadow-2xs">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowGuide(!showGuide)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                    <Info size={15} weight="bold" />
                  </div>
                  <span className="font-bold text-blue-900 text-xs">
                    Hướng dẫn gắn Key xác thực &amp; Sửa lỗi 401 ({group.protocol_type === 'MCP' ? 'Native MCP' : 'REST API'})
                  </span>
                </div>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded hover:bg-blue-100/50 transition flex items-center gap-1"
                >
                  <span>{showGuide ? 'Thu gọn' : 'Xem chi tiết'}</span>
                  {showGuide ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                </button>
              </div>

              {showGuide && (
                <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2 text-[11.5px] leading-relaxed text-blue-900">
                  {group.protocol_type === 'MCP' ? (
                    <>
                      <p>
                        <strong>❓ Gặp lỗi 401 Unauthorized khi Agent gọi Tool:</strong> MCP Server yêu cầu khóa xác thực bảo mật trước khi cho phép Agent truy vấn dữ liệu.
                      </p>
                      <div className="bg-white/80 p-2.5 rounded-lg border border-blue-200/60 space-y-1.5 font-sans">
                        <div className="font-semibold text-indigo-950 flex items-center gap-1">
                          <span>Các bước khắc phục ngay:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-slate-700">
                          <li>Bấm nút <strong>&quot;Thêm Biến Mới&quot;</strong> ở góc trên bên phải.</li>
                          <li>
                            Tại ô <strong>Tên biến (Key)</strong>: Nhập <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">AUTH_TOKEN</code> (hoặc bấm chọn gợi ý <code className="bg-gray-100 px-1 rounded font-mono">AUTH_TOKEN</code> / <code className="bg-gray-100 px-1 rounded font-mono">API_KEY</code>).
                          </li>
                          <li>
                            Tại ô <strong>Giá trị (Value)</strong>: Dán mã Secret Key / Token của bạn và bấm <strong>&quot;Lưu Biến&quot;</strong>.
                          </li>
                        </ol>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        ⚡ <strong>Cơ chế tự động:</strong> Khi thực thi bất kỳ tool nào thuộc nhóm <em>{group.name}</em>, hệ thống sẽ tự động gửi kèm Header: <br />
                        <code className="bg-blue-100/90 text-blue-950 px-2 py-0.5 rounded font-mono text-[11px] inline-block mt-1">
                          Authorization: Bearer &lt;AUTH_TOKEN&gt;
                        </code>
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Cấu hình xác thực cho REST API:</strong> Bạn có thể cấu hình Token xác thực hoặc các biến môi trường riêng cho từng Không gian làm việc.
                      </p>
                      <div className="bg-white/80 p-2.5 rounded-lg border border-blue-200/60 space-y-1 text-slate-700">
                        <p>
                          • <strong>Token / API Key:</strong> Tạo biến <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">API_KEY</code> hoặc <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">AUTH_TOKEN</code>. Hệ thống sẽ tự động gán vào Header tương ứng.
                        </p>
                        <p>
                          • <strong>Tham số tùy biến:</strong> Các biến như <code className="bg-gray-100 px-1 rounded font-mono font-bold">BRANCH_ID</code>, <code className="bg-gray-100 px-1 rounded font-mono font-bold">TENANT_ID</code>... sẽ được tự động điền vào URL (dạng <code className="bg-gray-100 px-1 rounded font-mono">&#123;param&#125;</code>) hoặc Body (dạng <code className="bg-gray-100 px-1 rounded font-mono">&#123;&#123;KEY&#125;&#125;</code>) khi gọi API.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Suggestions & Add Form */}
            {showAddData && (
              <form onSubmit={handleAddData} className="mb-4 p-4 bg-white border border-indigo-200 rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">Khai báo biến mới:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] text-gray-400 mr-1">Gợi ý:</span>
                    {SUGGESTED_KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setAddKey(k)}
                        className="px-2 py-0.5 text-[10px] font-mono font-medium bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 rounded transition"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {['AUTH_TOKEN', 'API_KEY', 'TOKEN', 'BEARER_TOKEN', 'API_TOKEN', 'SECRET_KEY'].includes(addKey) && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <ShieldCheck size={14} weight="bold" />
                    <span>Biến xác thực chuẩn: Sẽ tự động được gán vào Header <strong>Authorization: Bearer</strong> khi gọi Tool.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Tên biến (Key) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: AUTH_TOKEN, API_KEY, BRANCH_ID"
                      className="w-full px-3 py-2 text-xs font-mono uppercase border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      value={addKey}
                      onChange={(e) => setAddKey(e.target.value.toUpperCase())}
                      disabled={addLoading}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-medium text-gray-600">
                        Giá trị (Value) <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddValueSecret(!showAddValueSecret)}
                        className="text-[10px] text-gray-500 hover:text-gray-800 flex items-center gap-1"
                      >
                        {showAddValueSecret ? <EyeSlash size={12} /> : <Eye size={12} />}
                        <span>{showAddValueSecret ? 'Ẩn' : 'Hiện'}</span>
                      </button>
                    </div>
                    <input
                      type={showAddValueSecret ? 'text' : 'password'}
                      placeholder="Nhập giá trị bảo mật..."
                      className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      value={addValue}
                      onChange={(e) => setAddValue(e.target.value)}
                      disabled={addLoading}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddData(false);
                      setAddKey('');
                      setAddValue('');
                    }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading || !addKey.trim() || !addValue.trim()}
                    className="inline-flex items-center gap-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition shadow-xs"
                  >
                    <Check size={14} weight="bold" />
                    <span>{addLoading ? 'Đang lưu...' : 'Lưu Biến'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Scoped Data List */}
            {loadingData ? (
              <div className="text-center py-3 text-xs text-gray-400">Đang tải biến...</div>
            ) : data.length === 0 ? (
              <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 italic">
                Chưa có biến cấu hình riêng nào cho nhóm công cụ này trong Workspace.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
                    <tr>
                      <th className="px-3.5 py-2 text-left font-semibold w-1/3">Tên biến (Key)</th>
                      <th className="px-3.5 py-2 text-left font-semibold">Giá trị cấu hình (Value)</th>
                      {isAdmin && <th className="px-3.5 py-2 text-right font-semibold w-24">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((item) => {
                      const isEditing = editingId === item.id;
                      const isVisible = visibleKeys[item.id];
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/70 transition">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-gray-800">
                            {isEditing ? (
                              <input
                                className="w-full px-2 py-1 text-xs font-mono uppercase border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                                value={editKey}
                                onChange={(e) => setEditKey(e.target.value.toUpperCase())}
                                disabled={editLoading}
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Key size={13} className="text-amber-500" />
                                <span>{item.key}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-gray-600">
                            {isEditing ? (
                              <input
                                className="w-full px-2 py-1 text-xs font-mono border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                disabled={editLoading}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                  {isVisible ? item.value : '••••••••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleVisibility(item.id)}
                                  className="text-gray-400 hover:text-gray-700 transition p-1"
                                  title={isVisible ? 'Ẩn giá trị' : 'Hiển thị giá trị'}
                                >
                                  {isVisible ? <EyeSlash size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.id, item.value)}
                                  className="text-gray-400 hover:text-indigo-600 transition p-1"
                                  title="Sao chép"
                                >
                                  {copiedId === item.id ? (
                                    <span className="text-[10px] text-emerald-600 font-sans font-semibold">Đã chép!</span>
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-3.5 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateData(item.id)}
                                      disabled={editLoading}
                                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition"
                                      title="Lưu"
                                    >
                                      <Check size={15} weight="bold" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingId(null)}
                                      disabled={editLoading}
                                      className="p-1 text-gray-400 hover:bg-gray-100 rounded transition"
                                      title="Hủy"
                                    >
                                      <X size={15} weight="bold" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingId(item.id);
                                        setEditKey(item.key);
                                        setEditValue(item.value);
                                      }}
                                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                      title="Chỉnh sửa"
                                    >
                                      <PencilSimple size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteData(item.id, item.key)}
                                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                      title="Xóa biến"
                                    >
                                      <Trash size={15} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION B: Endpoints & Tools Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                  <Wrench size={14} className="text-indigo-600" />
                  <span>Danh Sách Công Cụ Con ({toolsInGroup.length})</span>
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Bật hoặc tắt ngoại lệ từng endpoint cụ thể cho Không gian này.
                </p>
              </div>
            </div>

            {toolsInGroup.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 italic">
                Chưa có công cụ nào được liên kết với nhóm này.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
                    <tr>
                      <th className="px-3.5 py-2.5 text-left font-semibold w-24">Giao thức</th>
                      <th className="px-3.5 py-2.5 text-left font-semibold">Tên & Endpoint / Key</th>
                      <th className="px-3.5 py-2.5 text-left font-semibold hidden md:table-cell">Mô tả</th>
                      <th className="px-3.5 py-2.5 text-right font-semibold w-40">Phân quyền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {toolsInGroup.map((tool) => {
                      const isAdded = workspaceTools.some((t) => String(t.id) === String(tool.id));
                      const isToggling = togglingToolId === tool.id;
                      return (
                        <tr
                          key={tool.id}
                          className={`transition ${
                            isAdded ? 'hover:bg-emerald-50/40 bg-white' : 'hover:bg-gray-50 bg-gray-50/40 opacity-75'
                          }`}
                        >
                          <td className="px-3.5 py-3">
                            {getToolMethodBadge(tool, group.protocol_type)}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                              <Link
                                href={`/admin/tools/${tool.id}`}
                                className="hover:text-indigo-600 transition"
                              >
                                {tool.name}
                              </Link>
                            </div>
                            <div className="text-[11px] font-mono text-gray-500 mt-0.5 truncate max-w-sm">
                              {tool.key}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-gray-500 hidden md:table-cell">
                            <div className="truncate max-w-xs">{tool.description || '—'}</div>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold ${
                                  isAdded ? 'text-emerald-700' : 'text-gray-400'
                                }`}
                              >
                                {isAdded ? 'Kích hoạt' : 'Hạn chế'}
                              </span>

                              {isAdmin && (
                                <button
                                  type="button"
                                  disabled={isToggling}
                                  onClick={() => handleToggleSingleTool(tool, isAdded)}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                    isAdded ? 'bg-emerald-600' : 'bg-gray-300'
                                  }`}
                                  title={
                                    isAdded
                                      ? 'Đang kích hoạt (Click để tắt)'
                                      : 'Đang bị hạn chế (Click để bật)'
                                  }
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      isAdded ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

// ---------------------------------------------------------------------------
// StandaloneToolCard
// ---------------------------------------------------------------------------

function StandaloneToolCard({
  tool,
  workspaceId,
  isAdded,
  onToolChange,
  isAdmin,
}: {
  tool: ToolWithGroup;
  workspaceId: string;
  isAdded: boolean;
  onToolChange: () => void;
  isAdmin: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    try {
      setLoading(true);
      if (isAdded) {
        if (!confirm(`Thu hồi công cụ "${tool.name}" khỏi Workspace?`)) return;
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id }),
        });
        if (!(await res.json()).success) throw new Error('Failed to remove tool');
      } else {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/tools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: tool.id }),
        });
        const resData = await res.json();
        if (!resData.success) throw new Error(resData.error || 'Failed to add tool');
      }
      onToolChange();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật quyền công cụ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
        isAdded
          ? 'bg-emerald-50/40 border-emerald-200 shadow-2xs'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          {getToolMethodBadge(tool)}
          <span className={`text-[10px] font-semibold ${isAdded ? 'text-emerald-700' : 'text-gray-400'}`}>
            {isAdded ? 'Đang bật' : 'Chưa bật'}
          </span>
        </div>
        <div className="text-xs font-bold text-gray-900 line-clamp-1">{tool.name}</div>
        <div className="text-[10px] font-mono text-gray-400 truncate mt-0.5">{tool.key}</div>
        {tool.description && (
          <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{tool.description}</div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <Link
          href={`/admin/tools/${tool.id}`}
          className="text-[10px] text-indigo-600 hover:underline"
        >
          Chi tiết →
        </Link>
        {isAdmin && (
          <button
            type="button"
            disabled={loading}
            onClick={handleToggle}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
              isAdded ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isAdded ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}

