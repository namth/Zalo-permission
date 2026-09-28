'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, User, Eye, EyeSlash, ShieldCheck } from '@phosphor-icons/react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/admin/dashboard';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push(from);
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

      <div className="w-full max-w-md relative z-10 p-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4 border border-blue-500/30">
              <ShieldCheck size={36} weight="duotone" className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">Secure access to Zalo Permission Admin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Username / Email / Zalo ID</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3.5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="Enter your identifier"
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
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-12 py-3.5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-gray-500 text-sm">
              Don't have an account? <Link href="/register" className="text-blue-400 hover:underline">Sign Up</Link>
            </p>
            <p className="text-gray-500 text-xs mt-4 uppercase tracking-widest font-medium opacity-50">
              System Support
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
