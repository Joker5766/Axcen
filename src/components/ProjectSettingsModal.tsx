'use client';

import React, { useState, useEffect } from 'react';
import { X, Link2, Unlink, RefreshCw, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { GitHubRepository, GitHubRepo } from '@/types';
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

interface ProjectSettingsModalProps {
  projectId: string;
  githubRepository: GitHubRepository | null;
  onClose: () => void;
  onRepositoryUpdated: () => void;
}

export default function ProjectSettingsModal({
  projectId,
  githubRepository,
  onClose,
  onRepositoryUpdated,
}: ProjectSettingsModalProps) {
  const { showConfirm, showToast } = useNotification();
  const [gitHubConnected, setGitHubConnected] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Repo selection list states
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  
  // Action states
  const [linking, setLinking] = useState(false);
  const [syncingBranches, setSyncingBranches] = useState(false);
  const [syncingCommits, setSyncingCommits] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  
  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDeleteProject = async () => {
    const isConfirmed = await showConfirm('Are you sure you want to delete this project workspace? This action is permanent and will delete all nodes, branches, and timeline mappings. This cannot be undone.', { title: 'Delete Project', destructive: true });
    if (!isConfirmed) return;
    setDeletingProject(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Project workspace deleted successfully.', 'success');
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete project.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setDeletingProject(false);
    }
  };
 
  // Check auth and fetch user repositories if not linked
  const checkAuthAndLoadRepos = async () => {
    setCheckingAuth(true);
    setError(null);
    try {
      const statusRes = await fetch('/api/auth/github/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setGitHubConnected(statusData.connected);

        if (statusData.connected && !githubRepository) {
          // If GitHub connected and no repo linked, fetch the user's repos
          setReposLoading(true);
          const reposRes = await fetch(`/api/projects/${projectId}/github/repos`);
          if (reposRes.ok) {
            const reposData = await reposRes.json();
            setRepos(reposData.repos || []);
          } else {
            const errData = await reposRes.json();
            setError(errData.error || 'Failed to load user repositories from GitHub.');
          }
          setReposLoading(false);
        }
      } else {
        setError('Failed to check user GitHub account status.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuthAndLoadRepos();
  }, [projectId, githubRepository]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Repository analyzed successfully! Generated ${data.workItemsCount} work item nodes.`);
        onRepositoryUpdated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to analyze repository.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLinkRepository = async () => {
    if (!selectedRepoId) return;
    const selectedRepo = repos.find((r) => String(r.id) === selectedRepoId);
    if (!selectedRepo) return;

    setLinking(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/github/repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: selectedRepo.name,
          repoOwner: selectedRepo.owner.login,
          repoUrl: selectedRepo.html_url,
          defaultBranch: selectedRepo.default_branch,
        }),
      });

      if (res.ok) {
        setSuccess('Repository successfully linked to project!');
        onRepositoryUpdated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to link repository.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkRepository = async () => {
    const isConfirmed = await showConfirm('Are you sure you want to unlink this GitHub repository? Synced branch and commit records will remain in the database, but synchronization will be stopped.', { title: 'Unlink Repository' });
    if (!isConfirmed) return;
    setUnlinking(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/github/repository`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSuccess('Repository unlinked successfully.');
        setSelectedRepoId('');
        onRepositoryUpdated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to unlink repository.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setUnlinking(false);
    }
  };

  const handleSyncBranches = async () => {
    setSyncingBranches(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/github/sync/branches`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Branches synchronized successfully. Created ${data.createdCount} new branch nodes.`);
        onRepositoryUpdated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sync branches.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setSyncingBranches(false);
    }
  };

  const handleSyncCommits = async () => {
    setSyncingCommits(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/github/sync/commits`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        let msg = `Commits synchronized successfully. Fetched ${data.totalCommitsSynced} commits.`;
        if (data.errors && data.errors.length > 0) {
          msg += ` (Note: sync errors encountered on ${data.errors.length} branches)`;
        }
        setSuccess(msg);
        onRepositoryUpdated();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sync commits.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setSyncingCommits(false);
    }
  };

  const formatTimestamp = (tsStr: string | null) => {
    if (!tsStr) return 'Never';
    return new Date(tsStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-155">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-slate-800" />
            <h2 className="text-base font-bold text-slate-900">Project Integration Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3.5 flex gap-2.5 text-red-700 text-xs font-semibold">
            <AlertCircle className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="leading-normal">{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-green-50 border border-green-100 p-3.5 flex gap-2.5 text-green-700 text-xs font-semibold">
            <CheckCircle2 className="h-4.5 w-4.5 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="leading-normal">{success}</span>
          </div>
        )}

        {/* Content */}
        <div className="space-y-5 text-xs font-semibold text-slate-700">
          {checkingAuth ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"></div>
              <p className="text-xs text-slate-500 font-medium">Checking integration setup...</p>
            </div>
          ) : !gitHubConnected ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <Github className="h-6 w-6" />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-slate-900">GitHub Account Required</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  You need to connect your GitHub account in your personal settings before you can link a repository to this project workspace.
                </p>
              </div>
              <div className="pt-2">
                <p className="text-slate-400 text-[10px]">
                  Close this modal and click &quot;Settings&quot; in the upper right navbar to link your GitHub profile.
                </p>
              </div>
            </div>
          ) : githubRepository ? (
            /* Linked repo interface */
            <div className="space-y-6">
              
              {/* Linked repository info */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Repository</p>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                      <Github className="h-4 w-4 text-slate-700" />
                      {githubRepository.repoOwner}/{githubRepository.repoName}
                    </h4>
                  </div>
                  <a
                    href={githubRepository.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Open in GitHub"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] border-t border-slate-200/60 pt-3.5">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wide text-[9px]">Default Branch</span>
                    <span className="text-slate-800 font-mono">{githubRepository.defaultBranch}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wide text-[9px]">Workspace Project</span>
                    <span className="text-slate-800 truncate block">ID: {projectId.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-3.5 flex justify-end">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || syncingBranches || syncingCommits || unlinking}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10.5px] font-bold shadow transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {analyzing ? 'Analyzing...' : 'Analyze Repository'}
                  </button>
                </div>
              </div>

              {/* Sync controls */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Manual Synchronization</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Branch sync card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 flex flex-col justify-between shadow-sm">
                    <div className="space-y-1">
                      <span className="text-slate-800 font-bold block">Sync Branches</span>
                      <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                        Fetch all repository branches and automatically generate Branch Graph nodes.
                      </p>
                    </div>
                    <div className="space-y-2.5 pt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Synced: {formatTimestamp(githubRepository.lastBranchSync)}</span>
                      </div>
                      <button
                        onClick={handleSyncBranches}
                        disabled={syncingBranches || syncingCommits || unlinking}
                        className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingBranches ? 'animate-spin' : ''}`} />
                        {syncingBranches ? 'Syncing...' : 'Sync Branches'}
                      </button>
                    </div>
                  </div>

                  {/* Commit sync card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 flex flex-col justify-between shadow-sm">
                    <div className="space-y-1">
                      <span className="text-slate-800 font-bold block">Sync Commits</span>
                      <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                        Fetch commit metadata for all synchronized branches from GitHub.
                      </p>
                    </div>
                    <div className="space-y-2.5 pt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Synced: {formatTimestamp(githubRepository.lastCommitSync)}</span>
                      </div>
                      <button
                        onClick={handleSyncCommits}
                        disabled={syncingBranches || syncingCommits || unlinking}
                        className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingCommits ? 'animate-spin' : ''}`} />
                        {syncingCommits ? 'Syncing...' : 'Sync Commits'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={handleUnlinkRepository}
                  disabled={syncingBranches || syncingCommits || unlinking}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="h-4 w-4" />
                  {unlinking ? 'Unlinking...' : 'Disconnect Repository'}
                </button>
              </div>
            </div>
          ) : (
            /* Link repo interface */
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Repository to Link
                </label>
                {reposLoading ? (
                  <div className="flex items-center justify-center py-4 border border-slate-200 rounded-lg bg-slate-50/30">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800 mr-2"></span>
                    <span className="text-slate-500 font-medium">Fetching repositories...</span>
                  </div>
                ) : repos.length === 0 ? (
                  <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                    <p className="text-slate-400 italic">No repositories found in your GitHub account.</p>
                  </div>
                ) : (
                  <select
                    value={selectedRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2.5 px-3 bg-white text-slate-700 focus:border-slate-800 focus:outline-none transition-colors"
                  >
                    <option value="">Choose a repository...</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name} ({r.private ? 'private' : 'public'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-normal font-medium">
                Linking a repository imports its branches and commits. This allows you to attach individual commit logs directly into development graph nodes.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkRepository}
                  disabled={linking || !selectedRepoId}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Link2 className="h-4 w-4" />
                  {linking ? 'Linking...' : 'Link Repository'}
                </button>
              </div>
            </div>
          )}
          {/* Danger Zone */}
          <div className="border-t border-red-100 pt-5 mt-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-red-500">Danger Zone</h3>
            <div className="p-4 rounded-xl border border-red-200 bg-red-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-red-950 font-bold block text-xs">Delete Project Workspace</span>
                <p className="text-[10.5px] text-red-700/80 font-medium leading-normal max-w-sm">
                  Permanently delete this project workspace, including all nodes, synced commits, branches, and timeline history. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={handleDeleteProject}
                disabled={deletingProject}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-center"
              >
                {deletingProject ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
