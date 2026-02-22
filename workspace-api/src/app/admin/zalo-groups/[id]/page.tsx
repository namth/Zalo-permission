
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ZaloGroupMember {
    id: string; // member record id
    user_id: string;
    role: string;
    joined_at: string;
    user: {
        full_name: string;
        zalo_id: string;
    };
}

export default function ZaloGroupDetailPage() {
    const params = useParams();
    const groupId = params?.id as string;

    const [members, setMembers] = useState<ZaloGroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [userIdToAdd, setUserIdToAdd] = useState('');

    // Selection Data
    const [allUsers, setAllUsers] = useState<{ id: string, full_name: string, zalo_id: string }[]>([]);

    // Create User Modal
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUser, setNewUser] = useState({ zalo_id: '', full_name: '', email: '', phone: '' });

    useEffect(() => {
        if (groupId) {
            fetchMembers();
            fetchAllUsers();
        }
    }, [groupId]);

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
    }

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

    if (loading && members.length === 0) return <div>Loading...</div>;

    const availableUsers = allUsers.filter(au => !members.find(m => m.user_id === au.id));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                {/* We assume the user came from workspace detail, or we can provide a generic back link */}
                <button onClick={() => history.back()} className="text-blue-600 hover:text-blue-800">
                    ← Back
                </button>
                <h1 className="text-2xl font-bold">Zalo Group Members</h1>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-2">Group ID: {groupId}</h2>
                    {/* We could fetch group details here too if we want to show name */}
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
                            <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-3">
                                    <div className="font-medium">{m.user?.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400">{m.user?.zalo_id}</div>
                                </td>
                                <td className="py-3">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{m.role}</span>
                                </td>
                                <td className="py-3 text-sm text-gray-500">{new Date(m.joined_at).toLocaleDateString()}</td>
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
