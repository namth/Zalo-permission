
'use client';

import { useState, useEffect } from 'react';
import { Plus, PencilSimple, Trash, X } from '@phosphor-icons/react';

interface User {
    id: string;
    zalo_id: string | null;
    username: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    gender: string | null;
    note: string | null;
    role: string | null;
    status: 'active' | 'inactive';
    created_at: string;
}

interface EditUserForm {
    username: string;
    password?: string;
    full_name: string;
    email: string;
    phone: string;
    gender: string;
    note: string;
    role: string;
    status: 'active' | 'inactive';
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Create modal
    const [showModal, setShowModal] = useState(false);
    const [newUser, setNewUser] = useState({ zalo_id: '', full_name: '', email: '', phone: '' });
    const [creating, setCreating] = useState(false);

    // Edit modal
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<EditUserForm>({
        username: '',
        password: '',
        full_name: '',
        email: '',
        phone: '',
        gender: '',
        note: '',
        role: 'user',
        status: 'active',
    });
    const [saving, setSaving] = useState(false);

    // Merge mode
    const [mergeMode, setMergeMode] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [merging, setMerging] = useState(false);

    useEffect(() => {
        loadUsers();
    }, [searchTerm]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ limit: '100', offset: '0' });
            if (searchTerm) params.append('search', searchTerm);

            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();

            if (data.success) {
                setUsers(data.data);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newUser.zalo_id.trim()) {
            alert('Zalo ID là bắt buộc');
            return;
        }
        try {
            setCreating(true);
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                setNewUser({ zalo_id: '', full_name: '', email: '', phone: '' });
                loadUsers();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert('Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setEditForm({
            username: user.username || '',
            password: '',
            full_name: user.full_name || '',
            email: user.email || '',
            phone: user.phone || '',
            gender: user.gender || '',
            note: user.note || '',
            role: user.role || 'user',
            status: user.status,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        try {
            setSaving(true);
            const payload: any = {
                username: editForm.username.trim() || null,
                full_name: editForm.full_name.trim() || null,
                email: editForm.email.trim() || null,
                phone: editForm.phone.trim() || null,
                gender: editForm.gender.trim() || null,
                note: editForm.note.trim() || null,
                role: editForm.role,
                status: editForm.status,
            };
            if (editForm.password) payload.password = editForm.password;

            const res = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                setUsers(prev => prev.map(u => u.id === editingUser.id ? data.data : u));
                setEditingUser(null);
            } else {
                alert(data.error || 'Failed to update user');
            }
        } catch (err) {
            alert('Error: ' + String(err));
        } finally {
            setSaving(false);
        }
    };

    const handleMerge = async () => {
        if (selectedUsers.length !== 2) {
            alert('Chọn đúng 2 user để gộp');
            return;
        }
        if (!confirm('Bạn có chắc muốn gộp 2 user này? Dữ liệu của tài khoản phụ sẽ được chuyển sang tài khoản chính và tài khoản phụ sẽ bị xóa.')) return;

        try {
            setMerging(true);
            const res = await fetch('/api/admin/users/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetId: selectedUsers[0],
                    sourceId: selectedUsers[1]
                }),
            });
            const data = await res.json();
            if (data.success) {
                alert('Gộp thành công!');
                setMergeMode(false);
                setSelectedUsers([]);
                loadUsers();
            } else {
                alert(data.error || 'Gộp thất bại');
            }
        } catch (err) {
            alert('Error: ' + String(err));
        } finally {
            setMerging(false);
        }
    };

    const toggleSelectUser = (id: string) => {
        setSelectedUsers(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc? Hành động này sẽ xóa user khỏi PostgreSQL và Neo4j.')) return;

        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                loadUsers();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert('Failed to delete user');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">System Users</h1>
                    <p className="text-gray-600 mt-2">Manage all users in the system</p>
                </div>
                <div className="flex gap-2">
                    {!mergeMode ? (
                        <button
                            onClick={() => setMergeMode(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                        >
                            Merge Users
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleMerge}
                                disabled={selectedUsers.length !== 2 || merging}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
                            >
                                {merging ? 'Merging...' : 'Execute Merge'}
                            </button>
                            <button
                                onClick={() => { setMergeMode(false); setSelectedUsers([]); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                        <Plus size={16} weight="bold" />
                        New User
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
                <input
                    type="text"
                    placeholder="Search by name, Zalo ID, or email..."
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading users...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No users found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {mergeMode && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Select</th>}
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Username</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Zalo ID</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user.id} className={`hover:bg-gray-50 ${selectedUsers.includes(user.id) ? 'bg-blue-50' : ''}`}>
                                        {mergeMode && (
                                            <td className="px-6 py-4 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.includes(user.id)}
                                                    onChange={() => toggleSelectUser(user.id)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            <div>{user.full_name || '-'}</div>
                                            <div className="text-xs text-gray-400">@{user.username || 'unregistered'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{user.zalo_id || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <span className="uppercase text-[10px] font-bold tracking-wider">{user.role}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(user)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                                >
                                                    <PencilSimple size={13} weight="bold" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                                >
                                                    <Trash size={13} weight="bold" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Create New User</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Zalo ID <span className="text-red-500">*</span></label>
                                <input
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newUser.zalo_id}
                                    onChange={e => setNewUser({ ...newUser, zalo_id: e.target.value })}
                                    placeholder="e.g. 0123456789"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Full Name</label>
                                <input
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newUser.full_name}
                                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newUser.phone}
                                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={creating || !newUser.zalo_id.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-xl font-bold">Edit User</h2>
                                <p className="text-xs text-gray-400 mt-0.5 font-mono">Zalo ID: {editingUser.zalo_id}</p>
                            </div>
                            <button
                                onClick={() => setEditingUser(null)}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={saving}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-500 lowercase tracking-wider">Username</label>
                                    <input
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editForm.username}
                                        onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                                        disabled={saving}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-500 lowercase tracking-wider">Role</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editForm.role}
                                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                        disabled={saving}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-500 lowercase tracking-wider">Update Password (leaver blank to keep current)</label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editForm.password}
                                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                    disabled={saving}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-500 lowercase tracking-wider">Full Name</label>
                                <input
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editForm.full_name}
                                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                    disabled={saving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-500 lowercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editForm.email}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    disabled={saving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editForm.phone}
                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    disabled={saving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Gender</label>
                                <select
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editForm.gender}
                                    onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                    disabled={saving}
                                >
                                    <option value="">-- Not specified --</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Note</label>
                                <textarea
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    value={editForm.note}
                                    onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                    disabled={saving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editForm.status}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })}
                                    disabled={saving}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    disabled={saving}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
