'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/UserContext';
import { 
  ArrowLeft, 
  GitBranch, 
  Folder, 
  GitCommit, 
  Code2, 
  Users, 
  ExternalLink, 
  Calendar,
  RefreshCw,
  CircleDot,
  Camera,
  Palette,
  EyeOff,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import AxcenLoader from '@/components/AxcenLoader';
import { useNotification } from '@/contexts/NotificationContext';

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
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    createdAt: string;
    githubUsername: string | null;
    profileCode: string | null;
    bannerGradient: string | null;
    isProfilePrivate: boolean;
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

const PRESET_AVATARS = [
  { name: 'Felix', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
  { name: 'Aneka', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka' },
  { name: 'Robert', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Robert' },
  { name: 'Bot 1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Axcen1' },
  { name: 'Bot 2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Axcen2' },
  { name: 'Coder', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Coder' }
];

const PRESET_GRADIENTS = [
  { name: 'Midnight Slate', value: 'from-slate-900 via-slate-950 to-slate-900' },
  { name: 'Indigo Dream', value: 'from-indigo-900 via-slate-900 to-violet-950' },
  { name: 'Sunset Crimson', value: 'from-rose-950 via-slate-900 to-amber-950' },
  { name: 'Emerald Forest', value: 'from-emerald-950 via-slate-900 to-teal-950' },
  { name: 'Ocean Aurora', value: 'from-cyan-950 via-slate-900 to-blue-950' },
  { name: 'Neon Violet', value: 'from-purple-950 via-slate-900 to-fuchsia-950' }
];

export default function ProfilePage() {
  const { user: authUser, loading: authLoading, refreshUser } = useAuth();
  const { showConfirm, showToast } = useNotification();
  const router = useRouter();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Avatar edit states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Banner customize states
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [updatingBanner, setUpdatingBanner] = useState(false);
  const [bannerError, setBannerError] = useState('');

  // Search Profiles states
  const [searchCode, setSearchCode] = useState('');
  const [searchError, setSearchError] = useState('');

  const fetchProfile = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch profile details.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
      return;
    }
    if (authUser) {
      fetchProfile();
    }
  }, [authUser, authLoading, router]);

  const handleUpdateAvatar = async (urlToUse: string) => {
    if (!urlToUse.trim()) return;
    setPhotoError('');
    setUpdatingPhoto(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: urlToUse }),
      });
      if (res.ok) {
        setShowPhotoModal(false);
        setNewAvatarUrl('');
        await fetchProfile();
        await refreshUser();
      } else {
        const data = await res.json();
        setPhotoError(data.error || 'Failed to update profile picture.');
      }
    } catch (err) {
      setPhotoError('Connection error.');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleUpdateBanner = async (gradientToUse: string) => {
    setBannerError('');
    setUpdatingBanner(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerGradient: gradientToUse }),
      });
      if (res.ok) {
        setShowBannerModal(false);
        await fetchProfile();
        await refreshUser();
      } else {
        const data = await res.json();
        setBannerError(data.error || 'Failed to update banner style.');
      }
    } catch (err) {
      setBannerError('Connection error.');
    } finally {
      setUpdatingBanner(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    if (type === 'avatar') {
      setPhotoError('');
      setUpdatingPhoto(true);
    } else {
      setBannerError('');
      setUpdatingBanner(true);
    }

    try {
      const uploadRes = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Upload failed.');
      }

      // Apply uploaded URL to profile settings
      const patchRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          type === 'avatar' 
            ? { avatarUrl: uploadData.url } 
            : { bannerGradient: uploadData.url }
        ),
      });

      if (!patchRes.ok) {
        const patchData = await patchRes.json();
        throw new Error(patchData.error || 'Failed to update profile.');
      }

      showToast(`${type === 'avatar' ? 'Profile photo' : 'Banner image'} uploaded successfully!`, 'success');
      if (type === 'avatar') {
        setShowPhotoModal(false);
      } else {
        setShowBannerModal(false);
      }
      await fetchProfile();
      await refreshUser();
    } catch (err: any) {
      if (type === 'avatar') {
        setPhotoError(err.message || 'Upload failed.');
      } else {
        setBannerError(err.message || 'Upload failed.');
      }
    } finally {
      if (type === 'avatar') {
        setUpdatingPhoto(false);
      } else {
        setUpdatingBanner(false);
      }
    }
  };

  const handleTogglePrivacy = async (privateVal: boolean) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isProfilePrivate: privateVal }),
      });
      if (res.ok) {
        showToast(`Profile is now ${privateVal ? 'Private' : 'Public'}.`, 'success');
        await fetchProfile();
        await refreshUser();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to toggle privacy.', 'error');
      }
    } catch (e) {
      showToast('Connection error.', 'error');
    }
  };

  const handleSearchProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    const code = searchCode.trim();
    if (!code) return;

    try {
      const res = await fetch(`/api/profile/public/${code}`);
      if (res.ok) {
        router.push(`/profile/${code}`);
      } else {
        setSearchError('Profile code not found.');
      }
    } catch (err) {
      setSearchError('Connection error.');
    }
  };

  if (authLoading || (loading && !profile)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <AxcenLoader text="Loading Profile..." />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center space-y-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-semibold text-red-500">{error}</p>
          <button 
            onClick={fetchProfile}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const user = profile?.user;
  const stats = profile?.stats;
  const skills = profile?.skills || [];
  const projects = profile?.projects || [];
  const repositories = profile?.repositories || [];

  const joinedDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'N/A';

  const currentBanner = user?.bannerGradient || 'from-slate-900 via-slate-950 to-slate-900';
  const isGradient = currentBanner.startsWith('from-') || currentBanner.startsWith('bg-');
  const bannerStyle = isGradient ? {} : { backgroundImage: `url(${currentBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  const bannerClassName = isGradient ? `bg-gradient-to-br ${currentBanner}` : 'bg-slate-900';

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
            </div>
          </div>

          <button
            onClick={fetchProfile}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-200">
        
        {/* Profile Card Header */}
        <section 
          style={bannerStyle}
          className={`relative overflow-hidden rounded-3xl border border-slate-200/80 p-8 text-white shadow-lg ${bannerClassName}`}
        >
          <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-white/5 to-transparent blur-2xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-gradient-to-tr from-white/5 to-transparent blur-2xl rounded-full pointer-events-none" />
          
          {/* Customize Banner Button */}
          <button 
            onClick={() => setShowBannerModal(true)}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm transition-all cursor-pointer shadow-sm z-10"
            title="Customize Profile Banner"
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Customize Banner</span>
          </button>

          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            {/* Avatar Section with Overlay Edit */}
            <div 
              onClick={() => setShowPhotoModal(true)}
              className="relative group/avatar cursor-pointer shrink-0 rounded-full border-2 border-white/20 shadow-md overflow-hidden"
              title="Change Profile Photo"
            >
              <img 
                src={user?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix'} 
                alt={user?.name} 
                className="h-24 w-24 rounded-full object-cover group-hover/avatar:opacity-60 transition-opacity"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/50">
                <Camera className="h-4 w-4 text-white" />
                <span className="text-[8px] text-white font-bold uppercase tracking-wider mt-0.5">Edit</span>
              </div>
            </div>
            
            <div className="space-y-4 flex-1">
              <div>
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 justify-center md:justify-start">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{user?.name}</h1>
                  {user?.githubUsername && (
                    <div className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-slate-300 self-center">
                      <Github className="h-3 w-3" />
                      <span>{user.githubUsername}</span>
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
              </div>

              {/* Unique Profile ID & Privacy Switch */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 shadow-inner backdrop-blur-sm">
                  <span className="text-slate-400 font-medium">Profile ID:</span>
                  <span className="font-bold text-white font-mono">{user?.profileCode || 'axc-assigning'}</span>
                  <button 
                    onClick={() => {
                      if (user?.profileCode) {
                        navigator.clipboard.writeText(user.profileCode);
                        showToast('Shareable Profile ID copied to clipboard!', 'success');
                      }
                    }}
                    className="ml-1 hover:text-white text-slate-400 font-bold transition-colors cursor-pointer text-[10px] uppercase tracking-wider bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded"
                  >
                    Copy
                  </button>
                </div>

                {/* Privacy checkbox switch */}
                <label className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer backdrop-blur-sm hover:bg-white/15 transition-all select-none">
                  {user?.isProfilePrivate ? (
                    <EyeOff className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-indigo-400" />
                  )}
                  <span className="font-medium">Private Profile</span>
                  <input
                    type="checkbox"
                    checked={user?.isProfilePrivate || false}
                    onChange={(e) => handleTogglePrivacy(e.target.checked)}
                    className="ml-1.5 h-3.5 w-3.5 rounded text-slate-800 border-white/20 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 text-xs text-slate-300 border-t border-white/5 pt-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Joined {joinedDate}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5 text-slate-400" />
                  <span>Developer Account</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Projects Onboarded', value: stats?.totalProjects || 0, icon: Folder, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Repos Connected', value: stats?.totalRepos || 0, icon: Github, color: 'text-sky-600 bg-sky-50' },
            { label: 'Commits Tracked', value: stats?.totalCommits || 0, icon: GitCommit, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Milestones Created', value: stats?.totalNodes || 0, icon: CircleDot, color: 'text-amber-600 bg-amber-50' }
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

        {/* Skill Set & Profile Search row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Tech Stack / Skillset Tag Section (2/3 width on desktop) */}
          <section className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Code2 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Detected Skill Set</h2>
            </div>
            {skills.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs italic font-medium">
                No tech stack tags detected. Analysis runs on package.json, requirements.txt, and pom.xml during repository onboarding or refresh.
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

          {/* Search Profiles Card (1/3 width on desktop) */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Find Developer Profiles</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Enter another developer's unique Shareable ID to view their development statistics and tech stacks.
              </p>
              
              <form onSubmit={handleSearchProfile} className="space-y-3">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="e.g. axc-1234abcd"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Search
                  </button>
                </div>
                {searchError && (
                  <p className="text-[10px] text-red-500 font-semibold">{searchError}</p>
                )}
              </form>
            </div>
          </section>

        </div>

        {/* Projects and Repos lists layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Projects Column */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Active Workspaces ({projects.length})</h2>
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
                        <Link 
                          href={`/projects/${proj.id}`}
                          className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors truncate max-w-[200px]"
                        >
                          {proj.name}
                        </Link>
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
                        <div className="flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md transition-colors truncate max-w-[200px]">
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

      {/* Edit Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Edit Profile Photo</h2>
              <button 
                onClick={() => {
                  setShowPhotoModal(false);
                  setPhotoError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Preset Avatars</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((avatar) => (
                    <button
                      key={avatar.name}
                      onClick={() => handleUpdateAvatar(avatar.url)}
                      disabled={updatingPhoto}
                      className="rounded-full border border-slate-200 hover:border-indigo-600 overflow-hidden hover:scale-105 transition-all p-0.5 bg-slate-50 cursor-pointer disabled:opacity-50"
                      title={avatar.name}
                    >
                      <img src={avatar.url} alt={avatar.name} className="h-10 w-10 rounded-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload file from PC */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">OR UPLOAD FILE</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upload from PC</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'avatar')}
                  disabled={updatingPhoto}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer disabled:opacity-50"
                />
              </div>

              {/* Paste URL */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">OR IMAGE URL</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  handleUpdateAvatar(newAvatarUrl); 
                }} 
                className="space-y-4"
              >
                {photoError && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100 font-medium">
                    {photoError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Image URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/avatar.png"
                    value={newAvatarUrl}
                    onChange={(e) => setNewAvatarUrl(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPhotoModal(false);
                      setPhotoError('');
                    }}
                    className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingPhoto}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {updatingPhoto ? 'Saving...' : 'Save Photo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Customize Banner Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Customize Banner Style</h2>
              <button 
                onClick={() => {
                  setShowBannerModal(false);
                  setBannerError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {bannerError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100 font-medium">
                  {bannerError}
                </div>
              )}

              {/* Gradients presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Preset Gradients</label>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_GRADIENTS.map((grad) => (
                    <button
                      key={grad.name}
                      onClick={() => handleUpdateBanner(grad.value)}
                      disabled={updatingBanner}
                      className={`h-16 rounded-xl bg-gradient-to-br ${grad.value} border border-white/10 hover:border-slate-800 hover:scale-[1.02] transition-all p-3 text-left flex flex-col justify-end text-white cursor-pointer disabled:opacity-50 shadow-sm`}
                    >
                      <span className="text-[10px] font-extrabold tracking-tight">{grad.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* File upload banner */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">OR UPLOAD BANNER</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upload Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'banner')}
                  disabled={updatingBanner}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer disabled:opacity-50"
                />
              </div>

              {/* Banner URL paste */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">OR BANNER URL</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  const target = e.currentTarget.elements.namedItem('bannerUrl') as HTMLInputElement;
                  handleUpdateBanner(target.value); 
                }} 
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Banner Image URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      name="bannerUrl"
                      required
                      placeholder="https://example.com/banner.png"
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={updatingBanner}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </form>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowBannerModal(false);
                    setBannerError('');
                  }}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
