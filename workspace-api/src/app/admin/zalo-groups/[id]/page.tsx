
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

interface ZaloGroup {
    id: string;
    workspace_id: string;
    thread_id: string;
    name: string | null;
    created_at: string;
    updated_at: string;
}

interface ZaloGroupMember {
    user_id: string;
    zalo_group_id: string;
    role: string;
    joined_at: string | null;
    full_name: string | null;
    zalo_id: string | null;
}

export default function ZaloGroupDetailPage() {
    const params = useParams();
    const groupId = params?.id as string;

    const [group, setGroup] = useState<ZaloGroup | null>(null);
    const [members, setMembers] = useState<ZaloGroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [userIdToAdd, setUserIdToAdd] = useState('');

    // Selection Data
    const [allUsers, setAllUsers] = useState<{ id: string, full_name: string, zalo_id: string }[]>([]);

    // Rename state
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [groupLoading, setGroupLoading] = useState(true);
    const [groupError, setGroupError] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Create User Modal
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUser, setNewUser] = useState({ zalo_id: '', full_name: '', email: '', phone: '' });

    useEffect(() => {
        if (groupId) {
            fetchGroup();
            fetchMembers();
            fetchAllUsers();
        }
    }, [groupId]);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const fetchGroup = async () => {
        setGroupLoading(true);
        setGroupError('');
        try {
            const res = await fetch(`/api/admin/zalo-groups/${groupId}`);
            const data = await res.json();
            if (data.success) {
                setGroup(data.data);
            } else {
                setGroupError(data.error || 'Failed to load group details');
            }
        } catch (e) {
            setGroupError('Failed to fetch group details');
            console.error('Failed to fetch group details', e);
        } finally {
            setGroupLoading(false);
        }
    };

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/zalo-groups/${groupId}/users`);
            const data = await res.json();
            if (data.success) {
                setMembers(data.data || []);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch(`/api/admin/users?limit=1000`);
            const data = await res.json();
            if (data.success) setAllUsers(data.data || []);
        } catch (e) {
            console.error('Failed to fetch all users', e);
        }
    };

    const handleStartEditName = () => {
        // Always use the latest group name from state
        setEditNameValue(group?.name || '');
        setIsEditingName(true);
    };

    const handleCancelEditName = () => {
        setIsEditingName(false);
        setEditNameValue('');
    };

    const handleSaveName = async () => {
        if (!editNameValue.trim()) return;
        setSavingName(true);
        try {
            const res = await fetch(`/api/admin/zalo-groups/${groupId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editNameValue.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setGroup(data.data);
                setIsEditingName(false);
                setEditNameValue('');
            } else {
                alert(data.error || 'Failed to update group name');
            }
        } catch (err) {
            alert('Error: ' + String(err));
        } finally {
            setSavingName(false);
        }
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSaveName();
        if (e.key === 'Escape') handleCancelEditName();
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!userIdToAdd) return;
            const res = await fetch(`/api/admin/zalo-groups/${groupId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userIdToAdd, role: 'MEMBER' }),
            });
            const data = await res.json();
            if (data.success) {
                setUserIdToAdd('');
                fetchMembers();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert(String(err));
        }
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

            // 2. Add to group
            const linkRes = await fetch(`/api/admin/zalo-groups/${groupId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: createdUser.id, role: 'MEMBER' }),
            });
            const linkData = await linkRes.json();
            if (linkData.success) {
                alert('User created and added to group (and workspace)');
                setShowCreateUser(false);
                setNewUser({ zalo_id: '', full_name: '', email: '', phone: '' });
                fetchMembers();
                fetchAllUsers();
            } else {
                alert('User created but failed to link: ' + linkData.error);
            }
        } catch (err) {
            alert('Failed to create user: ' + String(err));
        }
    };

    const handleRemoveUser = async (userId: string) => {
        if (!confirm('Remove user from group?')) return;
        try {
            const res = await fetch(`/api/admin/zalo-groups/${groupId}/users?user_id=${userId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                fetchMembers();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert(String(err));
        }
    };

    if (loading && members.length === 0 && groupLoading) return <div>Loading...</div>;

    const availableUsers = allUsers.filter(au => !members.find(m => m.user_id === au.id));
    const displayName = group?.name ?? null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => history.back()} className="text-blue-600 hover:text-blue-800">
                    ← Back
                </button>

                {/* Group Name — Inline Edit */}
                <div className="flex items-center gap-2 flex-1">
                    {isEditingName ? (
                        <>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={editNameValue}
                                onChange={e => setEditNameValue(e.target.value)}
                                onKeyDown={handleNameKeyDown}
                                className="text-2xl font-bold border-b-2 border-blue-500 outline-none bg-transparent px-1 min-w-[200px]"
                                placeholder="Nhập tên group..."
                            />
                            <button
                                onClick={handleSaveName}
                                disabled={savingName || !editNameValue.trim()}
                                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {savingName ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={handleCancelEditName}
                                disabled={savingName}
                                className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {groupLoading ? (
                                <h1 className="text-2xl font-bold text-gray-400 animate-pulse">Đang tải...</h1>
                            ) : groupError ? (
                                <h1 className="text-2xl font-bold text-red-500">Không thể tải tên group</h1>
                            ) : (
                                <h1 className="text-2xl font-bold">
                                    {displayName ?? <span className="text-gray-400 italic">Chưa có tên</span>}
                                </h1>
                            )}
                            <button
                                onClick={handleStartEditName}
                                title="Sửa tên group"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                                {/* Pencil icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="mb-6 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="font-medium text-gray-700">Thread ID:</span>
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{group?.thread_id || groupId}</code>
                    </div>
                </div>

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
                            <button disabled={!userIdToAdd} className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400">+ Add Member</button>
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
                            <th className="pb-2">User</th>
                            <th className="pb-2">Role</th>
                            <th className="pb-2">Joined</th>
                            <th className="pb-2">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(m => (
                            <tr key={m.user_id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-3">
                                    <div className="font-medium">{m.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400">{m.zalo_id}</div>
                                </td>
                                <td className="py-3">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{m.role}</span>
                                </td>
                                <td className="py-3 text-sm text-gray-500">
                                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                                </td>
                                <td className="py-3">
                                    <button onClick={() => handleRemoveUser(m.user_id)} className="text-red-600 hover:underline text-sm">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {members.length === 0 && <p className="text-center py-4 text-gray-500">No members in this group.</p>}
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
