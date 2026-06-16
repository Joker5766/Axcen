'use client';

import React, { useState } from 'react';
import { 
  X, 
  GitBranch, 
  Calendar, 
  CheckSquare, 
  Square, 
  Copy, 
  Check, 
  Edit3, 
  Trash2,
  ListTodo,
  ChevronDown,
  GitMerge
} from 'lucide-react';
import { Node } from '@/types';
import { useNotification } from '@/contexts/NotificationContext';

interface NodeDetailsPanelProps {
  node: Node;
  projectId: string;
  branchName: string;
  onClose: () => void;
  onNodeUpdated: (updatedNode: Node) => void;
  onNodeDeleted: (nodeId: string) => void;
  onEditClick: () => void;
  allNodes?: Node[];
}

export default function NodeDetailsPanel({
  node,
  projectId,
  branchName,
  onClose,
  onNodeUpdated,
  onNodeDeleted,
  onEditClick,
  allNodes = [],
}: NodeDetailsPanelProps) {
  const { showConfirm, showToast } = useNotification();
  const [copiedCommit, setCopiedCommit] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Split states
  const [selectedCommitsToSplit, setSelectedCommitsToSplit] = useState<string[]>([]);
  const [newSplitTitle, setNewSplitTitle] = useState('');
  const [splitting, setSplitting] = useState(false);

  // Merge states
  const [showMergeSection, setShowMergeSection] = useState(false);
  const [selectedMergeTargetId, setSelectedMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  const handleCopyCommit = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedCommit(hash);
    setTimeout(() => setCopiedCommit(null), 2000);
  };

  const handleStatusChange = async (newStatus: Node['status']) => {
    setUpdating(true);
    setShowStatusDropdown(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        onNodeUpdated(data.node);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleTask = async (taskText: string, currentlyCompleted: boolean) => {
    let newCompleted = [...node.completedWork];
    let newPending = [...node.pendingWork];

    if (currentlyCompleted) {
      newCompleted = newCompleted.filter(t => t !== taskText);
      if (!newPending.includes(taskText)) {
        newPending.push(taskText);
      }
    } else {
      newPending = newPending.filter(t => t !== taskText);
      if (!newCompleted.includes(taskText)) {
        newCompleted.push(taskText);
      }
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedWork: newCompleted,
          pendingWork: newPending,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onNodeUpdated(data.node);
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteNode = async () => {
    const isConfirmed = await showConfirm('Are you sure you want to delete this development node?', { title: 'Delete Node', destructive: true });
    if (!isConfirmed) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes/${node.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onNodeDeleted(node.id);
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete node:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSplitCommits = async () => {
    if (selectedCommitsToSplit.length === 0 || !newSplitTitle.trim()) return;
    setSplitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          commitShas: selectedCommitsToSplit,
          newTitle: newSplitTitle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onNodeUpdated(data.originalNode);
        setSelectedCommitsToSplit([]);
        setNewSplitTitle('');
        onClose();
        window.location.reload();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to split cluster.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error splitting commits.', 'error');
    } finally {
      setSplitting(false);
    }
  };

  const handleMergeCluster = async () => {
    if (!selectedMergeTargetId) return;
    setMerging(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNodeId: node.id,
          targetNodeId: selectedMergeTargetId,
        }),
      });

      if (res.ok) {
        setShowMergeSection(false);
        setSelectedMergeTargetId('');
        onClose();
        window.location.reload();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to merge clusters.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error merging clusters.', 'error');
    } finally {
      setMerging(false);
    }
  };

  const getStatusBadge = (status: Node['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'NOT_STARTED':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const mergeableNodes = allNodes.filter(n => n.id !== node.id && n.branchId === node.branchId);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
      
      {/* Drawer Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Node Details</span>
          <h2 className="text-base font-bold text-slate-900 line-clamp-1 mt-0.5">{node.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        
        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs font-semibold text-slate-600">
          
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={updating}
                className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border text-left cursor-pointer transition-colors ${getStatusBadge(node.status)}`}
              >
                <span>{node.status.replace('_', ' ')}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 mt-1 z-50 w-full rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-slate-700">
                  {(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(st)}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 cursor-pointer font-semibold"
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branch</span>
            <div className="flex items-center gap-1.5 py-1.5 text-slate-800 font-mono">
              <GitBranch className="h-4 w-4 text-slate-400" />
              <span className="truncate">{branchName}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Author</span>
            <div className="flex items-center gap-2 py-1">
              <img 
                src={node.author.avatarUrl} 
                alt={node.author.name} 
                className="h-5 w-5 rounded-full border border-slate-200"
              />
              <span className="text-slate-800 truncate">{node.author.name}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created</span>
            <div className="flex items-center gap-1.5 py-1.5 text-slate-800">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>{new Date(node.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}</span>
            </div>
          </div>

        </div>

        {/* Associated Commits */}
        {node.relatedCommits.length > 0 && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-bold">Related Commits</span>
            <div className="space-y-2 border border-slate-100 rounded-xl bg-slate-50/20 p-3">
              {node.relatedCommits.map((hash) => {
                const commitInfo = node.githubCommits?.find(
                  (c) => c.sha === hash || c.sha.startsWith(hash)
                );

                const isCheckedForSplit = selectedCommitsToSplit.includes(hash);

                return (
                  <div key={hash} className="flex gap-2.5 p-2.5 border border-slate-100 bg-white rounded-lg shadow-xs items-start">
                    {node.relatedCommits.length > 1 && (
                      <input
                        type="checkbox"
                        checked={isCheckedForSplit}
                        onChange={() => {
                          if (isCheckedForSplit) {
                            setSelectedCommitsToSplit(selectedCommitsToSplit.filter((s) => s !== hash));
                          } else {
                            setSelectedCommitsToSplit([...selectedCommitsToSplit, hash]);
                          }
                        }}
                        className="rounded border-slate-300 text-slate-950 focus:ring-slate-900 mt-1 cursor-pointer h-4 w-4"
                        title="Select commit to split into a new cluster node"
                      />
                    )}

                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleCopyCommit(hash)}
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-[9.5px] font-mono font-semibold text-slate-600 transition-all cursor-pointer"
                          title="Click to copy commit hash"
                        >
                          {copiedCommit === hash ? (
                            <Check className="h-3 w-3 text-green-600 animate-in zoom-in-50" />
                          ) : (
                            <Copy className="h-3 w-3 text-slate-400" />
                          )}
                          <span>{hash.slice(0, 7)}</span>
                        </button>
                        
                        {commitInfo && (
                          <span className="text-[9.5px] text-slate-400 font-semibold">
                            {new Date(commitInfo.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        )}
                      </div>

                      {commitInfo ? (
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-800 leading-normal">{commitInfo.message}</p>
                          <p className="text-[9.5px] text-slate-400 font-semibold font-mono">by {commitInfo.author}</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-400 italic">Commit metadata not synced yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Split control box */}
              {selectedCommitsToSplit.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Split Cluster ({selectedCommitsToSplit.length} selected)</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="New cluster title..."
                      value={newSplitTitle}
                      onChange={(e) => setNewSplitTitle(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white focus:border-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSplitCommits}
                      disabled={splitting || !newSplitTitle.trim()}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {splitting ? 'Splitting...' : 'Split'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Summary</span>
          <div className="rounded-xl border border-slate-100 bg-slate-50/20 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
            {node.summary}
          </div>
        </div>

        {/* Tasks Checklist */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ListTodo className="h-4 w-4 text-slate-400" />
            Checklist / Tasks ({node.completedWork.length} of {node.completedWork.length + node.pendingWork.length} completed)
          </span>

          {node.completedWork.length === 0 && node.pendingWork.length === 0 ? (
            <p className="text-xs text-slate-400 italic font-medium">No tasks listed for this node.</p>
          ) : (
            <div className="space-y-2 border border-slate-100 rounded-xl bg-white p-4 shadow-sm">
              {node.pendingWork.map((task) => (
                <button
                  key={task}
                  disabled={updating}
                  onClick={() => handleToggleTask(task, false)}
                  className="flex items-start gap-2.5 w-full text-left py-1.5 text-slate-700 hover:text-slate-900 transition-colors text-xs font-semibold cursor-pointer"
                >
                  <Square className="h-4 w-4.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span>{task}</span>
                </button>
              ))}

              {node.completedWork.map((task) => (
                <button
                  key={task}
                  disabled={updating}
                  onClick={() => handleToggleTask(task, true)}
                  className="flex items-start gap-2.5 w-full text-left py-1.5 text-slate-400 hover:text-slate-600 transition-colors text-xs font-semibold cursor-pointer line-through"
                >
                  <CheckSquare className="h-4 w-4.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{task}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {node.notes && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notes</span>
            <div className="rounded-xl border border-slate-100 bg-slate-50/20 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
              {node.notes}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {node.nextSteps && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Steps</span>
            <div className="rounded-xl border border-slate-100 bg-slate-50/20 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
              {node.nextSteps}
            </div>
          </div>
        )}

      </div>

      {/* Drawer Action Footer */}
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
        
        {/* Merge section inline toggle */}
        {showMergeSection && (
          <div className="p-3 border border-slate-200 rounded-xl bg-white space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Merge into another node</span>
            <div className="flex gap-2">
              <select
                value={selectedMergeTargetId}
                onChange={(e) => setSelectedMergeTargetId(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-slate-800 focus:outline-none"
              >
                <option value="">Choose cluster...</option>
                {mergeableNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title} ({n.relatedCommits.length} commits)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleMergeCluster}
                disabled={merging || !selectedMergeTargetId}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer disabled:opacity-50"
              >
                {merging ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={handleDeleteNode}
            disabled={updating}
            className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Node
          </button>

          <div className="flex items-center gap-2">
            {mergeableNodes.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMergeSection(!showMergeSection)}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <GitMerge className="h-4 w-4" />
                Merge
              </button>
            )}

            <button
              type="button"
              onClick={onEditClick}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
            >
              <Edit3 className="h-4 w-4" />
              Edit Node
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
