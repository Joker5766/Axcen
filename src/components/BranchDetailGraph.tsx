'use client';

import React from 'react';
import { Plus, CheckCircle2, Circle, HelpCircle } from 'lucide-react';
import { Node, Relationship } from '@/types';

interface BranchDetailGraphProps {
  nodes: Node[];
  relationships: Relationship[];
  activeNodeId: string | null;
  onSelectNode: (node: Node) => void;
  onCreateNodeClick: () => void;
  branchName: string;
}

export default function BranchDetailGraph({
  nodes,
  relationships,
  activeNodeId,
  onSelectNode,
  onCreateNodeClick,
  branchName,
}: BranchDetailGraphProps) {
  
  // 1. Layout nodes in columns and rows dynamically
  const computeLayout = () => {
    if (nodes.length === 0) return { positionedNodes: [], svgWidth: 800, svgHeight: 250 };

    const nodeIds = new Set(nodes.map(n => n.id));
    const columns: Record<string, number> = {};
    
    // Initialize columns at 0
    nodes.forEach(n => {
      columns[n.id] = 0;
    });

    // Relax columns based on relationships
    for (let run = 0; run < nodes.length; run++) {
      let changed = false;
      relationships.forEach(rel => {
        if (nodeIds.has(rel.fromNodeId) && nodeIds.has(rel.toNodeId)) {
          const fromCol = columns[rel.fromNodeId];
          const toCol = columns[rel.toNodeId];
          if (toCol <= fromCol) {
            columns[rel.toNodeId] = fromCol + 1;
            changed = true;
          }
        }
      });
      if (!changed) break;
    }

    // Group nodes by column
    const colGroups: Record<number, string[]> = {};
    nodes.forEach(n => {
      const col = columns[n.id];
      if (!colGroups[col]) colGroups[col] = [];
      colGroups[col].push(n.id);
    });

    // Space parameters
    const nodeWidth = 220;
    const nodeHeight = 100;
    const colWidth = 300;
    const rowHeight = 140;
    const paddingX = 40;
    const paddingY = 40;

    let maxCol = 0;
    let maxRowSize = 0;

    const positions: Record<string, { x: number; y: number }> = {};
    
    Object.keys(colGroups).forEach(colStr => {
      const col = parseInt(colStr);
      if (col > maxCol) maxCol = col;
      
      const ids = colGroups[col];
      if (ids.length > maxRowSize) maxRowSize = ids.length;

      ids.forEach((id, row) => {
        positions[id] = {
          x: paddingX + col * colWidth,
          y: paddingY + row * rowHeight,
        };
      });
    });

    const positionedNodes = nodes.map(n => ({
      ...n,
      x: positions[n.id]?.x || paddingX,
      y: positions[n.id]?.y || paddingY,
      width: nodeWidth,
      height: nodeHeight,
    }));

    const svgWidth = Math.max(900, paddingX * 2 + (maxCol + 1) * colWidth);
    const svgHeight = Math.max(250, paddingY * 2 + maxRowSize * rowHeight);

    return { positionedNodes, svgWidth, svgHeight };
  };

  const { positionedNodes, svgWidth, svgHeight } = computeLayout();

  // Find relationships to draw
  const activeNodeIds = new Set(nodes.map(n => n.id));
  const connections = relationships
    .filter(rel => activeNodeIds.has(rel.fromNodeId) && activeNodeIds.has(rel.toNodeId))
    .map(rel => {
      const from = positionedNodes.find(n => n.id === rel.fromNodeId)!;
      const to = positionedNodes.find(n => n.id === rel.toNodeId)!;
      return {
        fromId: rel.fromNodeId,
        toId: rel.toNodeId,
        fromX: from.x + from.width,
        fromY: from.y + from.height / 2,
        toX: to.x,
        toY: to.y + to.height / 2,
      };
    });

  const getStatusStyle = (status: Node['status']) => {
    switch (status) {
      case 'COMPLETED':
        return {
          bg: 'bg-green-50 text-green-700 border-green-200',
          dot: 'bg-green-500',
          icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
        };
      case 'IN_PROGRESS':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          icon: <Circle className="h-4 w-4 text-blue-500 animate-pulse" />
        };
      case 'NOT_STARTED':
      default:
        return {
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          dot: 'bg-slate-400',
          icon: <HelpCircle className="h-4 w-4 text-slate-400" />
        };
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col flex-1">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">{branchName}</span>
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Development Nodes</h2>
        </div>
        <button
          onClick={onCreateNodeClick}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Node
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 min-h-[300px] bg-slate-50/40 relative">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 font-medium">
            <p className="text-sm">No development nodes on this branch yet.</p>
            <button
              onClick={onCreateNodeClick}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-white text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add first node
            </button>
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
                  id="arrow-node"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
              </defs>
              {connections.map((conn, idx) => {
                const midX = (conn.fromX + conn.toX) / 2;
                const pathData = `M ${conn.fromX} ${conn.fromY} C ${midX} ${conn.fromY}, ${midX} ${conn.toY}, ${conn.toX} ${conn.toY}`;
                return (
                  <path
                    key={idx}
                    d={pathData}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="1.75"
                    markerEnd="url(#arrow-node)"
                    className="transition-all"
                  />
                );
              })}
            </svg>

            {/* Render positioned nodes */}
            {positionedNodes.map(node => {
              const statusStyle = getStatusStyle(node.status);
              const totalTasks = node.completedWork.length + node.pendingWork.length;
              const isSelected = node.id === activeNodeId;

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                  }}
                  className={`flex flex-col justify-between p-4 rounded-xl border bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all select-none cursor-pointer ${
                    isSelected ? 'ring-2 ring-slate-800 border-transparent shadow-sm' : 'border-slate-200'
                  }`}
                >
                  {/* Top row: Status & Author */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${statusStyle.bg}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}></span>
                      {node.status.replace('_', ' ')}
                    </span>
                    <img 
                      src={node.author.avatarUrl} 
                      alt={node.author.name} 
                      title={node.author.name}
                      className="h-5 w-5 rounded-full border border-slate-100"
                    />
                  </div>

                  {/* Node Title */}
                  <h3 className="font-bold text-xs text-slate-800 line-clamp-1 mt-1">
                    {node.title}
                  </h3>

                  {/* Task counts & Date */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-2">
                    <span>
                      {totalTasks > 0 
                        ? `${node.completedWork.length}/${totalTasks} tasks`
                        : 'No tasks'
                      }
                    </span>
                    <span>
                      {new Date(node.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
