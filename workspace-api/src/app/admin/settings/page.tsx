'use client';

import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Copy, 
  ArrowsClockwise, 
  Eye, 
  EyeSlash, 
  CheckCircle, 
  LockOpen,
  WarningCircle
} from '@phosphor-icons/react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (settings?.api_token) {
      navigator.clipboard.writeText(settings.api_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReroll = async () => {
    setRerolling(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reroll_token' })
      });
      const data = await res.json();
      if (data.success) {
        setSettings({ ...settings, api_token: data.api_token });
        setShowConfirm(false);
      }
    } catch (error) {
      console.error('Failed to reroll token:', error);
    } finally {
      setRerolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">User Settings</h2>
        <p className="text-gray-500 mt-2">Manage your account preferences and security credentials.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            <div className="px-6 pb-6 -mt-12">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center text-blue-600">
                  <span className="text-3xl font-bold">{settings?.full_name?.charAt(0) || 'U'}</span>
                </div>
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-bold text-gray-900">{settings?.full_name}</h3>
                <p className="text-sm text-gray-500">{settings?.email || 'No email provided'}</p>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold uppercase">{settings?.role}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{settings?.status === 'active' ? 'Active Account' : 'Inactive'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API Token Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                  <Key size={24} weight="duotone" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Personal Access Token</h3>
                  <p className="text-sm text-gray-500">Use this token to authenticate with the Zalo Permission API.</p>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm break-all flex items-center justify-between gap-4">
                <div className="flex-1 overflow-x-auto">
                  {showToken ? (
                    <span className="text-gray-800">{settings?.api_token}</span>
                  ) : (
                    <span className="text-gray-400">••••••••••••••••••••••••••••••••••••••••••••••••</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setShowToken(!showToken)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors shadow-sm border border-transparent hover:border-gray-100"
                    title={showToken ? "Hide Token" : "Show Token"}
                  >
                    {showToken ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                  <button 
                    onClick={copyToClipboard}
                    className={`p-2 rounded-lg transition-all shadow-sm border border-transparent hover:border-gray-100 ${copied ? 'bg-green-50 text-green-600' : 'text-gray-500 hover:text-blue-600 hover:bg-white'}`}
                    title="Copy to Clipboard"
                  >
                    {copied ? <CheckCircle size={18} weight="fill" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              {copied && (
                <div className="absolute -top-10 right-0 animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <div className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg">
                    Copied to clipboard!
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-md">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <WarningCircle size={16} className="text-amber-500" />
                    Regenerate Token
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Regenerating will invalidate your current token. Any services or scripts using the old token will stop working.
                  </p>
                </div>
                <button 
                  onClick={() => setShowConfirm(true)}
                  className="px-6 py-2.5 bg-white border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowsClockwise size={18} weight="bold" className={rerolling ? 'animate-spin' : ''} />
                  Reroll Token
                </button>
              </div>
            </div>
          </div>

          {/* API Info Card */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-8 text-white">
            <div className="flex items-center gap-3 mb-4 text-blue-400">
              <LockOpen size={24} weight="duotone" />
              <h4 className="text-lg font-bold">How to use</h4>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              Add the following header to your API requests to authenticate:
            </p>
            <div className="bg-black/30 rounded-xl p-4 font-mono text-sm border border-white/10">
              <span className="text-indigo-400">Authorization:</span> <span className="text-green-400">Bearer {settings?.api_token?.substring(0, 10)}...</span>
            </div>
            <div className="mt-6 flex gap-4">
              <a href="/API_DOCUMENTATION" className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-4">Read Documentation</a>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <ArrowsClockwise size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Are you absolutely sure?</h3>
            <p className="text-gray-500 mt-3 leading-relaxed">
              This action cannot be undone. Your current token will be deactivated immediately and you will need to update all your API integrations.
            </p>
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-6 py-3 bg-gray-50 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleReroll}
                disabled={rerolling}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rerolling && <ArrowsClockwise size={18} className="animate-spin" />}
                Yes, Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
