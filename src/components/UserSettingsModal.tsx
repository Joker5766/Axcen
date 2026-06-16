'use client';

import React, { useState, useEffect } from 'react';
import { X, Link2, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

interface UserSettingsModalProps {
  onClose: () => void;
}

export default function UserSettingsModal({ onClose }: UserSettingsModalProps) {
  const { showConfirm, showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/github/status');
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        setUsername(data.githubUsername);
        setAvatarUrl(data.avatarUrl);
      } else {
        setError('Failed to load GitHub status.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = () => {
    // Redirect browser to initiate OAuth flow
    window.location.href = '/api/auth/github';
  };

  const handleDisconnect = async () => {
    const isConfirmed = await showConfirm('Are you sure you want to disconnect your GitHub account? This will prevent you from syncing repository changes.', { title: 'Disconnect GitHub' });
    if (!isConfirmed) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/github/disconnect', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to disconnect GitHub account.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-155">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-slate-800" />
            <h2 className="text-base font-bold text-slate-900">User Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"></div>
              <p className="text-xs text-slate-500 font-medium">Checking GitHub connection...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex gap-3 text-red-700 text-xs font-semibold">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-bold">Error</p>
                <p className="mt-1 font-medium text-red-600">{error}</p>
                <button 
                  onClick={fetchStatus}
                  className="mt-2 text-red-700 hover:text-red-900 underline font-bold"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : connected ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={username || 'GitHub User'} 
                    className="h-12 w-12 rounded-full border border-slate-300"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <Github className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connected Account</p>
                  <p className="text-sm font-extrabold text-slate-900 truncate mt-0.5">@{username}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-green-600 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Authorized</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Your GitHub account is connected. You can now link repositories inside project workspaces and synchronize branches and commits.
                </p>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="h-4 w-4" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <Github className="h-6 w-6" />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-slate-900">Connect GitHub Account</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Link your GitHub account to connect repositories, import development branches, and attach commit logs directly to development nodes.
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={handleConnect}
                  className="flex items-center justify-center gap-2 w-full max-w-xs px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
                >
                  <Link2 className="h-4 w-4" />
                  Connect GitHub Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
