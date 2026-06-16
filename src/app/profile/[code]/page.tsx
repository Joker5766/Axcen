'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  GitBranch, 
  Folder, 
  GitCommit, 
  Code2, 
  Users, 
  ExternalLink, 
  Calendar,
  CircleDot
} from 'lucide-react';
import Link from 'next/link';

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
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

interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  membersCount: number;
  branchesCount: number;
  repo: string | null;
}

interface RepositoryInfo {
  id: string;
  name: string;
  owner: string;
  url: string;
  defaultBranch: string;
}

interface ProfileData {
  user: {
    name: string;
    avatarUrl: string;
    createdAt: string;
    githubUsername: string | null;
    profileCode: string | null;
    bannerGradient: string | null;
  };
  stats: {
    totalProjects: number;
    totalRepos: number;
    totalCommits: number;
    totalNodes: number;
  };
  skills: string[];
  projects: ProjectInfo[];
  repositories: RepositoryInfo[];
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const [profileCode, setProfileCode] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Unwrap params
  useEffect(() => {
    params.then((p) => setProfileCode(p.code));
  }, [params]);

  const fetchPublicProfile = async (code: string) => {
    try {
      const res = await fetch(`/api/profile/public/${code}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch public profile details.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileCode) {
      fetchPublicProfile(profileCode);
    }
  }, [profileCode]);

  if (loading || !profileCode || !profile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800"></div>
          <p className="text-sm text-slate-500 font-medium animate-pulse">Loading Public Profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center space-y-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-155">
          <p className="text-sm font-semibold text-red-500">{error}</p>
          <Link 
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const user = profile.user;
  const stats = profile.stats;
  const skills = profile.skills;
  const projects = profile.projects;
  const repositories = profile.repositories;

  const joinedDate = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'N/A';

  const currentBanner = user.bannerGradient || 'from-slate-900 via-slate-950 to-slate-900';

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="group flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900">Developer Profile</span>
              <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-50 border border-indigo-150 text-indigo-600 px-2 py-0.5 rounded-full">
                Public View
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Home Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-200">
        
        {/* Profile Card Header */}
        <section className={`relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br ${currentBanner} p-8 text-white shadow-lg`}>
          <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-white/5 to-transparent blur-2xl rounded-full" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-gradient-to-tr from-white/5 to-transparent blur-2xl rounded-full" />
          
          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <img 
              src={user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix'} 
              alt={user.name} 
              className="h-24 w-24 rounded-full border-2 border-white/20 shadow-md flex-shrink-0 object-cover"
            />
            
            <div className="space-y-4 flex-1">
              <div>
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 justify-center md:justify-start">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{user.name}</h1>
                  {user.githubUsername && (
                    <div className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-slate-300">
                      <Github className="h-3 w-3" />
                      <span>{user.githubUsername}</span>
                    </div>
                  )}
                </div>
              </div>

              {user.profileCode && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-slate-200">
                  <span className="text-slate-400 font-medium">Profile ID:</span>
                  <span className="font-bold text-white font-mono">{user.profileCode}</span>
                </div>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 text-xs text-slate-300 border-t border-white/5 pt-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Joined {joinedDate}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5 text-slate-400" />
                  <span>Verified Developer</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Projects Onboarded', value: stats.totalProjects, icon: Folder, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Repos Connected', value: stats.totalRepos, icon: Github, color: 'text-sky-600 bg-sky-50' },
            { label: 'Commits Tracked', value: stats.totalCommits, icon: GitCommit, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Milestones Created', value: stats.totalNodes, icon: CircleDot, color: 'text-amber-600 bg-amber-50' }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div 
                key={i} 
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-slate-300 transition-all duration-200"
              >
                <div className={`p-3 rounded-xl ${stat.color} flex-shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider leading-none">{stat.label}</p>
                  <p className="text-xl md:text-2xl font-extrabold text-slate-800 mt-1">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </section>

        {/* Skill Set Tag Section */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Code2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Developer Skill Set</h2>
          </div>
          {skills.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs italic font-medium">
              No tech stack tags detected.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((tech) => (
                <span 
                  key={tech}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all duration-150 shadow-sm cursor-default"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Projects and Repos lists layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Projects Column */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Workspaces ({projects.length})</h2>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
              {projects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                  No active workspaces onboarded.
                </div>
              ) : (
                projects.map((proj) => (
                  <div 
                    key={proj.id}
                    className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all duration-200 flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                          {proj.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Created {new Date(proj.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {proj.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2 mt-1">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-semibold">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>{proj.membersCount}</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold">
                          <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                          <span>{proj.branchesCount}</span>
                        </span>
                      </div>

                      {proj.repo && (
                        <div className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md truncate max-w-[200px]">
                          <Github className="h-3 w-3" />
                          <span className="truncate">{proj.repo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Repositories Column */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Connected Repositories ({repositories.length})</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
              {repositories.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                  No GitHub repositories connected.
                </div>
              ) : (
                repositories.map((repo) => (
                  <div 
                    key={repo.id}
                    className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all duration-200 flex items-center justify-between gap-4 group"
                  >
                    <div className="truncate space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {repo.owner}/{repo.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Default branch: <span className="font-bold text-slate-500">{repo.defaultBranch}</span>
                      </p>
                    </div>

                    <a 
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-all shadow-sm cursor-pointer"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

      </main>
    </div>
  );
}
