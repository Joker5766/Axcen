'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/UserContext';
import { 
  ArrowLeft, 
  GitBranch, 
  Users, 
  Activity as ActivityIcon, 
  Search, 
  UserPlus, 
  Plus, 
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

// Shared Types
import { User, ProjectMember, Branch, Node, Relationship, Activity } from '@/types';

// Components
import BranchGraph from '@/components/BranchGraph';
import BranchDetailGraph from '@/components/BranchDetailGraph';
import NodeDetailsPanel from '@/components/NodeDetailsPanel';

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Unwrap params
  const [projectId, setProjectId] = useState<string | null>(null);

  // Core Project Workspace State
  const [project, setProject] = useState<any | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    nodes: any[];
    branches: any[];
    members: any[];
  } | null>(null);
  const [searching, setSearching] = useState(false);

  // Modal Control States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<'create' | 'edit'>('create');

  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchParentId, setNewBranchParentId] = useState('');
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [branchError, setBranchError] = useState('');

  // Node form states
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeStatus, setNodeStatus] = useState<Node['status']>('NOT_STARTED');
  const [nodeBranchId, setNodeBranchId] = useState('');
  const [nodeSummary, setNodeSummary] = useState('');
  const [nodeNotes, setNodeNotes] = useState('');
  const [nodeNextSteps, setNodeNextSteps] = useState('');
  const [nodeCommitsInput, setNodeCommitsInput] = useState(''); // Comma separated hashes
  const [nodeCompletedTasks, setNodeCompletedTasks] = useState<string[]>([]);
  const [nodePendingTasks, setNodePendingTasks] = useState<string[]>([]);
  const [nodeParentLinks, setNodeParentLinks] = useState<string[]>([]); // node relationships
  const [nodeError, setNodeError] = useState('');
  const [nodeSubmitting, setNodeSubmitting] = useState(false);

  // New task temp input fields
  const [tempCompTask, setTempCompTask] = useState('');
  const [tempPendTask, setTempPendTask] = useState('');

  // Unwrap params
  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  // Route protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load workspace details
  const fetchWorkspace = async (pId: string) => {
    try {
      const res = await fetch(`/api/projects/${pId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setMembers(data.project.members || []);
        setBranches(data.project.branches || []);
        setNodes(data.nodes || []);
        setRelationships(data.relationships || []);
        setActivities(data.project.activities || []);

        // Save active branch selection (default to main, then first branch, or null)
        if (!activeBranchId && data.project.branches && data.project.branches.length > 0) {
          const mainBranch = data.project.branches.find((b: any) => b.name === 'main');
          setActiveBranchId(mainBranch ? mainBranch.id : data.project.branches[0].id);
        }

        // Cache recently viewed workspaces in local storage
        const cacheRaw = localStorage.getItem('axon_recent_projects');
        let currentCache: { id: string; name: string }[] = [];
        if (cacheRaw) {
          try {
            currentCache = JSON.parse(cacheRaw);
          } catch (e) {}
        }
        // Filter out current project, prepend, limit to 5
        currentCache = currentCache.filter((item) => item.id !== pId);
        currentCache.unshift({ id: pId, name: data.project.name });
        localStorage.setItem('axon_recent_projects', JSON.stringify(currentCache.slice(0, 5)));

      } else {
        const errData = await res.json();
        setPageError(errData.error || 'Failed to load project workspace.');
      }
    } catch (err) {
      setPageError('Connection error, please reload page.');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (user && projectId) {
      fetchWorkspace(projectId);
    }
  }, [user, projectId]);

  // Global search trigger
  useEffect(() => {
    const triggerSearch = async () => {
      if (!searchQuery.trim() || !projectId) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      triggerSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, projectId]);

  // Handlers
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    if (!inviteEmail.trim() || !projectId) return;

    setInviteSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (res.ok && data.member) {
        setMembers([...members, data.member]);
        setInviteEmail('');
        setShowInviteModal(false);
        // Refresh workspace activities
        fetchWorkspace(projectId);
      } else {
        setInviteError(data.error || 'Failed to invite user.');
      }
    } catch (err) {
      setInviteError('Connection error.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchError('');
    if (!newBranchName.trim() || !projectId) return;

    setBranchSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBranchName,
          parentBranchId: newBranchParentId || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.branch) {
        setBranches([...branches, data.branch]);
        setActiveBranchId(data.branch.id); // select newly created branch
        setNewBranchName('');
        setNewBranchParentId('');
        setShowBranchModal(false);
        fetchWorkspace(projectId);
      } else {
        setBranchError(data.error || 'Failed to create branch.');
      }
    } catch (err) {
      setBranchError('Connection error.');
    } finally {
      setBranchSubmitting(false);
    }
  };

  const openCreateNodeModal = () => {
    setNodeModalMode('create');
    setNodeTitle('');
    setNodeStatus('NOT_STARTED');
    setNodeBranchId(activeBranchId || '');
    setNodeSummary('');
    setNodeNotes('');
    setNodeNextSteps('');
    setNodeCommitsInput('');
    setNodeCompletedTasks([]);
    setNodePendingTasks([]);
    setNodeParentLinks([]);
    setNodeError('');
    setShowNodeModal(true);
  };

  const openEditNodeModal = (node: Node) => {
    setNodeModalMode('edit');
    setNodeTitle(node.title);
    setNodeStatus(node.status);
    setNodeBranchId(node.branchId);
    setNodeSummary(node.summary);
    setNodeNotes(node.notes || '');
    setNodeNextSteps(node.nextSteps || '');
    setNodeCommitsInput(node.relatedCommits.join(', '));
    setNodeCompletedTasks(node.completedWork);
    setNodePendingTasks(node.pendingWork);
    
    // Find parents for this node
    const parents = relationships
      .filter((r) => r.toNodeId === node.id)
      .map((r) => r.fromNodeId);
    setNodeParentLinks(parents);

    setNodeError('');
    setShowNodeModal(true);
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setNodeError('');

    if (!nodeTitle.trim() || !nodeBranchId || !nodeSummary.trim() || !projectId) {
      setNodeError('Please fill in Title, Branch, and Summary.');
      return;
    }

    const commits = nodeCommitsInput
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    setNodeSubmitting(true);
    
    const payload = {
      title: nodeTitle,
      status: nodeStatus,
      branchId: nodeBranchId,
      summary: nodeSummary,
      notes: nodeNotes,
      nextSteps: nodeNextSteps,
      relatedCommits: commits,
      completedWork: nodeCompletedTasks,
      pendingWork: nodePendingTasks,
      parentNodes: nodeParentLinks,
    };

    try {
      const url = nodeModalMode === 'create'
        ? `/api/projects/${projectId}/nodes`
        : `/api/projects/${projectId}/nodes/${selectedNode?.id}`;
      
      const method = nodeModalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.node) {
        setShowNodeModal(false);
        
        // Update selection if editing
        if (nodeModalMode === 'edit') {
          setSelectedNode(data.node);
        }

        // Reload fresh data from database
        fetchWorkspace(projectId);
      } else {
        setNodeError(data.error || 'Failed to save node.');
      }
    } catch (err) {
      setNodeError('Connection error.');
    } finally {
      setNodeSubmitting(false);
    }
  };

  const addCompletedTask = () => {
    if (tempCompTask.trim() && !nodeCompletedTasks.includes(tempCompTask.trim())) {
      setNodeCompletedTasks([...nodeCompletedTasks, tempCompTask.trim()]);
      setTempCompTask('');
    }
  };

  const addPendingTask = () => {
    if (tempPendTask.trim() && !nodePendingTasks.includes(tempPendTask.trim())) {
      setNodePendingTasks([...nodePendingTasks, tempPendTask.trim()]);
      setTempPendTask('');
    }
  };

  // Node panel updates callback
  const handleNodeUpdated = (updatedNode: Node) => {
    setNodes(nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    setSelectedNode(updatedNode);
  };

  const handleNodeDeleted = (deletedId: string) => {
    setNodes(nodes.filter((n) => n.id !== deletedId));
    setRelationships(relationships.filter((r) => r.fromNodeId !== deletedId && r.toNodeId !== deletedId));
    setSelectedNode(null);
  };

  // Format Helper
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Filtering nodes for currently selected branch
  const activeBranchNodes = nodes.filter((n) => n.branchId === activeBranchId);
  const activeBranch = branches.find((b) => b.id === activeBranchId);

  if (loading || !user || pageLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800"></div>
          <p className="text-sm text-slate-500 font-medium">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-50 p-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h3 className="mt-4 text-lg font-bold text-slate-900">Workspace Error</h3>
        <p className="mt-2 text-sm text-slate-500 text-center max-w-sm">{pageError}</p>
        <Link 
          href="/" 
          className="mt-6 flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold shadow-xs transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen relative">
      
      {/* Upper Workspace Nav Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-950 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">{project?.name}</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">
              Workspace
            </span>
          </div>
        </div>

        {/* Global Search and Invite */}
        <div className="flex items-center gap-3 self-stretch md:self-auto">
          {/* Search container */}
          <div className="relative rounded-lg shadow-sm flex-1 md:flex-initial md:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search workspace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
            />

            {/* Floating Search Results */}
            {searchQuery.trim() && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-xl border border-slate-200 bg-white shadow-xl max-h-[300px] overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Search Results</span>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>

                {searching ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">Searching...</p>
                ) : !searchResults || (searchResults.nodes.length === 0 && searchResults.branches.length === 0 && searchResults.members.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">No results found.</p>
                ) : (
                  <div className="space-y-4 text-xs font-semibold text-slate-700">
                    {/* Node matches */}
                    {searchResults.nodes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nodes</span>
                        {searchResults.nodes.map((nd) => (
                          <button
                            key={nd.id}
                            onClick={() => {
                              setSelectedNode(nd);
                              setSearchQuery('');
                            }}
                            className="w-full text-left p-1.5 rounded-lg hover:bg-slate-50 block truncate"
                          >
                            {nd.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Branch matches */}
                    {searchResults.branches.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branches</span>
                        {searchResults.branches.map((br) => (
                          <button
                            key={br.id}
                            onClick={() => {
                              setActiveBranchId(br.id);
                              setSearchQuery('');
                            }}
                            className="w-full text-left p-1.5 rounded-lg hover:bg-slate-50 block truncate"
                          >
                            {br.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Pane */}
      <div className="flex-1 flex flex-col lg:flex-row h-full">
        
        {/* Left Side: Members list and Activity Log */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-6 flex flex-col gap-6 flex-shrink-0">
          
          {/* Members widget */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-400" />
              Members ({members.length})
            </h2>
            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1 font-semibold">
              {members.map((mem) => (
                <div key={mem.id} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={mem.user.avatarUrl} 
                      alt={mem.user.name} 
                      className="h-6 w-6 rounded-full border border-slate-100"
                    />
                    <div className="truncate max-w-[150px]">
                      <p className="text-slate-800 truncate leading-none">{mem.user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{mem.user.email}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                    mem.role === 'OWNER' 
                      ? 'bg-slate-100 border-slate-200 text-slate-600'
                      : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}>
                    {mem.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace feed widget */}
          <div className="space-y-4 flex-1 flex flex-col min-h-[220px]">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <ActivityIcon className="h-4 w-4 text-slate-400" />
              Workspace Feed
            </h2>
            
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6 font-semibold">No recent updates.</p>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1 max-h-[400px] lg:max-h-none pr-1">
                {activities.map((act) => (
                  <div key={act.id} className="flex gap-2.5 text-[11px] leading-relaxed">
                    <img 
                      src={act.user.avatarUrl} 
                      alt={act.user.name} 
                      className="h-6 w-6 rounded-full border border-slate-100 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-slate-700">
                        <span className="font-bold text-slate-900">{act.user.name}</span>{' '}
                        {act.action === 'created' ? 'created project' : act.action}{' '}
                        <span className="font-bold text-slate-900">{act.entityName}</span>
                      </p>
                      <span className="text-[9px] font-semibold text-slate-400">{formatTimeAgo(act.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right / Center Canvas (Main Graph Workspace) */}
        <main className="flex-1 flex flex-col p-6 gap-6 bg-slate-50 overflow-hidden">
          
          {/* Top Half: Branch Graph */}
          <BranchGraph 
            branches={branches}
            activeBranchId={activeBranchId}
            onSelectBranch={(id) => {
              setActiveBranchId(id);
              setSelectedNode(null); // Clear selected node on branch switch
            }}
            onCreateBranchClick={() => setShowBranchModal(true)}
          />

          {/* Bottom Half: Branch Detail Graph */}
          <BranchDetailGraph 
            nodes={activeBranchNodes}
            relationships={relationships}
            activeNodeId={selectedNode?.id || null}
            onSelectNode={(node) => setSelectedNode(node)}
            onCreateNodeClick={openCreateNodeModal}
            branchName={activeBranch ? activeBranch.name : 'Unknown'}
          />

        </main>
      </div>

      {/* Slide-over details drawer panel */}
      {selectedNode && activeBranch && (
        <NodeDetailsPanel 
          node={selectedNode}
          projectId={projectId || ''}
          branchName={activeBranch.name}
          onClose={() => setSelectedNode(null)}
          onNodeUpdated={handleNodeUpdated}
          onNodeDeleted={handleNodeDeleted}
          onEditClick={() => openEditNodeModal(selectedNode)}
        />
      )}

      {/* Modal 1: Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-5 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Invite Team Member</h2>
              <button 
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              {inviteError && (
                <div className="rounded-lg bg-red-50 p-3 text-[10px] text-red-600 border border-red-100 font-semibold">
                  {inviteError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="developer@team.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {inviteSubmitting ? 'Inviting...' : 'Invite Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-5 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Create New Branch</h2>
              <button 
                onClick={() => {
                  setShowBranchModal(false);
                  setBranchError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              {branchError && (
                <div className="rounded-lg bg-red-50 p-3 text-[10px] text-red-600 border border-red-100 font-semibold">
                  {branchError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. feature/auth-refactor"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Parent Branch (Optional)
                </label>
                <select
                  value={newBranchParentId}
                  onChange={(e) => setNewBranchParentId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-700 bg-white focus:border-slate-800 focus:outline-none transition-colors"
                >
                  <option value="">No parent (Root Branch)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchModal(false);
                    setBranchError('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={branchSubmitting}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {branchSubmitting ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create / Edit Node Modal */}
      {showNodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                {nodeModalMode === 'create' ? 'Create Development Node' : 'Edit Development Node'}
              </h2>
              <button 
                onClick={() => {
                  setShowNodeModal(false);
                  setNodeError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNode} className="space-y-4 text-xs font-semibold text-slate-700">
              {nodeError && (
                <div className="rounded-lg bg-red-50 p-3 text-[10px] text-red-600 border border-red-100 font-semibold">
                  {nodeError}
                </div>
              )}

              {/* Title & Status Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Login API Integration"
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors"
                  />
                </div>
                
                <div className="col-span-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                  <select
                    value={nodeStatus}
                    onChange={(e) => setNodeStatus(e.target.value as Node['status'])}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-700 bg-white focus:border-slate-800 focus:outline-none transition-colors"
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>

              {/* Branch Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch</label>
                <select
                  value={nodeBranchId}
                  onChange={(e) => setNodeBranchId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-700 bg-white focus:border-slate-800 focus:outline-none transition-colors"
                >
                  <option value="" disabled>Select Branch...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Related Commits */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Related Commits (comma separated hashes, optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5d8fa23, b8a34d2"
                  value={nodeCommitsInput}
                  onChange={(e) => setNodeCommitsInput(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors font-mono"
                />
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Summary</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain what has been built or updated..."
                  value={nodeSummary}
                  onChange={(e) => setNodeSummary(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Task list builders */}
              <div className="grid grid-cols-2 gap-4">
                {/* Completed tasks builder */}
                <div className="space-y-2 border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Completed Work</label>
                  
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Add completed task..."
                      value={tempCompTask}
                      onChange={(e) => setTempCompTask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCompletedTask();
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] bg-white text-slate-900 focus:border-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCompletedTask}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <ul className="space-y-1 max-h-[80px] overflow-y-auto text-[10px]">
                    {nodeCompletedTasks.map((t, idx) => (
                      <li key={idx} className="flex items-center justify-between p-1 bg-white border border-slate-100 rounded text-slate-700 font-semibold">
                        <span className="truncate flex-1 pr-1">{t}</span>
                        <button
                          type="button"
                          onClick={() => setNodeCompletedTasks(nodeCompletedTasks.filter((item) => item !== t))}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pending tasks builder */}
                <div className="space-y-2 border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending Work</label>
                  
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Add pending task..."
                      value={tempPendTask}
                      onChange={(e) => setTempPendTask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addPendingTask();
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] bg-white text-slate-900 focus:border-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addPendingTask}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <ul className="space-y-1 max-h-[80px] overflow-y-auto text-[10px]">
                    {nodePendingTasks.map((t, idx) => (
                      <li key={idx} className="flex items-center justify-between p-1 bg-white border border-slate-100 rounded text-slate-700 font-semibold">
                        <span className="truncate flex-1 pr-1">{t}</span>
                        <button
                          type="button"
                          onClick={() => setNodePendingTasks(nodePendingTasks.filter((item) => item !== t))}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Node Relationships: Parent Links selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Prerequisites / Connected From (Parent Node Linkage)
                </label>
                <div className="border border-slate-200 rounded-lg p-2 max-h-[80px] overflow-y-auto space-y-1 bg-white">
                  {nodes
                    .filter((nd) => nd.id !== selectedNode?.id) // Prevent self linkages
                    .map((nd) => {
                      const isChecked = nodeParentLinks.includes(nd.id);
                      return (
                        <label key={nd.id} className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setNodeParentLinks(nodeParentLinks.filter((id) => id !== nd.id));
                              } else {
                                setNodeParentLinks([...nodeParentLinks, nd.id]);
                              }
                            }}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span className="truncate font-semibold text-slate-700">{nd.title}</span>
                          <span className="text-[9px] text-slate-400 font-mono">({branches.find((b) => b.id === nd.branchId)?.name})</span>
                        </label>
                      );
                    })}
                  {nodes.filter((nd) => nd.id !== selectedNode?.id).length === 0 && (
                    <p className="text-[10px] text-slate-400 italic font-semibold">No nodes available to link.</p>
                  )}
                </div>
              </div>

              {/* Notes & Next Steps */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Additional context, links, details..."
                    value={nodeNotes}
                    onChange={(e) => setNodeNotes(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors resize-none font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next Steps (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="What should be worked on next..."
                    value={nodeNextSteps}
                    onChange={(e) => setNodeNextSteps(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-slate-800 focus:outline-none transition-colors resize-none font-semibold"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowNodeModal(false);
                    setNodeError('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nodeSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {nodeSubmitting ? 'Saving...' : 'Save Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
