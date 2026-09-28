'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, User, Envelope, UserPlus, ShieldCheck } from '@phosphor-icons/react';

function RegisterContent() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, full_name: fullName, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden">
      {/* Background blobs for premium look */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md relative z-10 p-4 pt-10 pb-10">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4 border border-blue-500/30">
              <UserPlus size={36} weight="duotone" className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-gray-400">Join the Zalo Permission platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="Choose a username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <ShieldCheck size={20} />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <Envelope size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
