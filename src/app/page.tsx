'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/UserContext';
import { 
  GitBranch, 
  FolderPlus, 
  Users, 
  Clock, 
  ExternalLink,
  Search,
  LogOut,
  FolderOpen,
  Activity as ActivityIcon,
  ChevronRight,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import UserSettingsModal from '@/components/UserSettingsModal';

interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: {
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string;
    };
  }[];
  branches: {
    id: string;
    name: string;
  }[];
}

interface Activity {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  entityType: string;
  entityName: string;
  createdAt: string;
  project: {
    name: string;
  };
  user: {
    name: string;
    avatarUrl: string;
  };
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<{ id: string; name: string }[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  
  // Create Project State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // User Settings Modal State
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);

  // Protect route
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);

        // Aggregate activities from all projects
        const allActivities: Activity[] = [];
        data.projects?.forEach((proj: { name: string; activities?: Omit<Activity, 'project'>[] }) => {
          if (proj.activities) {
            proj.activities.forEach((act: Omit<Activity, 'project'>) => {
              allActivities.push({
                ...act,
                project: { name: proj.name }
              } as Activity);
            });
          }
        });
        
        // Sort aggregated activities by date desc
        allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActivities(allActivities.slice(0, 15));
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Load recently viewed projects from local storage
      const cached = localStorage.getItem('axon_recent_projects');
      if (cached) {
        try {
          setRecentlyViewed(JSON.parse(cached));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [user]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newProjectName.trim()) {
      setCreateError('Project name is required.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc,
        }),
      });

      const data = await res.json();
      if (res.ok && data.project) {
        // Clear forms and close modal
        setNewProjectName('');
        setNewProjectDesc('');
        setShowCreateModal(false);
        // Refresh list
        fetchData();
        // Redirect to project workspace
        router.push(`/projects/${data.project.id}`);
      } else {
        setCreateError(data.error || 'Failed to create project.');
      }
    } catch (err) {
      setCreateError('An unexpected error occurred.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800"></div>
          <p className="text-sm text-slate-500 font-medium">Loading Axon...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top Navbar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <GitBranch className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">Axon</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
              <img 
                src={user.avatarUrl} 
                alt={user.name} 
                className="h-8 w-8 rounded-full border border-slate-200"
              />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-800 leading-none">{user.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
              </div>
            </div>

            <button 
              onClick={() => setShowUserSettingsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button 
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Workspaces Area (3 Columns wide on large screens) */}
        <section className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
              <p className="text-sm text-slate-500 mt-1">Select a workspace to track development milestones</p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 self-start sm:self-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow transition-colors cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
              New Project
            </button>
          </div>

          {/* Search bar */}
          <div className="relative rounded-lg shadow-sm max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Project List */}
          {projectsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse"></div>
              <div className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse"></div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No projects found</h3>
              <p className="mt-2 text-sm text-slate-500 max-w-xs">
                {searchQuery ? 'No projects match your search criteria.' : 'Create a new project to start tracking your development progress.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow transition-colors cursor-pointer"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-slate-900 group-hover:text-slate-950 transition-colors">
                      {project.name}
                    </h3>
                    <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-2 min-h-[40px]">
                    {project.description || 'No description provided.'}
                  </p>
                  
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{project.members.length} {project.members.length === 1 ? 'member' : 'members'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span>{project.branches.length} {project.branches.length === 1 ? 'branch' : 'branches'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Sidebar Panel (1 Column wide on large screens) */}
        <aside className="lg:col-span-1 space-y-6">
          
          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                Recent Workspaces
              </h2>
              <div className="space-y-1">
                {recentlyViewed.map((recent) => (
                  <Link
                    key={recent.id}
                    href={`/projects/${recent.id}`}
                    className="flex items-center justify-between p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-medium transition-colors"
                  >
                    <span className="truncate">{recent.name}</span>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <ActivityIcon className="h-4 w-4 text-slate-400" />
              Recent Updates
            </h2>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 font-medium">No recent activities.</p>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div key={act.id} className="flex gap-3 text-xs">
                    <img 
                      src={act.user.avatarUrl} 
                      alt={act.user.name} 
                      className="h-7 w-7 rounded-full border border-slate-100 flex-shrink-0"
                    />
                    <div className="space-y-1">
                      <p className="text-slate-700 leading-normal">
                        <span className="font-semibold text-slate-900">{act.user.name}</span>{' '}
                        {act.action === 'created' ? 'created project' : act.action}{' '}
                        <span className="font-semibold text-slate-900">
                          {act.entityName}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 text-slate-400 font-medium">
                        <span>{act.project.name}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(act.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Create New Project</h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100 font-medium">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Food Delivery App"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Description
                </label>
                <textarea
                  placeholder="Briefly describe the purpose of this project..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {createSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* User Settings Modal */}
      {showUserSettingsModal && (
        <UserSettingsModal onClose={() => setShowUserSettingsModal(false)} />
      )}
    </div>
  );
}
