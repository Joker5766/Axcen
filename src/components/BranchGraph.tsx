'use client';

import React from 'react';
import { GitBranch, Plus } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  parentBranchId: string | null;
}

interface BranchGraphProps {
  branches: Branch[];
  activeBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
  onCreateBranchClick: () => void;
}

interface TreeItem extends Branch {
  depth: number;
  row: number;
  children: TreeItem[];
}

export default function BranchGraph({
  branches,
  activeBranchId,
  onSelectBranch,
  onCreateBranchClick,
}: BranchGraphProps) {
  
  // 1. Build a helper tree from branches
  const buildTree = (): { items: TreeItem[]; maxDepth: number; maxRow: number } => {
    if (branches.length === 0) return { items: [], maxDepth: 0, maxRow: 0 };

    // Find main/root branch first, default to first branch if none matches
    const mainBranch = branches.find(b => b.name === 'main') || branches.find(b => !b.parentBranchId) || branches[0];
    
    const branchMap = new Map<string, Branch>();
    branches.forEach(b => branchMap.set(b.id, b));

    // To prevent cycle-based hangs, keep track of visited ids
    const visited = new Set<string>();
    const treeItems: TreeItem[] = [];
    let currentRow = 0;
    let maxDepth = 0;

    const traverse = (branch: Branch, depth: number): TreeItem => {
      visited.add(branch.id);
      if (depth > maxDepth) maxDepth = depth;
      
      const item: TreeItem = {
        ...branch,
        depth,
        row: currentRow++,
        children: [],
      };
      
      // Find direct children
      const children = branches.filter(b => b.parentBranchId === branch.id);
      children.forEach(child => {
        if (!visited.has(child.id)) {
          item.children.push(traverse(child, depth + 1));
        }
      });

      return item;
    };

    const rootItem = traverse(mainBranch, 0);
    treeItems.push(rootItem);

    // Pick up orphaned branches (unreachable from main)
    branches.forEach(b => {
      if (!visited.has(b.id)) {
        treeItems.push(traverse(b, 0));
      }
    });

    return { items: treeItems, maxDepth, maxRow: currentRow };
  };

  const { items: treeItems, maxDepth, maxRow } = buildTree();

  // Graph spacing params
  const nodeWidth = 200;
  const nodeHeight = 40;
  const colWidth = 240;
  const rowHeight = 70;
  const paddingX = 40;
  const paddingY = 40;

  // Flatten the tree items to render them
  const flatNodes: { id: string; name: string; x: number; y: number; active: boolean }[] = [];
  const lines: { fromX: number; fromY: number; toX: number; toY: number }[] = [];

  const fillRenderData = (item: TreeItem) => {
    const x = paddingX + item.depth * colWidth;
    const y = paddingY + item.row * rowHeight;
    flatNodes.push({
      id: item.id,
      name: item.name,
      x,
      y,
      active: item.id === activeBranchId,
    });

    item.children.forEach(child => {
      const childX = paddingX + child.depth * colWidth;
      const childY = paddingY + child.row * rowHeight;
      lines.push({
        fromX: x + 100, // center of parent node (width is ~180-200)
        fromY: y + nodeHeight / 2,
        toX: childX, // start of child node
        toY: childY + nodeHeight / 2,
      });
      fillRenderData(child);
    });
  };

  treeItems.forEach(root => fillRenderData(root));

  // Determine container dimensions
  const svgWidth = Math.max(800, paddingX * 2 + (maxDepth + 1) * colWidth);
  const svgHeight = Math.max(160, paddingY * 2 + maxRow * rowHeight);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4.5 w-4.5 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Branch Graph</h2>
        </div>
        <button
          onClick={onCreateBranchClick}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Branch
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 min-h-[180px] bg-slate-50/40 relative">
        {branches.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 font-medium">
            No branches found.
          </div>
        ) : (
          <div style={{ width: svgWidth, height: svgHeight }} className="relative">
            {/* SVG Connecting Tracks */}
            <svg
              style={{ width: svgWidth, height: svgHeight }}
              className="absolute inset-0 pointer-events-none"
            >
              <defs>
                <marker
                  id="arrow-branch"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
              </defs>
              {lines.map((line, idx) => {
                // Beautiful cubic bezier curve linking parent to child
                const midX = (line.fromX + line.toX) / 2;
                const pathData = `M ${line.fromX} ${line.fromY} C ${midX} ${line.fromY}, ${midX} ${line.toY}, ${line.toX} ${line.toY}`;
                return (
                  <path
                    key={idx}
                    d={pathData}
                    fill="none"
                    stroke="#cbd5e1" // slate-300
                    strokeWidth="2"
                    markerEnd="url(#arrow-branch)"
                    strokeDasharray="4 2"
                    className="transition-all"
                  />
                );
              })}
            </svg>

            {/* Flat branch badge items */}
            {flatNodes.map(node => (
              <button
                key={node.id}
                onClick={() => onSelectBranch(node.id)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: nodeWidth - 20,
                  height: nodeHeight,
                }}
                className={`flex items-center gap-2 px-3 rounded-lg border text-xs font-semibold shadow-xs select-none transition-all duration-150 cursor-pointer ${
                  node.active
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm scale-102'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <GitBranch className={`h-4 w-4 ${node.active ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate flex-1 text-left">{node.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
