
'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/services/user.service'; // Start using types from service if possible, or define here

// Define type locally if import fails or as good practice for client component independence
interface User {
    id: string;
    zalo_id: string;
    full_name: string;
    email: string;
    phone: string;
    status: 'active' | 'inactive';
    created_at: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [newUser, setNewUser] = useState({ zalo_id: '', full_name: '', email: '', phone: '' });

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
        try {
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
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This will delete the user from PostgreSQL and Neo4j.')) return;

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
                <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    + New User
                </button>
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
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Full Name</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Zalo ID</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{user.zalo_id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{user.email || '-'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm space-x-3">
                                            <button className="text-blue-600 hover:underline">Edit</button>
                                            <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:underline">Delete</button>
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Create New User</h2>
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
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
