'use client';

import React from 'react';

interface AxcenLoaderProps {
  text?: string;
}

export default function AxcenLoader({ text = 'Loading Axcen...' }: AxcenLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <div className="relative flex items-center justify-center h-16 w-32 shrink-0">
        {/* Branch Lines */}
        <div className="absolute h-[2px] w-24 bg-slate-200" />
        <div className="absolute h-[2px] w-14 left-4 top-1/2 -translate-y-1/2 rotate-[35deg] bg-slate-200 origin-left" />
        
        {/* Animated Nodes (Git node branch style) */}
        {/* Node 1 (Root) */}
        <div className="absolute left-4 h-3.5 w-3.5 rounded-full bg-slate-900 border-2 border-white shadow-sm animate-pulse" />
        
        {/* Node 2 (Branch Node - pulses later) */}
        <div className="absolute left-16 top-3.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm animate-bounce [animation-delay:0.15s]" />
        
        {/* Node 3 (Mainline Commit) */}
        <div className="absolute left-16 top-[31px] h-3 w-3 rounded-full bg-violet-600 border-2 border-white shadow-sm animate-bounce [animation-delay:0.3s]" />
        
        {/* Node 4 (Merged/End Commit) */}
        <div className="absolute right-4 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm animate-ping [animation-delay:0.45s]" />
      </div>
      
      <p className="text-xs text-slate-400 font-bold tracking-widest uppercase animate-pulse select-none font-sans">
        {text}
      </p>
    </div>
  );
}
